import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("gift status notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("shipped and delivered gifts say nothing was charged, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const gifts = source("src/app/gifts/page.tsx");
    assert.match(gifts, /Marked shipped\. Nothing was charged\./);
    assert.match(gifts, /Marked delivered\. Nothing was charged\./);
    assert.match(gifts, /Approved\. Nothing was charged or emailed\./);
    assert.match(gifts, /Video link saved\. Nothing was emailed\./);
    assert.match(gifts, /No free products yet\. Nothing is charged\./);
    assert.match(gifts, /No one has applied\. Nothing is charged\./);
    const apply = source("src/app/gifts/apply/page.tsx");
    assert.match(apply, /Applied\. Momma Mari will review your request\./);
    assert.match(apply, /robots: \{ index: false, follow: false \}/);
    assert.equal(apply.includes("Have an attorney review"), false);
    assert.match(apply, /No free products yet\./);
    assert.equal(apply.includes("Nothing is charged."), false);

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
