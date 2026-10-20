import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { settingsErrorCode, settingsErrorNote, supportErrorCode, supportErrorNote } from "../src/lib/account-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("account error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("settings and support links cannot invent their own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(settingsErrorCode("Settings for notices are on the creator's own sign-in."), "own");
    assert.equal(settingsErrorCode("anything else"), "1");
    assert.equal(settingsErrorNote("own"), "Settings for notices are on the creator's own sign-in.");
    assert.equal(settingsErrorNote("hello world"), "That was not saved.");
    assert.equal(settingsErrorNote(undefined), null);

    assert.equal(supportErrorCode("Add a subject."), "subject");
    assert.equal(supportErrorCode("That note is too long."), "long");
    assert.equal(supportErrorCode("anything else"), "1");
    assert.equal(supportErrorNote("body"), "Write a message.");
    assert.equal(supportErrorNote("hello world"), "That was not saved.");
    assert.equal(supportErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(supportErrorNote(undefined), null);

    const settings = source("src/app/settings/page.tsx");
    assert.match(settings, /settingsErrorNote\(params\.settingsError\)/);
    assert.match(settings, /Saved\. Nothing was emailed\./);
    assert.equal(settings.includes("{params.settingsError}"), false);
    const support = source("src/app/support/page.tsx");
    assert.match(support, /supportErrorNote\(params\.supportError\)/);
    assert.match(support, /No notes yet\. Nothing is emailed\./);
    assert.match(support, /Saved in the portal\. Nothing was sent\./);
    assert.equal(support.includes("{params.supportError}"), false);
    const action = source("src/app/account-actions.ts");
    assert.match(action, /settingsError=\$\{settingsErrorCode\(result\.error\)\}/);
    assert.match(action, /supportError=\$\{supportErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("settingsError=${encodeURIComponent"), false);
    assert.equal(action.includes("supportError=${encodeURIComponent"), false);

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
