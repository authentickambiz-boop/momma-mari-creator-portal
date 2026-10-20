import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, gmailWatches } from "../src/db/schema";
import { addedFromHistoryPages, ingestGmailPush, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("gmail history pages", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("history.list pages are followed, and a leftover page does not jump the cursor", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.match(source, /pageToken=/);
    assert.match(source, /HISTORY_PAGE_LIMIT = 5/);
    assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);

    const full = addedFromHistoryPages("100", [
      {
        historyId: "300",
        nextPageToken: "next",
        history: [{ id: "150", messagesAdded: [{ message: { id: "a", threadId: "ta" } }] }],
      },
      {
        historyId: "300",
        history: [{ id: "250", messagesAdded: [{ message: { id: "b", threadId: "tb" } }] }],
      },
    ]);
    assert.equal(full.expired, false);
    assert.equal(full.partial, false);
    assert.equal(full.latestHistoryId, "300");
    assert.deepEqual(full.messages.map((message) => message.id), ["a", "b"]);

    const partialPage = addedFromHistoryPages("100", [
      {
        historyId: "900",
        nextPageToken: "more",
        history: [{ id: "160", messagesAdded: [{ message: { id: "c", threadId: "tc" } }] }],
      },
    ]);
    assert.equal(partialPage.partial, true);
    assert.equal(partialPage.latestHistoryId, "160");
    assert.equal(addedFromHistoryPages("100", [{ missing: true }]).expired, true);
    assert.equal(addedFromHistoryPages("100", [{ missing: true }]).latestHistoryId, "100");

    const mailbox = "mmaclamroc@gmail.com";
    const cursor = "8000";
    const existingWatch = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0];
    if (existingWatch) {
      await db.update(gmailWatches).set({ historyId: cursor, creatorId: "mariclare", updatedAt: "2026-10-19T20:00:00.000Z" }).where(eq(gmailWatches.mailbox, mailbox));
    } else {
      await db.insert(gmailWatches).values({
        mailbox,
        creatorId: "mariclare",
        historyId: cursor,
        expiration: null,
        topic: null,
        updatedAt: "2026-10-19T20:00:00.000Z",
      });
    }
    const message: GmailHistoryMessage = {
      id: "page-mail-1",
      threadId: "page-thread-1",
      from: "Bea <bea@maple.example>",
      to: mailbox,
      subject: "Maple samples",
      labelIds: ["INBOX"],
    };
    const result = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9000" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "8100", partial: true, messages: [{ id: message.id, threadId: message.threadId }] }),
        getMessage: async () => message,
      },
    });
    assert.equal(result.status, 503);
    if (!("partial" in result.body) || !("createdDealIds" in result.body)) throw new Error("expected a partial page");
    assert.equal(result.body.partial, true);
    assert.deepEqual(result.body.createdDealIds, ["mail-page-mail-1"]);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "8100");
    const hidden = await getDealForViewer(db, admin, "mail-page-mail-1");
    assert.equal(hidden?.visibleToCreator, false);
    assert.equal(hidden?.workflowStage, "offer_received");
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-page-mail-1"))).length, 1);

    const stuck = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9100" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "8100", partial: true, messages: [] }),
        getMessage: async () => message,
      },
    });
    assert.equal(stuck.status, 503);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "8100");

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingBefore?.stageEvents?.length);
  });
});
