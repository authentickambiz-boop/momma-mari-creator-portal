import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { adminNotifications, deals } from "../src/db/schema";
import {
  CREATOR_REVIEW_EMPTY,
  creatorReviewNeedsAction,
  decideCreatorDealReview,
  listBotOfferReviews,
  listCreatorDealReviews,
  listOwnerDealReviews,
  upsertOfferReview,
  type CreatorDealReview,
} from "../src/lib/creator-deal-review";
import { creatorBrandDealNeedsAction } from "../src/lib/creator-home";
import { listDealsForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function card(partial: Partial<CreatorDealReview> & Pick<CreatorDealReview, "offerLabel" | "summary">): Pick<CreatorDealReview, "offerLabel" | "summary" | "reviewMode" | "decision"> {
  return {
    offerLabel: partial.offerLabel,
    summary: partial.summary,
    reviewMode: partial.reviewMode ?? null,
    decision: partial.decision ?? null,
  };
}

describe("creator home review actions", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the creator home keeps cards she can answer and hides the rest", () => {
    assert.equal(CREATOR_REVIEW_EMPTY, "Nothing needs you right now");
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "$450 per post",
      summary: "4 posts over 30 days, starting in 1-2 weeks.",
    })), true);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Countered: 2 videos, 30-day usage",
      summary: "Temu wanted 360 days of paid ads. We countered with 2 videos and 30 days of paid usage. Waiting on Temu. You can suggest a counter, but don't accept.",
      reviewMode: "counter",
    })), true);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Please answer",
      summary: "Can you post this Friday?",
    })), true);

    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Duplicate: closed",
      summary: "Duplicate of the other Persona card. The $450-per-post offer was passed; nothing to answer here.",
      reviewMode: "info",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Declined Oct 20, 2026",
      summary: "Declined on Oct 20, 2026. Nothing for you to answer; this card is closed.",
      reviewMode: "info",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "On hold: terms still needed",
      summary: "Nothing to decide yet.",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Waiting on the brand",
      summary: "Kamron replied on Oct 21. Nothing for you to answer right now.",
      reviewMode: "info",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "For your notes",
      summary: "For your information. Nothing to accept.",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "$2,000",
      summary: "Already answered.",
      decision: "declined",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "$300",
      summary: "One story set.",
      decision: "pass",
    })), false);
    assert.equal(creatorReviewNeedsAction(card({
      offerLabel: "Gift",
      summary: "She accepted.",
      decision: "accept",
    })), false);

    const home = source("src/app/page.tsx");
    const offersPage = source("src/app/offers/page.tsx");
    const view = source("src/components/creator-deal-review.tsx");
    assert.equal(home.includes("CreatorDealReviewCard"), false);
    assert.match(home, /creatorBrandDealNeedsAction/);
    assert.match(home, /Nothing needs you this week\./);
    assert.match(home, /SeasonalGreeting/);
    assert.match(offersPage, /CreatorDealReviewCard/);
    assert.match(offersPage, /CREATOR_REVIEW_EMPTY/);
    assert.match(offersPage, /Your minimum stays private/);
    assert.match(offersPage, /I&apos;m interested/);
    assert.match(offersPage, /Suggest a counter/);
    assert.match(view, /creatorReviewNeedsAction/);
    assert.match(view, /CREATOR_REVIEW_EMPTY/);
    assert.match(view, /Nothing to accept/);
    assert.match(view, /I&apos;m interested/);
    assert.match(view, /Suggest a counter/);
    assert.match(view, />Pass</);
    assert.equal(source("src/components/owner-signals.tsx").includes("creatorReviewNeedsAction"), false);
    assert.equal(source("src/app/dashboard/page.tsx").includes("creatorReviewNeedsAction"), false);
    assert.match(source("src/lib/help-center.ts"), /Offers are new brand offers/);
    assert.match(source("src/lib/education.ts"), /Offers page/);
  });

  test("owner and bot lists still include cards the creator home hides", async () => {
    const seeded = await listCreatorDealReviews(db, "mariclare");
    assert.equal(seeded.length >= 2, true);
    assert.equal(seeded.filter(creatorReviewNeedsAction).length, seeded.length);

    const resting = await upsertOfferReview(db, {
      id: "review-home-momcozy",
      creatorId: "mariclare",
      brand: "Momcozy",
      contactEmail: "betty@momcozy.com",
      offerLabel: "Waiting on the brand",
      summary: "Kamron replied on Oct 21. Nothing for you to answer right now.",
      reviewMode: "info",
    });
    assert.equal(resting.status, 201);
    const acting = await upsertOfferReview(db, {
      id: "review-home-temu",
      creatorId: "mariclare",
      brand: "Temu (via Link Lark)",
      contactEmail: "generalhotline24@gmail.com",
      offerLabel: "Countered: 2 videos, 30-day usage",
      summary: "Waiting on Temu. You can suggest a counter, but don't accept.",
      reviewMode: "counter",
    });
    assert.equal(acting.status, 201);

    const creator = await listCreatorDealReviews(db, "mariclare");
    assert.equal(creator.some((offer) => offer.id === "review-home-momcozy"), true);
    assert.equal(creator.filter(creatorReviewNeedsAction).some((offer) => offer.id === "review-home-momcozy"), false);
    assert.equal(creator.filter(creatorReviewNeedsAction).some((offer) => offer.id === "review-home-temu"), true);

    const owner = await listOwnerDealReviews(db, admin);
    assert.equal(owner.ok, true);
    if (owner.ok) {
      assert.equal(owner.reviews.some((offer) => offer.id === "review-home-momcozy"), true);
      assert.equal(owner.reviews.some((offer) => offer.id === "review-home-temu"), true);
      assert.equal(owner.reviews.some((offer) => offer.brand === "Persona"), true);
    }

    const bot = await listBotOfferReviews(db, "mariclare");
    assert.equal(bot.status, 200);
    const reviews = (bot.body as { reviews: { id: string }[] }).reviews;
    assert.equal(reviews.some((offer) => offer.id === "review-home-momcozy"), true);
    assert.equal(reviews.some((offer) => offer.id === "review-home-temu"), true);

    const open = await upsertOfferReview(db, {
      id: "review-home-open",
      creatorId: "mariclare",
      brand: "Open Soap",
      contactEmail: "hello@opensoap.test",
      offerLabel: "$450 per post",
      summary: "One TikTok next month.",
    });
    assert.equal(open.status, 201);
    const noticesBefore = (await db.select().from(adminNotifications)).length;
    const accepted = await decideCreatorDealReview(db, {
      offerId: "review-home-open",
      creatorId: "mariclare",
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(accepted.ok, true);
    const placed = (await db.select().from(deals).where(eq(deals.id, "accepted-review-home-open")))[0];
    assert.equal(placed?.workflowStage, "creator_interested");
    assert.equal(placed?.visibleToCreator, true);
    assert.equal(placed?.rateCents ?? null, null);
    assert.equal(JSON.stringify(placed).toLowerCase().includes("minimum"), false);
    assert.equal(creatorBrandDealNeedsAction(placed!), false);
    assert.equal(creatorBrandDealNeedsAction({
      visibleToCreator: true,
      needsCreator: false,
      uploadEnabled: true,
      workflowStage: "draft_due",
      status: "active",
    }), true);
    assert.equal(creatorBrandDealNeedsAction({
      visibleToCreator: true,
      needsCreator: false,
      workflowStage: "offer_shared",
      status: "pitch",
    }), false);
    assert.equal(creatorBrandDealNeedsAction({
      visibleToCreator: true,
      needsCreator: false,
      workflowStage: "on_hold",
      status: "active",
    }), false);
    const creatorDeals = await listDealsForViewer(db, mariclare, "mariclare");
    const ownerDeals = await listDealsForViewer(db, admin, "mariclare");
    assert.equal(creatorDeals.some((deal) => deal.brand === "Open Soap"), true);
    assert.equal(ownerDeals.some((deal) => deal.brand === "Open Soap"), true);
    assert.equal(creatorDeals.filter(creatorBrandDealNeedsAction).some((deal) => deal.brand === "Open Soap"), false);
    assert.equal((await db.select().from(adminNotifications)).length > noticesBefore, true);
    const note = (await db.select().from(adminNotifications)).find((row) => row.message.includes("Open Soap"));
    assert.match(note?.message ?? "", /accepted Open Soap/);
    assert.equal((note?.message ?? "").toLowerCase().includes("minimum"), false);
  });
});
