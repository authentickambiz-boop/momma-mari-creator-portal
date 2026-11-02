import { eq, inArray } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  commissionProductRequests,
  deals,
  drafts,
  giftedApplications,
  giftedOffers,
  livePosts,
  sponsoredPosts,
} from "@/db/schema";
import { accountTierFor } from "./account-tier";
import { creatorIsSigned } from "./signed-creators";

/**
 * Kamron, Nov 2, 2026: a free-tier creator holds one deal at a time.
 * The next free-pool or commission-only offer unlocks only after the brand
 * has the draft AND the posting cycle is finished.
 *
 * Paid tiers and signed creators skip this. The commission-limit counter
 * stays in commission-access.ts so a later count-mode change does not have
 * to edit this file.
 */
export type FreeDealSlot = {
  allowed: boolean;
  reason: string | null;
  blockingDealId: string | null;
};

export const FREE_DEAL_SLOT_PREFIX = "You can hold one deal at a time on the free plan.";

export const FREE_DEAL_SLOT_FALLBACK =
  "You can hold one deal at a time on the free plan. Deliver the draft to the brand, then finish posting, and the next deal unlocks. Plus, Pro, and Business can hold more than one deal.";

const ALLOWED: FreeDealSlot = { allowed: true, reason: null, blockingDealId: null };

/** Stages where the brand already has the draft. Draft submitted is earlier: the manager still has it. */
const BRAND_HAS_DRAFT_STAGES = new Set([
  "sent_to_brand",
  "brand_revisions",
  "brand_approved",
  "scheduled_posted",
  "payment_pending",
  "paid",
]);

/** Posting cycle finished: the sponsored post is live, or the deal is marked posted or paid. */
const POSTED_STAGES = new Set(["scheduled_posted", "payment_pending", "paid"]);

/**
 * An offer waiting on the creator's answer is not a held deal yet.
 * Accepting it is what takes the slot.
 */
const NOT_HELD_YET = new Set(["offer_received", "offer_shared"]);

/** Draft rows that mean the brand has the file. email_awaiting_ok is still waiting on Kamron. */
const DRAFT_WITH_BRAND = new Set(["sent", "approved"]);

export type DealCycle = "released" | "waiting" | "finished" | "holding";

export function freeDealSlotReason(label: string) {
  const name = label.trim() || "Your open deal";
  return `${FREE_DEAL_SLOT_PREFIX} ${name} is still open. Deliver the draft to the brand, then finish posting, and the next deal unlocks. Plus, Pro, and Business can hold more than one deal.`;
}

export function freeDealSlotCode(error: string) {
  return error.startsWith(FREE_DEAL_SLOT_PREFIX) ? "deal-slot" as const : null;
}

function stageId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Declined, cancelled, and brand-withdrawn free the slot.
 * Assumption: there is no brand_withdrawn stage. "cancelled" is the kill-fee stage.
 * A stage or request status whose id contains "withdraw" is treated the same way.
 */
export function dealStageReleasesSlot(workflowStage: string | null | undefined) {
  const stage = stageId(workflowStage);
  if (!stage) return false;
  return stage === "creator_declined" || stage === "cancelled" || stage.includes("withdraw");
}

export function productRequestReleasesSlot(status: string) {
  const value = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return value === "declined" || value === "cancelled" || value.includes("withdraw");
}

/**
 * Gifted applications have no draft handoff. The posted video is what the brand receives
 * and the end of the posting cycle. Assumption: status "posted" or a postedAt timestamp
 * satisfies both conditions. Charged without a post still holds the slot.
 */
export function giftedCycleFinished(status: string, postedAt: string | null | undefined) {
  if (postedAt?.trim()) return true;
  return status.trim().toLowerCase() === "posted";
}

export function classifyDealCycle(input: {
  workflowStage: string | null;
  status: string;
  draftReachedBrand: boolean;
  postingFinished: boolean;
}): DealCycle {
  if (dealStageReleasesSlot(input.workflowStage)) return "released";
  const stage = stageId(input.workflowStage);
  if (NOT_HELD_YET.has(stage)) return "waiting";
  const draft = input.draftReachedBrand || BRAND_HAS_DRAFT_STAGES.has(stage);
  const posted = input.postingFinished || POSTED_STAGES.has(stage) || input.status === "delivered" || input.status === "paid";
  if (draft && posted) return "finished";
  return "holding";
}

type Blocker = { id: string; label: string; rank: number; stamp: string };

function openSlot(blocker: Blocker): FreeDealSlot {
  return {
    allowed: false,
    reason: freeDealSlotReason(blocker.label),
    blockingDealId: blocker.id,
  };
}

