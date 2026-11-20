import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { commissionProductRequests, creators } from "../src/db/schema";
import {
  countsTowardFreeCommissionLimit,
  freeCommissionCountMode,
  freeCommissionLimit,
  freeCommissionLimitReachedMessage,
  newYorkYearMonth,
  requestCommissionProduct,
  resolveProductRequest,
  type FreeCommissionCountMode,
} from "../src/lib/commission-access";
import { saveCommissionCampaign } from "../src/lib/commission-campaigns";
import { setSignupCodeRequired, completeFreeSignup } from "../src/lib/signup-codes";
import type { Viewer } from "../src/lib/types";
import { abby, admin, mariclare, openTestDb } from "./harness";

const CAMPAIGN = "camp-count-mode";
const LIFETIME_REACHED = "You've reached the free commission limit.";
const MONTHLY_REACHED = "You've reached this month's free commission limit.";
const OPEN_REQUEST = "You already have an open product request. Wait until it is approved, declined, or cancelled.";
const COMING_SOON = "Commission requests are coming soon.";
const FREE_ONLY = "Product requests on this board are for free accounts.";

// America/New_York month starts. March and January are EST (UTC-5). April, November are EDT (UTC-4).
const MARCH_START = new Date("2026-03-01T05:00:00.000Z");
const BEFORE_MARCH = new Date("2026-03-01T04:59:59.999Z");
const APRIL_START = new Date("2026-04-01T04:00:00.000Z");
const BEFORE_APRIL = new Date("2026-04-01T03:59:59.999Z");
const NOVEMBER_START = new Date("2026-11-01T04:00:00.000Z");
const BEFORE_NOVEMBER = new Date("2026-11-01T03:59:59.999Z");
const JANUARY_START = new Date("2026-01-01T05:00:00.000Z");
const BEFORE_JANUARY = new Date("2026-01-01T04:59:59.999Z");
const DECEMBER_START = new Date("2026-12-01T05:00:00.000Z");
const BEFORE_DECEMBER = new Date("2026-12-01T04:59:59.999Z");
const FALLBACK_BEFORE = new Date("2026-11-01T05:59:59.999Z");
const FALLBACK_AFTER = new Date("2026-11-01T06:00:00.000Z");

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function assertError(result: { ok: boolean; error?: string }, error: string) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, error);
}

async function usingCommissionEnv(limit: string | null, mode: string | null, run: () => Promise<void>) {
  const previousLimit = process.env.FREE_COMMISSION_LIMIT;
  const previousMode = process.env.FREE_COMMISSION_COUNT_MODE;
  if (limit == null) delete process.env.FREE_COMMISSION_LIMIT;
  else process.env.FREE_COMMISSION_LIMIT = limit;
  if (mode == null) delete process.env.FREE_COMMISSION_COUNT_MODE;
  else process.env.FREE_COMMISSION_COUNT_MODE = mode;
  try {
    await run();
  } finally {
    if (previousLimit === undefined) delete process.env.FREE_COMMISSION_LIMIT;
    else process.env.FREE_COMMISSION_LIMIT = previousLimit;
    if (previousMode === undefined) delete process.env.FREE_COMMISSION_COUNT_MODE;
    else process.env.FREE_COMMISSION_COUNT_MODE = previousMode;
  }
}

