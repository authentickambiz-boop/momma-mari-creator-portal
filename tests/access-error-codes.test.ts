import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { accessErrorCode, accessErrorNote } from "../src/lib/access-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("access error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("an access link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(accessErrorCode("Pick a person or a bot."), "person");
    assert.equal(accessErrorCode("Mark the training complete before raising this level."), "training");
    assert.equal(accessErrorCode("That creator is not on your list."), "list");
    assert.equal(accessErrorCode("Deal not found."), "deal");
    assert.equal(accessErrorCode("anything else"), "1");
    assert.equal(accessErrorNote("training"), "Mark the training complete before raising this level.");
    assert.equal(accessErrorNote("1"), "That was not saved.");
    assert.equal(accessErrorNote("hello world"), "That was not saved.");
    assert.equal(accessErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(accessErrorNote(undefined), null);

    const page = source("src/app/access/page.tsx");
    assert.match(page, /accessErrorNote\(params\.accessError\)/);
    assert.equal(page.includes("{params.accessError}"), false);
    const action = source("src/app/capability-actions.ts");
    assert.match(action, /accessError=\$\{accessErrorCode\(error\)\}|accessError", accessErrorCode\(error\)/);
    assert.equal(action.includes("encodeURIComponent(error)"), false);
    assert.equal(action.includes('query.set("accessError", error)'), false);

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
