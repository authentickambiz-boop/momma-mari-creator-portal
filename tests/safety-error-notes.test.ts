import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { draftSafetyFlags } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import { clearSafetyHold } from "../src/lib/safety";
import { safetyErrorCode, safetyErrorNote } from "../src/lib/safety-notes";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("safety error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused safety clear keeps its sentence, and no hold is cleared", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const waterhBefore = await getDealForViewer(db, admin, "waterh");
    const flagsBefore = await db.select().from(draftSafetyFlags);

    const creatorClear = await clearSafetyHold(db, {
      draftId: "draft-waterh-v1",
      actorEmail: mariclare.email,
      actorRole: "creator",
    });
    assert.equal(creatorClear.ok, false);
    if (!creatorClear.ok) {
      assert.equal(creatorClear.error, "You can't clear a safety hold.");
      assert.equal(safetyErrorCode(creatorClear.error), "creator");
    }

    const managerClear = await clearSafetyHold(db, {
      draftId: "draft-waterh-v1",
      actorEmail: "riley.manager@gmail.com",
      actorRole: "manager",
    });
    assert.equal(managerClear.ok, false);
    if (!managerClear.ok) {
      assert.equal(managerClear.error, "Only Kamron can clear a safety hold.");
      assert.equal(safetyErrorCode(managerClear.error), "owner");
    }

    const empty = await clearSafetyHold(db, {
      draftId: "no-such-draft",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(empty.ok, true);
    if (empty.ok) assert.equal(empty.cleared, 0);

    assert.equal(safetyErrorCode("You can't clear something else."), "1");
    assert.equal(safetyErrorCode("Safety holds are for the team."), "1");
    assert.equal(safetyErrorNote("creator"), "You can't clear a safety hold.");
    assert.equal(safetyErrorNote("owner"), "Only Kamron can clear a safety hold.");
    assert.equal(safetyErrorNote("1"), null);
    assert.equal(safetyErrorNote("hello"), null);
    assert.equal(safetyErrorNote(undefined), null);

    const actions = source("src/app/actions.ts");
    const clear = actions.slice(actions.indexOf("export async function clearSafetyAction"), actions.indexOf("function contractBack"));
    assert.match(clear, /safetyError=\$\{safetyErrorCode\(result\.error\)\}/);
    assert.equal(clear.includes("can't clear"), false);
    assert.match(clear, /cleared=1/);
    const safety = source("src/app/safety/page.tsx");
    assert.match(safety, /safetyErrorNote\(params\.safetyError\)/);
    assert.match(safety, /That hold was not cleared\. Nothing was sent to the brand\./);
    assert.match(safety, /Hold cleared\. Nothing was sent to the brand\./);
    assert.match(safety, /No drafts are held\./);
    assert.match(safety, /Safety holds are for the team\./);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /safetyErrorNote\(safetyError\)/);
    assert.match(board, /That hold was not cleared\. Nothing was sent to the brand\./);
    assert.match(board, /That review was not saved\. Nothing was emailed\./);

    const flagsAfter = await db.select().from(draftSafetyFlags);
    assert.equal(flagsAfter.length, flagsBefore.length);
    assert.equal(flagsAfter.filter((row) => row.held).length, flagsBefore.filter((row) => row.held).length);
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
