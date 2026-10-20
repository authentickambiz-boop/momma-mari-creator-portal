import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import { reviewErrorCode, reviewErrorNote } from "../src/lib/review-notes";
import { reviewDraft } from "../src/lib/video-review";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("review error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused draft review keeps its sentence, and the seed draft stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const waterhBefore = await getDealForViewer(db, admin, "waterh");
    const emailsBefore = await db.select().from(approvalEmails);

    const own = await reviewDraft(db, {
      draftId: "draft-waterh-v1",
      decision: "approved",
      actorEmail: mariclare.email,
      actorRole: "creator",
    });
    assert.equal(own.ok, false);
    if (!own.ok) {
      assert.equal(own.error, "You can't approve your own video.");
      assert.equal(reviewErrorCode(own.error), "own");
    }

    const choose = await reviewDraft(db, {
      draftId: "draft-waterh-v1",
      decision: "nope",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(choose.ok, false);
    if (!choose.ok) {
      assert.equal(choose.error, "Choose Approve or Request changes.");
      assert.equal(reviewErrorCode(choose.error), "choose");
    }

    const missing = await reviewDraft(db, {
      draftId: "missing-draft",
      decision: "approved",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Draft not found.");
      assert.equal(reviewErrorCode(missing.error), "missing");
    }

    const seed = await reviewDraft(db, {
      draftId: "draft-waterh-v1",
      decision: "approved",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(seed.ok, false);
    if (!seed.ok) {
      assert.equal(seed.error, "Seed drafts stay as they are. Nothing was changed.");
      assert.equal(reviewErrorCode(seed.error), "seed");
    }

    assert.equal(reviewErrorCode("This upload is still in progress."), "upload");
    assert.equal(reviewErrorCode("This version was already reviewed."), "reviewed");
    assert.equal(reviewErrorCode("Tell her what to fix."), "note");
    assert.equal(reviewErrorCode("This deal has no brand email yet."), "email");
    assert.equal(reviewErrorCode("This draft is held for Kamron. Nothing was sent to the brand."), "held");
    assert.equal(reviewErrorCode("You can't approve videos."), "video");
    assert.equal(reviewErrorCode("nope"), "1");
    assert.equal(reviewErrorNote("1"), null);
    assert.equal(reviewErrorNote("hello"), null);
    assert.equal(reviewErrorNote(undefined), null);
    assert.equal(reviewErrorNote("seed"), "Seed drafts stay as they are. Nothing was changed.");
    assert.equal(reviewErrorNote("choose"), "Choose Approve or Request changes.");

    const actions = source("src/app/actions.ts");
    const review = actions.slice(actions.indexOf("export async function reviewDraftAction"), actions.indexOf("export async function clearSafetyAction"));
    assert.match(review, /reviewError=\$\{reviewErrorCode\(result\.error\)\}/);
    assert.equal(review.includes("includes(\"held for Kamron\")"), false);
    assert.equal(review.includes("status === 400"), false);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /reviewErrorNote\(reviewError\)/);
    assert.match(board, /That review was not saved\. Nothing was emailed\./);

    const emailsAfter = await db.select().from(approvalEmails);
    assert.equal(emailsAfter.length, emailsBefore.length);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
    const waterhAfter = await getDealForViewer(db, admin, "waterh");
    assert.equal(waterhAfter?.workflowStage, waterhBefore?.workflowStage);
    assert.equal(waterhAfter?.drafts.length, waterhBefore?.drafts.length);
  });
});
