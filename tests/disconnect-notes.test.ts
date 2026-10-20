import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { creators } from "../src/db/schema";
import { disconnectMailbox } from "../src/lib/gmail-push";
import { disconnectErrorCode } from "../src/lib/mailbox-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("disconnect notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused disconnect keeps its sentence, and the watched inbox stays", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const mariBefore = (await db.select().from(creators)).find((row) => row.id === "mariclare");

    const blank = await disconnectMailbox(db, "not-an-email");
    assert.equal(blank.status, 400);
    assert.equal(blank.body.error, "email is required.");
    assert.equal(disconnectErrorCode(blank.body.error), "email");

    const missing = await disconnectMailbox(db, "nobody@example.com");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "No watched inbox uses that email.");
    assert.equal(disconnectErrorCode(missing.body.error), "inbox");
    assert.equal(disconnectErrorCode("Google didn't finish"), "1");

    const action = source("src/app/mailbox-actions.ts");
    assert.match(action, /gmail=\$\{disconnectErrorCode\(error\)\}/);
    assert.equal(action.includes("gmail=oauth"), false);
    const page = source("src/app/connect/page.tsx");
    assert.match(page, /Enter the inbox email\./);
    assert.match(page, /No watched inbox uses that email\./);
    assert.match(page, /Google didn't finish connecting that email\. Try again\./);
    assert.match(page, /That inbox is disconnected\. Connect it again with the current Google client\./);

    const mariAfter = (await db.select().from(creators)).find((row) => row.id === "mariclare");
    assert.equal(mariAfter?.gmailEmail, mariBefore?.gmailEmail);
    assert.equal(mariAfter?.gmailRefreshToken, mariBefore?.gmailRefreshToken);
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
