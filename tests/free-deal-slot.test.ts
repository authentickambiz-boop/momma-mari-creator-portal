import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import {
  approvalEmails,
  campaignAllocations,
  campaigns,
  commissionProductRequests,
  creatorOfferReviews,
  creators,
  deals,
  drafts,
  giftedApplications,
  livePosts,
  sponsoredPosts,
} from "../src/db/schema";
import { respondToOffer } from "../src/lib/brand-offers";
import { commissionRequestSlotBlock, requestCommissionProduct, resolveProductRequest } from "../src/lib/commission-access";
import { saveCommissionCampaign, showCommissionInterest } from "../src/lib/commission-campaigns";
import { recordCreatorInterest, releaseOffer } from "../src/lib/creator-interest";
import { decideCreatorDealReview } from "../src/lib/creator-deal-review";
import {
  classifyDealCycle,
  freeDealSlot,
  freeDealSlotReason,
  giftedCycleFinished,
  productRequestReleasesSlot,
} from "../src/lib/free-deal-slot";
import { applyForGiftedOffer, createGiftedOffer } from "../src/lib/gifted";
import { admin, openTestDb } from "./harness";
import type { Viewer } from "../src/lib/types";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function viewerFor(id: string): Viewer {
  return { email: `${id}@example.com`, role: "creator", creatorId: id, name: id };
}

async function addCreator(db: PortalDb, id: string, tier: string, contracted = false) {
  await db.insert(creators).values({
    id,
    name: id,
    email: `${id}@example.com`,
    initials: "FC",
    tiktokStatus: "disconnected",
    instagramStatus: "disconnected",
    facebookStatus: "disconnected",
    youtubeStatus: "disconnected",
    emailStatus: "disconnected",
    isSeed: false,
    accountTier: tier,
    contracted,
    createdAt: "2026-11-02T00:00:00.000Z",
  });
}

async function addDeal(
  db: PortalDb,
  id: string,
  creatorId: string,
  workflowStage: string | null,
  extra: { brand?: string; status?: string; updatedAt?: string; createdAt?: string } = {},
) {
  const createdAt = extra.createdAt ?? "2026-11-01T00:00:00.000Z";
  await db.insert(deals).values({
    id,
    creatorId,
    brand: extra.brand ?? "Glow Soap",
    status: extra.status ?? "active",
    workflowStage,
    deliverablesJson: "[]",
    chipsJson: "[]",
    visibleToCreator: true,
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: 1,
    isSeed: false,
    createdAt,
    updatedAt: extra.updatedAt ?? createdAt,
  });
}

