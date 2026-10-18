import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { pushNotices, pushSubscriptions } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const PUSH_KINDS = ["approval", "announcement", "mention", "reply"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export const QUIET_HOURS_NOTE = "Quiet hours are 9 PM to 8 AM ET. Notices wait until morning.";

export function pushEnabled() {
  return process.env.PUSH_ENABLED === "true";
}

export function isPushKind(value: string): value is PushKind {
  return (PUSH_KINDS as readonly string[]).includes(value);
}

/** Quiet from 9:00 PM inclusive through 7:59 AM Eastern. 8:00 AM is morning. */
export function inQuietHours(now: Date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  return minutes >= 21 * 60 || minutes < 8 * 60;
}

export async function savePushSubscription(
  db: PortalDb,
  input: { email: string; endpoint: string },
): Promise<Result<{ id: string }>> {
  const endpoint = input.endpoint.trim();
  if (!endpoint.startsWith("https://")) return { ok: false, status: 400, error: "The push endpoint has to be an https link." };
  const email = normalizeEmail(input.email);
  const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  if (existing[0]) {
    await db.update(pushSubscriptions).set({ email }).where(eq(pushSubscriptions.id, existing[0].id));
    return { ok: true, id: existing[0].id };
  }
  const id = crypto.randomUUID();
  await db.insert(pushSubscriptions).values({ id, email, endpoint, createdAt: nowIso() });
  return { ok: true, id };
}

export async function queueHomeNotice(
  db: PortalDb,
  input: { email: string; kind: string; title: string; body: string; now?: Date },
): Promise<Result<{ id: string; status: "held" | "ready" | "off" }>> {
  if (!isPushKind(input.kind)) {
    return { ok: false, status: 400, error: "Notice must be an approval, announcement, mention, or reply." };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, status: 400, error: "A notice needs a title and a body." };
  const now = input.now ?? new Date();
  const status = inQuietHours(now) ? "held" : pushEnabled() ? "ready" : "off";
  const id = crypto.randomUUID();
  await db.insert(pushNotices).values({
    id,
    email: normalizeEmail(input.email),
    kind: input.kind,
    title,
    body,
    status,
    createdAt: nowIso(),
  });
  return { ok: true, id, status };
}

export async function dueHomeNotices(db: PortalDb, email: string) {
  const rows = await db
    .select()
    .from(pushNotices)
    .where(and(eq(pushNotices.email, normalizeEmail(email)), eq(pushNotices.status, "ready")));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
  }));
}
