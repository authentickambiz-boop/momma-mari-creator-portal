import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { giftErrorCode, giftErrorNote } from "../src/lib/gift-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("gift error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a free-product link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(giftErrorCode("Use a due date like 2026-11-20."), "due");
    assert.equal(giftErrorCode("Accept the current terms before you apply."), "terms");
    assert.equal(giftErrorCode("Only Kamron can update this."), "update");
    assert.equal(giftErrorCode("anything else"), "1");
    assert.equal(giftErrorNote("due"), "Use a due date like 2026-11-20.");
    assert.equal(giftErrorNote("1"), "That was not saved.");
    assert.equal(giftErrorNote("hello world"), "That was not saved.");
    assert.equal(giftErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(giftErrorNote(undefined), null);

    for (const file of ["src/app/gifts/page.tsx", "src/app/gifts/apply/page.tsx"]) {
      const page = source(file);
      assert.match(page, /giftErrorNote\(params\.giftsError\)/);
      assert.equal(page.includes("{params.giftsError}"), false);
    }
    const action = source("src/app/gift-actions.ts");
    assert.match(action, /giftsError", giftErrorCode\(error\)/);
    assert.equal(action.includes('query.set("giftsError", error)'), false);

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
