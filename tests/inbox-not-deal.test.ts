import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { gmailBridgeThreads, gmailWatches } from "../src/db/schema";
import { inboxErrorCode, inboxErrorNote } from "../src/lib/inbox-notes";
import {
  classifyThread,
  keptInboxClassification,
  listDealInbox,
  recordBrandMessage,
} from "../src/lib/gmail-bridge";
import { ingestGmailPush, type GmailHistoryClient, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

const mailbox = "mmaclamroc@gmail.com";

function message(id: string, extra: Partial<GmailHistoryMessage> = {}): GmailHistoryMessage {
  return {
    id,
    threadId: `thread-${id}`,
    from: "1AM Talent Group <bookings@1amtalent.example>",
    to: mailbox,
    subject: "Management Opportunity",
    labelIds: ["INBOX"],
    ...extra,
  };
}

function client(rows: GmailHistoryMessage[], latestHistoryId: string): GmailHistoryClient {
  return {
    listAdded: async () => ({ latestHistoryId, messages: rows.map((row) => ({ id: row.id, threadId: row.threadId })) }),
    getMessage: async (id) => {
      const found = rows.find((row) => row.id === id);
      if (!found) throw new Error(id);
      return found;
    },
    listThreadDrafts: async () => [],
    createDraft: async () => ({ id: "should-not-draft" }),
  };
}

describe("inbox not a deal", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("not a deal leaves the inbox and a later sync cannot mark it a deal again", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const previousSync = process.env.GMAIL_SYNC_ENABLED;
    process.env.GMAIL_SYNC_ENABLED = "true";
    try {
      assert.equal(keptInboxClassification("not_deal", "deal"), "not_deal");
      assert.equal(keptInboxClassification("deal", "inquiry"), "deal");
      assert.equal(keptInboxClassification("inquiry", "deal"), "deal");

      const page = readFileSync(path.join(process.cwd(), "src/app/inbox/page.tsx"), "utf8");
      const action = readFileSync(path.join(process.cwd(), "src/app/inbox-actions.ts"), "utf8");
      assert.match(page, /This is a deal/);
      assert.match(page, /Not a deal/);
      assert.match(page, /name="creator"/);
      assert.match(page, /This thread is not a deal, so it is off this list/);
      assert.match(page, /This thread stays on the list as a deal/);
      assert.match(page, /inboxErrorNote\(params\.error\)/);
      assert.match(page, /className="private-note"/);
      assert.match(action, /error=\$\{inboxErrorCode\(result\.error\)\}/);
      assert.match(action, /reply=\$\{reply\}/);

      assert.equal(inboxErrorNote(inboxErrorCode("Only the owner can change this.")), "Only the owner can change this.");
      assert.equal(inboxErrorNote(inboxErrorCode("Pick deal or not a deal.")), "Pick deal or not a deal.");
      assert.equal(inboxErrorNote(inboxErrorCode("That thread is not on your list.")), "That thread is not on your list.");
      assert.equal(inboxErrorNote("1"), "That was not saved.");
      assert.equal(inboxErrorNote(undefined), null);

      await db.insert(gmailWatches).values({
        mailbox,
        creatorId: "mariclare",
        historyId: "5000",
        expiration: null,
        topic: null,
        updatedAt: "2026-10-21T22:00:00.000Z",
      });

      const talent = message("talent");
      const opened = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5100" }, { client: client([talent], "5100") });
      assert.equal(opened.status, 200);
      const before = await listDealInbox(db, admin, "mariclare");
      const card = before.find((thread) => thread.subject === "Management Opportunity");
      assert.equal(card?.brand, "1AM Talent Group");
      assert.ok(card);

      const dismissed = await classifyThread(db, admin, card.id, "not_deal");
      assert.equal(dismissed.ok, true);
      const hidden = await listDealInbox(db, admin, "mariclare");
      assert.equal(hidden.some((thread) => thread.id === card.id), false);
      assert.equal((await db.select().from(gmailBridgeThreads).where(eq(gmailBridgeThreads.id, card.id)))[0]?.classification, "not_deal");

      const follow = message("talent-2", { threadId: talent.threadId, subject: "Re: Management Opportunity" });
      const synced = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5200" }, { client: client([follow], "5200") });
      assert.equal(synced.status, 200);
      assert.equal((await db.select().from(gmailBridgeThreads).where(eq(gmailBridgeThreads.id, card.id)))[0]?.classification, "not_deal");
      assert.equal((await listDealInbox(db, admin, "mariclare")).some((thread) => thread.id === card.id), false);

      await recordBrandMessage(db, {
        creatorId: "mariclare",
        mailbox,
        message: { ...follow, snippet: "Still a management opportunity" },
        dealId: "mail-talent",
        classification: "deal",
      });
      assert.equal((await db.select().from(gmailBridgeThreads).where(eq(gmailBridgeThreads.id, card.id)))[0]?.classification, "not_deal");
      assert.equal((await listDealInbox(db, admin, "mariclare")).some((thread) => thread.id === card.id), false);

      const maple = message("maple", { from: "Bea <bea@maple.example>", subject: "Maple partnership" });
      await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5300" }, { client: client([maple], "5300") });
      const mapleCard = (await listDealInbox(db, admin, "mariclare")).find((thread) => thread.subject === "Maple partnership");
      assert.ok(mapleCard);
      const confirmed = await classifyThread(db, admin, mapleCard.id, "deal");
      assert.equal(confirmed.ok, true);
      const kept = (await listDealInbox(db, admin, "mariclare")).find((thread) => thread.id === mapleCard.id);
      assert.equal(kept?.classification, "deal");
      await recordBrandMessage(db, {
        creatorId: "mariclare",
        mailbox,
        message: { ...maple, id: "maple-2", snippet: "Following up" },
        dealId: kept?.dealId ?? null,
        classification: "inquiry",
      });
      const stillDeal = (await listDealInbox(db, admin, "mariclare")).find((thread) => thread.id === mapleCard.id);
      assert.equal(stillDeal?.classification, "deal");

      const denied = await classifyThread(db, mariclare, mapleCard.id, "not_deal");
      assert.equal(denied.ok, false);
      if (!denied.ok) assert.equal(inboxErrorNote(inboxErrorCode(denied.error)), "Only the owner can change this.");
      const missing = await classifyThread(db, admin, "missing-thread", "not_deal");
      assert.equal(missing.ok, false);
      if (!missing.ok) assert.equal(inboxErrorNote(inboxErrorCode(missing.error)), "That thread is not on your list.");
      const blank = await classifyThread(db, admin, mapleCard.id, "maybe");
      assert.equal(blank.ok, false);
      if (!blank.ok) assert.equal(inboxErrorNote(inboxErrorCode(blank.error)), "Pick deal or not a deal.");
      assert.equal((await listDealInbox(db, admin, "mariclare")).some((thread) => thread.id === mapleCard.id), true);
    } finally {
      if (previousSync == null) delete process.env.GMAIL_SYNC_ENABLED;
      else process.env.GMAIL_SYNC_ENABLED = previousSync;
    }

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
