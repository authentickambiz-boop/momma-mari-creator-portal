import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorCalendars, creatorNotifications, creators, deals, deliverableDates, deliverableNudges } from "@/db/schema";
import { createApprovalEmail, BRAND_EMAIL_SENDER } from "./approvals";
import { canSeeDeal } from "./authz";
import { nowIso } from "./format";
import { assertStaffAccess } from "./managers";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type DeliverableKind = "draft" | "post";
export type NudgeChannel = "portal" | "queue";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDeliverableKind(value: string): value is DeliverableKind {
  return value === "draft" || value === "post";
}

export function isIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function kindLabel(kind: DeliverableKind) {
  return kind === "draft" ? "draft" : "post";
}

async function allowedToEdit(db: PortalDb, dealCreatorId: string, actor: { email: string; role: string }) {
  if (actor.role === "admin" || actor.role === "bot") return { ok: true as const };
  if (actor.role === "manager") {
    return assertStaffAccess(db, {
      actorEmail: actor.email,
      actorRole: "manager",
      creatorId: dealCreatorId,
      permission: "stage",
    });
  }
  return { ok: false as const, status: 403, error: "You can't change due dates." };
}

export async function saveDeliverableDate(
  db: PortalDb,
  input: { dealId: string; kind: string; dueOn: string; actorEmail: string; actorRole: string },
): Promise<Result<{ id: string; dueOn: string; remindOn: string }>> {
  if (!isDeliverableKind(input.kind)) return { ok: false, status: 400, error: "That date needs to be a draft or a post." };
  if (!isIsoDate(input.dueOn)) return { ok: false, status: 400, error: "Use a date like 2026-10-21." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const allowed = await allowedToEdit(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
  if (!allowed.ok) return allowed;
  const timestamp = nowIso();
  const existing = await db
    .select()
    .from(deliverableDates)
    .where(and(eq(deliverableDates.dealId, deal.id), eq(deliverableDates.kind, input.kind)));
  const id = existing[0]?.id ?? crypto.randomUUID();
  if (existing[0]) {
    await db.update(deliverableDates).set({ dueOn: input.dueOn, updatedAt: timestamp }).where(eq(deliverableDates.id, id));
    if (existing[0].dueOn !== input.dueOn) {
      await db.delete(deliverableNudges).where(and(eq(deliverableNudges.dealId, deal.id), eq(deliverableNudges.kind, input.kind)));
    }
  } else {
    await db.insert(deliverableDates).values({
      id,
      dealId: deal.id,
      kind: input.kind,
      dueOn: input.dueOn,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return { ok: true, id, dueOn: input.dueOn, remindOn: addDays(input.dueOn, -3) };
}

export type CalendarItem = {
  id: string;
  dealId: string;
  brand: string;
  kind: DeliverableKind;
  dueOn: string;
  remindOn: string;
};

export async function listCalendar(db: PortalDb, viewer: Viewer): Promise<CalendarItem[]> {
  const rows = await db.select().from(deliverableDates);
  const dealRows = await db.select().from(deals);
  const byId = new Map(dealRows.map((deal) => [deal.id, deal]));
  return rows.flatMap((row) => {
    const deal = byId.get(row.dealId);
    if (!deal || !isDeliverableKind(row.kind)) return [];
    if (!canSeeDeal(viewer, deal)) return [];
    return [{
      id: row.id,
      dealId: deal.id,
      brand: deal.brand,
      kind: row.kind,
      dueOn: row.dueOn,
      remindOn: addDays(row.dueOn, -3),
    }];
  }).sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.brand.localeCompare(right.brand));
}

export async function setCalendarConnected(
  db: PortalDb,
  actor: { role: string; creatorId?: string | null },
  connected: boolean,
): Promise<Result<{ connected: boolean }>> {
  if (actor.role !== "creator" || !actor.creatorId) {
    return { ok: false, status: 403, error: "You can only connect your own calendar." };
  }
  const timestamp = nowIso();
  const existing = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, actor.creatorId));
  if (existing[0]) {
    await db.update(creatorCalendars).set({ connected, updatedAt: timestamp }).where(eq(creatorCalendars.creatorId, actor.creatorId));
  } else {
    await db.insert(creatorCalendars).values({ creatorId: actor.creatorId, connected, updatedAt: timestamp });
  }
  return { ok: true, connected };
}

export async function calendarConnected(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, creatorId));
  return Boolean(rows[0]?.connected);
}

