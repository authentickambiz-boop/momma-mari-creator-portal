import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { contracts } from "../src/db/schema";
import { saveChecklist } from "../src/lib/contracts";
import { contractErrorCode, contractErrorNote, signErrorCode } from "../src/lib/contract-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("contract error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a checklist refusal keeps its own sentence, and no contract is saved", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const contractsBefore = await db.select().from(contracts);

    const missing = await saveChecklist(db, {
      contractId: "no-such-contract",
      checks: [{ item: "payment", status: "ok" }],
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Contract not found.");
      assert.equal(contractErrorCode(missing.error), "1");
    }

    const items = "Each checklist item is ok, an issue, or not checked.";
    const changes = "Mark at least one checklist item as an issue, or write the changes to request.";
    assert.equal(contractErrorCode(items), "items");
    assert.equal(contractErrorCode(changes), "changes");
    assert.equal(contractErrorNote("items"), items);
    assert.equal(contractErrorNote("changes"), changes);
    assert.equal(contractErrorNote("1"), null);
    assert.equal(contractErrorNote("hello"), null);
    assert.equal(contractErrorCode("Upload a PDF or DOCX."), "type");
    assert.equal(contractErrorCode("That file is over 20 MB."), "type");
    assert.equal(contractErrorCode("Upload a PDF or DOCX under 20 MB extra."), "1");
    assert.equal(signErrorCode("Check both boxes before countersigning."), "counter");
    assert.equal(signErrorCode("Check both boxes: agree to sign electronically, and confirm you have read and agree."), "boxes");
    assert.equal(signErrorCode("Only an admin can mark a signer as a minor."), "1");

    const actions = source("src/app/actions.ts");
    assert.equal(actions.includes("error.includes(\"checklist\")"), false);
    assert.equal(actions.includes("error.includes(\"both boxes\")"), false);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /contractErrorNote\(contractError\)/);
    assert.match(board, /That contract change was not saved\. Nothing was emailed\./);
    const sign = source("src/app/deals/[id]/sign/page.tsx");
    assert.match(sign, /Check both boxes before countersigning\./);
    assert.match(sign, /That signature was not saved\. Nothing was emailed\./);
    assert.match(sign, /ATTORNEY_NOTE/);

    const contractsAfter = await db.select().from(contracts);
    assert.equal(contractsAfter.length, contractsBefore.length);
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
