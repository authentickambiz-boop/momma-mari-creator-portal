import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { creators } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import { signerErrorCode, signerErrorNote } from "../src/lib/signer-notes";
import { setSignerIsMinor } from "../src/lib/signing";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("signer error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused signer flag keeps its sentence, and nobody is marked a minor", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const creatorsBefore = await db.select().from(creators);
    const mariBefore = creatorsBefore.find((row) => row.id === "mariclare");

    const missing = await setSignerIsMinor(db, { creatorId: "no-such-creator", minor: true, actorRole: "admin" });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Creator not found.");
      assert.equal(signerErrorCode(missing.error), "missing");
    }

    const owner = await setSignerIsMinor(db, { creatorId: "mariclare", minor: true, actorRole: "creator" });
    assert.equal(owner.ok, false);
    if (!owner.ok) {
      assert.equal(owner.error, "Only an admin can mark a signer as a minor.");
      assert.equal(signerErrorCode(owner.error), "owner");
    }

    assert.equal(signerErrorNote("missing"), "Creator not found.");
    assert.equal(signerErrorNote("owner"), "Only an admin can mark a signer as a minor.");
    assert.equal(signerErrorNote("1"), null);
    assert.equal(signerErrorNote("hello"), null);
    assert.equal(signerErrorCode("Only an admin can mark something else."), "1");

    const actions = source("src/app/actions.ts");
    const flag = actions.slice(actions.indexOf("export async function setSignerMinorAction"), actions.indexOf("export async function dismissCreatorNoticeAction"));
    assert.match(flag, /signerError=\$\{signerErrorCode\(result\.error\)\}/);
    assert.match(flag, /if \(!result\.ok\)/);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /signerErrorNote\(signerError\)/);
    assert.match(board, /That signer flag was not saved\. Nothing was changed\./);

    const creatorsAfter = await db.select().from(creators);
    assert.equal(creatorsAfter.length, creatorsBefore.length);
    for (const row of creatorsAfter) {
      const before = creatorsBefore.find((item) => item.id === row.id);
      assert.equal(row.signerIsMinor, before?.signerIsMinor);
      assert.equal(row.kidsAges, before?.kidsAges);
    }
    const mariAfter = creatorsAfter.find((row) => row.id === "mariclare");
    assert.equal(mariAfter?.signerIsMinor, false);
    assert.equal(mariAfter?.kidsAges, mariBefore?.kidsAges);
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
