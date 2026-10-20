import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { snapshotErrorCode, snapshotErrorNote } from "../src/lib/snapshot-notes";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("snapshot error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("an analytics link cannot invent its own snapshot wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(snapshotErrorCode("Enter the capture date as YYYY-MM-DD."), "date");
    assert.equal(snapshotErrorCode("Only an owner can enter a snapshot."), "owner");
    assert.equal(snapshotErrorCode("Pick a platform from the list."), "platform");
    assert.equal(snapshotErrorCode("anything else"), "1");
    assert.equal(snapshotErrorNote("revenue"), "Revenue has to be a dollar amount, or left blank.");
    assert.equal(snapshotErrorNote("1"), "That was not saved.");
    assert.equal(snapshotErrorNote("hello world"), "That was not saved.");
    assert.equal(snapshotErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(snapshotErrorNote(undefined), null);

    const page = source("src/app/analytics/page.tsx");
    assert.match(page, /snapshotErrorNote\(params\.snapshotError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.snapshotError}"), false);
    const action = source("src/app/growth-actions.ts");
    assert.match(action, /snapshotError=\$\{snapshotErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("snapshotError=${encodeURIComponent(result.error)}"), false);

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
