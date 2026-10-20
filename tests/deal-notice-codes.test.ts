import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { dealNoticeCode, dealNoticeNote } from "../src/lib/deal-notice-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("deal notice codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a deal or review link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(dealNoticeCode("Write the reply first."), "reply");
    assert.equal(dealNoticeCode("Enter the rate in dollars."), "dollars");
    assert.equal(dealNoticeCode("This deal was rejected."), "rejected");
    assert.equal(dealNoticeCode("anything else"), "1");
    assert.equal(dealNoticeNote("rate"), "Set the agreed rate before asking the creator to confirm it.");
    assert.equal(dealNoticeNote("1"), "That was not saved.");
    assert.equal(dealNoticeNote("hello world"), "That was not saved.");
    assert.equal(dealNoticeNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(dealNoticeNote(undefined), null);

    const deal = source("src/app/deals/[id]/page.tsx");
    assert.match(deal, /dealNoticeNote\(query\.replyError\)/);
    assert.match(deal, /dealNoticeNote\(query\.rateError\)/);
    assert.match(deal, /dealNoticeNote\(query\.datesError\)/);
    assert.match(deal, /Draft saved\. Nothing was emailed\./);
    assert.match(deal, /Dates saved\. Nothing was emailed or paid\./);
    assert.equal(deal.includes("{query.replyError}"), false);
    assert.equal(deal.includes("{query.rateError}"), false);
    assert.equal(deal.includes("{query.datesError}"), false);
    const review = source("src/app/review/page.tsx");
    assert.match(review, /dealNoticeNote\(params\.reviewError\)/);
    assert.match(review, /params\.saved === "draft"/);
    assert.equal(review.includes("{params.reviewError}"), false);
    const action = source("src/app/review-actions.ts");
    assert.match(action, /replyError: dealNoticeCode\(result\.error\)/);
    assert.match(action, /reviewError", dealNoticeCode\(error\)/);
    assert.equal(action.includes("replyError: result.error"), false);

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
