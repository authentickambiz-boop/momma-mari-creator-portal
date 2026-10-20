import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandCrmEntries, campaigns } from "../src/db/schema";
import { createBrandOffer } from "../src/lib/brand-offers";
import { upsertBrandCrm } from "../src/lib/brand-crm";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

const offer = {
  brand: "Follow Soap",
  contactName: "Ada Brand",
  contactEmail: "ada@followsoap.example",
  deliverables: ["TikTok"],
  platforms: ["TikTok"],
  budgets: [{ creatorId: "abby", amountCents: 50000 }],
  startsOn: "2026-11-01",
  endsOn: "2026-11-30",
};

describe("follow-up calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a follow-up that looks like a day has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const campaignsBefore = (await db.select().from(campaigns)).length;

    for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await createBrandOffer(db, admin, { ...offer, nextFollowUp: date });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.equal(refused.error, "Use a date like 2026-11-15.");
      const crm = await upsertBrandCrm(db, {
        brand: "Follow Soap",
        actorName: "Kamron",
        nextFollowUp: date,
      });
      assert.equal(crm.ok, false);
      if (!crm.ok) assert.equal(crm.error, "Use a date like 2026-11-15.");
    }
    assert.equal((await db.select().from(campaigns)).length, campaignsBefore);
    assert.equal((await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "follow soap"))).length, 0);

    const saved = await createBrandOffer(db, admin, { ...offer, nextFollowUp: "Next week" });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const row = await db.select().from(campaigns).where(eq(campaigns.id, saved.id));
    assert.equal(row[0]?.nextFollowUp, "Next week");

    const leap = await upsertBrandCrm(db, {
      brand: "Follow Soap",
      creatorId: "abby",
      actorName: "Kamron",
      nextFollowUp: "2024-02-29",
    });
    assert.equal(leap.ok, true);
    const cards = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "follow soap"));
    assert.ok(cards.some((card) => card.nextFollowUp === "2024-02-29"));

    const kept = await upsertBrandCrm(db, {
      brand: "Follow Soap",
      creatorId: "abby",
      actorName: "Kamron",
      nextFollowUp: "2026-02-31",
    });
    assert.equal(kept.ok, false);
    const after = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "follow soap"));
    assert.ok(after.some((card) => card.nextFollowUp === "2024-02-29"));
    assert.equal(after.some((card) => card.nextFollowUp === "2026-02-31"), false);

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
