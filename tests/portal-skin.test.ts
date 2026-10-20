import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { homeSummary, progressMarks } from "../src/lib/home-desk";
import { getDealForViewer } from "../src/lib/queries";
import type { DealSummary } from "../src/lib/types";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function deal(patch: Partial<DealSummary>): DealSummary {
  return {
    id: "sample",
    creatorId: "mariclare",
    creatorName: "MariClare",
    brand: "KOSBLING",
    subtitle: null,
    status: "active",
    amountDisplay: null,
    chips: [],
    nextStep: null,
    visibleToCreator: true,
    needsCreator: false,
    isSeed: true,
    uploadEnabled: false,
    earningsChipText: null,
    earningsChipTone: null,
    pipelineCents: null,
    pipelineName: null,
    sortOrder: 1,
    workflowStage: "draft_due",
    updatedAt: "2026-10-20T00:00:00.000Z",
    postDate: "2026-11-04",
    uploadDue: null,
    deadlineFlag: "none",
    rushRevision: false,
    ...patch,
  };
}

describe("portal skin", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the home uses real deal fields, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const css = source("src/app/globals.css");
    const layout = source("src/app/layout.tsx");
    const login = source("src/app/login/page.tsx");
    const home = source("src/app/page.tsx");
    assert.match(css, /#1F3B2D/);
    assert.match(css, /#B4532F/);
    assert.match(css, /#F7F4EE/);
    assert.match(layout, /Fraunces/);
    assert.match(layout, /Inter/);
    assert.match(login, /Welcome back\./);
    assert.match(login, /Apply to join Momma Mari/);
    assert.match(login, /That Google account isn't on the Momma Mari creator list/);
    assert.match(home, /Nothing needs you this week\./);
    assert.match(home, /<HomeDesk/);
    const summary = homeSummary([
      deal({ id: "one", postDate: "2026-11-04", workflowStage: "draft_due" }),
      deal({ id: "two", brand: "VEV", postDate: "Late October", workflowStage: "manager_review" }),
      deal({ id: "three", brand: "Hidden", visibleToCreator: false, workflowStage: "paid" }),
    ]);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.draftCount, 1);
    assert.equal(summary.nextPost?.brand, "KOSBLING");
    assert.equal(summary.nextPost?.when, "Nov 4");
    assert.equal(summary.payoutLabel, "No payout waiting");
    assert.deepEqual(progressMarks("draft_due"), [true, true, false, false]);
    assert.equal(css.includes("Jordan"), false);
    assert.equal(home.includes("Sample Snacks"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
  });
});
