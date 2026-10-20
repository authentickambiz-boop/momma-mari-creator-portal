import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { brandErrorCode, brandErrorNote } from "../src/lib/brand-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("brand error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a brand link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(brandErrorCode("Only an owner can update the brand list."), "owner");
    assert.equal(brandErrorCode("That brand is not on a deal yet."), "missing");
    assert.equal(brandErrorCode("Choose interested, declined, no reply, or negotiating."), "response");
    assert.equal(brandErrorCode("anything else"), "1");
    assert.equal(brandErrorNote("missing"), "That brand is not on a deal yet.");
    assert.equal(brandErrorNote("1"), "That was not saved.");
    assert.equal(brandErrorNote("hello world"), "That was not saved.");
    assert.equal(brandErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(brandErrorNote(undefined), null);

    const page = source("src/app/brands/page.tsx");
    assert.match(page, /brandErrorNote\(params\.brandError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.match(page, /No brands on this list yet\./);
    assert.equal(page.includes("{params.brandError}"), false);
    const action = source("src/app/brand-actions.ts");
    assert.match(action, /brandError=\$\{brandErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("brandError=${encodeURIComponent(result.error)}"), false);

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
