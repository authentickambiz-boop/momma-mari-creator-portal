import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { benchErrorCode, benchErrorNote } from "../src/lib/bench-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("bench error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a bench link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(benchErrorCode("Add your name."), "name");
    assert.equal(benchErrorCode("Use a score from 0 to 100."), "score");
    assert.equal(benchErrorCode("Enter the offer amount."), "amount");
    assert.equal(benchErrorCode("anything else"), "1");
    assert.equal(benchErrorNote("email"), "Enter an email address.");
    assert.equal(benchErrorNote("1"), "That was not saved.");
    assert.equal(benchErrorNote("hello world"), "That was not saved.");
    assert.equal(benchErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(benchErrorNote(undefined), null);

    for (const file of ["src/app/bench/page.tsx", "src/app/bench/join/page.tsx"]) {
      const page = source(file);
      assert.match(page, /benchErrorNote\(params\.benchError\)/);
      assert.equal(page.includes("{params.benchError}"), false);
    }
    assert.match(source("src/app/bench/page.tsx"), /Saved\. Nothing was sent or charged\./);
    assert.match(source("src/app/bench/join/page.tsx"), /You are on the bench\. There is no fee\./);
    assert.match(source("src/app/bench/join/page.tsx"), /index: false/);
    const action = source("src/app/bench-actions.ts");
    assert.match(action, /benchError=\$\{benchErrorCode\(error\)\}/);
    assert.equal(action.includes("encodeURIComponent(error)"), false);

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
