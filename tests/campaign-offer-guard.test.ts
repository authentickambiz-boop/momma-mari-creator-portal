import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, campaignAllocations } from "../src/db/schema";
import { createBrandOffer } from "../src/lib/brand-offers";
import { allocateCampaign, markOpenOutside, queueOutsideOffer, saveCampaign } from "../src/lib/campaigns";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("campaign offer guard", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a brand offer cannot be split from the campaign board, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const offer = await createBrandOffer(db, admin, {
      brand: "Guard Offer Co",
      contactName: "Nia Cole",
      contactEmail: "nia@guardoffer.test",
      deliverables: ["TikTok video"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "mariclare", amountCents: 8000 }],
    });
    assert.equal(offer.ok, true);
    if (!offer.ok) return;
    const before = (await db.select().from(campaignAllocations).where(eq(campaignAllocations.campaignId, offer.id))).length;

    const split = await allocateCampaign(db, admin, { campaignId: offer.id, creatorId: "abby", amountCents: 1000 });
    assert.equal(split.ok, false);
    if (!split.ok) assert.equal(split.error, "Brand offers are changed on the offers page.");
    const opened = await markOpenOutside(db, admin, offer.id);
    assert.equal(opened.ok, false);
    if (!opened.ok) assert.equal(opened.error, "Brand offers are changed on the offers page.");
    const queued = await queueOutsideOffer(db, admin, { campaignId: offer.id, prospectId: "missing", amountCents: 1000 });
    assert.equal(queued.ok, false);
    if (!queued.ok) assert.equal(queued.error, "Brand offers are changed on the offers page.");
    assert.equal((await db.select().from(campaignAllocations).where(eq(campaignAllocations.campaignId, offer.id))).length, before);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const campaign = await saveCampaign(db, admin, {
      brand: "Guard Soap",
      name: "Fall push",
      budgetCents: 100000,
      niches: [],
      platforms: [],
      deliverables: [],
      slots: 2,
    });
    assert.equal(campaign.ok, true);
    if (!campaign.ok) return;
    const added = await allocateCampaign(db, admin, { campaignId: campaign.id, creatorId: "abby", amountCents: 1000 });
    assert.equal(added.ok, true);

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
