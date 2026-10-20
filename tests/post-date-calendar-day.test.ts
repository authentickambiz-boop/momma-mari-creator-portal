import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals } from "../src/db/schema";
import { upsertDeal } from "../src/lib/bot-api";
import { editDealReview } from "../src/lib/deal-review";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("post date calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a brand post date that looks like a day has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const vevBefore = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];

    for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await editDealReview(db, { dealId: "vev", actorRole: "admin", postDate: date });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.equal(refused.error, "Use a date like 2026-11-20.");
      const posted = await upsertDeal(db, {
        id: "vev",
        brand: "VEV Gummies",
        creatorId: "mariclare",
        postDate: date,
      });
      assert.equal(posted.status, 400);
      assert.equal("error" in posted.body && posted.body.error, "postDate must be a real day like 2026-11-20.");
      const drafted = await upsertDeal(db, {
        id: "vev",
        brand: "VEV Gummies",
        creatorId: "mariclare",
        draftDue: date,
      });
      assert.equal(drafted.status, 400);
      assert.equal("error" in drafted.body && drafted.body.error, "draftDue must be a real day like 2026-11-20.");
    }

    const untouched = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];
    assert.equal(untouched?.postDate, vevBefore?.postDate);
    assert.equal(untouched?.draftDue, vevBefore?.draftDue);

    const wording = await editDealReview(db, { dealId: "vev", actorRole: "admin", postDate: "Late October" });
    assert.equal(wording.ok, true);
    const leap = await editDealReview(db, { dealId: "vev", actorRole: "admin", postDate: "2024-02-29" });
    assert.equal(leap.ok, true);
    const noted = await upsertDeal(db, {
      id: "vev",
      brand: "VEV Gummies",
      creatorId: "mariclare",
      draftDue: "Late October or November",
    });
    assert.equal(noted.status, 200);
    const saved = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];
    assert.equal(saved?.postDate, "2024-02-29");
    assert.equal(saved?.draftDue, "Late October or November");

    const kept = await editDealReview(db, { dealId: "vev", actorRole: "admin", postDate: "2026-02-31" });
    assert.equal(kept.ok, false);
    const after = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];
    assert.equal(after?.postDate, "2024-02-29");
    assert.equal(after?.draftDue, "Late October or November");

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.postDate, kosblingBefore?.postDate);
    assert.equal(kosblingAfter?.draftDue, kosblingBefore?.draftDue);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  });
});
