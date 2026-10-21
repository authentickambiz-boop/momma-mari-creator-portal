import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators, deals, gmailBridgeThreads, gmailWatches } from "../src/db/schema";
import { listSendableApprovals, markApprovalSent, reviewApproval } from "../src/lib/approvals";
import {
  beginGmailBridgeConnect,
  classifyThread,
  deleteBridgeForCreator,
  gmailBridgeConnectHref,
  gmailSyncEnabled,
  listBotThreads,
  listBridgeAudit,
  listDealInbox,
  queueBrandReply,
  readThreadAttachment,
  removeBridgeAudit,
  setThreadPrivate,
  syncConnectedMailboxes,
  type BridgeMessage,
} from "../src/lib/gmail-bridge";
import { clearCreatorGmail, ingestGmailPush, renewGmailWatches, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { GMAIL_READONLY_SCOPE } from "../src/lib/google-oauth";
import { addManager, assignCreatorManagers } from "../src/lib/managers";
import { saveGmailConnection } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import type { Viewer } from "../src/lib/types";
import { abby, admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("gmail bridge", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("brand threads sync only when the flag is on, and a reply stays a draft", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const previousSync = process.env.GMAIL_SYNC_ENABLED;
    const previousClient = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    const token = "super-secret-refresh-token-abby";
    try {
      delete process.env.GMAIL_SYNC_ENABLED;
      assert.equal(gmailSyncEnabled(), false);
      assert.equal(source("src/lib/gmail-bridge.ts").includes("messages/send"), false);
      assert.equal(source("src/lib/gmail-bridge.ts").includes("gmail.send"), false);
      assert.match(source(".env.example"), /GMAIL_SYNC_ENABLED=/);
      assert.equal(gmailBridgeConnectHref({ email: "riley.bridge@gmail.com", role: "manager", creatorId: null, name: "Riley" }, "abby"), null);

      process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "test-secret";
      const managerStart = await beginGmailBridgeConnect(
        { email: "riley.bridge@gmail.com", role: "manager", creatorId: null, name: "Riley" },
        "abby",
        "theofficialtheriots@gmail.com",
      );
      assert.equal(managerStart.ok, false);
      const creatorStart = await beginGmailBridgeConnect(abby, "abby", abby.email);
      assert.equal(creatorStart.ok, true);
      if (!creatorStart.ok) return;
      const bridgeUrl = new URL(creatorStart.url);
      assert.equal(bridgeUrl.searchParams.get("scope"), GMAIL_READONLY_SCOPE);
      assert.equal(bridgeUrl.searchParams.get("scope")?.includes("gmail.compose"), false);
      assert.equal(bridgeUrl.searchParams.get("scope")?.includes("gmail.send"), false);
      assert.equal(bridgeUrl.searchParams.get("scope")?.includes("mail.google.com"), false);
      assert.equal(bridgeUrl.searchParams.get("redirect_uri"), "http://localhost:43123/api/auth/callback");

      let reads = 0;
      const off = await syncConnectedMailboxes(db, {
        read: async () => {
          reads += 1;
          return [];
        },
      });
      assert.equal(off.enabled, false);
      assert.equal(off.mailboxes.length, 0);
      assert.equal(reads, 0);

      const saved = await saveGmailConnection(db, "abby", { refreshToken: token, gmailEmail: "abby.brand@gmail.com" });
      assert.equal(saved.ok, true);
      const stored = await db.select().from(creators).where(eq(creators.id, "abby"));
      const cipher = stored[0]?.gmailRefreshToken ?? "";
      assert.equal(cipher.includes(token), false);
      assert.match(cipher, /^v1:/);

      const ignored = await ingestGmailPush(db, { emailAddress: "abby.brand@gmail.com", historyId: "10" });
      assert.equal(ignored.status, 200);
      assert.equal("ignored" in ignored.body && ignored.body.ignored, true);

      await db.insert(gmailWatches).values({
        mailbox: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        historyId: "8000",
        expiration: null,
        topic: null,
        updatedAt: "2026-10-20T12:00:00.000Z",
      });
      const watchedFiled = await ingestGmailPush(db, { emailAddress: "mmaclamroc@gmail.com", historyId: "8100" }, {
        client: {
          listAdded: async () => ({ latestHistoryId: "8100", messages: [{ id: "off-1", threadId: "off-thread" }] }),
          getMessage: async () => ({
            id: "off-1",
            threadId: "off-thread",
            from: "Bea <bea@maple.example>",
            to: "mmaclamroc@gmail.com",
            subject: "Maple collab",
            labelIds: ["INBOX"],
          }),
        },
      });
      assert.equal(watchedFiled.status, 200);
      assert.equal((await db.select().from(gmailBridgeThreads)).length, 0);

      process.env.GMAIL_SYNC_ENABLED = "true";
      assert.equal(gmailSyncEnabled(), true);
      const personal: BridgeMessage = {
        id: "personal-1",
        threadId: "personal-thread",
        from: "Sam <sam.friend@gmail.com>",
        to: "abby.brand@gmail.com",
        subject: "Saturday dinner",
        labelIds: ["INBOX"],
        snippet: "Want to come over?",
      };
      const brand: BridgeMessage = {
        id: "brand-1",
        threadId: "brand-thread",
        from: "Bea <bea@maple.example>",
        to: "abby.brand@gmail.com",
        subject: "Paid collab for your channel",
        labelIds: ["INBOX"],
        snippet: "We would love a partnership.",
        attachments: [{ id: "file-1", filename: "brief.pdf", mimeType: "application/pdf" }],
      };
      const synced = await syncConnectedMailboxes(db, {
        read: async ({ refreshToken }) => {
          assert.equal(refreshToken, token);
          return [personal, brand];
        },
      });
      assert.equal(synced.enabled, true);
      assert.equal(synced.mailboxes.some((row) => JSON.stringify(row).includes(token)), false);
      const abbyBox = synced.mailboxes.find((row) => row.mailbox === "abby.brand@gmail.com");
      assert.equal(abbyBox?.ok, true);
      assert.equal(abbyBox?.filed, 1);
      assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, personal.threadId))).length, 0);
      const hidden = await getDealForViewer(db, admin, "mail-brand-1");
      assert.equal(hidden?.visibleToCreator, false);
      assert.equal(hidden?.brand.length ? hidden.brand.length > 0 : false, true);

      const added = await addManager(db, { actorRole: "admin", name: "Riley Bridge", email: "riley.bridge@gmail.com" });
      assert.equal(added.ok, true);
      if (!added.ok) return;
      const other = await addManager(db, { actorRole: "admin", name: "Casey Bridge", email: "casey.bridge@gmail.com" });
      assert.equal(other.ok, true);
      if (!other.ok) return;
      assert.equal((await assignCreatorManagers(db, { actorRole: "admin", creatorId: "abby", primaryManagerId: added.id, backupManagerId: null })).ok, true);
      const riley: Viewer = { email: added.email, role: "manager", creatorId: null, name: "Riley Bridge", managerId: added.id };
      const casey: Viewer = { email: other.email, role: "manager", creatorId: null, name: "Casey Bridge", managerId: other.id };

      const abbyInbox = await listDealInbox(db, abby);
      const rileyInbox = await listDealInbox(db, riley);
      const caseyInbox = await listDealInbox(db, casey);
      assert.equal(abbyInbox.some((thread) => thread.subject.includes("collab")), true);
      assert.equal(abbyInbox.some((thread) => thread.subject.includes("dinner")), false);
      assert.equal(rileyInbox.length, 1);
      assert.equal(caseyInbox.length, 0);
      const packed = JSON.stringify({ abbyInbox, rileyInbox, bot: await listBotThreads(db) });
      assert.equal(packed.includes(token), false);
      assert.equal(packed.includes(cipher), false);

      const threadId = abbyInbox[0]?.id ?? "";
      const draft = await queueBrandReply(db, riley, { threadId, body: "Thanks, we can talk next week." });
      assert.equal(draft.ok && draft.status === "pending" && draft.sent === false, true);
      if (!draft.ok) return;
      const managerReview = await reviewApproval(db, {
        approvalId: draft.approvalId,
        intent: "approve",
        actorEmail: riley.email,
        actorRole: "manager",
      });
      assert.equal(managerReview.ok, false);
      const ownerReview = await reviewApproval(db, {
        approvalId: draft.approvalId,
        intent: "approve",
        actorEmail: admin.email,
        actorRole: "admin",
      });
      assert.equal(ownerReview.ok && ownerReview.status === "approved", true);
      assert.equal((await listSendableApprovals(db)).some((row) => row.id === draft.approvalId), false);
      const sent = await markApprovalSent(db, draft.approvalId, { messageId: "should-not-send" }, { email: "bot@mommamari.com", role: "bot" });
      assert.equal(sent.ok, false);

      assert.equal((await setThreadPrivate(db, abby, threadId, true)).ok, true);
      assert.equal((await listDealInbox(db, riley)).length, 0);
      assert.equal((await listDealInbox(db, abby)).length, 1);
      assert.equal((await classifyThread(db, admin, threadId, "deal")).ok, true);
      assert.equal((await listDealInbox(db, riley)).some((thread) => thread.id === threadId), false);
      const ownerStill = await listDealInbox(db, admin, "abby");
      assert.equal(ownerStill.some((thread) => thread.id === threadId && thread.private), true);

      let loaded = 0;
      const file = await readThreadAttachment(db, abby, { threadId, messageId: "brand-1", attachmentId: "file-1" }, async ({ refreshToken }) => {
        loaded += 1;
        assert.equal(refreshToken, token);
        return { bytes: new Uint8Array([1, 2, 3]), mimeType: "application/pdf" };
      });
      assert.equal(file.ok, true);
      if (file.ok) {
        assert.equal(file.filename, "brief.pdf");
        assert.equal(file.bytes.length, 3);
        assert.equal(JSON.stringify({ filename: file.filename, mimeType: file.mimeType }).includes(token), false);
      }
      const zip = await readThreadAttachment(db, abby, { threadId, messageId: "brand-1", attachmentId: "all" }, async () => {
        loaded += 1;
        return { bytes: new Uint8Array([9]), mimeType: "application/zip" };
      });
      assert.equal(zip.ok, false);
      if (!zip.ok) assert.equal(zip.status, 400);
      assert.equal(loaded, 1);
      const stranger = await readThreadAttachment(db, casey, { threadId, messageId: "brand-1", attachmentId: "file-1" }, async () => {
        loaded += 1;
        return { bytes: new Uint8Array([4]), mimeType: "application/pdf" };
      });
      assert.equal(stranger.ok, false);
      assert.equal(loaded, 1);

      assert.equal((await assignCreatorManagers(db, { actorRole: "admin", creatorId: "abby", primaryManagerId: null, backupManagerId: null })).ok, true);
      assert.equal((await setThreadPrivate(db, abby, threadId, false)).ok, true);
      assert.equal((await listDealInbox(db, riley)).length, 0);

      const audit = await listBridgeAudit(db, admin);
      assert.equal(audit.ok, true);
      if (audit.ok) assert.equal(JSON.stringify(audit.entries).includes(token), false);
      assert.equal((await listBridgeAudit(db, riley)).ok, false);
      assert.equal((await removeBridgeAudit()).status, 403);

      const cleared = await clearCreatorGmail(db, "abby");
      assert.equal(cleared.status, 200);
      const after = await db.select().from(creators).where(eq(creators.id, "abby"));
      assert.equal(after[0]?.gmailRefreshToken, null);
      assert.equal((await listDealInbox(db, abby)).length, 0);
      assert.equal((await listDealInbox(db, admin, "abby")).length, 0);
      await deleteBridgeForCreator(db, "abby");

      const renewed = await renewGmailWatches(db, async () => {
        throw new Error(`should not watch ${token}`);
      });
      assert.equal(renewed.length, 3);
      assert.equal(JSON.stringify(renewed).includes(token), false);
    } finally {
      if (previousSync == null) delete process.env.GMAIL_SYNC_ENABLED;
      else process.env.GMAIL_SYNC_ENABLED = previousSync;
      if (previousClient == null) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousClient;
      if (previousSecret == null) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
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
