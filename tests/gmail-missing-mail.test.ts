import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, gmailWatches } from "../src/db/schema";
import {
  ingestGmailPush,
  isDraftMail,
  isWatchedMailboxSender,
  laterHistoryId,
  messageGone,
  type GmailHistoryClient,
  type GmailHistoryMessage,
} from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

const mailbox = "mmaclamroc@gmail.com";

function brandMessage(id: string): GmailHistoryMessage {
  return {
    id,
    threadId: `thread-${id}`,
    from: "Noah <noah@cedar.example>",
    to: mailbox,
    subject: "Spring post",
    labelIds: ["INBOX"],
  };
}

describe("gmail missing mail", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a deleted message, a draft, and internal mail do not stall the cursor or open a deal", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.match(source, /if \(loaded\.missing\) return messageGone\(id\);/);
    assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);
    assert.equal(laterHistoryId("5000", "not-a-number"), "5000");
    assert.equal(laterHistoryId("not-a-number", "5000"), "5000");
    assert.equal(laterHistoryId("5000", "5300"), "5300");
    assert.equal(laterHistoryId("7000", "6000"), "7000");
    assert.equal(isDraftMail(["DRAFT", "SENT"]), true);
    assert.equal(isDraftMail(["INBOX"]), false);
    assert.equal(isWatchedMailboxSender("Kamron <authentickambiz@gmail.com>"), true);
    assert.equal(isWatchedMailboxSender("Noah <noah@cedar.example>"), false);
    assert.equal(messageGone("gone-1").threadId, "");

    let reads = 0;
    const primed = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "not-a-number" }, {
      client: {
        listAdded: async () => {
          reads += 1;
          return { latestHistoryId: "1", messages: [] };
        },
        getMessage: async () => brandMessage("unused"),
      },
    });
    assert.equal(primed.status, 200);
    assert.equal(reads, 0);
    assert.equal("error" in primed.body ? primed.body.error : "", "Gmail history id was not a number.");
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox))).length, 0);

    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: "5000",
      expiration: "1893456000000",
      topic: null,
      updatedAt: "2026-10-19T00:00:00.000Z",
    });

    const messages = new Map<string, GmailHistoryMessage>([
      ["gone-1", messageGone("gone-1")],
      ["draft-1", { ...brandMessage("draft-1"), labelIds: ["DRAFT"] }],
      ["internal-1", { ...brandMessage("internal-1"), from: "Kamron <authentickambiz@gmail.com>" }],
      ["brand-1", brandMessage("brand-1")],
    ]);
    const client: GmailHistoryClient = {
      listAdded: async () => ({
        latestHistoryId: "5200",
        messages: [...messages.keys()].map((id) => ({ id, threadId: messages.get(id)?.threadId || `thread-${id}` })),
      }),
      getMessage: async (id) => messages.get(id) ?? messageGone(id),
    };
    const filed = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "not-a-number" }, { client });
    assert.equal(filed.status, 200);
    assert.equal("ok" in filed.body && filed.body.ok, true);
    const created = "createdDealIds" in filed.body ? filed.body.createdDealIds : [];
    assert.deepEqual(created, ["mail-brand-1"]);
    const watch = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0];
    assert.equal(watch?.historyId, "5200");
    const hidden = await getDealForViewer(db, admin, "mail-brand-1");
    assert.equal(hidden?.visibleToCreator, false);
    assert.equal(await getDealForViewer(db, mariclare, "mail-brand-1"), null);
    const opened = await db.select().from(deals).where(eq(deals.gmailThreadId, "thread-brand-1"));
    assert.equal(opened.length, 1);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-draft-1"))).length, 0);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-internal-1"))).length, 0);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-gone-1"))).length, 0);

    const stalled = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5300" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "oops", partial: true, messages: [] }),
        getMessage: async () => brandMessage("unused-2"),
      },
    });
    assert.equal(stalled.status, 503);
    const afterStall = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0];
    assert.equal(afterStall?.historyId, "5200");

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
