import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { creatorProfiles } from "../src/db/schema";
import { profileErrorCode, profileErrorNote } from "../src/lib/profile-notes";
import { hideMyProfile } from "../src/lib/profiles";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("hide profile notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("an owner cannot hide a creator profile, and nothing is marked saved", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const profilesBefore = await db.select().from(creatorProfiles);

    const refused = await hideMyProfile(db, admin);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error, "You can only edit your own profile.");
      assert.equal(profileErrorCode(refused.error), "own");
    }
    assert.equal(profileErrorNote("own"), "You can only edit your own profile.");
    assert.equal(profileErrorNote("hello"), "That was not saved.");
    assert.equal(profileErrorCode("nope"), "1");

    const actions = source("src/app/profile-actions.ts");
    const hide = actions.slice(actions.indexOf("export async function hideProfileAction"), actions.indexOf("export async function moderateProfileAction"));
    assert.match(hide, /profileError=\$\{profileErrorCode\(result\.error\)\}/);
    assert.match(hide, /if \(!result\.ok\)/);
    assert.equal(hide.includes("saved=1"), true);
    const page = source("src/app/profile/page.tsx");
    assert.match(page, /Creators edit their own profile\. You can hide a field from Members\./);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.match(page, /profileErrorNote\(params\.profileError\)/);

    const profilesAfter = await db.select().from(creatorProfiles);
    assert.equal(profilesAfter.length, profilesBefore.length);
    for (const row of profilesAfter) {
      const before = profilesBefore.find((item) => item.creatorId === row.creatorId);
      assert.equal(row.profileOn, before?.profileOn);
    }
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
