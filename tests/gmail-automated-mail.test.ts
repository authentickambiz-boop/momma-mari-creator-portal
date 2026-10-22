import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandReplyDrafts, deals, gmailPortalDrafts, gmailWatches } from "../src/db/schema";
import { saveBrandReplyDraft } from "../src/lib/deal-review";
import { dealNoticeCode } from "../src/lib/deal-notice-notes";
import { confirmDraftBody, gmailDraftCreateAllowed, gmailDraftRequestAllowed, isAutomatedSender, isBotSenderName, isBulkHeader, isGithubSender, MM_LABEL } from "../src/lib/gmail-live";
import { ingestGmailPush, type GmailHistoryClient, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { admin, openTestDb } from "./harness";

const mailbox = "authentickambiz@gmail.com";

function message(id: string, extra: Partial<GmailHistoryMessage> = {}): GmailHistoryMessage {
  return {
    id,
    threadId: `thread-${id}`,
    from: '"cursor[bot]" <notifications@github.com>',
    to: mailbox,
    subject: "Re: [authentickambiz-boop/momma-mari-creator-portal] Hide dismissed threads (PR #172)",
    labelIds: ["INBOX", "CATEGORY_UPDATES"],
    headers: {
      "list-unsubscribe": "<mailto:unsub@reply.github.com>",
      "list-id": "momma-mari-creator-portal <momma-mari-creator-portal.authentickambiz-boop.github.com>",
      precedence: "list",
    },
    ...extra,
  };
}

function recordingClient(rows: GmailHistoryMessage[], latestHistoryId: string) {
  const labels: { id: string; names: string[] }[] = [];
  const created: { threadId: string; to: string; subject: string; body: string }[] = [];
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
    listThreadDrafts: async () => [],
    createDraft: async (input) => {
      created.push(input);
      return { id: `gmail-draft-${created.length}` };
    },
  };
  return { client, labels, created };
}