export async function freeDealSlot(db: PortalDb, creatorId: string): Promise<FreeDealSlot> {
  if (!creatorId) return ALLOWED;
  const tier = await accountTierFor(db, creatorId);
  if (tier !== "free") return ALLOWED;
  if (await creatorIsSigned(db, creatorId)) return ALLOWED;

  const [dealRows, requestRows, giftRows] = await Promise.all([
    db.select().from(deals).where(eq(deals.creatorId, creatorId)),
    db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, creatorId)),
    db.select().from(giftedApplications).where(eq(giftedApplications.creatorId, creatorId)),
  ]);

  const dealIds = dealRows.map((deal) => deal.id);
  const [draftRows, emailRows, liveRows, sponsoredRows] = dealIds.length
    ? await Promise.all([
        db.select({
          dealId: drafts.dealId,
          status: drafts.status,
          isSeed: drafts.isSeed,
        }).from(drafts).where(inArray(drafts.dealId, dealIds)),
        db.select({
          dealId: approvalEmails.dealId,
          gate: approvalEmails.gate,
          status: approvalEmails.status,
        }).from(approvalEmails).where(inArray(approvalEmails.dealId, dealIds)),
        db.select({ dealId: livePosts.dealId }).from(livePosts).where(inArray(livePosts.dealId, dealIds)),
        db.select({ dealId: sponsoredPosts.dealId }).from(sponsoredPosts).where(inArray(sponsoredPosts.dealId, dealIds)),
      ])
    : [[], [], [], []];

  const draftByDeal = new Set(
    draftRows.filter((row) => !row.isSeed && DRAFT_WITH_BRAND.has(row.status)).map((row) => row.dealId),
  );
  const videoSent = new Set(
    emailRows.filter((row) => row.gate === "video" && row.status === "sent").map((row) => row.dealId),
  );
  const liveByDeal = new Set(liveRows.map((row) => row.dealId));
  const sponsoredByDeal = new Set(sponsoredRows.map((row) => row.dealId).filter((id): id is string => Boolean(id)));

  const blockers: Blocker[] = [];
  const finished: { id: string; updatedAt: string }[] = [];

  for (const deal of dealRows) {
    const cycle = classifyDealCycle({
      workflowStage: deal.workflowStage,
      status: deal.status,
      draftReachedBrand: draftByDeal.has(deal.id) || videoSent.has(deal.id),
      postingFinished: liveByDeal.has(deal.id) || sponsoredByDeal.has(deal.id),
    });
    if (cycle === "finished") finished.push({ id: deal.id, updatedAt: deal.updatedAt });
    if (cycle !== "holding") continue;
    blockers.push({
      id: deal.id,
      label: deal.brand.trim() || "Your open deal",
      rank: 0,
      stamp: deal.updatedAt,
    });
  }

  if (giftRows.length) {
    const offerIds = [...new Set(giftRows.map((row) => row.offerId))];
    const offers = await db.select({
      id: giftedOffers.id,
      product: giftedOffers.product,
    }).from(giftedOffers).where(inArray(giftedOffers.id, offerIds));
    const productById = new Map(offers.map((offer) => [offer.id, offer.product.trim()]));
    for (const row of giftRows) {
      if (giftedCycleFinished(row.status, row.postedAt)) continue;
      const product = productById.get(row.offerId);
      blockers.push({
        id: row.id,
        label: product ? `Your free product (${product})` : "Your free product",
        rank: 1,
        stamp: row.updatedAt,
      });
    }
  }

  const finishedLeft = finished.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  const usedFinished = new Set<string>();
  const approved = requestRows
    .filter((row) => row.status === "approved")
    .sort((left, right) => (left.resolvedAt ?? left.createdAt).localeCompare(right.resolvedAt ?? right.createdAt));
  for (const request of approved) {
    const stamp = request.resolvedAt ?? request.createdAt;
    const match = finishedLeft.find((deal) => !usedFinished.has(deal.id) && deal.updatedAt >= stamp);
    if (match) {
      usedFinished.add(match.id);
      continue;
    }
    blockers.push({
      id: request.id,
      label: "Your commission request",
      rank: 2,
      stamp: request.createdAt,
    });
  }

  for (const request of requestRows) {
    if (request.status === "approved" || productRequestReleasesSlot(request.status)) continue;
    blockers.push({
      id: request.id,
      label: "Your commission request",
      rank: request.status === "open" ? 3 : 2,
      stamp: request.createdAt,
    });
  }

  if (!blockers.length) return ALLOWED;
  blockers.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.rank <= 1) return right.stamp.localeCompare(left.stamp);
    return left.stamp.localeCompare(right.stamp);
  });
  return openSlot(blockers[0]);
}
