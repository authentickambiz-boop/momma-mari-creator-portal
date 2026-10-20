import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { analyticsDaily } from "../src/db/schema";
import { writeDailyAnalytics } from "../src/lib/bot-api";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("daily analytics calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a daily analytics date has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await writeDailyAnalytics(db, {
        creatorId: "abby",
        date,
        platform: "tiktok",
        views: 10,
      });
      assert.equal(refused.status, 400);
      assert.equal("error" in refused.body && refused.body.error, "date must be YYYY-MM-DD.");
    }

    const leap = await writeDailyAnalytics(db, {
      creatorId: "abby",
      date: "2024-02-29",
      platform: "tiktok",
      views: 10,
    });
    assert.equal(leap.status, 200);
    const rows = await db.select().from(analyticsDaily).where(eq(analyticsDaily.creatorId, "abby"));
    assert.deepEqual(rows.map((row) => row.metricDate), ["2024-02-29"]);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  });
});
