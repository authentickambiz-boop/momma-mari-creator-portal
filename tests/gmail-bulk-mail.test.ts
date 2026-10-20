import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, gmailWatches } from "../src/db/schema";
import { ingestGmailPush, isBulkMail, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

describe("gmail bulk mail", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("newsletters and spam labels do not open a deal, and a reply on an existing deal still matches", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);
    assert.equal(isBulkMail(["INBOX", "CATEGORY_PROMOTIONS"]), true);
    assert.equal(isBulkMail(["SPAM"]), true);
    assert.equal(isBulkMail(["TRASH"]), true);
    assert.equal(isBulkMail(["CATEGORY_SOCIAL"]), true);
    assert.equal(isBulkMail(["CATEGORY_FORUMS"]), true);
    assert.equal(isBulkMail(["INBOX"]), false);
    assert.equal(isBulkMail(["INBOX", "CATEGORY_UPDATES"]), false);
    assert.equal(isBulkMail(undefined), false);

    const mailbox = "mmaclamroc@gmail.com";
    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: "7000",
      expiration: null,
      topic: null,
      updatedAt: "2026-10-19T20:00:00.000Z",
    });

    const newsletter: GmailHistoryMessage = {
      id: "bulk-news-1",
      threadId: "bulk-news-thread",
      from: "Shop <news@maple.example>",
      to: mailbox,
      subject: "This week's list",
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    };
    const pitch: GmailHistoryMessage = {
      id: "bulk-pitch-1",
      threadId: "bulk-pitch-thread",
      from: "Bea <bea@maple.example>",
      to: mailbox,
      subject: "Maple collab",
      labelIds: ["INBOX"],
    };
    const rows = [newsletter, pitch];
    const opened = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "7100" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "7100", messages: rows.map((row) => ({ id: row.id, threadId: row.threadId })) }),
        getMessage: async (id: string) => {
          const found = rows.find((row) => row.id === id);
          if (!found) throw new Error(id);
          return found;
        },
      },
    });
    assert.equal(opened.status, 200);
    if (!("createdDealIds" in opened.body) || !("skippedSpam" in opened.body)) throw new Error("expected a filed result");
    assert.deepEqual(opened.body.createdDealIds, ["mail-bulk-pitch-1"]);
    assert.equal(opened.body.skippedSpam, 1);
    assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, newsletter.threadId))).length, 0);
    const hidden = await getDealForViewer(db, admin, "mail-bulk-pitch-1");
    assert.equal(hidden?.workflowStage, "offer_received");
    assert.equal(hidden?.visibleToCreator, false);
    assert.equal(await getDealForViewer(db, mariclare, "mail-bulk-pitch-1"), null);

    const followUp: GmailHistoryMessage = {
      id: "bulk-pitch-2",
      threadId: "bulk-pitch-thread",
      from: "Bea <bea@maple.example>",
      to: mailbox,
      subject: "Re: Maple collab",
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    };
    const matched = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "7200" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "7200", messages: [{ id: followUp.id, threadId: followUp.threadId }] }),
        getMessage: async () => followUp,
      },
    });
    if (!("matchedDealIds" in matched.body) || !("createdDealIds" in matched.body)) throw new Error("expected a match");
    assert.deepEqual(matched.body.matchedDealIds, ["mail-bulk-pitch-1"]);
    assert.deepEqual(matched.body.createdDealIds, []);
    assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, "bulk-pitch-thread"))).length, 1);

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
