import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { growthErrorCode, growthErrorNote } from "../src/lib/growth-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("growth error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a ranking, pod, report, or dashboard link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(growthErrorCode("Only an owner can change rank weights."), "weights");
    assert.equal(growthErrorCode("Use a month like 2026-10."), "month");
    assert.equal(growthErrorCode("Enter the amount in dollars."), "amount");
    assert.equal(growthErrorCode("anything else"), "1");
    assert.equal(growthErrorNote("pod"), "That pod is not on your list.");
    assert.equal(growthErrorNote("1"), "That was not saved.");
    assert.equal(growthErrorNote("hello world"), "That was not saved.");
    assert.equal(growthErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(growthErrorNote(undefined), null);

    const pages = [
      ["src/app/ranking/page.tsx", /growthErrorNote\(params\.growthError\)/],
      ["src/app/reports/page.tsx", /growthErrorNote\(params\.growthError\)/],
      ["src/app/pods/page.tsx", /growthErrorNote\(params\.growthError\)/],
      ["src/app/pods/[id]/page.tsx", /growthErrorNote\(query\.growthError\)/],
      ["src/app/dashboard/page.tsx", /growthErrorNote\(growthError\)/],
    ] as const;
    for (const [file, pattern] of pages) {
      const text = source(file);
      assert.match(text, pattern);
      assert.equal(text.includes("{query.growthError}"), false);
      if (file.endsWith("dashboard/page.tsx")) {
        assert.match(text, /growthError=\{params\.growthError\}/);
        assert.match(text, /\{note \?/);
      } else {
        assert.equal(text.includes("{params.growthError}"), false);
        assert.match(text, /\{growthNote\}/);
      }
    }
    assert.match(source("src/app/dashboard/page.tsx"), /Saved\. Nothing was paid or billed\./);
    assert.match(source("src/app/reports/page.tsx"), /No reports yet\. Nothing is emailed\./);
    const action = source("src/app/growth-actions.ts");
    assert.match(action, /growthError=\$\{growthErrorCode\(error\)\}/);
    assert.equal(action.includes("growthError=${encodeURIComponent"), false);

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
