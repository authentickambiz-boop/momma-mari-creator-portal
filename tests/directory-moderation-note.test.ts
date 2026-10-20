import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { moderateProfileField } from "../src/lib/profiles";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("directory moderation note", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a profile field change says nothing was emailed, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const directory = source("src/app/directory/page.tsx");
    assert.match(directory, /Saved\. Nothing was emailed\./);
    assert.match(directory, /Nothing was emailed\./);
    assert.match(directory, /No public profiles yet\. Nothing is emailed\./);
    const action = source("src/app/profile-actions.ts");
    const moderate = action.slice(action.indexOf("export async function moderateProfileAction"));
    assert.match(moderate, /directoryError=/);
    assert.match(moderate, /\/directory\?saved=1/);

    const blocked = await moderateProfileField(db, mariclare, {
      creatorId: "abby",
      field: "bio",
      action: "hide",
      reason: "Checking the note only",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error, "Only an owner can hide or reset a profile field.");

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
