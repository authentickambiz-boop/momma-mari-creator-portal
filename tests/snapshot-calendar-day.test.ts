import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { analyticsSnapshots } from "../src/db/schema";
import { saveOwnerSnapshot } from "../src/lib/analytics-snapshots";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("snapshot calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a capture date has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const beforeRows = await db.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.creatorId, "abby"));

    for (const capturedOn of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await saveOwnerSnapshot(db, admin, {
        creatorId: "abby",
        platform: "TikTok",
        capturedOn,
        metrics: { followers: "10" },
      });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.equal(refused.error, "Enter the capture date as YYYY-MM-DD.");
    }

    const leap = await saveOwnerSnapshot(db, admin, {
      creatorId: "abby",
      platform: "TikTok",
      capturedOn: "2024-02-29",
      metrics: { followers: "10" },
    });
    assert.equal(leap.ok, true);

    const afterRows = await db.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.creatorId, "abby"));
    assert.equal(afterRows.length, beforeRows.length + 1);
    assert.equal(afterRows.some((row) => row.capturedOn === "2026-02-31"), false);

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
