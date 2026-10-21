import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandReplyDrafts, deals, gmailPortalDrafts, gmailSeenMessages, gmailWatches } from "../src/db/schema";
import { KAMRON_AGENCY_EMAIL, saveAgencyMailbox } from "../src/lib/agency-mailbox";
import {
  confirmDraftBody,
  gmailMutationAllowed,
  isSintraDraft,
  MM_LABEL,
  scrubPricesAndDates,
} from "../src/lib/gmail-live";
import {
  WATCH_MAILBOXES,
  catchUpWatchedMailboxes,
  clearCreatorGmail,
  ingestGmailPush,
  pushAudiencesMatch,
  renewGmailWatches,
  verifyPubSubOidc,
  type GmailHistoryClient,
  type GmailHistoryMessage,
} from "../src/lib/gmail-push";
import { GMAIL_WATCH_SCOPE, googleGmailWatchAuthUrl, googleRedirectUri } from "../src/lib/google-oauth";
import { gmailConnectionState } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

const mailbox = KAMRON_AGENCY_EMAIL;

function message(id: string, extra: Partial<GmailHistoryMessage> = {}): GmailHistoryMessage {
  return {
    id,
    threadId: `thread-${id}`,
    from: "Harbor $1,200 <nina@harbor.example>",
    to: mailbox,
    subject: "Collab on Oct 21, 2026",
    labelIds: ["INBOX"],
    ...extra,
  };
}

function recordingClient(rows: GmailHistoryMessage[], latestHistoryId: string, drafts: { id: string; snippet: string }[] = []) {
  const labels: { id: string; names: string[] }[] = [];
  const created: { to: string; subject: string; body: string }[] = [];
  const client: GmailHistoryClient = {
    listAdded: async () => ({ latestHistoryId, messages: rows.map((row) => ({ id: row.id, threadId: row.threadId })) }),
    getMessage: async (id) => {
      const found = rows.find((row) => row.id === id);
      if (!found) throw new Error(id);
      return found;
    },
    applyLabels: async (id, names) => {
      labels.push({ id, names });
    },
    listThreadDrafts: async () => drafts,
    createDraft: async (input) => {
      created.push(input);
      return { id: `gmail-draft-${created.length}` };
    },
  };
  return { client, labels, created };
}

