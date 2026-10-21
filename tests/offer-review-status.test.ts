import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorOfferReviews } from "../src/db/schema";
import {
  dealReviewLabel,
  listBotOfferReviews,
  offerReviewStatus,
  reviewChoices,
  upsertOfferReview,
} from "../src/lib/creator-deal-review";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("offer review passed and declined", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a pass or decline is not waiting and has no accept button", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    assert.equal(offerReviewStatus("passed on Oct 21"), "passed");
    assert.equal(offerReviewStatus("declined Oct 21"), "declined");
    assert.equal(offerReviewStatus(null), "waiting");
    assert.equal(dealReviewLabel("passed on Oct 21").toLowerCase().includes("waiting"), false);
    assert.equal(dealReviewLabel("declined").toLowerCase().includes("waiting"), false);
    assert.equal(reviewChoices(null, "passed").includes("accept"), false);
    assert.equal(reviewChoices(null, "declined").includes("accept"), false);
    assert.equal(reviewChoices(null, null).includes("accept"), true);

    const passed = await upsertOfferReview(db, {
      id: "review-oct-pass",
      creatorId: "mariclare",
      brand: "Oct Pass",
      contactEmail: "hello@octpass.test",
      offerLabel: "One post",
      summary: "Creator reply on Oct 21.",
      status: "passed on Oct 21",
    });
    assert.equal(passed.status, 201);
    const passedBody = passed.body as { status: string; decision: string; choices: string[] };
    assert.equal(passedBody.status, "passed");
    assert.equal(passedBody.decision, "passed");
    assert.equal(passedBody.choices.includes("accept"), false);

    const declined = await upsertOfferReview(db, {
      id: "review-oct-decline",
      creatorEmail: "mmaclamroc@gmail.com",
      brand: "Oct Decline",
      contactEmail: "hello@octdecline.test",
      offerLabel: "Two posts",
      summary: "Creator reply on Oct 21.",
      decision: "declined",
    });
    assert.equal(declined.status, 201);
    const declinedBody = declined.body as { status: string; choices: string[] };
    assert.equal(declinedBody.status, "declined");
    assert.equal(declinedBody.choices.includes("accept"), false);

    const waiting = await upsertOfferReview(db, {
      id: "review-still-open",
      creatorId: "mariclare",
      brand: "Still Open",
      contactEmail: "hello@open.test",
      offerLabel: "Gift",
      summary: "No reply yet.",
      status: "waiting",
    });
    assert.equal(waiting.status, 201);
    const waitingBody = waiting.body as { status: string; choices: string[] };
    assert.equal(waitingBody.status, "waiting");
    assert.equal(waitingBody.choices.includes("accept"), true);

    const bogus = await upsertOfferReview(db, {
      id: "review-bogus",
      creatorId: "mariclare",
      brand: "Bogus",
      contactEmail: "hello@bogus.test",
      offerLabel: "Nope",
      summary: "Bad status.",
      status: "waiting on brand",
    });
    assert.equal(bogus.status, 400);

    const listed = await listBotOfferReviews(db, "mariclare");
    assert.equal(listed.status, 200);
    const cards = listed.body as { reviews: { id: string; status: string; answerLabel: string; choices: string[] }[] };
    const passCard = cards.reviews.find((offer) => offer.id === "review-oct-pass");
    const declineCard = cards.reviews.find((offer) => offer.id === "review-oct-decline");
    assert.equal(passCard?.status, "passed");
    assert.equal(passCard?.answerLabel, "Passed");
    assert.equal(passCard?.choices.includes("accept"), false);
    assert.equal(declineCard?.status, "declined");
    assert.equal(declineCard?.answerLabel, "Declined");
    assert.equal(declineCard?.choices.includes("accept"), false);
    assert.equal(JSON.stringify(passCard).toLowerCase().includes("waiting"), false);

    const kept = await upsertOfferReview(db, {
      id: "review-oct-pass",
      creatorId: "abby",
      brand: "Replaced",
      contactEmail: "other@example.test",
      offerLabel: "New",
      summary: "Should stay passed.",
      status: "waiting",
    });
    assert.equal(kept.status, 200);
    const keptBody = kept.body as { kept: boolean; status: string; brand: string };
    assert.equal(keptBody.kept, true);
    assert.equal(keptBody.status, "passed");
    assert.equal(keptBody.brand, "Oct Pass");
    const row = (await db.select().from(creatorOfferReviews).where(eq(creatorOfferReviews.id, "review-oct-pass")))[0];
    assert.equal(row?.decision, "passed");
    assert.equal(row?.brand, "Oct Pass");

    const card = source("src/components/creator-deal-review.tsx");
    const closed = card.slice(card.indexOf("closed ?"), card.indexOf(": offer.decision"));
    assert.match(closed, /Nothing to accept/);
    assert.equal(closed.includes("Accept"), false);
    assert.match(card, />Accept</);

    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
  });
});