describe("free commission count mode", { concurrency: 1 }, () => {
  let db: PortalDb;

  before(async () => {
    db = openTestDb();
    await setSignupCodeRequired(db, admin, false);
    const saved = await saveCommissionCampaign(db, {
      id: CAMPAIGN,
      brand: "Northwind",
      title: "Spring kit",
      description: "A product to request.",
      terms: "Commission on sales",
      status: "open",
    });
    assert.equal(saved.status, 201);
  });

  async function freeCreator(email: string): Promise<Viewer & { creatorId: string }> {
    const created = await completeFreeSignup(db, email, null);
    assert.equal(created.ok, true);
    if (!created.ok || !created.viewer.creatorId) throw new Error("expected a free creator");
    return { ...created.viewer, creatorId: created.viewer.creatorId };
  }

  async function openRow(creatorId: string) {
    const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, creatorId));
    const open = rows.find((row) => row.status === "open");
    assert.ok(open);
    return open;
  }

  async function seedRequest(creatorId: string, status: "open" | "approved" | "declined" | "cancelled", createdAt: string) {
    await db.insert(commissionProductRequests).values({
      id: crypto.randomUUID(),
      creatorId,
      campaignId: CAMPAIGN,
      status,
      createdAt,
      resolvedAt: status === "open" ? null : createdAt,
    });
  }

  test("unset and invalid count modes stay on lifetime", async () => {
    await usingCommissionEnv(null, null, async () => {
      assert.equal(freeCommissionCountMode(), "lifetime");
    });
    for (const mode of ["", "   ", "weekly", "Lifetime", "monthly", "MONTHLY_EXCLUDING_DECLINED"]) {
      await usingCommissionEnv("1", mode, async () => {
        assert.equal(freeCommissionCountMode(), "lifetime");
        assert.equal(freeCommissionLimitReachedMessage(freeCommissionCountMode()), LIFETIME_REACHED);
      });
    }
    await usingCommissionEnv("1", " lifetime ", async () => {
      assert.equal(freeCommissionCountMode(), "lifetime");
    });
    await usingCommissionEnv("1", " lifetime_excluding_declined ", async () => {
      assert.equal(freeCommissionCountMode(), "lifetime_excluding_declined");
    });
    await usingCommissionEnv("1", " monthly_excluding_declined ", async () => {
      assert.equal(freeCommissionCountMode(), "monthly_excluding_declined");
    });
    assert.equal(freeCommissionLimitReachedMessage("lifetime"), LIFETIME_REACHED);
    assert.equal(freeCommissionLimitReachedMessage("lifetime_excluding_declined"), LIFETIME_REACHED);
    assert.equal(freeCommissionLimitReachedMessage("monthly_excluding_declined"), MONTHLY_REACHED);
    assert.match(MONTHLY_REACHED, /this month/);
  });

  test("counting keeps cancelled out, and drops declined only outside lifetime", () => {
    const modes: FreeCommissionCountMode[] = ["lifetime", "lifetime_excluding_declined", "monthly_excluding_declined"];
    for (const mode of modes) {
      assert.equal(countsTowardFreeCommissionLimit({ status: "cancelled", createdAt: MARCH_START.toISOString() }, mode, MARCH_START), false);
      assert.equal(countsTowardFreeCommissionLimit({ status: "cancelled", createdAt: "not-a-date" }, mode, MARCH_START), false);
      assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: MARCH_START.toISOString() }, mode, MARCH_START), mode === "lifetime");
      assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: BEFORE_MARCH.toISOString() }, mode, MARCH_START), mode === "lifetime");
      assert.equal(countsTowardFreeCommissionLimit({ status: "approved", createdAt: MARCH_START.toISOString() }, mode, MARCH_START), true);
      assert.equal(countsTowardFreeCommissionLimit({ status: "open", createdAt: MARCH_START.toISOString() }, mode, MARCH_START), true);
      assert.equal(countsTowardFreeCommissionLimit({ status: "held", createdAt: MARCH_START.toISOString() }, mode, MARCH_START), true);
    }
    assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: "not-a-date" }, "monthly_excluding_declined", MARCH_START), false);
    assert.equal(countsTowardFreeCommissionLimit({ status: "approved", createdAt: "not-a-date" }, "monthly_excluding_declined", MARCH_START), true);
    assert.equal(countsTowardFreeCommissionLimit({ status: "approved", createdAt: BEFORE_MARCH.toISOString() }, "lifetime", MARCH_START), true);
    assert.equal(countsTowardFreeCommissionLimit({ status: "approved", createdAt: BEFORE_MARCH.toISOString() }, "lifetime_excluding_declined", MARCH_START), true);
    assert.equal(countsTowardFreeCommissionLimit({ status: "approved", createdAt: BEFORE_MARCH.toISOString() }, "monthly_excluding_declined", MARCH_START), false);
    assert.equal(countsTowardFreeCommissionLimit({ status: "open", createdAt: BEFORE_MARCH.toISOString() }, "monthly_excluding_declined", MARCH_START), false);
    assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: MARCH_START.toISOString() }, "lifetime_excluding_declined", MARCH_START), false);
    assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: BEFORE_MARCH.toISOString() }, "lifetime", MARCH_START), true);
  });

  test("month keys follow America/New_York, including DST and the year boundary", () => {
    assert.equal(newYorkYearMonth(BEFORE_MARCH), "2026-02");
    assert.equal(newYorkYearMonth(MARCH_START), "2026-03");
    assert.equal(newYorkYearMonth(BEFORE_APRIL), "2026-03");
    assert.equal(newYorkYearMonth(APRIL_START), "2026-04");
    assert.equal(newYorkYearMonth(BEFORE_NOVEMBER), "2026-10");
    assert.equal(newYorkYearMonth(NOVEMBER_START), "2026-11");
    assert.equal(newYorkYearMonth(FALLBACK_BEFORE), "2026-11");
    assert.equal(newYorkYearMonth(FALLBACK_AFTER), "2026-11");
    assert.equal(newYorkYearMonth(BEFORE_DECEMBER), "2026-11");
    assert.equal(newYorkYearMonth(DECEMBER_START), "2026-12");
    assert.equal(newYorkYearMonth(BEFORE_JANUARY), "2025-12");
    assert.equal(newYorkYearMonth(JANUARY_START), "2026-01");
    assert.equal(newYorkYearMonth(new Date("not-a-date")), null);

    const boundaries: Array<[Date, Date, string, string]> = [
      [BEFORE_MARCH, MARCH_START, "2026-02", "2026-03"],
      [BEFORE_APRIL, APRIL_START, "2026-03", "2026-04"],
      [BEFORE_NOVEMBER, NOVEMBER_START, "2026-10", "2026-11"],
      [BEFORE_DECEMBER, DECEMBER_START, "2026-11", "2026-12"],
      [BEFORE_JANUARY, JANUARY_START, "2025-12", "2026-01"],
    ];
    for (const [before, start, previousMonth, month] of boundaries) {
      const approvedBefore = { status: "approved", createdAt: before.toISOString() };
      const approvedAt = { status: "approved", createdAt: start.toISOString() };
      assert.equal(newYorkYearMonth(before), previousMonth);
      assert.equal(newYorkYearMonth(start), month);
      assert.equal(countsTowardFreeCommissionLimit(approvedBefore, "monthly_excluding_declined", start), false);
      assert.equal(countsTowardFreeCommissionLimit(approvedAt, "monthly_excluding_declined", start), true);
      assert.equal(countsTowardFreeCommissionLimit(approvedBefore, "monthly_excluding_declined", before), true);
      assert.equal(countsTowardFreeCommissionLimit({ status: "declined", createdAt: start.toISOString() }, "monthly_excluding_declined", start), false);
      assert.equal(countsTowardFreeCommissionLimit({ status: "cancelled", createdAt: start.toISOString() }, "monthly_excluding_declined", start), false);
    }
  });

  test("a closed cap still says coming soon in every mode", async () => {
    const viewer = await freeCreator("closed.cap@gmail.com");
    for (const mode of [null, "lifetime", "lifetime_excluding_declined", "monthly_excluding_declined", "weekly"]) {
      for (const limit of [null, "", "0", "-1", "1.5", "nope"]) {
        await usingCommissionEnv(limit, mode, async () => {
          assert.equal(freeCommissionLimit(), null);
          assertError(await requestCommissionProduct(db, viewer, CAMPAIGN, { now: MARCH_START }), COMING_SOON);
        });
      }
    }
    const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
    assert.equal(rows.length, 0);
  });

  test("lifetime counts declined and approved, and ignores cancelled", async () => {
    const modes: Array<string | null> = [null, "lifetime", "weekly", "Lifetime"];
    let index = 0;
    for (const mode of modes) {
      const declined = await freeCreator(`lifetime.declined.${index}@gmail.com`);
      const approved = await freeCreator(`lifetime.approved.${index}@gmail.com`);
      const cancelled = await freeCreator(`lifetime.cancelled.${index}@gmail.com`);
      index += 1;
      await usingCommissionEnv("1", mode, async () => {
        assert.equal((await requestCommissionProduct(db, declined, CAMPAIGN)).ok, true);
        await resolveProductRequest(db, admin, (await openRow(declined.creatorId)).id, "declined");
        assertError(await requestCommissionProduct(db, declined, CAMPAIGN), LIFETIME_REACHED);

        assert.equal((await requestCommissionProduct(db, approved, CAMPAIGN)).ok, true);
        await resolveProductRequest(db, admin, (await openRow(approved.creatorId)).id, "approved");
        assertError(await requestCommissionProduct(db, approved, CAMPAIGN), LIFETIME_REACHED);

        assert.equal((await requestCommissionProduct(db, cancelled, CAMPAIGN)).ok, true);
        await resolveProductRequest(db, cancelled, (await openRow(cancelled.creatorId)).id, "cancelled");
        assert.equal((await requestCommissionProduct(db, cancelled, CAMPAIGN)).ok, true);
        await resolveProductRequest(db, admin, (await openRow(cancelled.creatorId)).id, "cancelled");
      });
    }
  });

  test("lifetime excluding declined ignores declined and cancelled, and counts approved", async () => {
    const viewer = await freeCreator("exclude.declined@gmail.com");
    await usingCommissionEnv("1", "lifetime_excluding_declined", async () => {
      assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN)).ok, true);
      assertError(await requestCommissionProduct(db, viewer, CAMPAIGN), OPEN_REQUEST);
      await resolveProductRequest(db, viewer, (await openRow(viewer.creatorId)).id, "cancelled");
      assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN)).ok, true);
      await resolveProductRequest(db, admin, (await openRow(viewer.creatorId)).id, "declined");
      assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN)).ok, true);
      await resolveProductRequest(db, admin, (await openRow(viewer.creatorId)).id, "declined");
      assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN)).ok, true);
      await resolveProductRequest(db, admin, (await openRow(viewer.creatorId)).id, "approved");
      assertError(await requestCommissionProduct(db, viewer, CAMPAIGN), LIFETIME_REACHED);
    });
  });

  test("monthly mode resets on America/New_York month boundaries and ignores declined", async () => {
    const boundaries: Array<[string, Date, Date]> = [
      ["march", BEFORE_MARCH, MARCH_START],
      ["april", BEFORE_APRIL, APRIL_START],
      ["november", BEFORE_NOVEMBER, NOVEMBER_START],
      ["december", BEFORE_DECEMBER, DECEMBER_START],
      ["january", BEFORE_JANUARY, JANUARY_START],
    ];
    await usingCommissionEnv("1", "monthly_excluding_declined", async () => {
      for (const [label, before, start] of boundaries) {
        const viewer = await freeCreator(`month.${label}@gmail.com`);
        assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN, { now: before })).ok, true);
        const previous = await openRow(viewer.creatorId);
        assert.equal(previous.createdAt, before.toISOString());
        await resolveProductRequest(db, admin, previous.id, "approved");
        assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN, { now: start })).ok, true);
        await resolveProductRequest(db, admin, (await openRow(viewer.creatorId)).id, "approved");
        assertError(await requestCommissionProduct(db, viewer, CAMPAIGN, { now: start }), MONTHLY_REACHED);
      }

      const fresh = await freeCreator("month.declined@gmail.com");
      assert.equal((await requestCommissionProduct(db, fresh, CAMPAIGN, { now: MARCH_START })).ok, true);
      await resolveProductRequest(db, admin, (await openRow(fresh.creatorId)).id, "declined");
      assert.equal((await requestCommissionProduct(db, fresh, CAMPAIGN, { now: MARCH_START })).ok, true);
      await resolveProductRequest(db, fresh, (await openRow(fresh.creatorId)).id, "cancelled");
      assert.equal((await requestCommissionProduct(db, fresh, CAMPAIGN, { now: MARCH_START })).ok, true);
      await resolveProductRequest(db, admin, (await openRow(fresh.creatorId)).id, "approved");
      assertError(await requestCommissionProduct(db, fresh, CAMPAIGN, { now: MARCH_START }), MONTHLY_REACHED);

      const carried = await freeCreator("month.carried@gmail.com");
      await seedRequest(carried.creatorId, "open", BEFORE_MARCH.toISOString());
      assertError(await requestCommissionProduct(db, carried, CAMPAIGN, { now: MARCH_START }), OPEN_REQUEST);
      await resolveProductRequest(db, admin, (await openRow(carried.creatorId)).id, "approved");
      assert.equal((await requestCommissionProduct(db, carried, CAMPAIGN, { now: MARCH_START })).ok, true);

      const mixed = await freeCreator("month.mixed@gmail.com");
      await seedRequest(mixed.creatorId, "approved", BEFORE_MARCH.toISOString());
      await seedRequest(mixed.creatorId, "approved", BEFORE_MARCH.toISOString());
      await seedRequest(mixed.creatorId, "declined", MARCH_START.toISOString());
      await seedRequest(mixed.creatorId, "cancelled", MARCH_START.toISOString());
      await seedRequest(mixed.creatorId, "approved", MARCH_START.toISOString());
      await usingCommissionEnv("2", "monthly_excluding_declined", async () => {
        assert.equal((await requestCommissionProduct(db, mixed, CAMPAIGN, { now: MARCH_START })).ok, true);
        await resolveProductRequest(db, admin, (await openRow(mixed.creatorId)).id, "approved");
        assertError(await requestCommissionProduct(db, mixed, CAMPAIGN, { now: MARCH_START }), MONTHLY_REACHED);
      });
      await usingCommissionEnv("5", "lifetime", async () => {
        assertError(await requestCommissionProduct(db, mixed, CAMPAIGN, { now: MARCH_START }), LIFETIME_REACHED);
      });

      const neighbor = await freeCreator("month.neighbor@gmail.com");
      assert.equal((await requestCommissionProduct(db, neighbor, CAMPAIGN, { now: MARCH_START })).ok, true);
    });
  });

  test("only one request may be open in every mode", async () => {
    const modes: Array<string | null> = [null, "lifetime", "lifetime_excluding_declined", "monthly_excluding_declined", "weekly"];
    let index = 0;
    for (const mode of modes) {
      const viewer = await freeCreator(`one.open.${index}@gmail.com`);
      index += 1;
      await usingCommissionEnv("4", mode, async () => {
        assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN, { now: MARCH_START })).ok, true);
        assertError(await requestCommissionProduct(db, viewer, CAMPAIGN, { now: MARCH_START }), OPEN_REQUEST);
        await resolveProductRequest(db, viewer, (await openRow(viewer.creatorId)).id, "cancelled");
        assert.equal((await requestCommissionProduct(db, viewer, CAMPAIGN, { now: MARCH_START })).ok, true);
        const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
        assert.equal(rows.filter((row) => row.status === "open").length, 1);
      });
    }
  });

  test("paid and managed creators are not capped and cannot request", async () => {
    const before = (await db.select({ accountTier: creators.accountTier }).from(creators).where(eq(creators.id, "abby")))[0]?.accountTier;
    try {
      await usingCommissionEnv("2", "monthly_excluding_declined", async () => {
        for (const tier of ["plus", "pro", "business", "managed"]) {
          await db.update(creators).set({ accountTier: tier }).where(eq(creators.id, "abby"));
          assertError(await requestCommissionProduct(db, abby, CAMPAIGN, { now: MARCH_START }), FREE_ONLY);
        }
        assertError(await requestCommissionProduct(db, mariclare, CAMPAIGN, { now: MARCH_START }), FREE_ONLY);
      });
    } finally {
      if (before) await db.update(creators).set({ accountTier: before }).where(eq(creators.id, "abby"));
    }
    for (const creatorId of ["abby", "mariclare"]) {
      const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, creatorId));
      assert.equal(rows.length, 0);
    }
  });

  test("the env var is documented and left empty", () => {
    const example = source(".env.example");
    const readme = source("README.md");
    assert.match(example, /^FREE_COMMISSION_LIMIT=$/m);
    assert.match(example, /^FREE_COMMISSION_COUNT_MODE=$/m);
    assert.match(example, /lifetime: N requests for the life of the account/);
    assert.match(example, /lifetime_excluding_declined/);
    assert.match(example, /monthly_excluding_declined/);
    assert.match(example, /America\/New_York/);
    assert.match(readme, /FREE_COMMISSION_COUNT_MODE/);
    assert.match(readme, /`lifetime`/);
    assert.match(readme, /lifetime_excluding_declined/);
    assert.match(readme, /monthly_excluding_declined/);
    assert.match(readme, /America\/New_York/);
    assert.match(readme, /this month/);
    assert.match(source("src/app/commission/page.tsx"), /\{params\.requestError\}/);
  });
});
