import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { questionErrorCode, questionErrorNote } from "../src/lib/question-notes";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("questionnaire error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("an onboarding link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(questionErrorCode("Pick at least one niche."), "niches");
    assert.equal(questionErrorCode("Add at least one rate."), "rates");
    assert.equal(questionErrorCode("This step is required."), "required");
    assert.equal(questionErrorCode("anything else"), "1");
    assert.equal(questionErrorNote("shipping"), "Choose a shipping region.");
    assert.equal(questionErrorNote("1"), "That was not saved.");
    assert.equal(questionErrorNote("hello world"), "That was not saved.");
    assert.equal(questionErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(questionErrorNote(undefined), null);

    const page = source("src/app/onboarding/page.tsx");
    assert.match(page, /questionErrorNote\(params\.questionError\)/);
    assert.match(page, /GMAIL_ERRORS\[params\.gmail\] \?\? CONNECTION_RETRY_NOTE/);
    assert.equal(page.includes("error={params.questionError"), false);
    const action = source("src/app/question-actions.ts");
    assert.match(action, /questionError=\$\{questionErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("questionError=${encodeURIComponent(result.error)}"), false);

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
