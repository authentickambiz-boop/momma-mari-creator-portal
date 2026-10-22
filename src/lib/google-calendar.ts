import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorCalendars, creators, deals, deliverableDates } from "@/db/schema";
import { addDays, isIsoDate, listCalendar } from "./calendar";
import {
  googleItemsToEntries,
  mergeSchedule,
  portalItemsToEntries,
  todayIso,
  type GoogleCalendarItem,
  type ScheduleEntry,
} from "./calendar-view";
import { agencyTimeZone, nowIso } from "./format";
import { revokeGoogleToken, type GoogleTokenRevoker } from "./google-oauth";
import { decryptToken, encryptToken } from "./token-crypto";
import type { Viewer } from "./types";

export type GoogleCalendarState = "off" | "ready" | "unavailable" | "needs_reconnect" | "not_configured";

type FetchLike = typeof fetch;

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

const RANGE_ERROR = "Use dates like 2026-10-21.";
const SPAN_ERROR = "Ask for 62 days or less.";

export function classifyCalendarFailure(status: number, body: unknown): "needs_reconnect" | "unavailable" {
  const error = body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : null;
  const reason = typeof error === "string"
    ? error
    : error && typeof error === "object"
      ? String((error as { errors?: { reason?: string }[]; status?: string }).errors?.[0]?.reason ?? (error as { status?: string }).status ?? "")
      : "";
  if (reason === "invalid_grant" || status === 401) return "needs_reconnect";
  return "unavailable";
}

function canView(viewer: Viewer, creatorId: string) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "creator") return viewer.creatorId === creatorId;
  if (viewer.role === "manager") return (viewer.assignedCreatorIds ?? []).includes(creatorId);
  return false;
}

function canSeeEmail(viewer: Viewer, creatorId: string) {
  return viewer.role === "admin" || (viewer.role === "creator" && viewer.creatorId === creatorId);
}

export async function calendarLink(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, creatorId));
  const row = rows[0];
  return {
    connected: Boolean(row?.connected),
    linked: Boolean(row?.refreshToken),
    email: row?.calendarEmail ?? null,
    status: (row?.status ?? "off") as GoogleCalendarState,
    cipher: row?.refreshToken ?? null,
  };
}

export async function saveCalendarConnection(
  db: PortalDb,
  creatorId: string,
  input: { refreshToken: string; calendarEmail: string | null },
) {
  const token = input.refreshToken.trim();
  if (!token) return { ok: false as const, status: 400, error: "Google didn't return a calendar connection. Try again." };
  const creator = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, status: 404, error: "Creator not found." };
  let cipher: string;
  try {
    cipher = await encryptToken(token);
  } catch {
    return { ok: false as const, status: 503, error: "Calendar connection isn't set up on this server yet." };
  }
  if (cipher.includes(token)) return { ok: false as const, status: 500, error: "Refusing to store a readable token." };
  const timestamp = nowIso();
  const email = input.calendarEmail?.includes("@") ? input.calendarEmail : null;
  const existing = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, creatorId));
  const values = {
    connected: true,
    refreshToken: cipher,
    calendarEmail: email,
    status: "ready",
    updatedAt: timestamp,
  };
  if (existing[0]) await db.update(creatorCalendars).set(values).where(eq(creatorCalendars.creatorId, creatorId));
  else await db.insert(creatorCalendars).values({ creatorId, ...values });
  return { ok: true as const };
}

export async function disconnectCalendar(
  db: PortalDb,
  actor: { role: string; creatorId?: string | null },
  creatorId: string,
  options?: { revoke?: GoogleTokenRevoker },
) {
  const self = actor.role === "creator" && actor.creatorId === creatorId;
  if (actor.role !== "admin" && !self) {
    return { ok: false as const, status: 403, error: "You can only connect your own calendar." };
  }
  const rows = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, creatorId));
  const cipher = rows[0]?.refreshToken ?? null;
  if (cipher) {
    try {
      await (options?.revoke ?? revokeGoogleToken)(await decryptToken(cipher));
    } catch {
      // An unreadable ciphertext or a failed revoke still clears the saved token.
    }
  }
  if (rows[0]) {
    await db.update(creatorCalendars).set({
      connected: false,
      refreshToken: null,
      calendarEmail: null,
      status: "off",
      updatedAt: nowIso(),
    }).where(eq(creatorCalendars.creatorId, creatorId));
  }
  return { ok: true as const, cleared: true as const };
}