describe("live gmail push", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("three inboxes are watched, drafts stay placeholders, and Sintra is left alone", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const wwwPush = "https://www.mommamari.com/portal/api/gmail/push";
    const apexPush = "https://mommamari.com/portal/api/gmail/push";
    assert.equal(pushAudiencesMatch(wwwPush, wwwPush), true);
    assert.equal(pushAudiencesMatch(wwwPush, apexPush), true);
    assert.equal(pushAudiencesMatch(apexPush, wwwPush), true);
    assert.equal(pushAudiencesMatch(wwwPush, "https://evil.example/portal/api/gmail/push"), false);
    const wwwClaims = {
      iss: "https://accounts.google.com",
      aud: wwwPush,
      email: "gmail-push-sender@momma-mari-portal.iam.gserviceaccount.com",
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const accepted = await verifyPubSubOidc("Bearer t", {
      audience: wwwPush,
      serviceAccount: wwwClaims.email,
      verifyToken: async () => wwwClaims,
    });
    assert.equal(accepted.ok, true);
    const previousBase = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://www.mommamari.com/portal";
    assert.equal(googleRedirectUri(), "https://www.mommamari.com/portal/api/auth/callback");
    if (previousBase == null) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousBase;

    assert.deepEqual(WATCH_MAILBOXES.map((box) => box.email), [
      "mmaclamroc@gmail.com",
      "authentickambiz@gmail.com",
      "kamron@mommamari.com",
    ]);
    const watchUrl = new URL(googleGmailWatchAuthUrl("state", mailbox));
    assert.equal(watchUrl.searchParams.get("scope"), GMAIL_WATCH_SCOPE);
    assert.equal(watchUrl.searchParams.get("scope")?.includes("gmail.send"), false);
    assert.equal(watchUrl.searchParams.get("scope")?.includes("mail.google.com"), false);
    assert.equal(gmailMutationAllowed("/drafts"), true);
    assert.equal(gmailMutationAllowed("/messages/abc/modify"), true);
    assert.equal(gmailMutationAllowed("/labels"), true);
    assert.equal(gmailMutationAllowed("/messages/send"), false);
    assert.equal(gmailMutationAllowed("/drafts/send"), false);
    assert.equal(gmailMutationAllowed("/messages/abc/trash"), false);
    assert.equal(gmailMutationAllowed("/messages/abc/delete"), false);
    assert.equal(isSintraDraft("Prepared by Sintra"), true);
    assert.equal(isSintraDraft("Thanks for writing"), false);
    const sample = confirmDraftBody({ creatorLabel: "MariClare", brand: "Harbor $1,200 on Oct 21, 2026" });
    assert.match(sample, /Rate: \[CONFIRM\]/);
    assert.match(sample, /Date: \[CONFIRM\]/);
    assert.equal(sample.includes("$"), false);
    assert.equal(scrubPricesAndDates("See you 10/21/2026").includes("10/21"), false);
    const pushSource = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.equal(pushSource.includes('"/messages/send"'), false);
    assert.equal(pushSource.includes('"/drafts/send"'), false);
    assert.equal(pushSource.includes('"/trash"'), false);
    assert.match(readFileSync(path.join(process.cwd(), "src/app/api/cron/gmail-sync/route.ts"), "utf8"), /catchUpWatchedMailboxes/);
    assert.match(readFileSync(path.join(process.cwd(), "src/app/api/cron/gmail-watch/route.ts"), "utf8"), /renewGmailWatches/);

    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "agency",
      historyId: "100",
      expiration: "1893456000000",
      topic: null,
      updatedAt: "2026-10-21T12:00:00.000Z",
    });
    const inbound = message("kam-1");
    const first = recordingClient([inbound], "200");
    const opened = await ingestGmailPush(db, { emailAddress: "Kamron@mommamari.com", historyId: "200" }, { client: first.client });
    assert.equal(opened.status, 200);
    if (!("createdDealIds" in opened.body)) throw new Error("expected a deal");
    assert.deepEqual(opened.body.createdDealIds, ["mail-kam-1"]);
    const deal = await getDealForViewer(db, admin, "mail-kam-1");
    assert.equal(deal?.creatorId, "agency");
    assert.equal(deal?.creatorName, "Kamron");
    assert.equal(deal?.visibleToCreator, false);
    assert.equal(deal?.workflowStage, "offer_received");
    assert.equal(await getDealForViewer(db, mariclare, "mail-kam-1"), null);
    assert.equal(deal?.brandReplyDraft ?? null, null);
    assert.deepEqual(first.labels[0]?.names, [MM_LABEL.deal, MM_LABEL.needsReply]);
    assert.equal(first.created.length, 0);
    assert.equal((await db.select().from(gmailPortalDrafts)).length, 0);

    const repeat = recordingClient([inbound], "210");
    const again = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "210" }, { client: repeat.client });
    if (!("skippedDuplicate" in again.body)) throw new Error("expected a duplicate");
    assert.equal((again.body.skippedDuplicate ?? 0) > 0, true);
    assert.equal(repeat.created.length, 0);
    assert.equal(repeat.labels.length, 0);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-kam-1"))).length, 1);
    assert.equal((await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, "kam-1"))).length, 1);

    await db.insert(brandReplyDrafts).values({
      dealId: "mail-kam-1",
      body: "Sintra already wrote this.",
      updatedBy: "Sintra",
      updatedAt: "2026-10-21T22:00:00.000Z",
    });
    const follow = message("kam-2", { threadId: "thread-kam-1", subject: "Checking in" });
    const sintra = recordingClient([follow], "220", [{ id: "sintra-1", snippet: "Drafted with Sintra" }]);
    const matched = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "220" }, { client: sintra.client });
    if (!("matchedDealIds" in matched.body)) throw new Error("expected a match");
    assert.deepEqual(matched.body.matchedDealIds, ["mail-kam-1"]);
    assert.equal(sintra.created.length, 0);
    assert.equal((await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, "mail-kam-1")))[0]?.body, "Sintra already wrote this.");
    assert.deepEqual(sintra.labels[0]?.names, [MM_LABEL.deal, MM_LABEL.needsReply]);

    const spam = message("kam-spam", { from: "Junk <junk@forceawakens.net>", subject: "You won" });
    const spamRun = recordingClient([spam], "230");
    const dropped = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "230" }, { client: spamRun.client });
    if (!("createdDealIds" in dropped.body)) throw new Error("expected a spam result");
    assert.deepEqual(dropped.body.createdDealIds, []);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-kam-spam"))).length, 0);
    assert.deepEqual(spamRun.labels[0]?.names, [MM_LABEL.notDeal]);
    assert.equal(spamRun.created.length, 0);

    const draftMail = message("kam-draft", { labelIds: ["DRAFT"] });
    const draftRun = recordingClient([draftMail], "240");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "240" }, { client: draftRun.client });
    assert.equal(draftRun.labels.length, 0);
    assert.equal(draftRun.created.length, 0);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-kam-draft"))).length, 0);

    const missed = message("kam-missed");
    const catchClient = recordingClient([missed], "300");
    const caught = await catchUpWatchedMailboxes(db, { clients: { [mailbox]: catchClient.client } });
    assert.equal(caught.mailboxes.find((row) => row.mailbox === mailbox)?.ok, true);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-kam-missed"))).length, 1);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "300");
    const quiet = recordingClient([], "300");
    const second = await catchUpWatchedMailboxes(db, { clients: { [mailbox]: quiet.client } });
    assert.equal(second.mailboxes.find((row) => row.mailbox === mailbox)?.ok, true);
    assert.equal(quiet.created.length, 0);
    assert.equal((await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, "kam-missed"))).length, 1);

    const saved = await saveAgencyMailbox(db, { refreshToken: "1//agency-refresh-token-value", gmailEmail: mailbox });
    assert.equal(saved.ok, true);
    const beforeRenew = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId;
    const renewed = await renewGmailWatches(db, async () => ({ historyId: "9999", expiration: "1893456000000" }));
    assert.equal(renewed.find((row) => row.mailbox === mailbox)?.ok, true);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, beforeRenew);
    assert.equal((await gmailConnectionState(db, "agency")).needsReconnect, false);

    const cleared = await clearCreatorGmail(db, "agency");
    assert.equal(cleared.status, 200);
    assert.equal((await gmailConnectionState(db, "agency")).connected, false);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox))).length, 0);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  });
});
