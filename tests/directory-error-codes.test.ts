import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { directoryErrorCode, directoryErrorNote, moderateProfileField } from "../src/lib/profiles";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("directory error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a members link cannot invent the error text, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const blocked = await moderateProfileField(db, mariclare, {
      creatorId: "abby",
      field: "bio",
      action: "hide",
      reason: "Checking the code only",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(directoryErrorCode(blocked.error), "owner");
      assert.equal(directoryErrorNote("owner"), blocked.error);
    }
    assert.equal(directoryErrorCode("Tell the creator why."), "reason");
    assert.equal(directoryErrorCode("Unknown profile field."), "field");
    assert.equal(directoryErrorCode("That profile is not set up yet."), "missing");
    assert.equal(directoryErrorCode("anything else"), "1");
    assert.equal(directoryErrorNote("1"), "That change was not saved.");
    assert.equal(directoryErrorNote("hello world"), "That change was not saved.");
    assert.equal(directoryErrorNote("<script>alert(1)</script>"), "That change was not saved.");
    assert.equal(directoryErrorNote(undefined), null);

    const page = source("src/app/directory/page.tsx");
    assert.match(page, /directoryErrorNote\(params\.directoryError\)/);
    assert.doesNotMatch(page, /\{params\.directoryError\}/);
    const action = source("src/app/profile-actions.ts");
    const moderate = action.slice(action.indexOf("export async function moderateProfileAction"));
    assert.match(moderate, /directoryError=\$\{directoryErrorCode\(result\.error\)\}/);
    assert.doesNotMatch(moderate, /encodeURIComponent\(result\.error\)/);

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