async function markStatus(db: PortalDb, creatorId: string, status: GoogleCalendarState) {
  await db.update(creatorCalendars).set({ status, updatedAt: nowIso() }).where(eq(creatorCalendars.creatorId, creatorId));
}

async function refreshAccessToken(refreshToken: string, fetchImpl: FetchLike) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) return { ok: false as const, google: "not_configured" as const };
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false as const, google: "unavailable" as const };
  }
  const json = await response.json().catch(() => null);
  const accessToken = json && typeof json === "object" && "access_token" in json && typeof (json as { access_token?: unknown }).access_token === "string"
    ? (json as { access_token: string }).access_token
    : "";
  if (!response.ok || !accessToken) return { ok: false as const, google: classifyCalendarFailure(response.status, json) };
  return { ok: true as const, accessToken };
}

async function plainToken(cipher: string | null) {
  if (!cipher) return null;
  try {
    return await decryptToken(cipher);
  } catch {
    return null;
  }
}

export async function readPrimaryCalendarId(accessToken: string, fetchImpl: FetchLike = fetch) {
  try {
    const response = await fetchImpl("https://www.googleapis.com/calendar/v3/calendars/primary?fields=id", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const json = await response.json() as { id?: string };
    return json.id?.includes("@") ? json.id : null;
  } catch {
    return null;
  }
}

async function portalEntries(db: PortalDb, viewer: Viewer, creatorId: string, span: { from: string; to: string }) {
  const items = await listCalendar(db, viewer);
  const dealRows = await db.select({ id: deals.id }).from(deals).where(eq(deals.creatorId, creatorId));
  const ids = new Set(dealRows.map((deal) => deal.id));
  return portalItemsToEntries(items.filter((item) => ids.has(item.dealId)), span);
}

async function portalDueOn(db: PortalDb, creatorId: string, span: { from: string; to: string }) {
  const dealRows = await db.select({ id: deals.id }).from(deals).where(eq(deals.creatorId, creatorId));
  const ids = new Set(dealRows.map((deal) => deal.id));
  const rows = await db.select().from(deliverableDates);
  return [...new Set(rows.flatMap((row) => {
    if (!ids.has(row.dealId) || row.dueOn < span.from || row.dueOn > span.to) return [];
    return [row.dueOn];
  }))].sort();
}

export async function creatorSchedule(
  db: PortalDb,
  viewer: Viewer,
  creatorId: string,
  span: { from: string; to: string },
  fetchImpl: FetchLike = fetch,
): Promise<Result<{
  google: GoogleCalendarState;
  linked: boolean;
  fileReady: boolean;
  email: string | null;
  events: ScheduleEntry[];
}>> {
  if (!canView(viewer, creatorId)) {
    return { ok: false, status: 403, error: "You can only connect your own calendar." };
  }
  const people = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "Creator not found." };
  const portal = await portalEntries(db, viewer, creatorId, span);
  const link = await calendarLink(db, creatorId);
  const email = canSeeEmail(viewer, creatorId) ? link.email : null;
  if (!link.cipher) {
    return { ok: true, google: "off", linked: false, fileReady: link.connected, email, events: portal };
  }
  if (link.status === "needs_reconnect") {
    return { ok: true, google: "needs_reconnect", linked: true, fileReady: link.connected, email, events: portal };
  }
  const refreshToken = await plainToken(link.cipher);
  if (!refreshToken) {
    await markStatus(db, creatorId, "needs_reconnect");
    return { ok: true, google: "needs_reconnect", linked: true, fileReady: link.connected, email, events: portal };
  }
  const access = await refreshAccessToken(refreshToken, fetchImpl);
  if (!access.ok) {
    await markStatus(db, creatorId, access.google);
    return { ok: true, google: access.google, linked: true, fileReady: link.connected, email, events: portal };
  }
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: `${span.from}T00:00:00Z`,
    timeMax: `${addDays(span.to, 1)}T00:00:00Z`,
    maxResults: "100",
    fields: "items(id,summary,status,transparency,start,end)",
  });
  let response: Response;
  try {
    response = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${access.accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    await markStatus(db, creatorId, "unavailable");
    return { ok: true, google: "unavailable", linked: true, fileReady: link.connected, email, events: portal };
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const google = classifyCalendarFailure(response.status, json);
    await markStatus(db, creatorId, google);
    return { ok: true, google, linked: true, fileReady: link.connected, email, events: portal };
  }
  const items = json && typeof json === "object" && Array.isArray((json as { items?: unknown }).items)
    ? (json as { items: GoogleCalendarItem[] }).items
    : [];
  if (link.status !== "ready") await markStatus(db, creatorId, "ready");
  return {
    ok: true,
    google: "ready",
    linked: true,
    fileReady: link.connected,
    email,
    events: mergeSchedule(portal, googleItemsToEntries(items, agencyTimeZone(), span)),
  };
}

