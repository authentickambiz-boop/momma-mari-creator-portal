import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { campaignErrorCode, campaignErrorNote } from "../src/lib/campaign-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("campaign error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a campaign link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(campaignErrorCode("Enter the budget in dollars, like 500."), "filter");
    assert.equal(campaignErrorCode("Brand offers are changed on the offers page."), "offer");
    assert.equal(campaignErrorCode("That split is over the campaign budget."), "over");
    assert.equal(campaignErrorCode("Use a date like 2026-11-01."), "date");
    assert.equal(campaignErrorNote("date"), "Use a date like 2026-11-01.");
    assert.equal(campaignErrorCode("anything else"), "1");
    assert.equal(campaignErrorNote("offer"), "Brand offers are changed on the offers page.");
    assert.equal(campaignErrorNote("1"), "That was not saved.");
    assert.equal(campaignErrorNote("hello world"), "That was not saved.");
    assert.equal(campaignErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(campaignErrorNote(undefined), null);

    const list = source("src/app/campaigns/page.tsx");
    assert.match(list, /campaignErrorNote\(params\.campaignError\)/);
    assert.equal(list.includes("{params.campaignError}"), false);
    const detail = source("src/app/campaigns/[id]/page.tsx");
    assert.match(detail, /campaignErrorNote\(query\.campaignError\)/);
    assert.equal(detail.includes("{query.campaignError}"), false);
    const action = source("src/app/campaign-actions.ts");
    assert.match(action, /campaignErrorCode\(minBudget\.error\)/);
    assert.match(action, /campaignError=\$\{campaignErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("campaignError=${encodeURIComponent(result.error)}"), false);

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