export async function buildCalendarFeed(db: PortalDb, viewer: Viewer): Promise<Result<{ filename: string; body: string }>> {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false, status: 403, error: "Creators connect their own calendar." };
  }
  if (!(await calendarConnected(db, viewer.creatorId))) {
    return { ok: false, status: 403, error: "Connect your calendar first. Nothing was downloaded." };
  }
  const items = await listCalendar(db, viewer);
  const events = items.map((item) => {
    const stamp = item.dueOn.replaceAll("-", "");
    const summary = item.kind === "draft" ? `Draft due: ${item.brand}` : `Post due: ${item.brand}`;
    return [
      "BEGIN:VEVENT",
      `UID:${item.kind}-${item.dealId}.mommamari`,
      `DTSTART;VALUE=DATE:${stamp}`,
      `SUMMARY:${summary}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Momma Mari//Portal//EN", ...events, "END:VCALENDAR"].join("\r\n");
  return { ok: true, filename: "momma-mari-dates.ics", body };
}

export async function runDeliverableNudges(
  db: PortalDb,
  input: { today: string; channel: string; actorRole: string },
): Promise<Result<{ nudged: { dealId: string; kind: DeliverableKind; channel: NudgeChannel; approvalId: string | null }[] }>> {
  if (input.actorRole !== "bot" && input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only the bot or an owner can run reminders." };
  }
  if (!isIsoDate(input.today)) return { ok: false, status: 400, error: "Use a date like 2026-10-21." };
  if (input.channel !== "portal" && input.channel !== "queue") {
    return { ok: false, status: 400, error: "A reminder goes to the portal or the approval queue." };
  }
  const channel = input.channel;
  const target = addDays(input.today, 3);
  const rows = await db.select().from(deliverableDates).where(eq(deliverableDates.dueOn, target));
  const nudged: { dealId: string; kind: DeliverableKind; channel: NudgeChannel; approvalId: string | null }[] = [];
  for (const row of rows) {
    if (!isDeliverableKind(row.kind)) continue;
    const already = await db
      .select()
      .from(deliverableNudges)
      .where(and(eq(deliverableNudges.dealId, row.dealId), eq(deliverableNudges.kind, row.kind), eq(deliverableNudges.dueOn, row.dueOn)));
    if (already[0]) continue;
    const dealRows = await db.select().from(deals).where(eq(deals.id, row.dealId));
    const deal = dealRows[0];
    if (!deal) continue;
    const people = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
    const creator = people[0];
    if (!creator) continue;
    const message = `Your ${kindLabel(row.kind)} for ${deal.brand} is due in 3 days, on ${row.dueOn}.`;
    let approvalId: string | null = null;
    if (channel === "queue") {
      if (!creator.email.includes("@")) {
        return { ok: false, status: 400, error: "Add the creator email before a reminder can be queued." };
      }
      const drafted = await createApprovalEmail(db, {
        dealId: deal.id,
        gate: "reminder",
        to: creator.email,
        subject: `Due in 3 days: ${deal.brand}`,
        body: message,
        from: BRAND_EMAIL_SENDER,
      }, { email: "bot", role: "bot" });
      if (!drafted.ok) return drafted;
      approvalId = drafted.id;
    } else {
      await db.insert(creatorNotifications).values({
        id: crypto.randomUUID(),
        creatorId: creator.id,
        dealId: deal.id,
        kind: "reminder",
        message,
        createdAt: nowIso(),
        readAt: null,
      });
    }
    await db.insert(deliverableNudges).values({
      id: crypto.randomUUID(),
      dealId: deal.id,
      kind: row.kind,
      dueOn: row.dueOn,
      channel,
      approvalId,
      createdAt: nowIso(),
    });
    nudged.push({ dealId: deal.id, kind: row.kind, channel, approvalId });
  }
  return { ok: true, nudged };
}
