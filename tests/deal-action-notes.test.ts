import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("deal action notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a failed deal change says nothing was sent, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const deal = source("src/app/deals/[id]/page.tsx");
    assert.match(deal, /Your signature is saved\. Nothing was emailed\./);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /That choice was not saved\. Nothing was emailed\./);
    assert.match(board, /That stage was not saved\. Nothing was changed\./);
    assert.match(board, /That review was not saved\. Nothing was emailed\./);
    assert.match(board, /That tracking was not saved\. Nothing was changed\./);
    assert.match(board, /That post was not saved\. Nothing was emailed\./);
    assert.match(board, /That payment step was not saved\. Nothing was charged\./);
    assert.match(board, /That contract change was not saved\. Nothing was emailed\./);

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