function defaultSpan(now: Date) {
  const from = todayIso(agencyTimeZone(), now);
  return { from, to: addDays(from, 14) };
}

export async function botCalendarBusy(
  db: PortalDb,
  input: { creatorId: string; from?: string | null; to?: string | null; now?: Date },
  fetchImpl: FetchLike = fetch,
) {
  const creatorId = input.creatorId.trim();
  if (!creatorId) return { status: 400, body: { error: "creatorId is required." } };
  const people = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!people[0]) return { status: 404, body: { error: "Creator not found." } };
  const fallback = defaultSpan(input.now ?? new Date());
  const from = input.from?.trim() || fallback.from;
  const to = input.to?.trim() || fallback.to;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return { status: 400, body: { error: RANGE_ERROR } };
  if (addDays(from, 62) < to) return { status: 400, body: { error: SPAN_ERROR } };
  const dueOn = await portalDueOn(db, creatorId, { from, to });
  const link = await calendarLink(db, creatorId);
  const base = { creatorId, connected: link.linked, portalDueOn: dueOn };
  if (!link.cipher) return { status: 200, body: { ...base, google: "off", busy: [] } };
  if (link.status === "needs_reconnect") return { status: 200, body: { ...base, google: "needs_reconnect", busy: [] } };
  const refreshToken = await plainToken(link.cipher);
  if (!refreshToken) {
    await markStatus(db, creatorId, "needs_reconnect");
    return { status: 200, body: { ...base, google: "needs_reconnect", busy: [] } };
  }
  const access = await refreshAccessToken(refreshToken, fetchImpl);
  if (!access.ok) {
    await markStatus(db, creatorId, access.google);
    return { status: 200, body: { ...base, google: access.google, busy: [] } };
  }
  let response: Response;
  try {
    response = await fetchImpl("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: `${from}T00:00:00Z`,
        timeMax: `${addDays(to, 1)}T00:00:00Z`,
        items: [{ id: "primary" }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    await markStatus(db, creatorId, "unavailable");
    return { status: 200, body: { ...base, google: "unavailable", busy: [] } };
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const google = classifyCalendarFailure(response.status, json);
    await markStatus(db, creatorId, google);
    return { status: 200, body: { ...base, google, busy: [] } };
  }
  const calendars = json && typeof json === "object" ? (json as { calendars?: Record<string, { busy?: { start?: string; end?: string }[]; errors?: unknown[] }> }).calendars : undefined;
  const primary = calendars?.primary;
  if (primary?.errors?.length) {
    await markStatus(db, creatorId, "unavailable");
    return { status: 200, body: { ...base, google: "unavailable", busy: [] } };
  }
  const busy = (primary?.busy ?? []).flatMap((block) => {
    if (!block.start || !block.end) return [];
    return [{ start: block.start, end: block.end }];
  });
  if (link.status !== "ready") await markStatus(db, creatorId, "ready");
  return { status: 200, body: { ...base, google: "ready", busy } };
}
