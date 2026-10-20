import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { inviteErrorCode, inviteErrorNote } from "../src/lib/invite-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("invite error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a home or dashboard link cannot invent invite wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(inviteErrorCode("Invite not found."), "missing");
    assert.equal(inviteErrorCode("That invite is not yours."), "own");
    assert.equal(inviteErrorCode("anything else"), "1");
    assert.equal(inviteErrorNote("missing"), "Invite not found.");
    assert.equal(inviteErrorNote("1"), "That was not saved.");
    assert.equal(inviteErrorNote("hello world"), "That was not saved.");
    assert.equal(inviteErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(inviteErrorNote(undefined), null);

    const home = source("src/app/page.tsx");
    assert.match(home, /inviteErrorNote\(params\.invite\)/);
    assert.equal(home.includes("{params.invite}"), false);
    const dash = source("src/app/dashboard/page.tsx");
    assert.match(dash, /inviteErrorNote\(params\.invite\)/);
    assert.match(dash, /Saved\. Nothing was paid or billed\./);
    assert.equal(dash.includes("{params.invite}"), false);
    const action = source("src/app/invite-actions.ts");
    assert.match(action, /invite=\$\{inviteErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("invite=${encodeURIComponent(result.error)}"), false);

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
