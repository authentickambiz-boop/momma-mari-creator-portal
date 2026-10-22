import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { profileErrorCode, profileErrorNote } from "../src/lib/profile-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("profile error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a profile link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(profileErrorCode("You can only edit your own profile."), "own");
    assert.equal(profileErrorCode("Bio can be 160 characters."), "bio");
    assert.equal(profileErrorCode("Confirm the family details before saving them."), "family");
    assert.equal(profileErrorCode("anything else"), "1");
    assert.equal(profileErrorNote("name"), "Add a display name before showing your profile.");
    assert.equal(profileErrorNote("1"), "That was not saved.");
    assert.equal(profileErrorNote("hello world"), "That was not saved.");
    assert.equal(profileErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(profileErrorNote(undefined), null);

    const page = source("src/app/profile/page.tsx");
    assert.match(page, /profileErrorNote\(params\.profileError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.profileError}"), false);
    const action = source("src/app/profile-actions.ts");
    assert.match(action, /profileError=\$\{profileErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("profileError=${encodeURIComponent(result.error)}"), false);

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
