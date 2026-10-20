import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { offerErrorCode, offerErrorNote } from "../src/lib/offer-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("offer error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("an offer link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(offerErrorCode("Enter each budget in dollars, like 500, or leave it blank."), "dollars");
    assert.equal(offerErrorCode("Only an owner can send a brand offer."), "owner");
    assert.equal(offerErrorCode("That offer is not on your list."), "list");
    assert.equal(offerErrorCode("You can't move this deal."), "move");
    assert.equal(offerErrorCode("anything else"), "1");
    assert.equal(offerErrorNote("dollars"), "Enter each budget in dollars, like 500, or leave it blank.");
    assert.equal(offerErrorNote("1"), "That was not saved.");
    assert.equal(offerErrorNote("hello world"), "That was not saved.");
    assert.equal(offerErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(offerErrorNote(undefined), null);

    const page = source("src/app/offers/page.tsx");
    assert.match(page, /offerErrorNote\(params\.offerError\)/);
    assert.match(page, /Save offer/);
    assert.match(page, /This adds the offer to her portal\. Nothing is emailed\./);
    assert.equal(page.includes("Send offer"), false);
    assert.equal(page.includes("{params.offerError}"), false);
    const action = source("src/app/offer-actions.ts");
    assert.match(action, /offerError=\$\{offerErrorCode\(parsed\.error\)\}/);
    assert.match(action, /offerError=\$\{offerErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("offerError=${encodeURIComponent"), false);

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
