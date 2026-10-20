import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { rulesErrorCode, rulesErrorNote } from "../src/lib/rules-notes";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("deal rules error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a deal-rules link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(rulesErrorCode("Enter the minimum profit in dollars."), "profit");
    assert.equal(rulesErrorCode("You can't edit these deal rules."), "edit");
    assert.equal(rulesErrorCode("That deal is not on the list."), "missing");
    assert.equal(rulesErrorCode("anything else"), "1");
    assert.equal(rulesErrorNote("floor"), "Only an owner can set the agency minimum.");
    assert.equal(rulesErrorNote("1"), "That was not saved.");
    assert.equal(rulesErrorNote("hello world"), "That was not saved.");
    assert.equal(rulesErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(rulesErrorNote(undefined), null);

    const page = source("src/app/rules/page.tsx");
    assert.match(page, /rulesErrorNote\(params\.rulesError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.rulesError}"), false);
    const deal = source("src/app/deals/[id]/page.tsx");
    assert.match(deal, /rulesErrorNote\(query\.rulesError\)/);
    assert.match(deal, /query\.saved === "1"/);
    assert.equal(deal.includes("{query.rulesError}"), false);
    const action = source("src/app/rules-actions.ts");
    assert.match(action, /rulesError=\$\{rulesErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("encodeURIComponent(result.error)"), false);

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
