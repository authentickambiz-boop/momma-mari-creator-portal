import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { approvalErrorCode, approvalErrorNote } from "../src/lib/approval-notes";
import { reviewApproval } from "../src/lib/approvals";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("approval error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused approval keeps its sentence, and nothing is sent", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const emailsBefore = await db.select().from(approvalEmails);

    const creator = await reviewApproval(db, {
      approvalId: "missing-email",
      intent: "approve",
      actorEmail: mariclare.email,
      actorRole: "creator",
    });
    assert.equal(creator.ok, false);
    if (!creator.ok) {
      assert.equal(creator.error, "Only an approver can change an email. Approvers are the admin addresses.");
      assert.equal(approvalErrorCode(creator.error), "approver");
    }

    const intent = await reviewApproval(db, {
      approvalId: "missing-email",
      intent: "nope",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(intent.ok, false);
    if (!intent.ok) {
      assert.equal(intent.error, "intent must be edit, approve, or reject.");
      assert.equal(approvalErrorCode(intent.error), "intent");
    }

    const missing = await reviewApproval(db, {
      approvalId: "missing-email",
      intent: "approve",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Email not found.");
      assert.equal(approvalErrorCode(missing.error), "missing");
    }

    assert.equal(approvalErrorCode("Deal not found."), "deal");
    assert.equal(approvalErrorCode("This email was already sent."), "sent");
    assert.equal(approvalErrorCode("Only a waiting email can be edited or approved."), "waiting");
    assert.equal(approvalErrorCode("subject and body are required."), "body");
    assert.equal(approvalErrorCode("That creator isn't on your list."), "list");
    assert.equal(approvalErrorCode("You can't approve brand email."), "email");
    assert.equal(approvalErrorCode("nope"), "1");
    assert.equal(approvalErrorNote("1"), null);
    assert.equal(approvalErrorNote("hello"), null);
    assert.equal(approvalErrorNote(undefined), null);
    assert.equal(approvalErrorNote("missing"), "Email not found.");
    assert.equal(approvalErrorNote("sent"), "This email was already sent.");

    const actions = source("src/app/actions.ts");
    const review = actions.slice(actions.indexOf("export async function reviewApprovalAction"), actions.indexOf("export async function addManagerAction"));
    assert.match(review, /approvalError=\$\{approvalErrorCode\(result\.error\)\}/);
    assert.equal(review.includes("approvalError=1"), false);
    const queue = source("src/components/approvals-queue.tsx");
    assert.match(queue, /approvalErrorNote\(error\)/);
    assert.match(queue, /That change was not saved\. Nothing was sent\./);

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
  });
});