describe("free creator one-deal slot", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(async () => {
    db = openTestDb();
    await saveCommissionCampaign(db, {
      id: "slot-camp",
      brand: "SecretBrand",
      title: "Spring kit",
      description: "A commission post",
      terms: "Commission only",
      status: "open",
    });
  });

  test("the cycle helper maps draft delivery and posting without unlocking on either one alone", () => {
    assert.equal(classifyDealCycle({
      workflowStage: "draft_submitted",
      status: "active",
      draftReachedBrand: false,
      postingFinished: false,
    }), "holding");
    assert.equal(classifyDealCycle({
      workflowStage: "sent_to_brand",
      status: "active",
      draftReachedBrand: false,
      postingFinished: false,
    }), "holding");
    assert.equal(classifyDealCycle({
      workflowStage: "draft_due",
      status: "delivered",
      draftReachedBrand: false,
      postingFinished: false,
    }), "holding");
    assert.equal(classifyDealCycle({
      workflowStage: "scheduled_posted",
      status: "delivered",
      draftReachedBrand: false,
      postingFinished: false,
    }), "finished");
    assert.equal(classifyDealCycle({
      workflowStage: "draft_due",
      status: "active",
      draftReachedBrand: true,
      postingFinished: true,
    }), "finished");
    assert.equal(classifyDealCycle({ workflowStage: "creator_declined", status: "pitch", draftReachedBrand: false, postingFinished: false }), "released");
    assert.equal(classifyDealCycle({ workflowStage: "cancelled", status: "active", draftReachedBrand: true, postingFinished: false }), "released");
    assert.equal(classifyDealCycle({ workflowStage: "brand_withdrawn", status: "pitch", draftReachedBrand: false, postingFinished: false }), "released");
    assert.equal(classifyDealCycle({ workflowStage: "offer_shared", status: "pitch", draftReachedBrand: false, postingFinished: false }), "waiting");
    assert.equal(productRequestReleasesSlot("declined"), true);
    assert.equal(productRequestReleasesSlot("cancelled"), true);
    assert.equal(productRequestReleasesSlot("brand-withdrawn"), true);
    assert.equal(productRequestReleasesSlot("approved"), false);
    assert.equal(giftedCycleFinished("posted", null), true);
    assert.equal(giftedCycleFinished("delivered", null), false);
    assert.equal(giftedCycleFinished("charged", "2026-11-02T00:00:00.000Z"), true);
    assert.match(freeDealSlotReason("Glow Soap"), /Glow Soap is still open/);
    assert.match(freeDealSlotReason("Glow Soap"), /Deliver the draft to the brand, then finish posting/);
    assert.match(freeDealSlotReason("Glow Soap"), /Plus, Pro, and Business/);
    assert.equal(/\$\s?\d|minimum/i.test(freeDealSlotReason("Glow Soap")), false);
  });

  test("a free creator with an open deal is blocked until the draft is with the brand and the post is finished", async () => {
    await addCreator(db, "slot-free", "free");
    const viewer = viewerFor("slot-free");
    assert.equal((await freeDealSlot(db, "slot-free")).allowed, true);

    await addDeal(db, "slot-deal", "slot-free", "creator_interested");
    const blocked = await freeDealSlot(db, "slot-free");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.blockingDealId, "slot-deal");
    assert.match(blocked.reason ?? "", /Glow Soap/);
    assert.match(blocked.reason ?? "", /Deliver the draft/);
    const requested = await requestCommissionProduct(db, viewer, "slot-camp");
    assert.equal(requested.ok, false);
    if (!requested.ok) {
      assert.match(requested.error, /one deal at a time/);
      assert.equal(/SecretBrand|minimum|\$\s?\d/.test(requested.error), false);
    }

    await db.update(deals).set({ workflowStage: "draft_submitted" }).where(eq(deals.id, "slot-deal"));
    assert.equal((await freeDealSlot(db, "slot-free")).allowed, false);
    await db.update(deals).set({ workflowStage: "sent_to_brand" }).where(eq(deals.id, "slot-deal"));
    assert.equal((await freeDealSlot(db, "slot-free")).allowed, false);
    await db.update(deals).set({ workflowStage: "draft_due", status: "delivered" }).where(eq(deals.id, "slot-deal"));
    assert.equal((await freeDealSlot(db, "slot-free")).allowed, false);

    await db.update(deals).set({ workflowStage: "scheduled_posted", status: "delivered", updatedAt: "2026-11-03T00:00:00.000Z" }).where(eq(deals.id, "slot-deal"));
    assert.equal((await freeDealSlot(db, "slot-free")).allowed, true);
  });

  test("a sent draft plus a live or sponsored post unlocks, and a manager-only draft does not", async () => {
    await addCreator(db, "slot-signals", "free");
    await addDeal(db, "slot-signals-deal", "slot-signals", "draft_due");
    await db.insert(drafts).values({
      id: "slot-draft-new",
      dealId: "slot-signals-deal",
      version: 1,
      bytesReceived: 4,
      status: "new",
      isSeed: false,
      createdAt: "2026-11-02T00:00:00.000Z",
    });
    await db.insert(livePosts).values({
      id: "slot-live",
      dealId: "slot-signals-deal",
      platform: "tiktok",
      url: "https://example.com/live",
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-signals")).allowed, false);

    await db.update(drafts).set({ status: "email_awaiting_ok" }).where(eq(drafts.id, "slot-draft-new"));
    assert.equal((await freeDealSlot(db, "slot-signals")).allowed, false);
    await db.update(drafts).set({ status: "sent" }).where(eq(drafts.id, "slot-draft-new"));
    assert.equal((await freeDealSlot(db, "slot-signals")).allowed, true);

    await db.update(drafts).set({ status: "new" }).where(eq(drafts.id, "slot-draft-new"));
    await db.delete(livePosts).where(eq(livePosts.id, "slot-live"));
    await db.insert(drafts).values({
      id: "slot-draft-seed",
      dealId: "slot-signals-deal",
      version: 2,
      bytesReceived: 4,
      status: "sent",
      isSeed: true,
      createdAt: "2026-11-02T00:00:00.000Z",
    });
    await db.insert(sponsoredPosts).values({
      id: "slot-sponsored",
      brand: "Glow Soap",
      creatorId: "slot-signals",
      dealId: "slot-signals-deal",
      platform: "tiktok",
      postUrl: "https://example.com/sponsored",
      postedOn: "2026-11-02",
      deliverableTerms: "1 TikTok",
      createdBy: "slot-signals",
      createdByName: "slot-signals",
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-signals")).allowed, false);

    await db.insert(approvalEmails).values({
      id: "slot-video-email",
      dealId: "slot-signals-deal",
      gate: "video",
      status: "sent",
      toEmail: "brand@example.com",
      subject: "Draft",
      body: "The draft is ready.",
      fromEmail: "authentickambiz@gmail.com",
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-signals")).allowed, true);
  });

  test("declined, cancelled, and brand-withdrawn deals and requests free the slot", async () => {
    await addCreator(db, "slot-release", "free");
    await addDeal(db, "slot-release-deal", "slot-release", "draft_due");
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, false);
    await db.update(deals).set({ workflowStage: "creator_declined" }).where(eq(deals.id, "slot-release-deal"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(deals).set({ workflowStage: "draft_due" }).where(eq(deals.id, "slot-release-deal"));
    await db.update(deals).set({ workflowStage: "cancelled" }).where(eq(deals.id, "slot-release-deal"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(deals).set({ workflowStage: "brand_withdrawn" }).where(eq(deals.id, "slot-release-deal"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(deals).set({ workflowStage: "offer_shared" }).where(eq(deals.id, "slot-release-deal"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(deals).set({ workflowStage: "brand_quiet" }).where(eq(deals.id, "slot-release-deal"));
    assert.equal((await freeDealSlot(db, "slot-release")).blockingDealId, "slot-release-deal");

    await db.update(deals).set({ workflowStage: "cancelled" }).where(eq(deals.id, "slot-release-deal"));
    await db.insert(commissionProductRequests).values({
      id: "slot-open-req",
      creatorId: "slot-release",
      campaignId: "slot-camp",
      status: "open",
      createdAt: "2026-11-02T00:00:00.000Z",
      resolvedAt: null,
    });
    const open = await freeDealSlot(db, "slot-release");
    assert.equal(open.blockingDealId, "slot-open-req");
    assert.match(open.reason ?? "", /commission request/);
    assert.equal((open.reason ?? "").includes("SecretBrand"), false);
    assert.equal(await commissionRequestSlotBlock(db, "slot-release"), null);

    await db.update(commissionProductRequests).set({ status: "declined", resolvedAt: "2026-11-02T01:00:00.000Z" }).where(eq(commissionProductRequests.id, "slot-open-req"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(commissionProductRequests).set({ status: "cancelled" }).where(eq(commissionProductRequests.id, "slot-open-req"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
    await db.update(commissionProductRequests).set({ status: "brand_withdrawn" }).where(eq(commissionProductRequests.id, "slot-open-req"));
    assert.equal((await freeDealSlot(db, "slot-release")).allowed, true);
  });

  test("an approved commission request holds the slot until a later deal is drafted and posted", async () => {
    await addCreator(db, "slot-approved", "free");
    await db.insert(commissionProductRequests).values({
      id: "slot-approved-a",
      creatorId: "slot-approved",
      campaignId: "slot-camp",
      status: "approved",
      createdAt: "2026-11-01T00:00:00.000Z",
      resolvedAt: "2026-11-01T01:00:00.000Z",
    });
    await db.insert(commissionProductRequests).values({
      id: "slot-approved-b",
      creatorId: "slot-approved",
      campaignId: "slot-camp",
      status: "approved",
      createdAt: "2026-11-02T00:00:00.000Z",
      resolvedAt: "2026-11-02T01:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-approved")).blockingDealId, "slot-approved-a");
    assert.match(await commissionRequestSlotBlock(db, "slot-approved") ?? "", /one deal at a time/);

    await addDeal(db, "slot-approved-deal", "slot-approved", "scheduled_posted", {
      status: "delivered",
      updatedAt: "2026-11-03T00:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-approved")).blockingDealId, "slot-approved-b");

    await addDeal(db, "slot-approved-deal-2", "slot-approved", "paid", {
      status: "paid",
      updatedAt: "2026-11-04T00:00:00.000Z",
    });
    assert.equal((await freeDealSlot(db, "slot-approved")).allowed, true);
  });

  test("the commission limit message is unchanged, and a deal blocks even when the limit would allow another request", async () => {
    const previous = process.env.FREE_COMMISSION_LIMIT;
    process.env.FREE_COMMISSION_LIMIT = "1";
    try {
      await addCreator(db, "slot-limit", "free");
      const viewer = viewerFor("slot-limit");
      assert.equal((await requestCommissionProduct(db, viewer, "slot-camp")).ok, true);
      const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, "slot-limit"));
      await resolveProductRequest(db, admin, rows[0].id, "approved");
      const capped = await requestCommissionProduct(db, viewer, "slot-camp");
      assert.equal(capped.ok, false);
      if (!capped.ok) assert.match(capped.error, /free commission limit/);
    } finally {
      if (previous === undefined) delete process.env.FREE_COMMISSION_LIMIT;
      else process.env.FREE_COMMISSION_LIMIT = previous;
    }

    process.env.FREE_COMMISSION_LIMIT = "5";
    try {
      await addCreator(db, "slot-under-limit", "free");
      await addDeal(db, "slot-under-limit-deal", "slot-under-limit", "draft_due", { brand: "Cedar Co" });
      const blocked = await requestCommissionProduct(db, viewerFor("slot-under-limit"), "slot-camp");
      assert.equal(blocked.ok, false);
      if (!blocked.ok) assert.match(blocked.error, /Cedar Co/);
      await db.update(deals).set({ workflowStage: "scheduled_posted", status: "delivered" }).where(eq(deals.id, "slot-under-limit-deal"));
      assert.equal((await requestCommissionProduct(db, viewerFor("slot-under-limit"), "slot-camp")).ok, true);
    } finally {
      if (previous === undefined) delete process.env.FREE_COMMISSION_LIMIT;
      else process.env.FREE_COMMISSION_LIMIT = previous;
    }
  });

  test("paid tiers and signed or managed creators are not blocked", async () => {
    for (const tier of ["plus", "pro", "business", "managed"] as const) {
      await addCreator(db, `slot-${tier}`, tier);
      await addDeal(db, `slot-${tier}-deal`, `slot-${tier}`, "draft_due");
      assert.equal((await freeDealSlot(db, `slot-${tier}`)).allowed, true);
    }
    await addCreator(db, "slot-signed", "free", true);
    await addDeal(db, "slot-signed-deal", "slot-signed", "draft_due");
    assert.equal((await freeDealSlot(db, "slot-signed")).allowed, true);
    assert.equal((await freeDealSlot(db, "mariclare")).allowed, true);

    const plus = await requestCommissionProduct(db, viewerFor("slot-plus"), "slot-camp");
    assert.equal(plus.ok, false);
    if (!plus.ok) assert.match(plus.error, /free accounts/);

    const previous = process.env.FREE_COMMISSION_LIMIT;
    process.env.FREE_COMMISSION_LIMIT = "5";
    try {
      assert.equal((await requestCommissionProduct(db, viewerFor("slot-signed"), "slot-camp")).ok, true);
    } finally {
      if (previous === undefined) delete process.env.FREE_COMMISSION_LIMIT;
      else process.env.FREE_COMMISSION_LIMIT = previous;
    }
  });

  test("server accept and request paths refuse a second free-pool deal and still allow a pass", async () => {
    await addCreator(db, "slot-accept", "free");
    await addDeal(db, "slot-accept-held", "slot-accept", "product_received", { brand: "Held Brand" });
    const viewer = viewerFor("slot-accept");

    await db.insert(campaigns).values({
      id: "slot-offer",
      brand: "Nimbus",
      name: "Nimbus offer",
      budgetCents: 0,
      nichesJson: "[]",
      platformsJson: JSON.stringify(["TikTok"]),
      deliverablesJson: JSON.stringify(["TikTok video"]),
      slots: 1,
      status: "open",
      openOutside: false,
      updatedAt: "2026-11-02T00:00:00.000Z",
      kind: "offer",
      offerFlag: "commission_trainee",
    });
    await db.insert(campaignAllocations).values({
      id: "slot-alloc",
      campaignId: "slot-offer",
      creatorId: "slot-accept",
      prospectId: null,
      amountCents: 0,
      createdAt: "2026-11-02T00:00:00.000Z",
      response: "pending",
      question: null,
      respondedAt: null,
    });
    const accepted = await respondToOffer(db, viewer, { allocationId: "slot-alloc", decision: "accepted" });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) assert.match(accepted.error, /Held Brand/);
    const stillPending = await db.select().from(campaignAllocations).where(eq(campaignAllocations.id, "slot-alloc"));
    assert.equal(stillPending[0]?.response, "pending");
    const passed = await respondToOffer(db, viewer, { allocationId: "slot-alloc", decision: "declined" });
    assert.equal(passed.ok, true);

    await db.insert(creatorOfferReviews).values({
      id: "slot-review",
      creatorId: "slot-accept",
      brand: "Nimbus",
      contactEmail: "ada@nimbus.test",
      offerLabel: "One TikTok",
      summary: "Commission post",
      decision: null,
      counterNote: null,
      decidedAt: null,
      reviewMode: null,
      createdAt: "2026-11-02T00:00:00.000Z",
    });
    const reviewAccept = await decideCreatorDealReview(db, {
      offerId: "slot-review",
      creatorId: "slot-accept",
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(reviewAccept.ok, false);
    if (!reviewAccept.ok) assert.match(reviewAccept.error, /Held Brand/);
    const reviewPass = await decideCreatorDealReview(db, {
      offerId: "slot-review",
      creatorId: "slot-accept",
      actorRole: "creator",
      decision: "pass",
    });
    assert.equal(reviewPass.ok, true);

    const interest = await showCommissionInterest(db, viewer, "slot-camp");
    assert.equal(interest.ok, false);
    if (!interest.ok) assert.match(interest.error, /Held Brand/);

    const posted = await createGiftedOffer(db, {
      actorRole: "admin",
      actorName: "Kamron",
      brand: "Glow",
      product: "Glow bar",
      photos: "https://example.com/glow.jpg",
      deliverable: "1 TikTok",
      dueOn: "2026-11-20",
      retailValueCents: 2400,
    });
    assert.equal(posted.ok, true);
    if (!posted.ok) return;
    const gift = await applyForGiftedOffer(db, {
      offerId: posted.id,
      creatorId: "slot-accept",
      acceptTerms: true,
      termsVersion: "draft-2",
    });
    assert.equal(gift.ok, false);
    if (!gift.ok) assert.match(gift.error, /Held Brand/);

    await addDeal(db, "slot-shared", "slot-accept", "offer_received", { brand: "Shared Brand" });
    await db.update(deals).set({ contact: "ada@shared.test", visibleToCreator: true }).where(eq(deals.id, "slot-shared"));
    const released = await releaseOffer(db, {
      dealId: "slot-shared",
      actorEmail: admin.email,
      actorRole: "admin",
      brandEmail: "ada@shared.test",
    });
    assert.equal(released.ok, true);
    const choice = await recordCreatorInterest(db, {
      dealId: "slot-shared",
      creatorId: "slot-accept",
      creatorEmail: viewer.email,
      creatorName: viewer.name,
      decision: "interested",
    });
    assert.equal(choice.ok, false);
    if (!choice.ok) assert.match(choice.error, /Held Brand/);

    await db.update(deals).set({ workflowStage: "scheduled_posted", status: "delivered" }).where(eq(deals.id, "slot-accept-held"));
    const giftAfter = await applyForGiftedOffer(db, {
      offerId: posted.id,
      creatorId: "slot-accept",
      acceptTerms: true,
      termsVersion: "draft-2",
    });
    assert.equal(giftAfter.ok, true);
    if (!giftAfter.ok) return;
    assert.equal((await freeDealSlot(db, "slot-accept")).blockingDealId, giftAfter.id);
    await db.update(giftedApplications).set({
      status: "posted",
      postUrl: "https://example.com/glow-post",
      postedAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    }).where(eq(giftedApplications.id, giftAfter.id));
    assert.equal((await freeDealSlot(db, "slot-accept")).allowed, true);

    await addCreator(db, "slot-plus-accept", "plus");
    await addDeal(db, "slot-plus-held", "slot-plus-accept", "draft_due");
    await db.insert(campaignAllocations).values({
      id: "slot-plus-alloc",
      campaignId: "slot-offer",
      creatorId: "slot-plus-accept",
      prospectId: null,
      amountCents: 0,
      createdAt: "2026-11-02T00:00:00.000Z",
      response: "pending",
      question: null,
      respondedAt: null,
    });
    const plusAccept = await respondToOffer(db, viewerFor("slot-plus-accept"), { allocationId: "slot-plus-alloc", decision: "accepted" });
    assert.equal(plusAccept.ok, true);
  });

  test("the deal and request screens explain the open deal", () => {
    for (const file of [
      "src/app/commission/page.tsx",
      "src/app/offers/page.tsx",
      "src/app/gifts/page.tsx",
      "src/app/deals/[id]/page.tsx",
      "src/app/page.tsx",
    ]) {
      assert.match(source(file), /freeDealSlot/);
    }
    assert.match(source("src/components/deal-board.tsx"), /dealSlotReason/);
    assert.match(source("src/components/creator-deal-review.tsx"), /acceptLocked/);
    assert.match(source("src/app/free-actions.ts"), /commissionRequestSlotBlock/);
    assert.match(source("src/lib/commission-access.ts"), /row\.status !== "cancelled"/);
    assert.match(source("src/lib/free-deal-slot.ts"), /export async function freeDealSlot/);
  });
});
