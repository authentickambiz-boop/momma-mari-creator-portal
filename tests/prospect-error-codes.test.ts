import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { prospectErrorCode, prospectErrorNote } from "../src/lib/prospect-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("prospect error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a prospect link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(prospectErrorCode("Only an owner can add a prospect."), "owner");
    assert.equal(prospectErrorCode("Add a real email address."), "email");
    assert.equal(prospectErrorCode("Pick a creator who is already on the roster."), "roster");
    assert.equal(prospectErrorCode("anything else"), "1");
    assert.equal(prospectErrorNote("email"), "Add a real email address.");
    assert.equal(prospectErrorNote("1"), "That was not saved.");
    assert.equal(prospectErrorNote("hello world"), "That was not saved.");
    assert.equal(prospectErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(prospectErrorNote(undefined), null);

    const page = source("src/app/prospects/page.tsx");
    assert.match(page, /prospectErrorNote\(params\.prospectError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.prospectError}"), false);
    const action = source("src/app/campaign-actions.ts");
    assert.match(action, /prospectError=\$\{prospectErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("prospectError=${encodeURIComponent(result.error)}"), false);

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
