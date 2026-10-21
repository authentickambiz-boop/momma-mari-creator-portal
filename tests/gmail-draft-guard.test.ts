import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandCrmEntries, brandReplyDrafts, deals, gmailPortalDrafts, gmailWatches } from "../src/db/schema";
import {
  gmailDraftAllowed,
  hasUnfilledPlaceholder,
  isAutomatedSender,
  isPersonalMail,
  MM_LABEL,
} from "../src/lib/gmail-live";
import { draftsOnThread, ingestGmailPush, type GmailHistoryClient, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

const mailbox = "mmaclamroc@gmail.com";

function message(id: string, extra: Partial<GmailHistoryMessage> = {}): GmailHistoryMessage {
  return {
    id,
    threadId: `thread-${id}`,
    from: "Bea <bea@maple.example>",
    to: mailbox,
    subject: "Maple partnership",
    labelIds: ["INBOX"],
    ...extra,
  };
}

function recordingClient(rows: GmailHistoryMessage[], latestHistoryId: string, drafts: { id: string; snippet: string }[] = []) {
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
    listThreadDrafts: async () => drafts,
    createDraft: async (input) => {
      created.push(input);
      return { id: `gmail-draft-${created.length}` };
    },
  };
  return { client, labels, created };
}

describe("gmail draft guards", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("automated senders and personal notes are not brand mail, and a filled reply is", () => {
    for (const from of [
      "no-reply@google.com",
      "Google <no-reply@google.com>",
      "noreply@accounts.google.com",
      "no_reply@shop.example",
      "no.reply@shop.example",
      "do-not-reply@shop.example",
      "donotreply@shop.example",
      "notification@shop.example",
      "notifications@shop.example",
      "alerts-noreply@google.com",
      "automated@brand.example",
      "notify@alerts.example",
      "mailer-daemon@google.com",
      "postmaster@shop.example",
    ]) {
      assert.equal(isAutomatedSender(from), true, from);
    }
    assert.equal(isAutomatedSender("Nina <nina@harbor.example>"), false);
    assert.equal(isAutomatedSender("reply@brand.example"), false);
    assert.equal(isAutomatedSender("national@brand.example"), false);

    assert.equal(isPersonalMail("Sam <sam.friend@gmail.com>", "Saturday dinner"), true);
    assert.equal(isPersonalMail("Sam <sam.friend@yahoo.com>", "Checking in"), true);
    assert.equal(isPersonalMail("Sam <sam.friend@gmail.com>", "Paid collab for your channel"), false);
    assert.equal(isPersonalMail("Bea <bea@maple.example>", "Hello"), false);
    assert.equal(isPersonalMail("no-reply@gmail.com", "Hello"), false);

    const starter = "Hi Google,\n\nThanks for writing about MariClare.\n\nRate: [CONFIRM]\nDate: [CONFIRM]";
    assert.equal(hasUnfilledPlaceholder(starter), true);
    assert.equal(hasUnfilledPlaceholder("rate: [confirm]"), true);
    assert.equal(hasUnfilledPlaceholder("MariClare can do the Maple video for $1,200 on November 2."), false);
    assert.equal(gmailDraftAllowed(starter), false);
    assert.equal(gmailDraftAllowed("Rate: [CONFIRM] but let's talk"), false);
    assert.equal(gmailDraftAllowed(""), false);
    assert.equal(gmailDraftAllowed("Prepared by Sintra"), false);
    assert.equal(gmailDraftAllowed("Hi Bea, MariClare can do the Maple video for $1,200 on November 2."), true);

    const onThread = draftsOnThread(
      "thread-maple",
      [{ id: "sent-1", snippet: "The pitch", labelIds: ["INBOX"] }],
      [{ id: "draft-row", message: { id: "draft-msg", threadId: "thread-maple", snippet: "Earlier reply" } }],
    );
    assert.deepEqual(onThread, [{ id: "draft-msg", snippet: "Earlier reply" }]);
    const labeled = draftsOnThread(
      "thread-maple",
      [{ id: "draft-msg", snippet: "Earlier reply", labelIds: ["DRAFT"] }],
      [{ message: { id: "draft-msg", threadId: "thread-maple", snippet: "Earlier reply" } }, { message: { id: "other", threadId: "thread-other", snippet: "Elsewhere" } }],
    );
    assert.deepEqual(labeled, [{ id: "draft-msg", snippet: "Earlier reply" }]);
  });

  test("live sync logs a brand thread in the portal and does not save a placeholder or duplicate Gmail draft", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: "1000",
      expiration: null,
      topic: null,
      updatedAt: "2026-10-21T21:00:00.000Z",
    });
    await db.insert(brandCrmEntries).values({
      id: "crm-glow",
      brandKey: "glow",
      kind: "brand",
      contactName: "Sam Glow",
      contactEmail: "sam.glow@gmail.com",
      response: null,
      note: null,
      actorName: "Kamron",
      createdAt: "2026-10-21T21:00:00.000Z",
      ratePaidCents: null,
      outcome: null,
      nextFollowUp: null,
      creatorId: "mariclare",
      domain: "gmail.com",
    });

    const ignored = [
      message("google-noreply", { from: "Google <no-reply@google.com>", subject: "Your partnership with Google" }),
      message("accounts-noreply", { from: "Google Account <noreply@accounts.google.com>", subject: "Security alert" }),
      message("notify", { from: "Shop <notifications@shop.example>", subject: "A notification" }),
      message("automated", { from: "Bot <automated@brand.example>", subject: "Automated update" }),
      message("dinner", { from: "Sam <sam.friend@gmail.com>", subject: "Saturday dinner" }),
    ];
    const gmailPitch = message("gmail-collab", { from: "Sam <sam.friend@gmail.com>", subject: "Paid collab for your channel" });
    const maple = message("maple");
    const known = message("known-glow", { from: "Sam Glow <sam.glow@gmail.com>", subject: "Hello from Glow" });
    const rows = [...ignored, gmailPitch, maple, known];
    const opened = recordingClient(rows, "1100");
    const first = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1100" }, { client: opened.client });
    assert.equal(first.status, 200);
    if (!("createdDealIds" in first.body)) throw new Error("expected deals");
    assert.deepEqual(first.body.createdDealIds, ["mail-gmail-collab", "mail-maple", "mail-known-glow"]);
    assert.equal(opened.created.length, 0);
    assert.equal((await db.select().from(gmailPortalDrafts)).length, 0);
    for (const row of ignored) {
      assert.equal((await db.select().from(deals).where(eq(deals.id, `mail-${row.id}`))).length, 0, row.id);
      assert.deepEqual(opened.labels.find((label) => label.id === row.id)?.names, [MM_LABEL.notDeal]);
    }
    const mapleDeal = await getDealForViewer(db, admin, "mail-maple");
    assert.equal(mapleDeal?.visibleToCreator, false);
    assert.match(mapleDeal?.brandReplyDraft ?? "", /Rate: \[CONFIRM\]/);
    assert.match(mapleDeal?.brandReplyDraft ?? "", /Thanks for writing about MariClare/);
    assert.equal(opened.created.some((draft) => draft.body.includes("[CONFIRM]") || draft.body.includes("Hi Google")), false);
    assert.equal(await getDealForViewer(db, mariclare, "mail-maple"), null);

    await db.update(brandReplyDrafts).set({
      body: "Rate: [CONFIRM] but let's talk",
      updatedBy: "kamron@mommamari.com",
    }).where(eq(brandReplyDrafts.dealId, "mail-gmail-collab"));
    const unfilled = message("gmail-collab-2", { threadId: "thread-gmail-collab", from: "Sam <sam.friend@gmail.com>", subject: "Re: Paid collab" });
    const unfilledRun = recordingClient([unfilled], "1200");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1200" }, { client: unfilledRun.client });
    assert.equal(unfilledRun.created.length, 0);

    const reply = "Hi Bea, MariClare can do the Maple video for $1,200 on November 2.";
    await db.update(brandReplyDrafts).set({
      body: reply,
      updatedBy: "kamron@mommamari.com",
    }).where(eq(brandReplyDrafts.dealId, "mail-maple"));
    const followUps = [
      message("maple-2", { threadId: "thread-maple", subject: "Re: Maple partnership" }),
      message("maple-3", { threadId: "thread-maple", subject: "One more detail" }),
    ];
    const follow = recordingClient(followUps, "1300");
    const matched = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1300" }, { client: follow.client });
    if (!("matchedDealIds" in matched.body)) throw new Error("expected a match");
    assert.deepEqual(matched.body.matchedDealIds, ["mail-maple", "mail-maple"]);
    assert.equal(follow.created.length, 1);
    assert.equal(follow.created[0]?.to, "bea@maple.example");
    assert.equal(follow.created[0]?.body, reply);
    assert.equal(follow.created[0]?.body.includes("[CONFIRM]"), false);
    assert.equal((await db.select().from(gmailPortalDrafts).where(eq(gmailPortalDrafts.threadId, "thread-maple"))).length, 1);

    const again = message("maple-4", { threadId: "thread-maple", subject: "Still there" });
    const repeat = recordingClient([again], "1400");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1400" }, { client: repeat.client });
    assert.equal(repeat.created.length, 0);
    assert.equal((await db.select().from(gmailPortalDrafts).where(eq(gmailPortalDrafts.threadId, "thread-maple"))).length, 1);

    const robot = message("maple-robot", { threadId: "thread-maple", from: "Google <no-reply@google.com>", subject: "Account notice" });
    const robotRun = recordingClient([robot], "1500");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1500" }, { client: robotRun.client });
    assert.equal(robotRun.created.length, 0);

    const occupied = message("harbor", { from: "Nina <nina@harbor.example>", subject: "Harbor campaign" });
    const occupiedRun = recordingClient([occupied], "1600", [{ id: "already", snippet: "A reply is already sitting here" }]);
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1600" }, { client: occupiedRun.client });
    await db.update(brandReplyDrafts).set({
      body: "Hi Nina, we can talk next week.",
      updatedBy: "kamron@mommamari.com",
    }).where(eq(brandReplyDrafts.dealId, "mail-harbor"));
    const occupiedFollow = message("harbor-2", { threadId: "thread-harbor", from: "Nina <nina@harbor.example>", subject: "Re: Harbor campaign" });
    const occupiedFollowRun = recordingClient([occupiedFollow], "1700", [{ id: "already", snippet: "A reply is already sitting here" }]);
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1700" }, { client: occupiedFollowRun.client });
    assert.equal(occupiedRun.created.length, 0);
    assert.equal(occupiedFollowRun.created.length, 0);
    assert.equal((await db.select().from(gmailPortalDrafts).where(eq(gmailPortalDrafts.threadId, "thread-harbor"))).length, 0);

    const sintraMail = message("sintra-brand", { from: "Ada <ada@cedar.example>", subject: "Cedar campaign" });
    const sintraOpen = recordingClient([sintraMail], "1800");
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1800" }, { client: sintraOpen.client });
    await db.update(brandReplyDrafts).set({
      body: "Hi Ada, the rate is $800.",
      updatedBy: "kamron@mommamari.com",
    }).where(eq(brandReplyDrafts.dealId, "mail-sintra-brand"));
    const sintraFollow = message("sintra-brand-2", { threadId: "thread-sintra-brand", from: "Ada <ada@cedar.example>", subject: "Re: Cedar campaign" });
    const sintraRun = recordingClient([sintraFollow], "1900", [{ id: "sintra-1", snippet: "Drafted with Sintra" }]);
    await ingestGmailPush(db, { emailAddress: mailbox, historyId: "1900" }, { client: sintraRun.client });
    assert.equal(sintraRun.created.length, 0);
    assert.equal((await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, "mail-sintra-brand")))[0]?.body, "Hi Ada, the rate is $800.");

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
