import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { kitErrorCode, kitErrorNote } from "../src/lib/kit-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("media kit error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a media kit link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(kitErrorCode("Bio can be 280 characters."), "bio");
    assert.equal(kitErrorCode("Followers and average views are whole numbers."), "numbers");
    assert.equal(kitErrorCode("You can only edit your own media kit."), "own");
    assert.equal(kitErrorCode("anything else"), "1");
    assert.equal(kitErrorNote("name"), "Add a display name before sharing the kit.");
    assert.equal(kitErrorNote("1"), "That was not saved.");
    assert.equal(kitErrorNote("hello world"), "That was not saved.");
    assert.equal(kitErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(kitErrorNote(undefined), null);

    const page = source("src/app/media-kit/page.tsx");
    assert.match(page, /kitErrorNote\(params\.kitError\)/);
    assert.match(page, /Saved\. Nothing was emailed or charged\./);
    assert.equal(page.includes("{params.kitError}"), false);
    const action = source("src/app/media-kit-actions.ts");
    assert.match(action, /kitError=\$\{kitErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("kitError=${encodeURIComponent(result.error)}"), false);

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