describe("automated mail is not a deal", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("github notifications, bot names, noreply domains, and bulk headers are automated", () => {
    const github = '"cursor[bot]" <notifications@github.com>';
    const exact = "cursor[bot] <notifications@github.com>";
    assert.equal(isAutomatedSender(github), true);
    assert.equal(isAutomatedSender(exact), true);
    assert.equal(isBotSenderName(github), true);
    assert.equal(isBotSenderName(exact), true);
    assert.equal(isGithubSender(exact), true);
    assert.equal(isAutomatedSender("notifications@github.com"), true);
    assert.equal(isAutomatedSender("dev@github.com"), true);
    assert.equal(isAutomatedSender("Ada <ada@reply.github.com>"), true);
    assert.equal(isAutomatedSender("no-reply@brand.example"), true);
    assert.equal(isAutomatedSender("notifications@brand.example"), true);
    const placeholder = confirmDraftBody({ creatorLabel: "AuthenticKam", brand: "cursor[bot]" });
    assert.equal(placeholder.includes("Hi cursor[bot],"), true);
    assert.equal(placeholder.includes("Thanks for writing about AuthenticKam."), true);
    assert.equal(placeholder.includes("Rate: [CONFIRM]"), true);
    assert.equal(gmailDraftCreateAllowed({ to: "notifications@github.com", subject: "Re: PR #174", body: placeholder }), false);
    const raw = Buffer.from(["To: notifications@github.com", "Subject: Re: PR #174", "", placeholder].join("\r\n")).toString("base64url");
    assert.equal(gmailDraftRequestAllowed("/drafts", { message: { raw, threadId: "thread-exact" } }), false);
    assert.equal(gmailDraftRequestAllowed("/labels", { message: { raw } }), true);
    assert.equal(isAutomatedSender("cursor[bot] <cursor[bot]@users.noreply.github.com>"), true);
    assert.equal(isAutomatedSender("GitHub <noreply@github.com>"), true);
    assert.equal(isAutomatedSender("Author <author@noreply.github.com>"), true);
    assert.equal(isAutomatedSender("List <momma-mari-creator-portal@noreply.github.com>"), true);
    assert.equal(isAutomatedSender('"cursor[bot]" <dev@brand.example>'), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { precedence: "bulk" }), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { precedence: "list" }), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { "list-unsubscribe": "<mailto:unsub@brand.example>" }), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { "list-id": "news <news.brand.example>" }), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { "auto-submitted": "auto-generated" }), true);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>", { "auto-submitted": "no" }), false);
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>"), false);
    assert.equal(isBulkHeader({ precedence: "bulk" }), true);
    assert.equal(isBulkHeader(undefined), false);
  });

  test("a github notification gets no deal card, no deal labels, and no placeholder draft", async () => {
    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "authentickam",
      historyId: "2000",
      expiration: null,
      topic: null,
      updatedAt: "2026-10-21T22:00:00.000Z",
    });

    const brand = message("brand-pitch", {
      from: "Bea <bea@maple.example>",
      subject: "Maple partnership",
      headers: {},
      labelIds: ["INBOX"],
    });
    const github = [
      message("gh-171"),
      message("gh-172", { subject: "Re: Hide dismissed threads from the deal inbox (PR #172)" }),
    ];
    const headerOnly = message("header-only", {
      from: "News <news@maple.example>",
      subject: "Weekly note",
      headers: { precedence: "bulk" },
    });
    const opened = recordingClient([brand, ...github, headerOnly], "2100");
    const first = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "2100" }, { client: opened.client });
    assert.equal(first.status, 200);
    if (!("createdDealIds" in first.body)) throw new Error("expected deals");
    assert.deepEqual(first.body.createdDealIds, ["mail-brand-pitch"]);
    assert.equal(opened.created.length, 0);
    assert.equal((await db.select().from(gmailPortalDrafts)).length, 0);
    assert.equal((await db.select().from(brandReplyDrafts)).some((row) => row.body.includes("[CONFIRM]")), false);
    for (const row of [...github, headerOnly]) {
      assert.equal((await db.select().from(deals).where(eq(deals.id, `mail-${row.id}`))).length, 0, row.id);
      const names = opened.labels.find((label) => label.id === row.id)?.names ?? [];
      assert.equal(names.includes(MM_LABEL.deal), false, row.id);
      assert.equal(names.includes(MM_LABEL.needsReply), false, row.id);
      assert.deepEqual(names, [MM_LABEL.notDeal]);
    }

    const onBrandThread = message("gh-on-brand", {
      threadId: "thread-brand-pitch",
      subject: "Re: Maple partnership",
    });
    const follow = recordingClient([onBrandThread], "2200");
    const matched = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "2200" }, { client: follow.client });
    if (!("createdDealIds" in matched.body) || !("matchedDealIds" in matched.body)) throw new Error("expected a filing");
    assert.deepEqual(matched.body.createdDealIds, []);
    assert.deepEqual(matched.body.matchedDealIds, []);
    assert.equal(follow.created.length, 0);
    assert.deepEqual(follow.labels[0]?.names, [MM_LABEL.notDeal]);

    const refused = await saveBrandReplyDraft(db, {
      dealId: "mail-brand-pitch",
      actorEmail: admin.email,
      actorRole: "admin",
      body: "Rate: [CONFIRM]\nDate: [CONFIRM]",
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.equal(dealNoticeCode(refused.error), "confirm");
    assert.equal((await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, "mail-brand-pitch"))).length, 0);

    const saved = await saveBrandReplyDraft(db, {
      dealId: "mail-brand-pitch",
      actorEmail: admin.email,
      actorRole: "admin",
      body: "Hi Bea, AuthenticKam can post the Maple video for $800 on November 2.",
    });
    assert.equal(saved.ok, true);
    const reply = "Hi Bea, AuthenticKam can post the Maple video for $800 on November 2.";
    const again = message("brand-2", { threadId: "thread-brand-pitch", from: "Bea <bea@maple.example>", subject: "Re: Maple partnership", headers: {} });
    const drafted = recordingClient([again], "2300");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "2300" }, { client: drafted.client });
    assert.equal(drafted.created.length, 1);
    assert.equal(drafted.created[0]?.body, reply);
    assert.equal(drafted.created.some((draft) => draft.body.includes("[CONFIRM]")), false);

    const exactFrom = "cursor[bot] <notifications@github.com>";
    const exactNote = message("gh-exact", {
      from: exactFrom,
      subject: "Re: [authentickambiz-boop/momma-mari-creator-portal] Do not file GitHub notifications as deals or placeholder drafts (PR #174)",
      headers: {},
      labelIds: ["INBOX", "CATEGORY_UPDATES"],
    });
    const exactOnDeal = message("gh-exact-thread", {
      from: exactFrom,
      threadId: "thread-brand-pitch",
      subject: "Re: Maple partnership",
      headers: {},
      labelIds: ["INBOX"],
    });
    const exactRun = recordingClient([exactNote, exactOnDeal], "2400");
    const filed = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "2400" }, { client: exactRun.client });
    if (!("createdDealIds" in filed.body) || !("matchedDealIds" in filed.body)) throw new Error("expected a filing");
    assert.deepEqual(filed.body.createdDealIds, []);
    assert.deepEqual(filed.body.matchedDealIds, []);
    assert.equal(exactRun.created.length, 0);
    assert.equal(exactRun.created.some((draft) => draft.body.includes("[CONFIRM]")), false);
    for (const row of [exactNote, exactOnDeal]) {
      assert.deepEqual(exactRun.labels.find((label) => label.id === row.id)?.names, [MM_LABEL.notDeal]);
    }
  });
});
