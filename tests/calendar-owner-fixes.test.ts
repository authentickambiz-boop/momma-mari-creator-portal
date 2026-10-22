import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorCalendars, gmailBridgeThreads } from "../src/db/schema";
import { upsertDeal } from "../src/lib/bot-api";
import { isRealBrandDeal, listDueDateDeals } from "../src/lib/due-date-deals";
import { calendarOwnerId, disconnectCalendar, saveCalendarConnection } from "../src/lib/google-calendar";
import { nowIso } from "../src/lib/format";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("calendar page fixes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the signed-in user, including the owner, always gets their own connect control", async () => {
    assert.equal(calendarOwnerId(admin), "self:kamron@mommamari.com");
    assert.equal(calendarOwnerId({ role: "creator", creatorId: "mariclare", email: "mmaclamroc@gmail.com" }), "mariclare");
    const page = source("src/app/calendar/page.tsx");
    const connectAt = page.indexOf('className="card calendar-connect"');
    const dueAt = page.indexOf("Set a due date");
    assert.ok(connectAt > 0 && connectAt < dueAt);
    assert.match(page, /Connect calendar/);
    assert.match(page, /Disconnect calendar/);
    assert.match(page, /\/api\/auth\/calendar/);
    assert.equal(page.includes('role === "creator" && portal.viewer.creatorId === targetId'), false);
    const route = source("src/app/api/auth/calendar/route.ts");
    assert.match(route, /calendarOwnerId/);
    assert.equal(route.includes('role !== "creator"'), false);
    const callback = source("src/app/api/auth/callback/route.ts");
    const finish = callback.slice(callback.indexOf("async function finishCalendarConnect"));
    assert.match(finish, /calendarOwnerId/);
    assert.equal(finish.includes("viewer.creatorId"), false);
    assert.equal(finish.includes("createSession"), false);

    const saved = await saveCalendarConnection(db, "self:kamron@mommamari.com", {
      refreshToken: "owner-calendar-refresh-token",
      calendarEmail: "kamron@mommamari.com",
    });
    assert.equal(saved.ok, true);
    const stored = await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, "self:kamron@mommamari.com"));
    assert.equal(stored[0]?.connected, true);
    assert.equal(stored[0]?.calendarEmail, "kamron@mommamari.com");
    assert.equal(stored[0]?.refreshToken?.includes("owner-calendar-refresh-token"), false);
    const stranger = await disconnectCalendar(db, { role: "manager", creatorId: null, email: "riley@mommamari.com" }, "mariclare");
    assert.equal(stranger.ok, false);
    const gone = await disconnectCalendar(db, admin, "self:kamron@mommamari.com");
    assert.equal(gone.ok, true);
    assert.equal((await db.select().from(creatorCalendars).where(eq(creatorCalendars.creatorId, "self:kamron@mommamari.com")))[0]?.refreshToken, null);
  });

  test("the due-date list keeps real brand deals and drops bots, no-reply, GitHub, and not-a-deal threads", async () => {
    assert.equal(isRealBrandDeal({ brand: "cursor[bot]", contact: "notifications@github.com" }), false);
    assert.equal(isRealBrandDeal({ brand: "GitHub", contact: "noreply@github.com" }), false);
    assert.equal(isRealBrandDeal({ brand: "Harbor", contact: "no-reply@brand.example" }), false);
    assert.equal(isRealBrandDeal({ brand: "Harbor", contact: "nina@harbor.example" }, [{ classification: "not_deal", fromEmail: "nina@harbor.example", brand: "Harbor" }]), false);
    assert.equal(isRealBrandDeal({ brand: "Harbor", contact: "nina@harbor.example" }), true);
    assert.equal(isRealBrandDeal({ brand: "", contact: "nina@harbor.example" }), false);

    assert.equal((await upsertDeal(db, {
      id: "due-cursor-bot",
      brand: "cursor[bot]",
      contact: "cursor[bot]@users.noreply.github.com",
      creatorId: "mariclare",
      status: "pitch",
      visibleToCreator: false,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "due-harbor",
      brand: "Harbor",
      contact: "nina@harbor.example",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "due-passed",
      brand: "Passed Brand",
      contact: "ada@passed.example",
      creatorId: "mariclare",
      status: "pitch",
      visibleToCreator: false,
    })).status, 201);
    const timestamp = nowIso();
    await db.insert(gmailBridgeThreads).values({
      id: "thread-passed",
      creatorId: "mariclare",
      mailbox: "mmaclamroc@gmail.com",
      threadId: "gmail-passed",
      dealId: "due-passed",
      brand: "Passed Brand",
      subject: "Not a fit",
      snippet: "Not a deal",
      fromEmail: "ada@passed.example",
      classification: "not_deal",
      private: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const deals = await listDueDateDeals(db, admin, "all");
    const brands = deals.map((deal) => deal.brand);
    assert.equal(brands.includes("cursor[bot]"), false);
    assert.equal(brands.includes("Passed Brand"), false);
    assert.equal(brands.includes("Harbor"), true);
    assert.equal(brands.includes("KOSBLING"), true);
    const page = source("src/app/calendar/page.tsx");
    assert.match(page, /No brand deals to schedule yet/);
  });

  test("portal art stays behind solid cards and the main-site ghost is not moved", () => {
    const site = source("public/seasonal/halloween-site.svg");
    const portal = source("public/seasonal/halloween-portal.svg");
    assert.match(site, /id="sitting-ghost" transform="translate\(760 600\)"/);
    assert.match(portal, /id="porch"/);
    assert.match(portal, /id="center-cast" transform="translate\(1040, 690\) scale\(0\.55\)"/);
    assert.equal(portal.includes('id="center-cast" transform="translate(760, 240)"'), false);
    assert.equal(portal.includes('id="sitting-ghost" transform="translate(560 640)"'), false);
    const theme = source("src/lib/seasonal-theme.ts");
    assert.match(theme, /kind: "ghost", surface: "site", top: "14%", left: "12%", size: 120/);
    assert.match(theme, /kind: "ghost", surface: "site", top: "30%", left: "58%", size: 88/);
    assert.match(theme, /kind: "ghost", surface: "site", top: "46%", left: "82%", size: 54/);
    assert.equal(theme.includes('surface: "portal", top: "18%", left: "42%"'), false);
    assert.equal(theme.includes('surface: "portal", top: "40%", left: "70%"'), false);
    const css = source("src/app/seasonal-theme.css");
    assert.match(css, /html\[data-seasonal\] \.portal-main :is\(\.card, \.hello, \.page-guide, \.admin-banner, \.note\.empty, \.empty-state\)/);
    assert.match(css, /background:\s*#1C1030/);
    assert.match(css, /z-index:\s*2/);
    assert.match(css, /rgba\(32, 14, 58, 0\.68\)/);
  });
});
