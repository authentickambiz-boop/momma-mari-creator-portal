import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, platformInvites } from "@/db/schema";
import { agencyTimeZone, nowIso } from "./format";
import { findCreatorByEmail, findCreatorById } from "./queries";
import type { Viewer } from "./types";

export type PlatformInviteView = {
  id: string;
  creatorId: string;
  creatorName: string;
  brand: string;
  platform: string;
  accountHandle: string | null;
  actionNeeded: string;
  deadlineAt: string | null;
  deadlineLabel: string;
  countdown: string;
  overdue: boolean;
  done: boolean;
};

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function presentDeadline(deadlineAt: string | null, now = new Date()) {
  if (!deadlineAt || Number.isNaN(Date.parse(deadlineAt))) {
    return { label: "No deadline yet", countdown: "", overdue: false };
  }
  const when = new Date(deadlineAt);
  const label = `${new Intl.DateTimeFormat("en-US", {
    timeZone: agencyTimeZone(),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(when)} ET`;
  const ms = when.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let unit = "minute";
  let count = Math.max(1, Math.floor(abs / minute));
  if (abs >= day) {
    unit = "day";
    count = Math.floor(abs / day);
  } else if (abs >= hour) {
    unit = "hour";
    count = Math.floor(abs / hour);
  }
  const noun = count === 1 ? unit : `${unit}s`;
  if (abs < minute) return { label, countdown: ms >= 0 ? "Due now" : "Overdue", overdue: ms < 0 };
  const countdown = ms >= 0 ? `${count} ${noun} left` : `Overdue by ${count} ${noun}`;
  return { label, countdown, overdue: ms < 0 };
}

function toView(row: typeof platformInvites.$inferSelect, creatorName: string, now: Date): PlatformInviteView {
  const deadline = presentDeadline(row.deadlineAt, now);
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName,
    brand: row.brand,
    platform: row.platform,
    accountHandle: row.accountHandle,
    actionNeeded: row.actionNeeded,
    deadlineAt: row.deadlineAt,
    deadlineLabel: deadline.label,
    countdown: deadline.countdown,
    overdue: deadline.overdue,
    done: Boolean(row.doneAt),
  };
}

export async function createPlatformInvite(db: PortalDb, body: unknown, now = new Date()): Promise<
  | { status: 400; body: { error: string } }
  | { status: 404; body: { error: string } }
  | { status: 201; body: { ok: true; invite: PlatformInviteView } }
> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, body: { error: "Expected a JSON object." } };
  }
  const input = body as Record<string, unknown>;
  const brand = clean(input.brand, 120);
  const platform = clean(input.platform, 80);
  const actionNeeded = clean(input.actionNeeded, 280);
  const accountHandle = clean(input.accountHandle, 80);
  if (!brand || !platform || !actionNeeded) {
    return { status: 400, body: { error: "brand, platform, and actionNeeded are required." } };
  }
  let deadlineAt: string | null = null;
  if (input.deadline != null && input.deadline !== "") {
    if (typeof input.deadline !== "string" || Number.isNaN(Date.parse(input.deadline))) {
      return { status: 400, body: { error: "deadline must be an ISO timestamp." } };
    }
    deadlineAt = new Date(input.deadline).toISOString();
  }
  const creatorId = clean(input.creatorId, 80);
  const email = clean(input.email, 200);
  const creator = creatorId
    ? await findCreatorById(db, creatorId)
    : email
      ? await findCreatorByEmail(db, email)
      : null;
  if (!creator) return { status: 404, body: { error: "Creator not found." } };
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(platformInvites).values({
    id,
    creatorId: creator.id,
    brand,
    platform,
    accountHandle: accountHandle || null,
    actionNeeded,
    deadlineAt,
    doneAt: null,
    createdBy: "bot",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const view = toView({
    id,
    creatorId: creator.id,
    brand,
    platform,
    accountHandle: accountHandle || null,
    actionNeeded,
    deadlineAt,
    doneAt: null,
    createdBy: "bot",
    createdAt: timestamp,
    updatedAt: timestamp,
  }, creator.name, now);
  return { status: 201, body: { ok: true, invite: view } };
}

async function namesById(db: PortalDb) {
  const rows = await db.select({ id: creators.id, name: creators.name }).from(creators);
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function listPlatformInvites(db: PortalDb, viewer: Viewer, now = new Date()) {
  if (viewer.role === "manager") return [];
  const rows = viewer.role === "creator" && viewer.creatorId
    ? await db.select().from(platformInvites).where(eq(platformInvites.creatorId, viewer.creatorId)).orderBy(asc(platformInvites.deadlineAt))
    : viewer.role === "admin"
      ? await db.select().from(platformInvites).orderBy(asc(platformInvites.deadlineAt))
      : [];
  const names = await namesById(db);
  return rows
    .map((row) => toView(row, names.get(row.creatorId) ?? "Creator", now))
    .sort((left, right) => Number(left.done) - Number(right.done) || (left.deadlineAt ?? "9999").localeCompare(right.deadlineAt ?? "9999"));
}

export async function setPlatformInviteDone(db: PortalDb, viewer: Viewer, id: string, done: boolean) {
  if (!id) return { ok: false as const, status: 400, error: "Invite not found." };
  const rows = await db.select().from(platformInvites).where(eq(platformInvites.id, id));
  const row = rows[0];
  if (!row) return { ok: false as const, status: 404, error: "Invite not found." };
  const allowed = viewer.role === "admin" || (viewer.role === "creator" && viewer.creatorId === row.creatorId);
  if (!allowed) return { ok: false as const, status: 403, error: "That invite is not yours." };
  const timestamp = nowIso();
  await db.update(platformInvites).set({
    doneAt: done ? timestamp : null,
    updatedAt: timestamp,
  }).where(eq(platformInvites.id, id));
  return { ok: true as const };
}
