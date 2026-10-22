import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorCalendars } from "../src/db/schema";
import { saveDeliverableDate } from "../src/lib/calendar";
import { upsertDeal } from "../src/lib/bot-api";
import { calendarGoogleNote } from "../src/lib/calendar-notes";
import { monthDates, shiftAnchor, weekDates } from "../src/lib/calendar-view";
import { decryptToken } from "../src/lib/token-crypto";
import {
  CALENDAR_READONLY_SCOPE,
  createCalendarOAuthState,
  googleCalendarAuthUrl,
  isCalendarOAuthState,
  isGmailOAuthState,
  verifyCalendarOAuthState,
  verifyGmailOAuthState,
} from "../src/lib/google-oauth";
import { botCalendarBusy, creatorSchedule, disconnectCalendar, saveCalendarConnection } from "../src/lib/google-calendar";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, abby, openTestDb } from "./harness";

process.env.GOOGLE_CLIENT_ID = "calendar-client-id";
process.env.GOOGLE_CLIENT_SECRET = "calendar-client-secret";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("google calendar", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("connect is read-only oauth, disconnect revokes the token, and the bot only gets busy blocks", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const state = await createCalendarOAuthState();
    assert.equal(isCalendarOAuthState(state), true);
    assert.equal(isGmailOAuthState(state), false);
    assert.equal(await verifyCalendarOAuthState(state, state), true);
    assert.equal(await verifyGmailOAuthState(state, state), false);
    const url = new URL(googleCalendarAuthUrl(state, mariclare.email));
    assert.equal(url.searchParams.get("scope"), CALENDAR_READONLY_SCOPE);
    assert.equal(url.searchParams.get("include_granted_scopes"), "false");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal((url.searchParams.get("scope") ?? "").includes("gmail"), false);
    assert.equal((url.searchParams.get("scope") ?? "").includes("calendar.events"), false);

    const page = source("src/app/calendar/page.tsx");
    assert.match(page, /calendarErrorNote\(params\.calendarError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.match(page, /\/api\/auth\/calendar/);
    assert.equal(page.includes("{params.calendarError}"), false);
    const callback = source("src/app/api/auth/callback/route.ts");
    const getFn = callback.slice(callback.indexOf("export async function GET"), callback.indexOf("async function finishGmailConnect"));
    assert.ok(getFn.indexOf("isCalendarOAuthState") > getFn.indexOf("isGmailOAuthState"));
    assert.equal(callback.slice(callback.indexOf("async function finishCalendarConnect")).includes("createSession"), false);

    assert.equal((await upsertDeal(db, {
      id: "calendar-dates",
      brand: "Calendar Dates",
      creatorId: "mariclare",
      status: "active",
      workflowStage: "draft_due",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await saveDeliverableDate(db, {
      dealId: "calendar-dates",
      kind: "post",
      dueOn: "2026-10-22",
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    const token = "calendar-refresh-token-raw";
    const saved = await saveCalendarConnection(db, "mariclare", { refreshToken: token, calendarEmail: "mmaclamroc@gmail.com" });
    assert.equal(saved.ok, true);
    const stored = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, "mariclare"));
    assert.equal(stored[0]?.refreshToken?.includes(token), false);
    assert.equal(await decryptToken(stored[0]?.refreshToken ?? ""), token);

    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const href = String(input);
      calls.push(href);
      if (href.includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "ya29.calendar-test" });
      if (href.includes("/events")) {
        return jsonResponse({
          items: [
            { id: "lunch", summary: "Lunch with mom@example.com", start: { dateTime: "2026-10-22T15:00:00Z" }, end: { dateTime: "2026-10-22T16:00:00Z" } },
            { id: "school", summary: "my son John Smith at school", start: { date: "2026-10-23" }, end: { date: "2026-10-24" } },
            { id: "free", summary: "Focus", transparency: "transparent", start: { dateTime: "2026-10-22T18:00:00Z" }, end: { dateTime: "2026-10-22T19:00:00Z" } },
          ],
        });
      }
      if (href.includes("freeBusy")) {
        assert.equal(init?.method, "POST");
        assert.equal(String(init?.body).includes("summary"), false);
        return jsonResponse({ calendars: { primary: { busy: [{ start: "2026-10-22T15:00:00Z", end: "2026-10-22T16:00:00Z" }] } } });
      }
      return jsonResponse({ error: "nope" }, 404);
    };

    const week = weekDates("2026-10-21");
    assert.deepEqual(week, ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
    const month = monthDates("2026-10-21");
    assert.equal(month.length % 7, 0);
    assert.equal(month.some((day) => day.date === "2026-10-01" && day.inMonth), true);
    assert.equal(month.some((day) => day.date === "2026-10-31" && day.inMonth), true);
    assert.equal(shiftAnchor("2026-10-21", "week", 1), "2026-10-28");

    const schedule = await creatorSchedule(db, mariclare, "mariclare", { from: week[0], to: week[6] }, fetchImpl);
    assert.equal(schedule.ok, true);
    if (!schedule.ok) return;
    assert.equal(schedule.google, "ready");
    assert.equal(schedule.events.some((entry) => entry.title === "Post due · Calendar Dates" && entry.date === "2026-10-22"), true);
    assert.equal(schedule.events.some((entry) => entry.title.includes("mom@example.com")), false);
    assert.equal(schedule.events.some((entry) => entry.title === "Busy" && entry.date === "2026-10-23"), true);
    assert.equal(schedule.events.some((entry) => entry.title === "Focus"), false);
    assert.equal(JSON.stringify(schedule.events).includes("ya29"), false);
    const stranger = await creatorSchedule(db, abby, "mariclare", { from: week[0], to: week[6] }, fetchImpl);
    assert.equal(stranger.ok, false);

    const busy = await botCalendarBusy(db, { creatorId: "mariclare", from: "2026-10-18", to: "2026-10-24" }, fetchImpl);
    assert.equal(busy.status, 200);
    if (!("busy" in busy.body) || !("portalDueOn" in busy.body)) return;
    const packed = JSON.stringify(busy.body);
    assert.equal(packed.includes("Lunch"), false);
    assert.equal(packed.includes("Calendar Dates"), false);
    assert.equal(packed.includes("summary"), false);
    assert.equal(packed.includes(token), false);
    assert.equal(packed.includes("ya29"), false);
    assert.equal(packed.includes("@"), false);
    assert.deepEqual(busy.body.busy, [{ start: "2026-10-22T15:00:00Z", end: "2026-10-22T16:00:00Z" }]);
    assert.deepEqual(busy.body.portalDueOn, ["2026-10-22"]);
    assert.equal((await botCalendarBusy(db, { creatorId: "", from: "2026-10-18", to: "2026-10-24" }, fetchImpl)).status, 400);

    calls.length = 0;
    const blocked: typeof fetch = async (input) => {
      const href = String(input);
      calls.push(href);
      if (href.includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "ya29.calendar-test" });
      return jsonResponse({ error: { errors: [{ reason: "accessNotConfigured" }], status: "PERMISSION_DENIED" } }, 403);
    };
    const degraded = await creatorSchedule(db, admin, "mariclare", { from: week[0], to: week[6] }, blocked);
    assert.equal(degraded.ok, true);
    if (!degraded.ok) return;
    assert.equal(degraded.google, "unavailable");
    assert.equal(calendarGoogleNote(degraded.google)?.includes("Portal dates"), true);
    assert.equal(degraded.events.some((entry) => entry.title === "Post due · Calendar Dates"), true);
    assert.equal((await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, "mariclare")))[0]?.refreshToken?.includes(token), false);

    const revoked: string[] = [];
    const gone = await disconnectCalendar(db, mariclare, "mariclare", { revoke: async (value) => { revoked.push(value); return true; } });
    assert.equal(gone.ok, true);
    assert.deepEqual(revoked, [token]);
    const after = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, "mariclare"));
    assert.equal(after[0]?.refreshToken, null);
    assert.equal(after[0]?.calendarEmail, null);
    assert.equal(after[0]?.connected, false);
    assert.equal((await disconnectCalendar(db, abby, "mariclare")).ok, false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
