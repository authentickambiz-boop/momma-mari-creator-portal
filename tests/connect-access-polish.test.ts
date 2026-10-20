import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { CONNECTION_RETRY_NOTE, mappedConnectionNote } from "../src/lib/account-connection-status";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("connect access polish", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("unknown connection codes, a new bot token, and an empty campaign roster say what happened", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(mappedConnectionNote({ oauth: "Try again." }, undefined), null);
    assert.equal(mappedConnectionNote({ oauth: "Try again." }, "oauth"), "Try again.");
    assert.equal(mappedConnectionNote({ oauth: "Try again." }, "mystery"), CONNECTION_RETRY_NOTE);

    const connect = source("src/app/connect/page.tsx");
    assert.match(connect, /mappedConnectionNote\(GMAIL_ERRORS/);
    assert.match(connect, /mappedConnectionNote\(DRIVE_NOTES/);
    assert.match(connect, /mappedConnectionNote\(ACCOUNT_NOTES/);

    const access = source("src/app/access/page.tsx");
    assert.match(access, /Copy the new token below\. It is shown once\. Nothing was emailed\./);
    assert.match(access, /Saved\. Nothing was emailed or charged\./);
    const creatorBlock = access.slice(access.indexOf('role === "creator"'), access.indexOf("Only Kamron sets who can act."));
    assert.match(creatorBlock, /accessError/);

    const campaign = source("src/app/campaigns/[id]/page.tsx");
    assert.match(campaign, /Saved\. Nothing was emailed\./);
    assert.match(campaign, /No creator on the roster matches this campaign yet\./);
    assert.match(campaign, /Add a prospect before you queue an offer\./);
    assert.match(campaign, /ranked\.length > 0/);

    const home = source("src/app/page.tsx");
    assert.match(home, /Nothing needs you this week\./);

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
