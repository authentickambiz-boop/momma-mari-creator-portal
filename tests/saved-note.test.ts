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

describe("saved notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a save says nothing was emailed, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const emailed = [
      "src/app/settings/page.tsx",
      "src/app/rules/page.tsx",
      "src/app/profile/page.tsx",
      "src/app/calendar/page.tsx",
      "src/app/prospects/page.tsx",
      "src/app/analytics/page.tsx",
      "src/app/pods/[id]/page.tsx",
    ];
    for (const file of emailed) {
      assert.match(source(file), /Saved\. Nothing was emailed\./);
    }
    assert.match(source("src/app/media-kit/page.tsx"), /Saved\. Nothing was emailed or charged\./);
    assert.match(source("src/app/rights/page.tsx"), /Saved\. Nothing was emailed or charged\./);

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
