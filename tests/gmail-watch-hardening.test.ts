import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators, deals, gmailWatches } from "../src/db/schema";
import {
  addedFromHistoryPages,
  ingestGmailPush,
  notificationAlreadyRead,
  renewGmailWatches,
  watchExpirationIsFuture,
  type GmailHistoryMessage,
} from "../src/lib/gmail-push";
import { gmailConnectionState } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import { encryptToken } from "../src/lib/token-crypto";
import { admin, mariclare, openTestDb } from "./harness";

describe("gmail watch hardening", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a repeated notice is ignored, a dead token needs reconnect, and renewal keeps the cursor", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.match(source, /historyTypes=messageAdded&historyTypes=labelAdded/);
    assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);
    assert.equal(notificationAlreadyRead("5000", "5000"), true);
    assert.equal(notificationAlreadyRead("5000", "4999"), true);
    assert.equal(notificationAlreadyRead("5000", "5001"), false);
    assert.equal(watchExpirationIsFuture("1893456000000", 1_700_000_000_000), true);
    assert.equal(watchExpirationIsFuture("1000", 1_700_000_000_000), false);
    assert.equal(watchExpirationIsFuture("", 1_700_000_000_000), false);

    const labeled = addedFromHistoryPages("100", [
      {
        historyId: "180",
        history: [{
          id: "170",
          messagesAdded: [{ message: { id: "added-1", threadId: "thread-added" } }],
          labelsAdded: [
            { message: { id: "added-1", threadId: "thread-added" }, labelIds: ["INBOX"] },
            { message: { id: "sent-1", threadId: "thread-sent" }, labelIds: ["SENT"] },
            { message: { id: "star-1", threadId: "thread-star" }, labelIds: ["STARRED"] },
          ],
        }],
      },
    ]);
    assert.deepEqual(labeled.messages.map((message) => message.id), ["added-1", "sent-1"]);

    const mailbox = "mmaclamroc@gmail.com";
    await db.update(creators).set({
      gmailRefreshToken: await encryptToken("1//secret-refresh-token-not-for-storage"),
      gmailEmail: mailbox,
      gmailConnectedAt: "2026-10-19T20:00:00.000Z",
      gmailReconnectReason: null,
      emailStatus: "connected",
    }).where(eq(creators.id, "mariclare"));
    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: "5000",
      expiration: "1893456000000",
      topic: null,
      updatedAt: "2026-10-19T20:00:00.000Z",
    });

    let reads = 0;
    const duplicate = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5000" }, {
      client: {
        listAdded: async () => {
          reads += 1;
          return { latestHistoryId: "5000", messages: [] };
        },
        getMessage: async () => {
          throw new Error("should not read a duplicate notice");
        },
      },
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.ok, true);
    assert.equal("duplicate" in duplicate.body && duplicate.body.duplicate, true);
    assert.equal(reads, 0);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "5000");

    const dead = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5100" }, {
      client: {
        listAdded: async () => {
          throw new Error("Gmail token refresh failed (400): invalid_grant: Token has been expired or revoked.");
        },
        getMessage: async () => {
          throw new Error("should not read a message");
        },
      },
    });
    assert.equal(dead.status, 200);
    assert.equal(dead.body.ok, false);
    assert.equal("permanent" in dead.body && dead.body.permanent, true);
    assert.equal((await gmailConnectionState(db, "mariclare")).reconnectReason, "invalid_grant");
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "5000");

    const kept = await renewGmailWatches(db, async () => ({ historyId: "9999", expiration: "1893456000000" }));
    assert.equal(kept.find((row) => row.mailbox === mailbox)?.ok, true);
    const afterRenew = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0];
    assert.equal(afterRenew?.historyId, "5000");
    assert.equal(afterRenew?.expiration, "1893456000000");
    assert.equal((await gmailConnectionState(db, "mariclare")).needsReconnect, false);

    const stale = await renewGmailWatches(db, async () => ({ historyId: "10000", expiration: "1000" }));
    assert.equal(stale.find((row) => row.mailbox === mailbox)?.ok, false);
    assert.match(stale.find((row) => row.mailbox === mailbox)?.error ?? "", /future expiration/);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "5000");
    assert.equal((await gmailConnectionState(db, "mariclare")).needsReconnect, false);

    const sent: GmailHistoryMessage = {
      id: "sent-mail-1",
      threadId: "sent-thread-1",
      from: "Noah <noah@cedar.example>",
      to: mailbox,
      subject: "Cedar reply",
      labelIds: ["SENT"],
    };
    const opened = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "5200" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "5200", messages: [{ id: sent.id, threadId: sent.threadId }] }),
        getMessage: async () => sent,
      },
    });
    assert.equal(opened.status, 200);
    if (!("createdDealIds" in opened.body)) throw new Error("expected a filed label change");
    assert.deepEqual(opened.body.createdDealIds, ["mail-sent-mail-1"]);
    assert.equal((await getDealForViewer(db, mariclare, "mail-sent-mail-1")), null);
    assert.equal((await getDealForViewer(db, admin, "mail-sent-mail-1"))?.visibleToCreator, false);
    assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, sent.threadId))).length, 1);

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
