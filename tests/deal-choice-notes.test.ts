import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { recordCreatorInterest } from "../src/lib/creator-interest";
import { setDealStage } from "../src/lib/deal-stage";
import { dealNoticeCode, dealNoticeSpecific } from "../src/lib/deal-notice-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("deal choice notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused stage or offer answer keeps its sentence, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const stage = await setDealStage(db, {
      dealId: "kosbling",
      toStage: "not-a-stage",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(stage.ok, false);
    if (!stage.ok) {
      assert.equal(stage.error, "That is not a deal stage.");
      assert.equal(dealNoticeCode(stage.error), "stage");
      assert.equal(dealNoticeSpecific("stage"), stage.error);
    }

    const move = await setDealStage(db, {
      dealId: "kosbling",
      toStage: "paid",
      actorEmail: mariclare.email,
      actorRole: "creator",
      creatorId: "mariclare",
    });
    assert.equal(move.ok, false);
    if (!move.ok) {
      assert.equal(move.error, "You can't move this deal.");
      assert.equal(dealNoticeCode(move.error), "move");
    }

    const choice = await recordCreatorInterest(db, {
      dealId: "kosbling",
      creatorId: "mariclare",
      creatorEmail: mariclare.email,
      creatorName: mariclare.name,
      decision: "interested",
    });
    assert.equal(choice.ok, false);
    if (!choice.ok) {
      assert.equal(choice.error, "This offer is not on your list yet.");
      assert.equal(dealNoticeCode(choice.error), "waiting");
      assert.equal(dealNoticeSpecific("waiting"), choice.error);
    }

    const blank = await recordCreatorInterest(db, {
      dealId: "kosbling",
      creatorId: "mariclare",
      creatorEmail: mariclare.email,
      creatorName: mariclare.name,
      decision: "",
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(dealNoticeCode(blank.error), "choose");

    assert.equal(dealNoticeSpecific("1"), null);
    assert.equal(dealNoticeSpecific("hello"), null);
    assert.equal(dealNoticeSpecific("hello world"), null);

    const actions = source("src/app/actions.ts");
    assert.match(actions, /stageError=\$\{dealNoticeCode\(result\.error\)\}/);
    assert.match(actions, /interestError=\$\{dealNoticeCode\(result\.error\)\}/);
    const page = source("src/app/deals/[id]/page.tsx");
    assert.match(page, /dealNoticeSpecific\(query\.stageError\)/);
    assert.match(page, /dealNoticeSpecific\(query\.interestError\)/);
    assert.equal(page.includes("{query.stageError}"), false);
    assert.equal(page.includes("{query.interestError}"), false);

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
