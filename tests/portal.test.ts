import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { createDb, type PortalDb } from "../src/db/index";
import { openDatabase } from "../src/db/local-d1";
import { approvalListAllowed, listApprovalQueue, listBrandContacts, reviewApproval } from "../src/lib/approvals";
import { canApproveEmail, canChangeDealStage, resolveViewedCreator } from "../src/lib/authz";
import { addFeedback, authorizeBot, createApprovalDraft, listApprovedApprovals, markApprovalDraftSent, updateDeal, upsertCreator, upsertDeal, upsertPayment, writeDailyAnalytics } from "../src/lib/bot-api";
import { setDealStage } from "../src/lib/deal-stage";
import { sideStages, trackStages } from "../src/lib/stages";
import { creatorCutLabel, nextPayoutLabel, pipelineHeadline } from "../src/lib/format";
import {
  findCreatorById,
  getDealForViewer,
  listDealsForViewer,
  listDraftsSince,
  listDailyMetrics,
  listPostMetrics,
  resolveLogin,
  summarizeAnalytics,
} from "../src/lib/queries";
import { createSession, readSignedSessionId } from "../src/lib/session";
import { assertCanUpload, parseContentRange, validateChunk } from "../src/lib/uploads";
import type { Viewer } from "../src/lib/types";

process.env.SESSION_SECRET = "test-secret-please-change";
process.env.BOT_API_TOKEN = "test-bot-token-please-change";
process.env.ADMIN_EMAILS = "Kamron@mommamari.com";

let db: PortalDb;

const mariclare: Viewer = {
  email: "mmaclamroc@gmail.com",
  role: "creator",
  creatorId: "mariclare",
  name: "MariClare",
};
const abby: Viewer = {
  email: "theofficialtheriots@gmail.com",
  role: "creator",
  creatorId: "abby",
  name: "Abby Theriot",
};
const admin: Viewer = {
  email: "kamron@mommamari.com",
  role: "admin",
  creatorId: null,
  name: "Kamron",
};

describe("portal", { concurrency: 1 }, () => {
before(() => {
  db = createDb(openDatabase(":memory:"));
});

test("allowlist accepts the admin and seeded creators, and rejects everyone else", async () => {
  const stranger = await resolveLogin(db, "someone@gmail.com");
  assert.equal(stranger.ok, false);

  const kamron = await resolveLogin(db, "Kamron@mommamari.com");
  assert.equal(kamron.ok, true);
  if (kamron.ok) assert.equal(kamron.viewer.role, "admin");

  const creator = await resolveLogin(db, "mmaclamroc@gmail.com");
  assert.equal(creator.ok, true);
  if (creator.ok) {
    assert.equal(creator.viewer.creatorId, "mariclare");
    assert.equal(creator.viewer.name, "MariClare");
    assert.equal(creator.viewer.role, "creator");
  }

  // Reserved .invalid addresses never open a session.
  const reserved = await resolveLogin(db, "someone@example.invalid");
  assert.equal(reserved.ok, false);
  const abbyLogin = await resolveLogin(db, "theofficialtheriots@gmail.com");
  assert.equal(abbyLogin.ok, true);
  if (abbyLogin.ok) assert.equal(abbyLogin.viewer.creatorId, "abby");
  const retiredSeed = await resolveLogin(db, "abby.theriot@example.com");
  assert.equal(retiredSeed.ok, false);
});

test("0004 fills in the Abby and AuthenticKam profiles without inventing splits", async () => {
  const kam = await findCreatorById(db, "authentickam");
  assert.ok(kam);
  assert.equal(kam?.email, "authentickambiz@gmail.com");
  assert.equal(kam?.handles, "@authentickam");
  assert.equal(kam?.kidsAges, "5");
  assert.equal(kam?.monthlyGoalCents, 500000);
  assert.equal(kam?.splitPercent, null);
  assert.equal(kam?.isSeed, false);

  const abbyRow = await findCreatorById(db, "abby");
  assert.ok(abbyRow);
  assert.equal(abbyRow?.email, "theofficialtheriots@gmail.com");
  assert.equal(abbyRow?.handles, "@theofficialtheriots");
  assert.equal(abbyRow?.monthlyGoalCents, 500000);
  assert.equal(abbyRow?.splitPercent, null);

  const mari = await findCreatorById(db, "mariclare");
  assert.equal(mari?.name, "MariClare");
  assert.equal(mari?.email, "mmaclamroc@gmail.com");
});

test("a creator only receives her own visible deals", async () => {
  const hers = await listDealsForViewer(db, mariclare, "mariclare");
  assert.deepEqual(hers.map((deal) => deal.id), ["kosbling", "vev", "waterh", "persona", "sanvive", "halara"]);
  assert.equal(hers[0]?.creatorName, "MariClare");
  assert.equal(hers.some((deal) => deal.brand === "Grail"), false);
  assert.equal(hers.filter((deal) => deal.needsCreator).length, 3);

  assert.equal(await getDealForViewer(db, mariclare, "grail"), null);
  assert.equal(await getDealForViewer(db, mariclare, "does-not-exist"), null);
  const vev = await getDealForViewer(db, abby, "vev");
  assert.equal(vev, null);

  const own = await getDealForViewer(db, mariclare, "vev");
  assert.ok(own);
  assert.equal(own?.kamronNotes, null);
  assert.equal(own?.gmailThreadId, "seed-thread-vev");
  assert.match(own?.botMessage ?? "", /I'll write the email to VEV/);

  const hidden = await getDealForViewer(db, admin, "grail");
  assert.ok(hidden?.kamronNotes);
  assert.match(hidden?.kamronNotes ?? "", /routes to Grail first/);
  assert.equal(hidden?.visibleToCreator, false);
});

test("changing the creator query does not widen a creator's view", () => {
  assert.equal(resolveViewedCreator(mariclare, "abby", ["mariclare", "abby"]), "mariclare");
  assert.equal(resolveViewedCreator(mariclare, "all", ["mariclare", "abby"]), "mariclare");
  assert.equal(resolveViewedCreator(admin, "abby", ["mariclare", "abby"]), "abby");
  assert.equal(resolveViewedCreator(admin, "all", ["mariclare", "abby"]), "all");
  assert.equal(resolveViewedCreator(admin, "nope", ["mariclare", "abby"]), "mariclare");
});

test("creator split stays pending until a contract sets it", () => {
  assert.equal(creatorCutLabel(null, 120000), "Pending contract");
  assert.equal(creatorCutLabel(70, 120000), "$840 (70%)");
  const headline = pipelineHeadline(
    [
      { pipelineCents: 120000, pipelineName: "VEV" },
      { pipelineCents: 300000, pipelineName: "WaterH (max)" },
      { pipelineCents: 180000, pipelineName: "Persona" },
    ],
    "October",
  );
  assert.equal(headline.cents, 600000);
  assert.equal(headline.label, "October deals if VEV, WaterH (max) and Persona all close");
  assert.equal(nextPayoutLabel(new Date("2026-10-17T18:00:00.000Z"), "America/Chicago"), "Mon, Oct 19");
});

test("example analytics are labeled and sum to the mockup headlines", async () => {
  const summary = summarizeAnalytics(await listDailyMetrics(db, "mariclare"), await listPostMetrics(db, "mariclare"));
  assert.equal(summary.exampleMode, true);
  assert.equal(summary.followers, 1240000);
  assert.equal(summary.newFollowers, 3180);
  assert.equal(summary.averageViews, 412000);
  assert.equal(summary.engagementRate, 6.8);
  assert.equal(summary.posts.length, 3);
});

test("uploads are refused across creators and on deals that are not ready", () => {
  const vev = { creatorId: "mariclare", visibleToCreator: true, uploadEnabled: true };
  const persona = { creatorId: "mariclare", visibleToCreator: true, uploadEnabled: false };
  const grail = { creatorId: "mariclare", visibleToCreator: false, uploadEnabled: false };
  assert.equal(assertCanUpload(abby, vev).ok, false);
  assert.equal(assertCanUpload(mariclare, grail).status, 404);
  assert.equal(assertCanUpload(mariclare, persona).status, 403);
  assert.equal(assertCanUpload(mariclare, vev).ok, true);
});

test("chunk ranges stay sequential and 256 KB aligned", () => {
  assert.deepEqual(parseContentRange("bytes 0-262143/1000000"), { start: 0, end: 262143, total: 1000000 });
  const first = validateChunk({ start: 0, end: 262143, total: 1000000, bytesReceived: 0, sizeBytes: 1000000, bodyLength: 262144 });
  assert.equal(first.ok, true);
  const skipped = validateChunk({ start: 262144, end: 524287, total: 1000000, bytesReceived: 0, sizeBytes: 1000000, bodyLength: 262144 });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.expectedStart, 0);
});

test("session cookies are signed", async () => {
  const created = await createSession(db, mariclare);
  assert.equal(await readSignedSessionId(created.cookieValue), created.id);
  assert.equal(await readSignedSessionId(`${created.id}.tampered`), null);
  assert.equal(await readSignedSessionId("not-a-cookie"), null);
});

test("the bot token is required and draft listing skips seed rows", async () => {
  assert.equal(authorizeBot(null).ok, false);
  assert.equal(authorizeBot("Bearer wrong").status, 401);
  assert.equal(authorizeBot("Bearer test-bot-token-please-change").ok, true);
  const previous = process.env.BOT_API_TOKEN;
  delete process.env.BOT_API_TOKEN;
  assert.equal(authorizeBot("Bearer test-bot-token-please-change").status, 503);
  process.env.BOT_API_TOKEN = previous;

  const hiddenSeed = await listDraftsSince(db, "2020-01-01T00:00:00.000Z", false);
  assert.equal(hiddenSeed.length, 0);
  const withSeed = await listDraftsSince(db, "2020-01-01T00:00:00.000Z", true);
  assert.equal(withSeed.length, 1);
  assert.equal(withSeed[0]?.dealId, "waterh");
  assert.equal(withSeed[0]?.gmailThreadId, "seed-thread-waterh");
});

test("0006 maps existing deals onto the stage list without changing who can see them", async () => {
  assert.equal(trackStages().length, 23);
  assert.deepEqual(sideStages().map((stage) => stage.id), ["creator_declined", "brand_quiet", "cancelled", "on_hold"]);

  const vev = await getDealForViewer(db, admin, "vev");
  assert.equal(vev?.workflowStage, "draft_due");
  assert.equal(vev?.status, "active");
  assert.equal(vev?.stageEvents?.[0]?.id, "stage-migrate-vev");
  assert.equal(vev?.stageEvents?.[0]?.actorRole, "system");
  assert.equal(vev?.stageEvents?.[0]?.fromStage, null);
  assert.match(vev?.stageEvents?.[0]?.note ?? "", /previous status/);

  const waterh = await getDealForViewer(db, admin, "waterh");
  assert.equal(waterh?.workflowStage, "brand_revisions");
  const persona = await getDealForViewer(db, admin, "persona");
  assert.equal(persona?.workflowStage, "contract_review");
  assert.equal(persona?.status, "negotiating");
  const grail = await getDealForViewer(db, admin, "grail");
  assert.equal(grail?.workflowStage, "contract_review");
  assert.equal(grail?.visibleToCreator, false);
  const kosbling = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosbling?.workflowStage, "draft_due");
  assert.equal(kosbling?.status, "active");

  const creatorView = await getDealForViewer(db, mariclare, "vev");
  assert.equal(creatorView?.stageEvents, null);
  assert.equal(creatorView?.workflowStage, "draft_due");
  const mari = await findCreatorById(db, "mariclare");
  assert.equal(mari?.name, "MariClare");
});

test("the bot can post feedback, update status, set a split, and write real analytics", async () => {
  const feedback = await addFeedback(db, "vev", {
    summary: "Brand likes the hook. Please trim the first second.",
    source: "brand",
    occurredLabel: "Oct 18, 9:00 AM",
    draftStatus: "nope",
  });
  assert.equal(feedback.status, 400);

  const saved = await addFeedback(db, "vev", {
    summary: "Brand likes the hook. Please trim the first second.",
    source: "brand",
    occurredLabel: "Oct 18, 9:00 AM",
  });
  assert.equal(saved.status, 201);
  const vev = await getDealForViewer(db, mariclare, "vev");
  assert.match(vev?.revisions.at(-1)?.summary ?? "", /trim the first second/);

  const missing = await updateDeal(db, "not-a-deal", { status: "active" });
  assert.equal(missing.status, 404);
  const updated = await updateDeal(db, "persona", { status: "active", visibleToCreator: true });
  assert.equal(updated.status, 200);
  if ("workflowStage" in updated.body) {
    assert.equal(updated.body.workflowStage, "contract_review");
    assert.equal(updated.body.status, "active");
  }

  const payment = await upsertPayment(db, { dealId: "vev", creatorSplitPercent: 70, landedAmountCents: 120000, landedDate: "2026-10-20" });
  assert.equal(payment.status, 200);
  if ("creatorPayoutCents" in payment.body) assert.equal(payment.body.creatorPayoutCents, 84000);
  const after = await getDealForViewer(db, mariclare, "vev");
  assert.equal(after?.payment?.creatorSplitPercent, 70);

  const analytics = await writeDailyAnalytics(db, {
    creatorEmail: "mmaclamroc@gmail.com",
    date: "2026-10-18",
    platform: "tiktok",
    views: 1000,
    newFollowers: 12,
    example: false,
  });
  assert.equal(analytics.status, 200);
  const summary = summarizeAnalytics(await listDailyMetrics(db, "mariclare"), await listPostMetrics(db, "mariclare"));
  assert.equal(summary.exampleMode, false);
  assert.equal(summary.daily.length, 1);
  assert.equal(summary.daily[0]?.views, 1000);
});

test("replacing a placeholder email updates the allowlist", async () => {
  const result = await upsertCreator(db, {
    id: "abby",
    name: "Abby Theriot",
    email: "abby.real@gmail.com",
  });
  assert.equal(result.status, 200);
  const oldEmail = await resolveLogin(db, "theofficialtheriots@gmail.com");
  const newEmail = await resolveLogin(db, "abby.real@gmail.com");
  assert.equal(oldEmail.ok, false);
  assert.equal(newEmail.ok, true);
  if (newEmail.ok) assert.equal(newEmail.viewer.creatorId, "abby");
});

test("admins and the bot can move a deal's stage, and creators cannot", async () => {
  assert.equal(canChangeDealStage(admin), true);
  assert.equal(canChangeDealStage(mariclare), false);

  const refused = await setDealStage(db, {
    dealId: "waterh",
    toStage: "brand_approved",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.status, 403);

  const unknown = await updateDeal(db, "waterh", { workflowStage: "nope" });
  assert.equal(unknown.status, 400);

  const before = await getDealForViewer(db, admin, "waterh");
  const beforeCount = before?.stageEvents?.length ?? 0;
  const same = await setDealStage(db, {
    dealId: "waterh",
    toStage: "brand_revisions",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(same.ok, true);
  if (same.ok) assert.equal(same.changed, false);
  const still = await getDealForViewer(db, admin, "waterh");
  assert.equal(still?.stageEvents?.length, beforeCount);

  const stepped = await updateDeal(db, "waterh", { stage: 3 });
  assert.equal(stepped.status, 200);
  if ("workflowStage" in stepped.body) assert.equal(stepped.body.workflowStage, "brand_approved");
  const approved = await getDealForViewer(db, admin, "waterh");
  assert.equal(approved?.workflowStage, "brand_approved");
  assert.equal(approved?.status, "active");
  assert.equal(approved?.stage, 3);
  assert.equal(approved?.stageEvents?.at(-1)?.actorRole, "bot");

  const paid = await updateDeal(db, "sanvive", { workflowStage: "paid", stageNote: "Check cleared." });
  assert.equal(paid.status, 200);
  if ("status" in paid.body) assert.equal(paid.body.status, "paid");
  const sanvive = await getDealForViewer(db, admin, "sanvive");
  assert.equal(sanvive?.workflowStage, "paid");
  assert.equal(sanvive?.stageEvents?.at(-1)?.note, "Check cleared.");
  assert.equal(sanvive?.stageEvents?.at(-1)?.actorEmail, "bot");
  const creatorSanvive = await getDealForViewer(db, mariclare, "sanvive");
  assert.equal(creatorSanvive?.stageEvents, null);
  assert.equal(creatorSanvive?.revisions.some((row) => row.summary.includes("Check cleared.")), false);
  assert.match(creatorSanvive?.revisions.at(-1)?.summary ?? "", /Paid/);

  const shared = await setDealStage(db, {
    dealId: "grail",
    toStage: "offer_shared",
    actorEmail: admin.email,
    actorRole: "admin",
    note: "Screened after the call.",
  });
  assert.equal(shared.ok, true);
  const shown = await getDealForViewer(db, mariclare, "grail");
  assert.equal(shown?.visibleToCreator, true);
  assert.equal(shown?.workflowStage, "offer_shared");
  assert.equal(shown?.revisions.some((row) => row.summary.includes("Screened after the call.")), false);

  const declined = await setDealStage(db, {
    dealId: "grail",
    toStage: "creator_declined",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(declined.ok, true);
  assert.equal(await getDealForViewer(db, mariclare, "grail"), null);
  const hiddenAgain = await getDealForViewer(db, admin, "grail");
  assert.equal(hiddenAgain?.workflowStage, "creator_declined");
  assert.equal(hiddenAgain?.visibleToCreator, false);

  const created = await upsertDeal(db, {
    id: "newbrand",
    creatorId: "mariclare",
    brand: "New Brand",
    status: "negotiating",
  });
  assert.equal(created.status, 201);
  if ("workflowStage" in created.body) {
    assert.equal(created.body.workflowStage, "contract_review");
    assert.equal(created.body.visibleToCreator, false);
  }
  assert.equal(await getDealForViewer(db, mariclare, "newbrand"), null);

  const shownBrand = await upsertDeal(db, {
    id: "shownbrand",
    creatorEmail: "mmaclamroc@gmail.com",
    brand: "Shown Brand",
    visibleToCreator: true,
  });
  assert.equal(shownBrand.status, 201);
  if ("workflowStage" in shownBrand.body) {
    assert.equal(shownBrand.body.workflowStage, "offer_received");
    assert.equal(shownBrand.body.visibleToCreator, true);
  }
});

test("outgoing brand email stays pending until an admin approves it", async () => {
  assert.equal(canApproveEmail(admin), true);
  assert.equal(canApproveEmail(mariclare), false);
  assert.equal(approvalListAllowed("pending").ok, false);
  assert.equal(approvalListAllowed("approved").ok, true);
  assert.equal(approvalListAllowed(null).ok, true);

  const forced = await createApprovalDraft(db, {
    dealId: "persona",
    gate: "interest",
    to: "hello@persona.example",
    subject: "MariClare is interested",
    body: "Hi, MariClare would like to move ahead.",
    status: "approved",
  });
  assert.equal(forced.status, 403);

  const wrongFrom = await createApprovalDraft(db, {
    dealId: "persona",
    gate: "interest",
    to: "hello@persona.example",
    subject: "MariClare is interested",
    body: "Hi, MariClare would like to move ahead.",
    from: "mmaclamroc@gmail.com",
  });
  assert.equal(wrongFrom.status, 400);

  const missing = await createApprovalDraft(db, {
    dealId: "not-a-deal",
    gate: "video",
    to: "hello@brand.example",
    subject: "Draft",
    body: "Here is the video.",
  });
  assert.equal(missing.status, 404);

  const drafted = await createApprovalDraft(db, {
    dealId: "persona",
    gate: "interest",
    to: "hello@persona.example",
    subject: "MariClare is interested",
    body: "Hi, MariClare would like to move ahead at $450 a post.",
    attachmentNote: "Rate note from MariClare",
  });
  assert.equal(drafted.status, 201);
  assert.ok("id" in drafted.body);
  assert.equal(drafted.body.status, "pending");
  assert.equal(drafted.body.from, "authentickambiz@gmail.com");
  assert.equal(drafted.body.sendable, false);
  const approvalId = drafted.body.id;

  const waiting = await listApprovedApprovals(db);
  assert.equal(waiting.body.approvals.some((row) => row.id === approvalId), false);
  const tooSoon = await markApprovalDraftSent(db, approvalId, { messageId: "msg-1" });
  assert.equal(tooSoon.status, 409);

  const creatorTry = await reviewApproval(db, {
    approvalId,
    intent: "approve",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorTry.ok, false);

  const edited = await reviewApproval(db, {
    approvalId,
    intent: "edit",
    subject: "MariClare is interested",
    body: "Hi, MariClare would like to move ahead at $500 a post.",
    note: "Raised the rate.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(edited.ok, true);
  const stillWaiting = await listApprovedApprovals(db);
  assert.equal(stillWaiting.body.approvals.some((row) => row.id === approvalId), false);

  const approved = await reviewApproval(db, {
    approvalId,
    intent: "approve",
    subject: "MariClare is interested",
    body: "Hi, MariClare would like to move ahead at $500 a post.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(approved.ok, true);
  const ready = await listApprovedApprovals(db);
  const sendable = ready.body.approvals.find((row) => row.id === approvalId);
  assert.equal(sendable?.sendable, true);
  assert.equal(sendable?.from, "authentickambiz@gmail.com");
  assert.equal(sendable?.body, "Hi, MariClare would like to move ahead at $500 a post.");
  assert.equal(sendable?.creatorName, "MariClare");
  assert.equal(sendable?.brand, "Persona");

  const sent = await markApprovalDraftSent(db, approvalId, { messageId: "gmail-msg-100" });
  assert.equal(sent.status, 200);
  const afterSend = await listApprovedApprovals(db);
  assert.equal(afterSend.body.approvals.some((row) => row.id === approvalId), false);
  const again = await markApprovalDraftSent(db, approvalId, { messageId: "gmail-msg-100" });
  assert.equal(again.status, 409);

  const queue = await listApprovalQueue(db, "mariclare");
  const item = queue.find((row) => row.id === approvalId);
  assert.equal(item?.status, "sent");
  assert.deepEqual(item?.events.map((event) => event.action), ["created", "edited", "approved", "sent"]);
  assert.equal(item?.events.find((event) => event.action === "approved")?.body, "Hi, MariClare would like to move ahead at $500 a post.");
  assert.equal(item?.events.find((event) => event.action === "edited")?.note, "Raised the rate.");
  assert.equal(await listApprovalQueue(db, "abby").then((rows) => rows.some((row) => row.id === approvalId)), false);

  const held = await createApprovalDraft(db, {
    dealId: "waterh",
    gate: "video",
    to: "team@waterh.example",
    subject: "WaterH draft",
    body: "The revised video is here.",
    attachmentUrl: "https://drive.google.com/file/d/example",
  });
  assert.equal(held.status, 201);
  assert.ok("id" in held.body && typeof held.body.id === "string");
  const heldId = held.body.id;
  const rejected = await reviewApproval(db, {
    approvalId: heldId,
    intent: "reject",
    note: "Do not send this cut.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(rejected.ok, true);
  const rejectedSend = await markApprovalDraftSent(db, heldId, { messageId: "nope" });
  assert.equal(rejectedSend.status, 409);

  const sameCreator = await createApprovalDraft(db, {
    dealId: "grail",
    gate: "decline",
    to: "hello@grail.example",
    subject: "Passing for now",
    body: "Thank you for thinking of MariClare. This one is not the right fit.",
    brandContact: { name: "Grail Team", email: "hello@grail.example", company: "Grail" },
    suggestedCreatorId: "mariclare",
  });
  assert.equal(sameCreator.status, 400);

  const bareDecline = await createApprovalDraft(db, {
    dealId: "halara",
    gate: "decline",
    to: "hello@halara.example",
    subject: "Passing for now",
    body: "Thank you for thinking of MariClare.",
  });
  assert.equal(bareDecline.status, 400);

  const decline = await createApprovalDraft(db, {
    dealId: "halara",
    gate: "decline",
    to: "hello@halara.example",
    subject: "Passing for now",
    body: "Thank you for thinking of MariClare. We hope to work together on a better fit.",
    brandContact: { name: "Halara Team", email: "hello@halara.example", company: "Halara" },
    suggestedCreatorId: "abby",
    suggestedPlan: "Or a gifted post next season.",
  });
  assert.equal(decline.status, 201);
  assert.ok("id" in decline.body && typeof decline.body.id === "string");
  const declineId = decline.body.id;
  const beforeContacts = await listBrandContacts(db);
  const savedDecline = await reviewApproval(db, {
    approvalId: declineId,
    intent: "approve",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(savedDecline.ok, true);
  const contacts = await listBrandContacts(db);
  assert.equal(contacts.length, beforeContacts.length + 1);
  assert.equal(contacts.at(-1)?.contactEmail, "hello@halara.example");
  assert.equal(contacts.at(-1)?.company, "Halara");
  assert.equal(contacts.at(-1)?.suggestedCreatorId, "abby");
  assert.equal(contacts.at(-1)?.suggestedPlan, "Or a gifted post next season.");
  assert.equal(contacts.at(-1)?.savedBy, admin.email);
  const declineCard = (await listApprovalQueue(db, "all")).find((row) => row.id === declineId);
  assert.equal(declineCard?.suggestedCreatorName, "Abby Theriot");
  assert.equal(declineCard?.fromEmail, "authentickambiz@gmail.com");
});
});
