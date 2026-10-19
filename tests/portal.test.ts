import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { createDb, type PortalDb } from "../src/db/index";
import { adminNotifications, analyticsSnapshots, approvalEmails, brandCrmEntries, communityMembers, communityPhotos, communitySettings, contracts as contractTable, creatorAccounts, creatorNotifications, creatorProfiles, creatorRankHistory, creators, deals, emailCopies, emailCopyFiles, signatureFiles, draftSafetyFlags, gmailWatches, payments } from "../src/db/schema";
import { openDatabase } from "../src/db/local-d1";
import { approvalListAllowed, createApprovalEmail, listApprovalQueue, listBrandContacts, reviewApproval } from "../src/lib/approvals";
import { boldSignEnabled, sendContractWithBoldSign } from "../src/lib/boldsign";
import {
  listCommunity,
  listFilterHitKinds,
  moderateCommunity,
  openCommunityPhoto,
  photoLinkValid,
  postCommunityMessage,
  acceptCommunityGuidelines,
  PHOTOS_OFF,
  saveCommunityPhoto,
  setCommunityPhotoStoreForTests,
  setCommunityQueryTap,
  stripJpegMetadata,
} from "../src/lib/community";
import { communityFailure } from "../src/lib/community-http";
import { hideMyProfile, listPublicProfiles, moderateProfileField, saveMyProfile } from "../src/lib/profiles";
import { canApproveEmail, canChangeDealStage, resolveViewedCreator } from "../src/lib/authz";
import { addFeedback, authorizeBot, createApprovalDraft, listApprovedApprovals, markApprovalDraftSent, syncDeals, updateDeal, upsertCreator, upsertDeal, upsertPayment, writeDailyAnalytics } from "../src/lib/bot-api";
import { listCreatorInterest, listOfferScreenings, recordCreatorInterest, releaseOffer, logOfferScreening } from "../src/lib/creator-interest";
import { approveContract, listContracts, requestContractRevisions, saveChecklist, saveContract, setSigningFormat } from "../src/lib/contracts";
import { listDraftReviews, listUnreadCreatorNotices, onDraftSubmitted, reviewDraft } from "../src/lib/video-review";
import { deadlineFlag, uploadDueDate } from "../src/lib/deadlines";
import { askCreatorToConfirmRate, confirmAgreedRate, editDealReview, listDealReviews, publishDealReview, rejectDealReview, saveBrandReplyDraft } from "../src/lib/deal-review";
import { setDealStage } from "../src/lib/deal-stage";
import { sideStages, trackStages } from "../src/lib/stages";
import { agencyTimeZone, commissionLabel, creatorCutLabel, creatorPayoutTracker, feeAndPayout, nextPayoutLabel, pipelineHeadline, withBasePath } from "../src/lib/format";
import { accountMenuItems, billingUsage, billingWarning, creatorHomeCards, firstName, isMenuTab, listSupportMessages, readOwnAccount, saveOwnSettings, submitSupportMessage } from "../src/lib/creator-home";
import { requestClientIp } from "../src/lib/request-ip";
import { confirmLivePost, confirmProductReceived, listLivePostsSince, listPaymentsSince, listShipmentsSince, markPayment, saveShipment, submitLivePosts } from "../src/lib/fulfillment";
import {
  findCreatorById,
  getDealForViewer,
  insertDraft,
  markDraftProgress,
  listDealsForViewer,
  listDraftsSince,
  listDailyMetrics,
  listPostMetrics,
  resolveLogin,
  summarizeAnalytics,
} from "../src/lib/queries";
import {
  GMAIL_READONLY_SCOPE,
  GMAIL_SCOPES,
  createGmailOAuthState,
  createWatchCreatorCookie,
  createOAuthState,
  googleAuthUrl,
  googleGmailAuthUrl,
  googleGmailWatchAuthUrl,
  googleRedirectUri,
  readWatchCreatorCookie,
  verifyGmailOAuthState,
  verifyOAuthState,
} from "../src/lib/google-oauth";
import {
  CREATOR_READY_MESSAGE,
  dismissNotification,
  emailSetupFor,
  finishOnboarding,
  gmailConnectionState,
  hostedEmailRequestMessage,
  listFinishedOnboarding,
  listUnreadCreatorReady,
  listUnreadNotices,
  saveEmailSetup,
  saveGmailConnection,
} from "../src/lib/onboarding";
import { hostedEmailPreview, STRIPE_CATALOG } from "../src/lib/email-setup";
import { addManager, assignCreatorManagers, assignedCreatorIds, listManagerNotices, listManagers, needsYou, notifyStaff, setManagerActive, setManagerPermissions } from "../src/lib/managers";
import { advanceAfterSignature, countersignContract, listSignatures, setSignerIsMinor, signContract, uploadBrandSignedCopy } from "../src/lib/signing";
import { createSession, readSignedSessionId } from "../src/lib/session";
import { decryptToken } from "../src/lib/token-crypto";
import { assertCanUpload, parseContentRange, validateChunk } from "../src/lib/uploads";
import type { Viewer } from "../src/lib/types";
import { buildCalendarFeed, listCalendar, runDeliverableNudges, saveDeliverableDate, setCalendarConnected } from "../src/lib/calendar";
import { addBrandCrmEntry, listBrandCrm, upsertBrandCrmByDomain } from "../src/lib/brand-crm";
import { listUsageRights, saveUsageRights, suggestUsageRenewal, usageFlag } from "../src/lib/usage";
import { myMediaKit, publicMediaKit, saveMediaKit, zernioStatsEnabled } from "../src/lib/media-kit";
import { clearSafetyHold, listSafetyHolds, recordDraftSafety } from "../src/lib/safety";
import { findSafetyKinds } from "../src/lib/safety-shared";
import { buildMonthlyReport, draftMonthlyReport } from "../src/lib/report";
import { getReferralPerk, listReferrals, perkLabel, recordReferral, REFERRAL_LAWYER_NOTE, setReferralPerk } from "../src/lib/referrals";
import { dueHomeNotices, homeScreenOffer, inQuietHours, isIosHomeScreen, pushEnabled, queueHomeNotice } from "../src/lib/home-screen";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "../src/lib/niche-catalog";
import { MEDIA_KIT_CATALOG } from "../src/lib/platforms";
import { approveBenchOffer, benchPromotionSuggested, joinBench, listBench, promoteBench, publicBenchPortfolio, queueBenchOffer, recordBenchPaid, setBenchScore } from "../src/lib/bench";
import { matchOffer, needsQuestionnaire, questionnaireFor, saveQuestionnaireStep, type QuestionnaireAnswers } from "../src/lib/questionnaire";
import { tagChoices } from "../src/lib/tag-picker";
import { deliverableKind, prefillDealRules, presentScreening, quotedAskCents, rulesFor, saveDealRules, savePricingFloor, screenOffer, setCategoryOverride, creatorKnowledge, type DealRules } from "../src/lib/deal-rules";
import { createBrandOffer, listCreatorOffers, listOfferBoard, respondToOffer } from "../src/lib/brand-offers";
import {
  authorizeCron,
  decodePushMessage,
  ingestGmailPush,
  isSpamSender,
  listInboxEvents,
  parseSince,
  renewGmailWatches,
  verifyPubSubOidc,
  type GmailHistoryMessage,
} from "../src/lib/gmail-push";
import { listLiveDeals } from "../src/lib/live-deals";
import { allocateCampaign, addProspect, campaignById, canSeeCommission, convertProspect, listCampaigns, markOpenOutside, ownerDashboard, presentRoster, projectedCommission, queueOutsideOffer, rankRoster, rosterHasAFit, saveCampaign } from "../src/lib/campaigns";
import { analyticsBoard, importAnalyticsSnapshots, parseDisplayedCount, publicWeeklySnapshots, saveOwnerSnapshot, writeAnalyticsSnapshots } from "../src/lib/analytics-snapshots";
import { compositeScore, defaultWeights, emptyInputs, inputsFor, leaderboard, refreshRanks, saveRankInputs, saveRankSettings, scoringInputs, tierFor } from "../src/lib/creator-rank";
import { addCollab, collabLift, pairCollab, podById, savePod, suggestPods } from "../src/lib/pods";
import { createRankReport, reportPdf, sharedReport } from "../src/lib/rank-reports";
import { addReinvestment, reinvestmentSummary } from "../src/lib/reinvestment";
import {
  TRAINING_ITEMS,
  actWithCapability,
  createScopedBot,
  listCapabilityAudit,
  listCapabilityGrants,
  listPendingCapabilityDrafts,
  listScopedBots,
  clearBotReveal,
  managerCapabilityAct,
  readCreatorAccountSecrets,
  resolveBotCaller,
  reviewCapabilityDraft,
  revokeScopedBot,
  setCapabilityLevel,
  setTrainingChecks,
} from "../src/lib/capabilities";
import { hideAccountCredentials } from "../src/lib/current-user";

process.env.SESSION_SECRET = "test-secret-please-change";
process.env.BOT_API_TOKEN = "test-bot-token-please-change";
process.env.ADMIN_EMAILS = "Kamron@mommamari.com";
process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);

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
  if ("creatorPayoutCents" in payment.body) assert.equal(payment.body.creatorPayoutCents, 96000);
  const after = await getDealForViewer(db, mariclare, "vev");
  assert.equal(after?.payment?.creatorSplitPercent, 80);

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

test("gmail connect is separate from sign-in and onboarding notifies Kamron", async () => {
  const loginUrl = new URL(googleAuthUrl(await createOAuthState()));
  assert.equal(loginUrl.searchParams.get("scope"), "openid email profile");
  assert.equal(loginUrl.searchParams.get("redirect_uri"), googleRedirectUri());

  const gmailState = await createGmailOAuthState();
  assert.equal(await verifyGmailOAuthState(gmailState, gmailState), true);
  assert.equal(await verifyOAuthState(gmailState, gmailState), false);
  const gmailUrl = new URL(googleGmailAuthUrl(gmailState, mariclare.email));
  assert.equal(gmailUrl.searchParams.get("redirect_uri"), googleRedirectUri());
  assert.equal(gmailUrl.searchParams.get("include_granted_scopes"), "true");
  assert.equal(gmailUrl.searchParams.get("access_type"), "offline");
  assert.equal(gmailUrl.searchParams.get("prompt"), "consent");
  for (const scope of GMAIL_SCOPES) assert.match(gmailUrl.searchParams.get("scope") ?? "", new RegExp(scope.replaceAll(".", "\\.")));
  assert.doesNotMatch(gmailUrl.searchParams.get("scope") ?? "", /openid/);

  const before = await gmailConnectionState(db, "mariclare");
  assert.equal(before.connected, false);
  const unfinished = await finishOnboarding(db, "mariclare", {
    botName: "MariClare Bot",
    niche: "Mom life",
    contentStyle: "Warm talking-to-camera videos",
    rates: "$500 a TikTok",
    platforms: ["tiktok"],
  });
  assert.equal(unfinished.ok, false);

  const refreshToken = "1//secret-refresh-token-not-for-storage";
  const missingKey = process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY;
  const blocked = await saveGmailConnection(db, "mariclare", { refreshToken, gmailEmail: "mmaclamroc@gmail.com" });
  assert.equal(blocked.ok, false);
  process.env.TOKEN_ENCRYPTION_KEY = missingKey;

  const saved = await saveGmailConnection(db, "mariclare", { refreshToken, gmailEmail: "MMACLamroc@gmail.com" });
  assert.equal(saved.ok, true);
  const chosen = await saveEmailSetup(db, "mariclare", "personal");
  assert.equal(chosen.ok, true);
  if (chosen.ok) assert.equal(chosen.notified, false);
  const stored = await gmailConnectionState(db, "mariclare");
  assert.equal(stored.connected, true);
  assert.equal(stored.gmailEmail, "mmaclamroc@gmail.com");
  assert.ok(stored.cipher);
  assert.equal(stored.cipher?.includes(refreshToken), false);
  assert.equal(await decryptToken(stored.cipher ?? ""), refreshToken);

  const incomplete = await finishOnboarding(db, "mariclare", { botName: "MariClare Bot", platforms: ["tiktok"] });
  assert.equal(incomplete.ok, false);
  const done = await finishOnboarding(db, "mariclare", {
    botName: "MariClare Bot",
    niche: "Mom life",
    contentStyle: "Warm talking-to-camera videos",
    rates: "$500 a TikTok",
    favoriteBrands: "VEV",
    kidsAges: "6 and 8",
    platforms: ["tiktok", "instagram", "nope"],
  });
  assert.equal(done.ok, true);
  if (done.ok) assert.equal(done.notified, true);
  const firstProfile = (await listFinishedOnboarding(db, null)).find((profile) => profile.creatorId === "mariclare");
  assert.equal(firstProfile?.botName, "MariClare Bot");
  assert.equal(firstProfile?.kidsAges, "6 and 8");
  assert.equal(firstProfile?.emailSetup, "personal");
  assert.equal(firstProfile?.hostedEmailAddress, null);
  assert.equal(firstProfile?.hostedEmailAddOn, null);
  assert.deepEqual(firstProfile?.platforms, ["tiktok", "instagram"]);
  const again = await finishOnboarding(db, "mariclare", {
    botName: "MariClare Bot",
    niche: "Mom life",
    contentStyle: "Warm talking-to-camera videos",
    rates: "$600 a TikTok",
    platforms: ["tiktok"],
  });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.notified, false);

  const notices = await listUnreadCreatorReady(db);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.message, CREATOR_READY_MESSAGE);
  assert.equal(notices[0]?.message, "New creator ready for bot");
  assert.equal(notices[0]?.creatorName, "MariClare");

  const profiles = await listFinishedOnboarding(db, null);
  const hers = profiles.find((profile) => profile.creatorId === "mariclare");
  assert.equal(hers?.rates, "$600 a TikTok");
  assert.equal(hers?.kidsAges, "6 and 8");
  assert.deepEqual(hers?.platforms, ["tiktok"]);
  assert.equal(hers?.gmailConnected, true);
  const packed = JSON.stringify(profiles);
  assert.equal(packed.includes(refreshToken), false);
  assert.equal(packed.includes(stored.cipher ?? "missing-cipher"), false);
  const future = await listFinishedOnboarding(db, "2999-01-01T00:00:00.000Z");
  assert.equal(future.length, 0);

  const mari = await findCreatorById(db, "mariclare");
  assert.equal(mari?.name, "MariClare");
  assert.equal(mari?.kidsAges, "6 and 8");

  assert.equal((await dismissNotification(db, notices[0]?.id ?? "")).ok, true);
  assert.equal((await listUnreadCreatorReady(db)).length, 0);
});

test("hosted creator email uses roster and public prices on @mommamari.com", async () => {
  assert.equal(hostedEmailPreview("Abby"), "abby@mommamari.com");
  assert.equal(hostedEmailPreview("Deals@AbbyBrand.com"), "deals@mommamari.com");
  assert.equal(hostedEmailPreview("abby theriot"), "abby.theriot@mommamari.com");
  assert.equal(hostedEmailPreview("@@@"), null);
  const missing = await saveEmailSetup(db, "abby", "hosted", "@@@");
  assert.equal(missing.ok, false);
  const blocked = await finishOnboarding(db, "abby", {
    botName: "Abby Bot",
    niche: "Family",
    contentStyle: "Day in the life",
    rates: "$400 a TikTok",
    platforms: ["tiktok"],
  });
  assert.equal(blocked.ok, false);

  const requested = await saveEmailSetup(db, "abby", "hosted", "Deals@AbbyBrand.com");
  assert.equal(requested.ok, true);
  if (requested.ok) {
    assert.equal(requested.notified, true);
    assert.equal(requested.hostedEmailAddress, "deals@mommamari.com");
  }
  const again = await saveEmailSetup(db, "abby", "hosted", "deals");
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.notified, false);

  const setup = await emailSetupFor(db, "abby");
  assert.equal(setup.choice, "hosted");
  assert.equal(setup.hostedEmailAddress, "deals@mommamari.com");
  const message = hostedEmailRequestMessage("deals@mommamari.com");
  assert.equal(message, "Hosted email requested: deals@mommamari.com. Paid add-on: hosted creator email. Roster: $79 one-time setup + $15/month. Public: $99 one-time setup + $19/month. Not charged yet.");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.name, "hosted creator email");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.roster.priceLabel, "$79 one-time setup + $15/month");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.public.priceLabel, "$99 one-time setup + $19/month");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.charged, false);

  const notices = await listUnreadNotices(db);
  const hers = notices.filter((note) => note.creatorId === "abby" && note.kind === "hosted_email");
  assert.equal(hers.length, 1);
  assert.equal(hers[0]?.message, message);
  assert.equal(hers[0]?.creatorName, "Abby Theriot");

  const done = await finishOnboarding(db, "abby", {
    botName: "Abby Bot",
    niche: "Family",
    contentStyle: "Day in the life",
    rates: "$400 a TikTok",
    platforms: ["instagram"],
  });
  assert.equal(done.ok, true);
  const profile = (await listFinishedOnboarding(db, null)).find((row) => row.creatorId === "abby");
  assert.equal(profile?.emailSetup, "hosted");
  assert.equal(profile?.hostedEmailAddress, "deals@mommamari.com");
  assert.equal(profile?.gmailConnected, false);
  assert.equal(profile?.hostedEmailAddOn?.charged, false);
  assert.equal(profile?.hostedEmailAddOn?.priceLabel, "$79 one-time setup + $15/month");
  assert.equal(profile?.hostedEmailAddOn?.publicPriceLabel, "$99 one-time setup + $19/month");
  assert.equal(JSON.stringify(profile).includes("placeholder"), false);
  assert.equal(JSON.stringify(profile).includes("v1:"), false);

  const changed = await saveEmailSetup(db, "abby", "hosted", "brands");
  assert.equal(changed.ok, true);
  if (changed.ok) assert.equal(changed.notified, false);
  const updated = (await listUnreadNotices(db)).filter((note) => note.creatorId === "abby" && note.kind === "hosted_email");
  assert.equal(updated.length, 1);
  assert.match(updated[0]?.message ?? "", /brands@mommamari.com/);
  assert.match(updated[0]?.message ?? "", /\$79 one-time setup \+ \$15\/month/);
  assert.match(updated[0]?.message ?? "", /Not charged yet/);
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

test("a creator can accept or pass a screened offer, and KOSBLING stays put", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingBefore?.workflowStage, "draft_due");
  assert.equal(kosblingBefore?.visibleToCreator, true);
  assert.equal(kosblingBefore?.contact, null);

  const created = await upsertDeal(db, {
    id: "phase3-offer",
    brand: "Glow Co",
    creatorId: "mariclare",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: false,
    amountDisplay: "$800",
    rateLabel: "$800",
    deliverables: ["1 TikTok"],
    usageRights: "Organic only",
  });
  assert.equal(created.status, 201);

  assert.equal(await getDealForViewer(db, mariclare, "phase3-offer"), null);
  const tooSoon = await recordCreatorInterest(db, {
    dealId: "phase3-offer",
    creatorId: mariclare.creatorId!,
    creatorEmail: mariclare.email,
    creatorName: mariclare.name,
    decision: "interested",
    note: "I'd want $500",
  });
  assert.equal(tooSoon.ok, false);
  if (!tooSoon.ok) assert.equal(tooSoon.status, 403);

  const blocked = await releaseOffer(db, {
    dealId: "kosbling",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@kosbling.example",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 409);
  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.contact, null);
  assert.equal((await listOfferScreenings(db, "kosbling")).length, 0);

  const noEmail = await releaseOffer(db, {
    dealId: "phase3-offer",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(noEmail.ok, false);
  if (!noEmail.ok) assert.equal(noEmail.status, 400);

  const released = await releaseOffer(db, {
    dealId: "phase3-offer",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@glow.example",
    note: "Rate looks fine.",
  });
  assert.equal(released.ok, true);
  const again = await releaseOffer(db, {
    dealId: "phase3-offer",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@glow.example",
  });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.changed, false);
  const screenings = await listOfferScreenings(db, "phase3-offer");
  assert.equal(screenings.length, 1);
  assert.equal(screenings[0]?.decision, "released");
  assert.equal(screenings[0]?.brandEmail, "hello@glow.example");

  const shown = await getDealForViewer(db, mariclare, "phase3-offer");
  assert.equal(shown?.workflowStage, "offer_shared");
  assert.equal(shown?.visibleToCreator, true);
  assert.equal(shown?.canRespondToOffer, true);
  const adminView = await getDealForViewer(db, admin, "phase3-offer");
  assert.equal(adminView?.offerReleased, true);
  assert.equal(adminView?.canReleaseOffer, false);
  assert.equal(adminView?.canRespondToOffer, false);
  assert.equal(adminView?.stageEvents?.some((event) => event.toStage === "offer_shared" && event.note === "Rate looks fine."), true);

  const other = await recordCreatorInterest(db, {
    dealId: "phase3-offer",
    creatorId: "abby",
    creatorEmail: abby.email,
    creatorName: "Abby Theriot",
    decision: "interested",
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.status, 403);
  const steal = await setDealStage(db, {
    dealId: "phase3-offer",
    toStage: "creator_interested",
    actorEmail: abby.email,
    actorRole: "creator",
    creatorId: "abby",
  });
  assert.equal(steal.ok, false);
  if (!steal.ok) assert.equal(steal.status, 403);

  const videoDraft = await createApprovalEmail(db, {
    dealId: "phase3-offer",
    gate: "video",
    to: "hello@glow.example",
    subject: "Video",
    body: "Here is the video.",
  }, { email: mariclare.email, role: "creator" });
  assert.equal(videoDraft.ok, false);

  const interested = await recordCreatorInterest(db, {
    dealId: "phase3-offer",
    creatorId: mariclare.creatorId!,
    creatorEmail: mariclare.email,
    creatorName: "MariClare",
    decision: "interested",
    note: "I'd want $500, or I can't post until November",
  });
  assert.equal(interested.ok, true);
  const after = await getDealForViewer(db, admin, "phase3-offer");
  assert.equal(after?.workflowStage, "creator_interested");
  assert.equal(after?.interest?.decision, "interested");
  assert.equal(after?.interest?.note, "I'd want $500, or I can't post until November");
  const history = after?.stageEvents?.find((event) => event.toStage === "creator_interested");
  assert.equal(history?.actorRole, "creator");
  assert.equal(history?.actorEmail, mariclare.email);
  assert.equal(history?.note, "I'd want $500, or I can't post until November");
  const creatorAfter = await getDealForViewer(db, mariclare, "phase3-offer");
  assert.equal(creatorAfter?.canRespondToOffer, false);
  assert.equal(creatorAfter?.interest?.decision, "interested");
  assert.equal(creatorAfter?.stageEvents, null);

  const notices = await listUnreadNotices(db);
  assert.equal(notices.some((notice) => notice.kind === "creator_interest" && notice.message.includes("MariClare is interested in Glow Co.") && notice.message.includes("I'd want $500")), true);

  const queue = await listApprovalQueue(db, "all");
  const draft = queue.find((row) => row.dealId === "phase3-offer" && row.gate === "interest");
  assert.equal(draft?.status, "pending");
  assert.equal(draft?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(draft?.toEmail, "hello@glow.example");
  assert.match(draft?.body ?? "", /I'd want \$500, or I can't post until November/);
  assert.equal(draft?.events[0]?.actorRole, "creator");
  const waiting = await listApprovedApprovals(db);
  assert.equal(waiting.body.approvals.some((row) => row.id === draft?.id), false);

  const listed = await listCreatorInterest(db, null);
  const row = listed.find((item) => item.dealId === "phase3-offer");
  assert.equal(row?.decision, "interested");
  assert.equal(row?.creatorName, "MariClare");
  assert.equal(row?.workflowStage, "creator_interested");
  assert.equal(JSON.stringify(listed).includes("gmailRefreshToken"), false);
  assert.equal(JSON.stringify(listed).includes("refresh_token"), false);
  const later = await listCreatorInterest(db, "2999-01-01T00:00:00.000Z");
  assert.equal(later.some((item) => item.dealId === "phase3-offer"), false);

  const twice = await recordCreatorInterest(db, {
    dealId: "phase3-offer",
    creatorId: mariclare.creatorId!,
    creatorEmail: mariclare.email,
    creatorName: "MariClare",
    decision: "declined",
  });
  assert.equal(twice.ok, false);
  if (!twice.ok) assert.equal(twice.status, 409);

  const passed = await upsertDeal(db, {
    id: "phase3-pass",
    brand: "Nimbus",
    creatorId: "mariclare",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: false,
    contact: "Nimbus Team <hello@nimbus.example>",
  });
  assert.equal(passed.status, 201);
  const releasedPass = await releaseOffer(db, {
    dealId: "phase3-pass",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@nimbus.example",
  });
  assert.equal(releasedPass.ok, true);
  const beforeContacts = await listBrandContacts(db);
  const beforePass = await getDealForViewer(db, admin, "phase3-pass");
  const declined = await recordCreatorInterest(db, {
    dealId: "phase3-pass",
    creatorId: mariclare.creatorId!,
    creatorEmail: mariclare.email,
    creatorName: "MariClare",
    decision: "declined",
    note: "The dates don't work for me",
  });
  assert.equal(declined.ok, false);
  if (!declined.ok) assert.equal(declined.status, 403);
  const passAdmin = await getDealForViewer(db, admin, "phase3-pass");
  assert.equal(passAdmin?.workflowStage, "offer_shared");
  assert.equal(passAdmin?.visibleToCreator, true);
  assert.equal(passAdmin?.interest, null);
  assert.equal(passAdmin?.stageEvents?.length, beforePass?.stageEvents?.length);
  assert.equal((await getDealForViewer(db, mariclare, "phase3-pass"))?.workflowStage, "offer_shared");
  assert.equal((await listApprovalQueue(db, "all")).some((item) => item.dealId === "phase3-pass" && item.gate === "decline"), false);
  assert.equal((await listBrandContacts(db)).length, beforeContacts.length);

  const sneak = await setDealStage(db, {
    dealId: "phase3-offer",
    toStage: "paid",
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: mariclare.creatorId,
  });
  assert.equal(sneak.ok, false);
  if (!sneak.ok) assert.equal(sneak.status, 403);

  const kosblingEnd = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingEnd?.workflowStage, "draft_due");
  assert.equal(kosblingEnd?.visibleToCreator, true);
  assert.equal(kosblingEnd?.brand, "KOSBLING");
});

test("a manager can send a video back or queue it for the brand, and KOSBLING stays put", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const waterhBefore = await getDealForViewer(db, admin, "waterh");
  const untouched = await onDraftSubmitted(db, "kosbling", { email: mariclare.email });
  assert.equal(untouched.ok, true);
  if (untouched.ok) assert.equal(untouched.changed, false);
  assert.equal((await getDealForViewer(db, admin, "kosbling"))?.workflowStage, kosblingBefore?.workflowStage);
  assert.equal((await getDealForViewer(db, admin, "kosbling"))?.visibleToCreator, true);

  const seedReview = await reviewDraft(db, {
    draftId: "draft-waterh-v1",
    decision: "approved",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@waterh.example",
  });
  assert.equal(seedReview.ok, false);
  assert.equal((await getDealForViewer(db, admin, "waterh"))?.workflowStage, waterhBefore?.workflowStage);

  const created = await upsertDeal(db, {
    id: "phase4-video",
    brand: "Lumen Co",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "draft_due",
    visibleToCreator: true,
    uploadEnabled: true,
    contact: "hello@lumen.example",
    amountDisplay: "$650",
  });
  assert.equal(created.status, 201);

  await insertDraft(db, {
    id: "phase4-v1",
    dealId: "phase4-video",
    version: 1,
    filename: "v1-morning.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1000,
    uploadSessionUrl: "demo://local",
    driveFolderId: null,
    gmailThreadId: null,
    status: "uploading",
  });
  await markDraftProgress(db, "phase4-v1", {
    bytesReceived: 1000,
    status: "new",
    driveFileId: "drive-v1",
    driveFileUrl: "https://drive.google.com/file/d/phase4-v1",
  });
  const submitted = await onDraftSubmitted(db, "phase4-video", { email: mariclare.email });
  assert.equal(submitted.ok, true);
  assert.equal((await getDealForViewer(db, admin, "phase4-video"))?.workflowStage, "draft_submitted");

  const creatorTry = await reviewDraft(db, {
    draftId: "phase4-v1",
    decision: "approved",
    actorEmail: mariclare.email,
    actorRole: "creator",
    brandEmail: "hello@lumen.example",
  });
  assert.equal(creatorTry.ok, false);
  if (!creatorTry.ok) assert.equal(creatorTry.status, 403);
  const otherTry = await reviewDraft(db, {
    draftId: "phase4-v1",
    decision: "changes",
    note: "Open on the bottle.",
    actorEmail: abby.email,
    actorRole: "creator",
  });
  assert.equal(otherTry.ok, false);

  const noNote = await reviewDraft(db, {
    draftId: "phase4-v1",
    decision: "changes",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(noNote.ok, false);
  if (!noNote.ok) assert.equal(noNote.status, 400);

  const changes = await reviewDraft(db, {
    draftId: "phase4-v1",
    decision: "changes",
    note: "Open on the bottle in the first three seconds.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(changes.ok, true);
  const afterChanges = await getDealForViewer(db, admin, "phase4-video");
  assert.equal(afterChanges?.workflowStage, "draft_due");
  assert.equal(afterChanges?.uploadEnabled, true);
  assert.equal(afterChanges?.drafts.length, 1);
  assert.equal(afterChanges?.drafts[0]?.status, "revisions");
  assert.equal(afterChanges?.drafts[0]?.review?.decision, "changes");
  assert.equal(afterChanges?.drafts[0]?.review?.note, "Open on the bottle in the first three seconds.");
  const history = afterChanges?.stageEvents?.find((event) => event.toStage === "draft_due" && event.actorRole === "admin");
  assert.equal(history?.note, "Open on the bottle in the first three seconds.");
  assert.equal(history?.actorEmail, admin.email);
  const creatorView = await getDealForViewer(db, mariclare, "phase4-video");
  assert.equal(creatorView?.drafts[0]?.review?.note, "Open on the bottle in the first three seconds.");
  assert.equal(creatorView?.stageEvents, null);
  const notices = await listUnreadCreatorNotices(db, "mariclare");
  assert.equal(notices.some((notice) => notice.kind === "video_changes" && notice.message.includes("Open on the bottle")), true);
  assert.equal((await listApprovalQueue(db, "all")).some((row) => row.dealId === "phase4-video" && row.gate === "video"), false);

  await insertDraft(db, {
    id: "phase4-v2",
    dealId: "phase4-video",
    version: 2,
    filename: "v2-morning.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1200,
    uploadSessionUrl: "demo://local",
    driveFolderId: null,
    gmailThreadId: null,
    status: "uploading",
  });
  await markDraftProgress(db, "phase4-v2", {
    bytesReceived: 1200,
    status: "new",
    driveFileId: "drive-v2",
    driveFileUrl: "https://drive.google.com/file/d/phase4-v2",
  });
  const resubmitted = await onDraftSubmitted(db, "phase4-video", { email: mariclare.email });
  assert.equal(resubmitted.ok, true);
  const both = await getDealForViewer(db, admin, "phase4-video");
  assert.equal(both?.workflowStage, "draft_submitted");
  assert.deepEqual(both?.drafts.map((draft) => draft.version), [1, 2]);
  assert.equal(both?.drafts[0]?.status, "revisions");
  assert.equal(both?.drafts[1]?.status, "new");

  const approved = await reviewDraft(db, {
    draftId: "phase4-v2",
    decision: "approved",
    note: "Good to send.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(approved.ok, true);
  if (approved.ok) assert.ok(approved.approvalId);
  const afterApprove = await getDealForViewer(db, admin, "phase4-video");
  assert.equal(afterApprove?.workflowStage, "manager_review");
  assert.equal(afterApprove?.uploadEnabled, false);
  assert.equal(afterApprove?.drafts[1]?.status, "email_awaiting_ok");
  assert.equal(afterApprove?.drafts[1]?.review?.decision, "approved");
  assert.equal(afterApprove?.drafts[0]?.version, 1);
  const videoEmail = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase4-video" && row.gate === "video");
  assert.equal(videoEmail?.status, "pending");
  assert.equal(videoEmail?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(videoEmail?.toEmail, "hello@lumen.example");
  assert.match(videoEmail?.body ?? "", /https:\/\/drive\.google\.com\/file\/d\/phase4-v2/);
  assert.equal((videoEmail?.body ?? "").includes("Open on the bottle"), false);
  assert.equal((videoEmail?.body ?? "").includes("Good to send"), false);
  const waiting = await listApprovedApprovals(db);
  assert.equal(waiting.body.approvals.some((row) => row.id === videoEmail?.id), false);
  const approvedNotices = await listUnreadCreatorNotices(db, "mariclare");
  assert.equal(approvedNotices.some((notice) => notice.kind === "video_approved" && notice.message.includes("v2")), true);

  const twice = await reviewDraft(db, {
    draftId: "phase4-v2",
    decision: "changes",
    note: "One more tweak.",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(twice.ok, false);
  if (!twice.ok) assert.equal(twice.status, 409);

  const listed = await listDraftReviews(db, null);
  assert.equal(listed.filter((row) => row.dealId === "phase4-video").length, 2);
  assert.equal(JSON.stringify(listed).includes("gmailRefreshToken"), false);
  assert.equal(JSON.stringify(listed).includes("refresh_token"), false);
  const later = await listDraftReviews(db, "2999-01-01T00:00:00.000Z");
  assert.equal(later.some((row) => row.dealId === "phase4-video"), false);

  const adminInterest = await createApprovalEmail(db, {
    dealId: "phase4-video",
    gate: "interest",
    to: "hello@lumen.example",
    subject: "Interested",
    body: "She is interested.",
  }, { email: admin.email, role: "admin" });
  assert.equal(adminInterest.ok, false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
});

test("an admin keeps every contract version, and the creator only sees the approved file", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const pdf = new TextEncoder().encode("%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  const blocked = await saveContract(db, {
    dealId: "kosbling",
    filename: "kosbling.pdf",
    mimeType: "application/pdf",
    bytes: pdf,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 409);
  const kosblingMid = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingMid?.workflowStage, "draft_due");
  assert.equal(kosblingMid?.visibleToCreator, true);
  assert.equal(kosblingMid?.contact, null);
  assert.equal(kosblingMid?.drafts.length, kosblingBefore?.drafts.length);
  assert.equal(kosblingMid?.contracts.length, 0);

  const created = await upsertDeal(db, {
    id: "phase5-contract",
    brand: "Northwind",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$800",
  });
  assert.equal(created.status, 201);
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.contact, null);

  const badFile = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "notes.txt",
    mimeType: "text/plain",
    bytes: new TextEncoder().encode("hello"),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(badFile.ok, false);

  const creatorUpload = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "v1.pdf",
    mimeType: "application/pdf",
    bytes: pdf,
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorUpload.ok, false);
  if (!creatorUpload.ok) assert.equal(creatorUpload.status, 403);

  const v1 = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "northwind-v1.pdf",
    mimeType: "application/pdf",
    bytes: pdf,
    countersign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(v1.ok, true);
  if (!v1.ok) return;
  assert.equal(v1.version, 1);
  assert.equal(v1.signingFormat, "pdf");
  assert.match(v1.sha256 ?? "", /^[a-f0-9]{64}$/);
  const afterV1 = await getDealForViewer(db, admin, "phase5-contract");
  assert.equal(afterV1?.workflowStage, "contract_received");
  assert.equal(afterV1?.visibleToCreator, true);
  assert.equal(afterV1?.contracts.length, 1);
  assert.equal(afterV1?.contracts[0]?.checks?.length, 10);
  assert.equal(afterV1?.contracts[0]?.countersign, true);
  assert.equal(afterV1?.stageEvents?.some((event) => event.toStage === "contract_received" && event.actorRole === "admin"), true);
  const creatorHidden = await getDealForViewer(db, mariclare, "phase5-contract");
  assert.equal(creatorHidden?.contracts.length, 0);
  assert.equal(JSON.stringify(creatorHidden).includes("northwind-v1.pdf"), false);

  const noIssue = await requestContractRevisions(db, {
    contractId: v1.id,
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@northwind.example",
  });
  assert.equal(noIssue.ok, false);
  if (!noIssue.ok) assert.equal(noIssue.status, 400);
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.workflowStage, "contract_received");

  const checklist = await saveChecklist(db, {
    contractId: v1.id,
    actorEmail: admin.email,
    actorRole: "admin",
    checks: [
      { item: "payment_terms", status: "issue", note: "Net 60 is too long." },
      { item: "usage_rights", status: "ok", note: "Lifetime usage is fine." },
      { item: "exclusivity", status: "unchecked", note: "skip this private note" },
    ],
  });
  assert.equal(checklist.ok, true);
  const reviewed = await getDealForViewer(db, admin, "phase5-contract");
  assert.equal(reviewed?.workflowStage, "contract_review");
  assert.equal(reviewed?.revisions.some((row) => row.summary === "We're reviewing the contract."), true);
  assert.equal(reviewed?.revisions.some((row) => (row.summary ?? "").includes("Net 60")), false);
  const creatorReview = await getDealForViewer(db, mariclare, "phase5-contract");
  assert.equal(creatorReview?.contracts.length, 0);
  assert.equal(JSON.stringify(creatorReview).includes("Net 60"), false);
  assert.equal(JSON.stringify(creatorReview).includes("Lifetime usage"), false);

  const missingEmail = await requestContractRevisions(db, {
    contractId: v1.id,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(missingEmail.ok, false);
  if (!missingEmail.ok) assert.equal(missingEmail.status, 400);
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.workflowStage, "contract_review");
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.contact, null);

  const asked = await requestContractRevisions(db, {
    contractId: v1.id,
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@northwind.example",
    changes: "Please send a PDF.",
  });
  assert.equal(asked.ok, true);
  const afterAsk = await getDealForViewer(db, admin, "phase5-contract");
  assert.equal(afterAsk?.workflowStage, "revisions_requested");
  assert.equal(afterAsk?.contact, "hello@northwind.example");
  assert.equal(afterAsk?.contracts[0]?.status, "revisions_requested");
  assert.equal(afterAsk?.stageEvents?.some((event) => event.toStage === "revisions_requested" && event.actorRole === "admin"), true);
  const revisionEmail = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase5-contract" && row.gate === "revision");
  assert.equal(revisionEmail?.status, "pending");
  assert.equal(revisionEmail?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(revisionEmail?.toEmail, "hello@northwind.example");
  assert.match(revisionEmail?.body ?? "", /Payment terms: Net 60 is too long/);
  assert.match(revisionEmail?.body ?? "", /Please send a PDF/);
  assert.equal((revisionEmail?.body ?? "").includes("Lifetime usage"), false);
  assert.equal((revisionEmail?.body ?? "").includes("skip this private note"), false);
  const waiting = await listApprovedApprovals(db);
  assert.equal(waiting.body.approvals.some((row) => row.id === revisionEmail?.id), false);

  const docx = new TextEncoder().encode("PK\u0003\u0004fake-docx");
  const v2 = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "northwind-v2.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: docx,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(v2.ok, true);
  if (!v2.ok) return;
  assert.equal(v2.version, 2);
  assert.equal(v2.signingFormat, "needs_review");
  const both = await getDealForViewer(db, admin, "phase5-contract");
  assert.equal(both?.workflowStage, "revised_contract");
  assert.deepEqual(both?.contracts.map((row) => row.version), [1, 2]);
  assert.equal(both?.contracts[0]?.filename, "northwind-v1.pdf");
  assert.equal(both?.contracts[1]?.signingLabel, "needs review before signing");

  const creatorApprove = await approveContract(db, {
    contractId: v2.id,
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorApprove.ok, false);
  if (!creatorApprove.ok) {
    assert.equal(creatorApprove.status, 403);
    assert.equal(creatorApprove.error, "You can't approve this contract.");
  }
  const tooSoon = await approveContract(db, {
    contractId: v2.id,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(tooSoon.ok, false);
  if (!tooSoon.ok) {
    assert.equal(tooSoon.status, 400);
    assert.equal(tooSoon.error, "This file needs review before signing. Upload a PDF or mark it as DocuSign.");
  }
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.workflowStage, "revised_contract");

  const marked = await setSigningFormat(db, { contractId: v2.id, signingFormat: "pdf", actorRole: "admin" });
  assert.equal(marked.ok, true);
  const approved = await approveContract(db, {
    contractId: v2.id,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(approved.ok, true);
  const afterApprove = await getDealForViewer(db, admin, "phase5-contract");
  assert.equal(afterApprove?.workflowStage, "approved_by_agency");
  assert.equal(afterApprove?.stageEvents?.some((event) => event.toStage === "approved_by_agency" && event.actorRole === "admin"), true);
  const creatorApproved = await getDealForViewer(db, mariclare, "phase5-contract");
  assert.equal(creatorApproved?.contracts.length, 1);
  assert.equal(creatorApproved?.contracts[0]?.filename, "northwind-v2.docx");
  assert.equal(creatorApproved?.contracts[0]?.checks, null);
  assert.equal(creatorApproved?.contracts[0]?.signingLabel, "PDF, ready for signing later");
  assert.equal(JSON.stringify(creatorApproved).includes("Net 60"), false);
  assert.equal(JSON.stringify(creatorApproved).includes("Lifetime usage"), false);
  const notices = await listUnreadCreatorNotices(db, "mariclare");
  assert.equal(
    notices.some((notice) => notice.kind === "contract_approved" && notice.message.includes("Northwind") && notice.message.includes("ready for you to sign")),
    true,
  );

  const v3 = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "northwind-v3.pdf",
    mimeType: "application/pdf",
    bytes: pdf,
    docusign: true,
    countersign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(v3.ok, true);
  if (!v3.ok) return;
  assert.equal(v3.version, 3);
  assert.equal(v3.signingFormat, "docusign");
  assert.equal((await getDealForViewer(db, admin, "phase5-contract"))?.workflowStage, "revised_contract");
  const beforeV3 = await getDealForViewer(db, mariclare, "phase5-contract");
  assert.deepEqual(beforeV3?.contracts.map((row) => row.version), [2]);
  const signedOff = await approveContract(db, {
    contractId: v3.id,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(signedOff.ok, true);
  const creatorFinal = await getDealForViewer(db, mariclare, "phase5-contract");
  assert.deepEqual(creatorFinal?.contracts.map((row) => row.version), [2, 3]);
  assert.equal(creatorFinal?.contracts[1]?.countersign, true);
  assert.equal(creatorFinal?.contracts[1]?.signingLabel, "DocuSign, ready for signing later");
  assert.equal(creatorFinal?.contracts.every((row) => row.checks === null), true);

  const botCopy = await saveContract(db, {
    dealId: "phase5-contract",
    filename: "from-email.pdf",
    mimeType: "application/pdf",
    sha256: "ab".repeat(32),
    driveFileUrl: "https://drive.google.com/file/d/bot-contract/view",
    driveFileId: "bot-contract",
    actorEmail: "bot",
    actorRole: "bot",
  });
  assert.equal(botCopy.ok, true);
  if (botCopy.ok) {
    assert.equal(botCopy.version, 4);
    assert.equal(botCopy.sha256, "ab".repeat(32));
  }

  const listed = await listContracts(db, null);
  const mine = listed.filter((row) => row.dealId === "phase5-contract");
  assert.equal(mine.length, 4);
  assert.equal(mine[0]?.checklist.length, 10);
  assert.equal(mine.some((row) => row.checklist.some((item) => item.item === "payment_terms" && item.note === "Net 60 is too long.")), true);
  assert.equal(JSON.stringify(listed).includes("gmailRefreshToken"), false);
  assert.equal(JSON.stringify(listed).includes("refresh_token"), false);
  const later = await listContracts(db, "2999-01-01T00:00:00.000Z");
  assert.equal(later.some((row) => row.dealId === "phase5-contract"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  assert.equal(kosblingAfter?.contracts.length, 0);
});

test("a creator signs her own approved PDF once, and a new version voids the request", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingSignaturesBefore = (await listSignatures(db, null)).filter((row) => row.dealId === "kosbling");

  async function onePagePdf() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([420, 560]);
    page.drawText("Momma Mari contract", { x: 50, y: 500, size: 16 });
    return new Uint8Array(await doc.save());
  }
  function sha256(bytes: Uint8Array) {
    return createHash("sha256").update(bytes).digest("hex");
  }
  const signAs = {
    actorRole: "creator" as const,
    creatorId: "mariclare",
    legalName: "Mari Clare Maclamroc",
    signatureKind: "typed",
    consentEsign: true,
    consentRead: true,
    guardianConfirm: false,
    ip: "203.0.113.8",
    userAgent: "PortalTest/6",
  };

  await db.insert(contractTable).values({
    id: "kosbling-sign-probe",
    dealId: "kosbling",
    version: 1,
    filename: "probe.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
    sha256: null,
    driveFileId: null,
    driveFileUrl: null,
    driveFolderId: null,
    source: "upload",
    signingFormat: "pdf",
    countersign: false,
    status: "approved",
    uploadedBy: "test",
    approvalId: null,
    createdAt: "2026-10-18T00:00:00.000Z",
  });
  const kosblingSign = await signContract(db, {
    ...signAs,
    contractId: "kosbling-sign-probe",
    actorEmail: mariclare.email,
  });
  assert.equal(kosblingSign.ok, false);
  if (!kosblingSign.ok) {
    assert.equal(kosblingSign.status, 409);
    assert.equal(kosblingSign.error, "This deal is already past signing. Nothing was changed.");
  }
  const kosblingUpload = await uploadBrandSignedCopy(db, {
    contractId: "kosbling-sign-probe",
    actorEmail: admin.email,
    actorRole: "admin",
    filename: "probe-signed.pdf",
    bytes: await onePagePdf(),
    ip: "203.0.113.8",
    userAgent: "PortalTest/6",
  });
  assert.equal(kosblingUpload.ok, false);
  if (!kosblingUpload.ok) assert.equal(kosblingUpload.status, 409);
  assert.equal((await listSignatures(db, null)).filter((row) => row.dealId === "kosbling").length, kosblingSignaturesBefore.length);
  await db.delete(contractTable).where(eq(contractTable.id, "kosbling-sign-probe"));

  const pdf = await onePagePdf();
  const created = await upsertDeal(db, {
    id: "phase6-sign",
    brand: "Phase6 Sign",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6sign.example",
  });
  assert.equal(created.status, 201);
  const saved = await saveContract(db, {
    dealId: "phase6-sign",
    filename: "phase6.pdf",
    mimeType: "application/pdf",
    bytes: pdf,
    docusign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const tooSoon = await signContract(db, { ...signAs, contractId: saved.id, actorEmail: mariclare.email });
  assert.equal(tooSoon.ok, false);
  if (!tooSoon.ok) {
    assert.equal(tooSoon.status, 409);
    assert.equal(tooSoon.error, "This deal isn't ready to sign. Nothing was changed.");
  }
  const approved = await approveContract(db, { contractId: saved.id, actorEmail: admin.email, actorRole: "admin" });
  assert.equal(approved.ok, true);
  const ready = await getDealForViewer(db, admin, "phase6-sign");
  assert.equal(ready?.workflowStage, "approved_by_agency");
  assert.equal(ready?.signatures.some((row) => row.contractId === saved.id && row.status === "requested"), true);

  const marked = await setSigningFormat(db, { contractId: saved.id, signingFormat: "needs_review", actorRole: "admin" });
  assert.equal(marked.ok, true);
  const blockedFormat = await signContract(db, { ...signAs, contractId: saved.id, actorEmail: mariclare.email });
  assert.equal(blockedFormat.ok, false);
  if (!blockedFormat.ok) assert.equal(blockedFormat.status, 400);
  await setSigningFormat(db, { contractId: saved.id, signingFormat: "docusign", actorRole: "admin" });

  const otherCreator = await signContract(db, {
    ...signAs,
    contractId: saved.id,
    actorEmail: abby.email,
    creatorId: "abby",
  });
  assert.equal(otherCreator.ok, false);
  if (!otherCreator.ok) {
    assert.equal(otherCreator.status, 403);
    assert.equal(otherCreator.error, "You can only sign your own contract.");
  }
  const missingBoxes = await signContract(db, {
    ...signAs,
    contractId: saved.id,
    actorEmail: mariclare.email,
    consentEsign: false,
  });
  assert.equal(missingBoxes.ok, false);
  if (!missingBoxes.ok) assert.equal(missingBoxes.status, 400);
  const shortName = await signContract(db, {
    ...signAs,
    contractId: saved.id,
    actorEmail: mariclare.email,
    legalName: "Mari",
  });
  assert.equal(shortName.ok, false);
  if (!shortName.ok) assert.equal(shortName.status, 400);

  const contentGuard = await signContract(db, { ...signAs, contractId: saved.id, actorEmail: mariclare.email });
  assert.equal(contentGuard.ok, false);
  if (!contentGuard.ok) {
    assert.equal(contentGuard.status, 400);
    assert.equal(contentGuard.error, "Confirm you are the parent or guardian for any minor in this content.");
  }
  const signed = await signContract(db, {
    ...signAs,
    contractId: saved.id,
    actorEmail: mariclare.email,
    guardianConfirm: true,
  });
  assert.equal(signed.ok, true, signed.ok ? "" : `${signed.status} ${signed.error}`);
  if (!signed.ok) return;
  assert.equal(signed.status, "final");
  assert.equal(signed.workflowStage, "waiting_for_product");
  const afterSign = await getDealForViewer(db, admin, "phase6-sign");
  const audit = afterSign?.signatures.find((row) => row.id === signed.signatureId);
  assert.equal(audit?.signerName, "Mari Clare Maclamroc");
  assert.equal(audit?.signerEmail, mariclare.email);
  assert.equal(audit?.ip, "203.0.113.8");
  assert.equal(audit?.userAgent, "PortalTest/6");
  assert.match(audit?.signedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(audit?.documentSha256, sha256(pdf));
  assert.match(audit?.signedSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.notEqual(audit?.signedSha256, audit?.documentSha256);
  const stored = await db.select().from(signatureFiles).where(eq(signatureFiles.signatureId, signed.signatureId));
  const signedBytes = new Uint8Array(Buffer.from(stored[0]?.bytesBase64 ?? "", "base64"));
  assert.equal(Buffer.from(signedBytes.subarray(0, 5)).toString(), "%PDF-");
  assert.equal(sha256(signedBytes), audit?.signedSha256);
  const signedDoc = await PDFDocument.load(signedBytes);
  const originalDoc = await PDFDocument.load(pdf);
  assert.equal(signedDoc.getPageCount(), originalDoc.getPageCount() + 1);
  assert.equal(afterSign?.workflowStage, "waiting_for_product");
  assert.equal(afterSign?.stageEvents?.some((event) => event.toStage === "signed_by_creator" && event.actorRole === "creator"), true);
  const brandEmail = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase6-sign" && row.gate === "signed_contract");
  assert.equal(brandEmail?.status, "pending");
  assert.equal(brandEmail?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(brandEmail?.toEmail, "hello@phase6sign.example");
  assert.match(brandEmail?.body ?? "", /Contracts folder|Drive link:/);
  const waiting = await listApprovedApprovals(db);
  assert.equal(waiting.body.approvals.some((row) => row.id === brandEmail?.id), false);
  const creatorView = await getDealForViewer(db, mariclare, "phase6-sign");
  assert.equal(creatorView?.contracts.every((row) => row.checks === null), true);
  assert.equal(creatorView?.signatures.find((row) => row.id === signed.signatureId)?.ip, null);
  assert.equal(creatorView?.signatures.find((row) => row.id === signed.signatureId)?.signerEmail, null);
  assert.equal(creatorView?.signatures.find((row) => row.id === signed.signatureId)?.userAgent, null);
  assert.equal(creatorView?.signatures.find((row) => row.id === signed.signatureId)?.documentSha256, null);
  assert.equal(JSON.stringify(creatorView).includes("203.0.113.8"), false);
  assert.equal(JSON.stringify(creatorView).includes("PortalTest/6"), false);

  const again = await signContract(db, { ...signAs, contractId: saved.id, actorEmail: mariclare.email });
  assert.equal(again.ok, false);
  if (!again.ok) {
    assert.equal(again.status, 409);
    assert.equal(again.error, "This version is already signed.");
  }

  const counterDeal = await upsertDeal(db, {
    id: "phase6-counter",
    brand: "Phase6 Counter",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6counter.example",
  });
  assert.equal(counterDeal.status, 201);
  const counterPdf = await onePagePdf();
  const counterV1 = await saveContract(db, {
    dealId: "phase6-counter",
    filename: "counter-v1.pdf",
    mimeType: "application/pdf",
    bytes: counterPdf,
    countersign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(counterV1.ok, true);
  if (!counterV1.ok) return;
  assert.equal((await approveContract(db, { contractId: counterV1.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const counterV2 = await saveContract(db, {
    dealId: "phase6-counter",
    filename: "counter-v2.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    countersign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(counterV2.ok, true);
  if (!counterV2.ok) return;
  const replaced = await signContract(db, { ...signAs, contractId: counterV1.id, actorEmail: mariclare.email });
  assert.equal(replaced.ok, false);
  if (!replaced.ok) {
    assert.equal(replaced.status, 409);
    assert.equal(replaced.error, "This version was replaced. Sign the newest contract.");
  }
  const creatorReplaced = await getDealForViewer(db, mariclare, "phase6-counter");
  assert.equal(creatorReplaced?.signatures.some((row) => row.status === "void"), false);
  const adminReplaced = await getDealForViewer(db, admin, "phase6-counter");
  assert.equal(adminReplaced?.signatures.some((row) => row.contractId === counterV1.id && row.status === "void"), true);
  assert.equal((await approveContract(db, { contractId: counterV2.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const creatorSigned = await signContract(db, {
    ...signAs,
    contractId: counterV2.id,
    actorEmail: mariclare.email,
    guardianConfirm: true,
  });
  assert.equal(creatorSigned.ok, true, creatorSigned.ok ? "" : `${creatorSigned.status} ${creatorSigned.error}`);
  if (!creatorSigned.ok) return;
  assert.equal(creatorSigned.status, "pending_countersign");
  assert.equal((await listApprovalQueue(db, "all")).some((row) => row.dealId === "phase6-counter" && row.gate === "signed_contract"), false);
  const countersigned = await countersignContract(db, {
    contractId: counterV2.id,
    actorEmail: admin.email,
    actorRole: "admin",
    legalName: "Kamron Santo",
    signatureKind: "typed",
    consentEsign: true,
    consentRead: true,
    ip: "203.0.113.9",
    userAgent: "PortalTest/6-admin",
  });
  assert.equal(countersigned.ok, true);
  if (!countersigned.ok) return;
  const creatorCopy = await db.select().from(signatureFiles).where(eq(signatureFiles.signatureId, creatorSigned.signatureId));
  const counterCopy = await db.select().from(signatureFiles).where(eq(signatureFiles.signatureId, countersigned.signatureId));
  assert.equal(creatorCopy.length, 1);
  assert.equal(counterCopy.length, 1);
  assert.notEqual(creatorCopy[0]?.bytesBase64, counterCopy[0]?.bytesBase64);
  const counterEmail = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase6-counter" && row.gate === "signed_contract");
  assert.equal(counterEmail?.status, "pending");
  assert.equal(counterEmail?.fromEmail, "authentickambiz@gmail.com");
  const counterDealAfter = await getDealForViewer(db, admin, "phase6-counter");
  assert.equal(counterDealAfter?.workflowStage, "waiting_for_product");
  assert.equal(counterDealAfter?.signatures.find((row) => row.id === creatorSigned.signatureId)?.status, "final");
  assert.equal(counterDealAfter?.stageEvents?.some((event) => (event.note ?? "").includes("Momma Mari countersigned contract v2")), true);
  assert.equal(counterDealAfter?.revisions.some((row) => row.summary === "Momma Mari countersigned the contract."), true);

  const contentRow = (await getDealForViewer(db, admin, "phase6-sign"))?.signatures.find((row) => row.id === signed.signatureId);
  assert.equal(contentRow?.role, "creator");
  assert.equal(contentRow?.guardian, false);
  const savedAges = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0]?.kidsAges ?? null;
  await db.update(creators).set({ kidsAges: null }).where(eq(creators.id, "mariclare"));
  const adultDeal = await upsertDeal(db, {
    id: "phase6-adult",
    brand: "Phase6 Adult",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6adult.example",
  });
  assert.equal(adultDeal.status, 201);
  const adultFile = await saveContract(db, {
    dealId: "phase6-adult",
    filename: "adult.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(adultFile.ok, true);
  if (!adultFile.ok) return;
  assert.equal((await approveContract(db, { contractId: adultFile.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const adultSigned = await signContract(db, { ...signAs, contractId: adultFile.id, actorEmail: mariclare.email, guardianConfirm: false });
  assert.equal(adultSigned.ok, true, adultSigned.ok ? "" : `${adultSigned.status} ${adultSigned.error}`);
  await db.update(creators).set({ kidsAges: savedAges }).where(eq(creators.id, "mariclare"));

  const minorFlag = await setSignerIsMinor(db, { creatorId: "mariclare", minor: true, actorRole: "admin" });
  assert.equal(minorFlag.ok, true);
  const minorDeal = await upsertDeal(db, {
    id: "phase6-minor",
    brand: "Phase6 Minor",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6minor.example",
  });
  assert.equal(minorDeal.status, 201);
  const minorFile = await saveContract(db, {
    dealId: "phase6-minor",
    filename: "minor.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(minorFile.ok, true);
  if (!minorFile.ok) return;
  assert.equal((await approveContract(db, { contractId: minorFile.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const minorBlocked = await signContract(db, { ...signAs, contractId: minorFile.id, actorEmail: mariclare.email, guardianConfirm: false });
  assert.equal(minorBlocked.ok, false);
  if (!minorBlocked.ok) {
    assert.equal(minorBlocked.status, 400);
    assert.equal(minorBlocked.error, "A parent or guardian has to sign this contract.");
  }
  const minorSigned = await signContract(db, {
    ...signAs,
    contractId: minorFile.id,
    actorEmail: mariclare.email,
    legalName: "Parent Maclamroc",
    guardianConfirm: true,
  });
  assert.equal(minorSigned.ok, true);
  if (minorSigned.ok) {
    const minorRow = (await getDealForViewer(db, admin, "phase6-minor"))?.signatures.find((row) => row.id === minorSigned.signatureId);
    assert.equal(minorRow?.role, "guardian");
    assert.equal(minorRow?.guardian, true);
  }
  const notices = await listUnreadNotices(db);
  assert.equal(notices.some((notice) => notice.kind === "minor_signature" && notice.message.includes("Phase6 Minor") && notice.message.includes("parent or guardian")), true);
  assert.equal((await setSignerIsMinor(db, { creatorId: "mariclare", minor: false, actorRole: "admin" })).ok, true);

  const drawnDeal = await upsertDeal(db, {
    id: "phase6-drawn",
    brand: "Phase6 Drawn",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6drawn.example",
  });
  assert.equal(drawnDeal.status, 201);
  const drawnFile = await saveContract(db, {
    dealId: "phase6-drawn",
    filename: "drawn.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(drawnFile.ok, true);
  if (!drawnFile.ok) return;
  assert.equal((await approveContract(db, { contractId: drawnFile.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const drawn = await signContract(db, {
    ...signAs,
    contractId: drawnFile.id,
    actorEmail: mariclare.email,
    guardianConfirm: true,
    signatureKind: "drawn",
    signaturePng: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  });
  assert.equal(drawn.ok, true);
  if (drawn.ok) {
    const drawnRow = (await getDealForViewer(db, admin, "phase6-drawn"))?.signatures.find((row) => row.id === drawn.signatureId);
    assert.equal(drawnRow?.status, "final");
  }

  const brandDeal = await upsertDeal(db, {
    id: "phase6-brand",
    brand: "Phase6 Brand",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    amountDisplay: "$500",
    contact: "hello@phase6brand.example",
  });
  assert.equal(brandDeal.status, 201);
  const brandFile = await saveContract(db, {
    dealId: "phase6-brand",
    filename: "brand.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    countersign: true,
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(brandFile.ok, true);
  if (!brandFile.ok) return;
  assert.equal((await approveContract(db, { contractId: brandFile.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const brandPdf = await onePagePdf();
  const uploaded = await uploadBrandSignedCopy(db, {
    contractId: brandFile.id,
    actorEmail: admin.email,
    actorRole: "admin",
    filename: "brand-completed.pdf",
    bytes: brandPdf,
    ip: "203.0.113.10",
    userAgent: "PortalTest/6-upload",
  });
  assert.equal(uploaded.ok, true);
  if (!uploaded.ok) return;
  const uploadedRow = await db.select().from(signatureFiles).where(eq(signatureFiles.signatureId, uploaded.signatureId));
  const uploadedBytes = Buffer.from(uploadedRow[0]?.bytesBase64 ?? "", "base64");
  assert.equal(Buffer.compare(uploadedBytes, Buffer.from(brandPdf)), 0);
  const brandView = await getDealForViewer(db, admin, "phase6-brand");
  assert.equal(brandView?.workflowStage, "waiting_for_product");
  assert.equal(brandView?.signatures.find((row) => row.id === uploaded.signatureId)?.status, "final");
  assert.equal(brandView?.signatures.some((row) => row.contractId === brandFile.id && row.status === "requested"), false);
  const skipped = await signContract(db, { ...signAs, contractId: brandFile.id, actorEmail: mariclare.email });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.status, 409);
  const brandMail = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase6-brand" && row.gate === "signed_contract");
  assert.equal(brandMail?.status, "pending");
  assert.equal(brandMail?.fromEmail, "authentickambiz@gmail.com");

  const listed = await listSignatures(db, null);
  assert.equal(JSON.stringify(listed).includes("gmailRefreshToken"), false);
  assert.equal(JSON.stringify(listed).includes("refresh_token"), false);
  assert.equal(listed.some((row) => row.dealId === "phase6-sign" && row.status === "final"), true);
  const later = await listSignatures(db, "2999-01-01T00:00:00.000Z");
  assert.equal(later.length, 0);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  assert.equal(kosblingAfter?.contracts.length, 0);
});

test("an owner assigns a manager, and that manager only sees their creators", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;

  const added = await addManager(db, { actorRole: "admin", name: "Riley", email: "riley.manager@gmail.com" });
  assert.equal(added.ok, true);
  if (!added.ok) return;
  assert.equal(added.permissions.approveEmail, true);
  assert.equal(added.permissions.approveVideo, true);
  assert.equal(added.permissions.approveContract, false);
  assert.equal(added.permissions.countersign, false);
  const creatorAdd = await addManager(db, { actorRole: "creator", name: "Nope", email: "nope.manager@gmail.com" });
  assert.equal(creatorAdd.ok, false);
  if (!creatorAdd.ok) assert.equal(creatorAdd.status, 403);
  assert.equal((await addManager(db, { actorRole: "admin", name: "Bad", email: "someone@example.invalid" })).ok, false);
  assert.equal((await addManager(db, { actorRole: "admin", name: "Kamron", email: "Kamron@mommamari.com" })).ok, false);

  const sam = await addManager(db, { actorRole: "admin", name: "Sam", email: "sam.manager@gmail.com" });
  assert.equal(sam.ok, true);
  if (!sam.ok) return;
  assert.equal((await setManagerActive(db, { actorRole: "admin", managerId: sam.id, active: false })).ok, true);
  assert.equal((await resolveLogin(db, "sam.manager@gmail.com")).ok, false);
  assert.equal((await resolveLogin(db, "stranger.manager@gmail.com")).ok, false);
  assert.equal((await resolveLogin(db, "also@example.invalid")).ok, false);
  const signedIn = await resolveLogin(db, "riley.manager@gmail.com");
  assert.equal(signedIn.ok, true);
  if (!signedIn.ok) return;
  assert.equal(signedIn.viewer.role, "manager");

  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: added.id,
    backupManagerId: null,
  })).ok, true);

  const riley: Viewer = {
    email: "riley.manager@gmail.com",
    role: "manager",
    creatorId: null,
    name: "Riley",
    managerId: added.id,
    permissions: added.permissions,
    assignedCreatorIds: await assignedCreatorIds(db, added.id),
  };
  const hidden = await upsertDeal(db, {
    id: "phase7-hidden",
    brand: "Phase7 Hidden",
    creatorId: "mariclare",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: false,
    amountDisplay: "$900",
    contact: "hello@phase7hidden.example",
  });
  assert.equal(hidden.status, 201);
  assert.ok(await getDealForViewer(db, riley, "phase7-hidden"));
  assert.equal(await getDealForViewer(db, mariclare, "phase7-hidden"), null);
  const abbyDeal = await upsertDeal(db, {
    id: "phase7-abby",
    brand: "Phase7 Abby",
    creatorId: "abby",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: true,
    amountDisplay: "$400",
    contact: "hello@phase7abby.example",
  });
  assert.equal(abbyDeal.status, 201);
  assert.equal(await getDealForViewer(db, riley, "phase7-abby"), null);
  const roster = await listDealsForViewer(db, riley, "all");
  assert.equal(roster.some((deal) => deal.creatorId === "abby"), false);
  assert.equal(roster.some((deal) => deal.id === "phase7-hidden"), true);
  const vev = await getDealForViewer(db, riley, "vev");
  assert.equal(vev?.amountDisplay, null);
  assert.equal(vev?.rateCents, null);
  assert.equal(vev?.rateLabel, null);
  assert.equal(vev?.paymentTerms, null);
  assert.equal(vev?.payment, null);
  assert.equal(vev?.pipelineCents, null);
  assert.ok(await getDealForViewer(db, admin, "vev"));
  assert.notEqual((await getDealForViewer(db, admin, "vev"))?.amountDisplay, null);

  const moved = await upsertDeal(db, {
    id: "phase7-role",
    brand: "Phase7 Role",
    creatorId: "mariclare",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: false,
    contact: "hello@phase7role.example",
  });
  assert.equal(moved.status, 201);
  const stage = await setDealStage(db, {
    dealId: "phase7-role",
    toStage: "offer_shared",
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(stage.ok, true);
  const staged = await getDealForViewer(db, admin, "phase7-role");
  const stageEvent = staged?.stageEvents?.find((event) => event.toStage === "offer_shared");
  assert.equal(stageEvent?.actorRole, "manager");
  assert.equal(stageEvent?.actorEmail, "riley.manager@gmail.com");

  async function onePagePdf() {
    const doc = await PDFDocument.create();
    doc.addPage([420, 560]);
    return new Uint8Array(await doc.save());
  }
  const ownerDeal = await upsertDeal(db, {
    id: "phase7-owner-contract",
    brand: "Phase7 Owner",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    contact: "hello@phase7owner.example",
  });
  assert.equal(ownerDeal.status, 201);
  const ownerFile = await saveContract(db, {
    dealId: "phase7-owner-contract",
    filename: "owner.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(ownerFile.ok, true);
  if (!ownerFile.ok) return;
  const managerDeal = await upsertDeal(db, {
    id: "phase7-contract",
    brand: "Phase7 Contract",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "creator_interested",
    visibleToCreator: true,
    contact: "hello@phase7contract.example",
  });
  assert.equal(managerDeal.status, 201);
  const managerFile = await saveContract(db, {
    dealId: "phase7-contract",
    filename: "manager.pdf",
    mimeType: "application/pdf",
    bytes: await onePagePdf(),
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(managerFile.ok, true);
  if (!managerFile.ok) return;
  const blocked = await approveContract(db, { contractId: managerFile.id, actorEmail: riley.email, actorRole: "manager" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "You can't approve contracts.");
  assert.equal((await approveContract(db, { contractId: ownerFile.id, actorEmail: admin.email, actorRole: "admin" })).ok, true);
  assert.equal((await setManagerPermissions(db, {
    actorRole: "admin",
    managerId: added.id,
    permissions: { approveEmail: true, approveVideo: true, approveContract: true, countersign: false },
  })).ok, true);
  const approved = await approveContract(db, { contractId: managerFile.id, actorEmail: riley.email, actorRole: "manager" });
  assert.equal(approved.ok, true);
  const approvedDeal = await getDealForViewer(db, admin, "phase7-contract");
  assert.equal(approvedDeal?.stageEvents?.some((event) => event.toStage === "approved_by_agency" && event.actorRole === "manager" && event.actorEmail === riley.email), true);
  const noSign = await countersignContract(db, {
    contractId: managerFile.id,
    actorEmail: riley.email,
    actorRole: "manager",
    legalName: "Riley Manager",
    signatureKind: "typed",
    consentEsign: true,
    consentRead: true,
    ip: "203.0.113.20",
    userAgent: "PortalTest/7",
  });
  assert.equal(noSign.ok, false);
  if (!noSign.ok) assert.equal(noSign.error, "You can't countersign.");
  assert.equal((await setManagerPermissions(db, {
    actorRole: "admin",
    managerId: added.id,
    permissions: { approveEmail: true, approveVideo: true, approveContract: true, countersign: true },
  })).ok, true);
  const signOpened = await countersignContract(db, {
    contractId: managerFile.id,
    actorEmail: riley.email,
    actorRole: "manager",
    legalName: "Riley Manager",
    signatureKind: "typed",
    consentEsign: true,
    consentRead: true,
    ip: "203.0.113.20",
    userAgent: "PortalTest/7",
  });
  assert.equal(signOpened.ok, false);
  if (!signOpened.ok) assert.notEqual(signOpened.error, "You can't countersign.");

  const hers = await createApprovalEmail(db, {
    dealId: "phase7-role",
    gate: "signed_contract",
    to: "hello@phase7role.example",
    subject: "Phase7 signed contract",
    body: "The signed contract is attached.",
  }, { email: "bot@mommamari.com", role: "bot" });
  assert.equal(hers.ok, true);
  if (!hers.ok) return;
  const reviewed = await reviewApproval(db, {
    approvalId: hers.id,
    intent: "approve",
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(reviewed.ok, true);
  const queue = await listApprovalQueue(db, "all");
  assert.equal(queue.find((row) => row.id === hers.id)?.events.some((event) => event.action === "approved" && event.actorRole === "manager"), true);
  const theirs = await createApprovalEmail(db, {
    dealId: "phase7-abby",
    gate: "signed_contract",
    to: "hello@phase7abby.example",
    subject: "Phase7 Abby email",
    body: "This one is not Riley's.",
  }, { email: "bot@mommamari.com", role: "bot" });
  assert.equal(theirs.ok, true);
  if (!theirs.ok) return;
  const denied = await reviewApproval(db, {
    approvalId: theirs.id,
    intent: "approve",
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "That creator isn't on your list.");

  const released = await releaseOffer(db, {
    dealId: "phase7-hidden",
    actorEmail: admin.email,
    actorRole: "admin",
    brandEmail: "hello@phase7hidden.example",
  });
  assert.equal(released.ok, true);
  const interest = await recordCreatorInterest(db, {
    dealId: "phase7-hidden",
    creatorId: "mariclare",
    creatorEmail: mariclare.email,
    creatorName: "MariClare",
    decision: "interested",
    note: "Phase7 yes",
  });
  assert.equal(interest.ok, true);
  const managerInbox = await listManagerNotices(db, added.id);
  assert.equal(managerInbox.some((note) => note.kind === "creator_interest" && note.message.includes("Phase7 Hidden")), true);
  assert.equal((await listUnreadNotices(db)).some((note) => note.kind === "creator_interest" && note.message.includes("Phase7 Hidden")), false);

  const listed = await listContracts(db, null);
  const packed = JSON.stringify(listed);
  assert.equal(packed.includes("riley.manager@gmail.com"), true);
  assert.equal(packed.includes("gmailRefreshToken"), false);
  assert.equal(packed.includes("refresh_token"), false);
  const signatures = JSON.stringify(await listSignatures(db, null));
  assert.equal(signatures.includes("gmailRefreshToken"), false);
  assert.equal(signatures.includes("refresh_token"), false);

  const jordan = await addManager(db, { actorRole: "admin", name: "Jordan", email: "jordan.manager@gmail.com" });
  assert.equal(jordan.ok, true);
  if (!jordan.ok) return;
  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: jordan.id,
    backupManagerId: null,
  })).ok, true);
  const rileyAfter = { ...riley, assignedCreatorIds: await assignedCreatorIds(db, added.id) };
  assert.equal(await getDealForViewer(db, rileyAfter, "vev"), null);

  assert.equal((await setManagerActive(db, { actorRole: "admin", managerId: jordan.id, active: false })).ok, true);
  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: jordan.id,
    backupManagerId: added.id,
  })).ok, false);
  assert.equal((await setManagerActive(db, { actorRole: "admin", managerId: jordan.id, active: true })).ok, true);
  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: jordan.id,
    backupManagerId: added.id,
  })).ok, true);
  assert.equal((await setManagerActive(db, { actorRole: "admin", managerId: jordan.id, active: false })).ok, true);
  await notifyStaff(db, { kind: "creator_interest", creatorId: "mariclare", message: "Backup cover check for Phase7." });
  const backupInbox = await listManagerNotices(db, added.id);
  assert.equal(backupInbox.some((note) => note.message === "Backup cover check for Phase7."), true);
  const ownerCopy = (await listUnreadNotices(db)).find((note) => note.message.includes("Backup cover check for Phase7."));
  assert.ok(ownerCopy);
  assert.equal(ownerCopy?.message.includes("The backup manager is covering."), true);

  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: null,
    backupManagerId: null,
  })).ok, true);
  await notifyStaff(db, { kind: "creator_interest", creatorId: "mariclare", message: "Owner only check for Phase7." });
  assert.equal((await listUnreadNotices(db)).some((note) => note.message === "Owner only check for Phase7."), true);
  assert.equal((await listManagerNotices(db, added.id)).some((note) => note.message === "Owner only check for Phase7."), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
});

test("product tracking, live posts, and owner-only payment marks", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const managers = await listManagers(db);
  const rileyRow = managers.find((manager) => manager.email === "riley.manager@gmail.com");
  assert.ok(rileyRow);
  const casey = await addManager(db, { actorRole: "admin", name: "Casey", email: "casey.manager@gmail.com" });
  assert.equal(casey.ok, true);
  if (!casey.ok || !rileyRow) return;
  const caseyViewer: Viewer = {
    email: casey.email,
    role: "manager",
    creatorId: null,
    name: "Casey",
    managerId: casey.id,
    permissions: casey.permissions,
    assignedCreatorIds: [],
  };

  const created = await upsertDeal(db, {
    id: "phase7-ship",
    brand: "Phase7 Ship",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "signed_sent",
    visibleToCreator: true,
    contact: "hello@phase7ship.example",
    rateCents: 100000,
  });
  assert.equal(created.status, 201);

  const creatorTracking = await saveShipment(db, {
    dealId: "phase7-ship",
    carrier: "UPS",
    trackingNumber: "1ZCREATOR",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorTracking.ok, false);
  if (!creatorTracking.ok) assert.equal(creatorTracking.status, 403);

  const strangerTracking = await saveShipment(db, {
    dealId: "phase7-ship",
    carrier: "UPS",
    trackingNumber: "1ZCASEY",
    actorEmail: casey.email,
    actorRole: "manager",
  });
  assert.equal(strangerTracking.ok, false);
  if (!strangerTracking.ok) assert.equal(strangerTracking.error, "That creator isn't on your list.");

  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: rileyRow.id,
    backupManagerId: null,
  })).ok, true);
  const riley: Viewer = {
    email: rileyRow.email,
    role: "manager",
    creatorId: null,
    name: rileyRow.name,
    managerId: rileyRow.id,
    permissions: rileyRow.permissions,
    assignedCreatorIds: await assignedCreatorIds(db, rileyRow.id),
  };

  const tracked = await saveShipment(db, {
    dealId: "phase7-ship",
    carrier: "UPS",
    trackingNumber: "1Z999",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(tracked.ok, true);
  const shipped = await getDealForViewer(db, admin, "phase7-ship");
  assert.equal(shipped?.workflowStage, "waiting_for_product");
  assert.equal(shipped?.shipment?.carrier, "UPS");
  assert.equal(shipped?.shipment?.trackingNumber, "1Z999");
  assert.equal(shipped?.shipment?.statusLabel, "On the way");
  const trackingEvent = shipped?.stageEvents?.find((event) => event.toStage === "waiting_for_product");
  assert.equal(trackingEvent?.actorRole, "admin");
  assert.equal(trackingEvent?.actorEmail, admin.email);

  const managerTracked = await saveShipment(db, {
    dealId: "phase7-ship",
    carrier: "UPS",
    trackingNumber: "1Z999",
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(managerTracked.ok, true);
  const managerNotices = await listManagerNotices(db, rileyRow.id);
  assert.equal(managerNotices.some((note) => note.message.includes("Phase7 Ship")), true);

  const gotIt = await confirmProductReceived(db, {
    dealId: "phase7-ship",
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: "mariclare",
  });
  assert.equal(gotIt.ok, true);
  const drafting = await getDealForViewer(db, mariclare, "phase7-ship");
  assert.equal(drafting?.workflowStage, "draft_due");
  assert.equal(drafting?.uploadEnabled, true);
  assert.equal(drafting?.shipment?.statusLabel, "Received");
  const creatorNotices = await listUnreadCreatorNotices(db, "mariclare");
  assert.equal(creatorNotices.some((note) => note.message.includes("draft is due")), true);

  const kosblingMid = await getDealForViewer(db, admin, "kosbling");
  const blockedProduct = await confirmProductReceived(db, {
    dealId: "kosbling",
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: "mariclare",
  });
  assert.equal(blockedProduct.ok, false);
  if (!blockedProduct.ok) assert.equal(blockedProduct.status, 409);
  const kosblingStill = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingStill?.workflowStage, "draft_due");
  assert.equal(kosblingStill?.stageEvents?.length, kosblingMid?.stageEvents?.length);

  const tooEarly = await submitLivePosts(db, {
    dealId: "phase7-ship",
    links: [{ platform: "tiktok", url: "https://www.tiktok.com/@mariclare/video/1" }],
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: "mariclare",
  });
  assert.equal(tooEarly.ok, false);
  if (!tooEarly.ok) assert.equal(tooEarly.status, 409);
  assert.equal((await getDealForViewer(db, admin, "phase7-ship"))?.livePosts.length, 0);

  assert.equal((await setDealStage(db, {
    dealId: "phase7-ship",
    toStage: "brand_approved",
    actorEmail: admin.email,
    actorRole: "admin",
  })).ok, true);
  const posted = await submitLivePosts(db, {
    dealId: "phase7-ship",
    links: [{ platform: "tiktok", url: "https://www.tiktok.com/@mariclare/video/1" }],
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: "mariclare",
  });
  assert.equal(posted.ok, true);
  const live = await getDealForViewer(db, admin, "phase7-ship");
  assert.equal(live?.workflowStage, "scheduled_posted");
  assert.equal(live?.stageEvents?.some((event) => event.toStage === "scheduled_posted" && event.actorRole === "creator" && event.actorEmail === mariclare.email), true);
  assert.equal(live?.livePosts[0]?.url, "https://www.tiktok.com/@mariclare/video/1");
  const waiting = await needsYou(db, riley);
  assert.equal(waiting.some((item) => item.id === "post-phase7-ship"), true);

  const confirmed = await confirmLivePost(db, {
    postId: live?.livePosts[0]?.id ?? "",
    meetsBrief: true,
    queueEmail: true,
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(confirmed.ok, true);
  const queue = await listApprovalQueue(db, "all");
  const queued = queue.find((row) => row.dealId === "phase7-ship" && row.gate === "post_link");
  assert.equal(queued?.status, "pending");
  assert.equal(queued?.fromEmail, "authentickambiz@gmail.com");

  const skipped = await markPayment(db, {
    dealId: "phase7-ship",
    paymentStatus: "brand_paid",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.status, 400);
  const managerPay = await markPayment(db, {
    dealId: "phase7-ship",
    paymentStatus: "brand_invoiced",
    actorEmail: riley.email,
    actorRole: "manager",
  });
  assert.equal(managerPay.ok, false);
  if (!managerPay.ok) assert.equal(managerPay.error, "Only an owner can update payment.");
  const kosblingPay = await markPayment(db, {
    dealId: "kosbling",
    paymentStatus: "brand_invoiced",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(kosblingPay.ok, false);
  if (!kosblingPay.ok) assert.equal(kosblingPay.status, 409);

  for (const step of ["brand_invoiced", "brand_paid", "creator_payout_pending", "creator_paid"] as const) {
    const marked = await markPayment(db, {
      dealId: "phase7-ship",
      paymentStatus: step,
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(marked.ok, true, step);
  }
  const ownerDeal = await getDealForViewer(db, admin, "phase7-ship");
  assert.equal(ownerDeal?.workflowStage, "paid");
  assert.equal(ownerDeal?.payment?.paymentStatus, "creator_paid");
  const ownerCommission = commissionLabel(ownerDeal?.payment?.landedAmountCents ?? ownerDeal?.payment?.amountOwedCents ?? null);
  assert.equal(ownerCommission.includes("20%"), true);
  const creatorDeal = await getDealForViewer(db, mariclare, "phase7-ship");
  assert.equal(creatorDeal?.payment?.paymentStatus, "creator_paid");
  assert.equal(typeof creatorDeal?.payment?.creatorPayoutCents, "number");
  assert.ok((creatorDeal?.payment?.creatorPayoutCents ?? 0) > 0);
  assert.equal(JSON.stringify(creatorDeal).includes("20%"), false);
  assert.equal(JSON.stringify(creatorDeal).includes("Commission"), false);
  const managerDeal = await getDealForViewer(db, riley, "phase7-ship");
  assert.equal(managerDeal?.amountDisplay, null);
  assert.equal(managerDeal?.payment, null);
  assert.equal(await getDealForViewer(db, caseyViewer, "phase7-ship"), null);

  const botShipments = JSON.stringify(await listShipmentsSince(db, null));
  const botPosts = JSON.stringify(await listLivePostsSince(db, null));
  const botPayments = JSON.stringify(await listPaymentsSince(db, null));
  assert.equal(botShipments.includes("phase7-ship"), true);
  assert.equal(botShipments.includes("1Z999"), true);
  assert.equal(botPosts.includes("https://www.tiktok.com/@mariclare/video/1"), true);
  assert.equal(botPayments.includes("creator_paid"), true);
  for (const packed of [botShipments, botPosts, botPayments]) {
    assert.equal(packed.includes("gmailRefreshToken"), false);
    assert.equal(packed.includes("refresh_token"), false);
  }

  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: null,
    backupManagerId: null,
  })).ok, true);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("approved and sent emails are kept as PDFs, and BoldSign stays off", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;

  try {
    const created = await upsertDeal(db, {
      id: "phase8-mail",
      brand: "Phase8 Mail",
      creatorId: "mariclare",
      status: "negotiating",
      workflowStage: "draft_due",
      visibleToCreator: true,
    });
    assert.equal(created.status, 201);

    const drafted = await createApprovalEmail(db, {
      dealId: "phase8-mail",
      gate: "interest",
      to: "hello@phase8mail.example",
      subject: "Phase8 saved copy",
      body: "Thanks for the offer. We will follow up.",
    }, { email: "bot", role: "bot" });
    assert.equal(drafted.ok, true);
    if (!drafted.ok) return;

    const approved = await reviewApproval(db, {
      approvalId: drafted.id,
      intent: "approve",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(approved.ok, true);

    const card = (await listApprovalQueue(db, "all")).find((row) => row.id === drafted.id);
    assert.equal(card?.copies.length, 1);
    assert.equal(card?.copies[0]?.kind, "approved");
    assert.equal(card?.copies[0]?.stored, "portal");
    assert.equal(card?.copies[0]?.driveFileUrl, null);
    assert.equal(card?.copies[0]?.filename.includes("approved"), true);

    const copyId = card?.copies[0]?.id ?? "";
    const fileRows = await db.select().from(emailCopyFiles).where(eq(emailCopyFiles.copyId, copyId));
    const bytes = Buffer.from(fileRows[0]?.bytesBase64 ?? "", "base64");
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    const copyRows = await db.select().from(emailCopies).where(eq(emailCopies.id, copyId));
    assert.equal(copyRows[0]?.filename, "interest-approved-phase8-saved-copy.pdf");
    assert.equal(copyRows[0]?.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(copyRows[0]?.driveFileId, null);

    const sent = await markApprovalDraftSent(db, drafted.id, { messageId: "phase8-msg-1" });
    assert.equal(sent.status, 200);
    const after = (await listApprovalQueue(db, "all")).find((row) => row.id === drafted.id);
    assert.equal(after?.status, "sent");
    assert.equal(after?.copies.length, 2);
    assert.equal(after?.copies.some((copy) => copy.kind === "sent"), true);

    assert.equal(boldSignEnabled(), false);
    const off = await sendContractWithBoldSign({
      title: "Phase8",
      signerName: "MariClare",
      signerEmail: "mmaclamroc@gmail.com",
    });
    assert.equal(off.ok, false);
    if (!off.ok) assert.equal(off.status, 403);

    process.env.BOLDSIGN_ENABLED = "true";
    delete process.env.BOLDSIGN_API_KEY;
    assert.equal(boldSignEnabled(), true);
    const missing = await sendContractWithBoldSign({
      title: "Phase8",
      signerName: "MariClare",
      signerEmail: "mmaclamroc@gmail.com",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.status, 400);
      assert.equal(missing.error, "BoldSign is on, but the API key is missing. Nothing was sent.");
    }
    assert.equal(fetchCalls, 0);
  } finally {
    delete process.env.BOLDSIGN_ENABLED;
    delete process.env.BOLDSIGN_API_KEY;
    globalThis.fetch = originalFetch;
  }

  assert.equal(boldSignEnabled(), false);
  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("community chat stays on the roster and off deal data", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const touched = new Set<string>();
  setCommunityQueryTap((table) => touched.add(table));

  const bannedWord = /\b(deals|payments|drafts|earnings)\b/;
  function walk(dir: string, files: string[]) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, files);
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) files.push(full);
    }
  }
  const files: string[] = [];
  walk(path.join(process.cwd(), "src/app/api/community"), files);
  for (const extra of ["src/lib/community.ts", "src/lib/community-auth.ts", "src/lib/community-http.ts", "src/lib/community-shared.ts", "src/components/community-panel.tsx"]) {
    files.push(path.join(process.cwd(), extra));
  }
  for (const file of files) assert.equal(bannedWord.test(readFileSync(file, "utf8")), false, file);

  const stranger = await postCommunityMessage(db, { email: "nobody@gmail.com", name: "Nobody", role: "creator", creatorId: null }, { channelId: "everyone", body: "hello" });
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.status, 403);
  const bot = await postCommunityMessage(db, { email: "bot@local", name: "Bot", role: "bot" }, { channelId: "everyone", body: "hello" });
  assert.equal(bot.ok, false);

  const created = await upsertCreator(db, { id: "community-guest", name: "Guest Creator", email: "guest.creator@gmail.com", initials: "GC" });
  assert.equal(created.status, 201);
  const guest = { email: "guest.creator@gmail.com", name: "Guest Creator", role: "creator", creatorId: "community-guest" };
  const abbyRow = await findCreatorById(db, "abby");
  const abbyActor = { email: abbyRow?.email ?? "", name: abbyRow?.name ?? "Abby", role: "creator", creatorId: "abby" };
  const mariActor = { email: mariclare.email, name: mariclare.name, role: "creator", creatorId: "mariclare" };
  const adminActor = { email: admin.email, name: admin.name, role: "admin", creatorId: null };
  const rileyActor = { email: "riley.manager@gmail.com", name: "Riley", role: "manager", creatorId: null };

  assert.equal((await acceptCommunityGuidelines(db, guest)).ok, true);
  assert.equal((await acceptCommunityGuidelines(db, abbyActor)).ok, true);
  assert.equal((await acceptCommunityGuidelines(db, mariActor)).ok, true);
  assert.equal((await acceptCommunityGuidelines(db, adminActor)).ok, true);
  assert.equal((await acceptCommunityGuidelines(db, rileyActor)).ok, true);

  const abbyPost = await postCommunityMessage(db, abbyActor, { channelId: "everyone", body: "Abby is on the roster." });
  assert.equal(abbyPost.ok, true);
  const listed = await listCommunity(db, abbyActor, null);
  assert.equal(listed.ok, true);
  if (listed.ok && !listed.unchanged) {
    const packed = JSON.stringify(listed);
    assert.equal(/full access|full_access|\bCore\b/i.test(packed), false);
    assert.equal(listed.me.communityRole, "member");
  }

  const announce = await postCommunityMessage(db, mariActor, { channelId: "announcements", body: "Not allowed" });
  assert.equal(announce.ok, false);
  if (!announce.ok) assert.equal(announce.status, 403);
  const adminAnnounce = await postCommunityMessage(db, adminActor, { channelId: "announcements", body: "Welcome" });
  assert.equal(adminAnnounce.ok, true);

  const privateTry = await postCommunityMessage(db, mariActor, { channelId: "everyone", body: "Call 555-123-4567" });
  assert.equal(privateTry.ok, false);
  if (!privateTry.ok) assert.equal(privateTry.error, "This looks private. Post anyway?");
  const hits = await listFilterHitKinds(db);
  assert.equal(hits.includes("phone"), true);
  assert.equal(hits.some((kind) => kind.includes("555")), false);
  const postedAnyway = await postCommunityMessage(db, mariActor, { channelId: "everyone", body: "Call 555-123-4567", acknowledgePrivate: true });
  assert.equal(postedAnyway.ok, true);

  const guestPost = await postCommunityMessage(db, guest, { channelId: "wins", body: "A win" });
  assert.equal(guestPost.ok, true);
  if (!guestPost.ok) return;
  const moderatorRemove = await moderateCommunity(db, rileyActor, { action: "remove", messageId: guestPost.id });
  assert.equal(moderatorRemove.ok, false);
  if (!moderatorRemove.ok) assert.equal(moderatorRemove.status, 403);
  const moderatorDelete = await moderateCommunity(db, rileyActor, { action: "delete", messageId: guestPost.id });
  assert.equal(moderatorDelete.ok, true);
  const guestAgain = await postCommunityMessage(db, guest, { channelId: "wins", body: "Still here" });
  assert.equal(guestAgain.ok, true);
  if (!guestAgain.ok) return;
  assert.equal((await moderateCommunity(db, adminActor, { action: "remove", messageId: guestAgain.id })).ok, true);
  const removed = await postCommunityMessage(db, guest, { channelId: "everyone", body: "nope" });
  assert.equal(removed.ok, false);
  if (!removed.ok) assert.equal(removed.status, 403);
  const afterRemove = await listCommunity(db, adminActor, null);
  assert.equal(afterRemove.ok, true);
  if (afterRemove.ok && !afterRemove.unchanged) {
    assert.equal(afterRemove.messages.some((message) => message.body === "Still here" && message.authorName === "former member"), true);
  }

  const muted = await moderateCommunity(db, adminActor, { action: "mute", memberId: (await db.select().from(communityMembers).where(eq(communityMembers.email, mariclare.email)))[0]?.id });
  assert.equal(muted.ok, true);
  const mutedPost = await postCommunityMessage(db, mariActor, { channelId: "everyone", body: "muted" });
  assert.equal(mutedPost.ok, false);
  if (!mutedPost.ok) assert.equal(mutedPost.status, 403);
  await db.update(communityMembers).set({ mutedUntil: null }).where(eq(communityMembers.email, mariclare.email));

  const exif = new TextEncoder().encode("SECRET_EXIF_GPS");
  const segment = new Uint8Array(4 + exif.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  const length = 2 + exif.length;
  segment[2] = length >> 8;
  segment[3] = length & 0xff;
  segment.set(exif, 4);
  const tail = Uint8Array.from([0xff, 0xda, 0x00, 0x02, 0x00, 0xff, 0xd9]);
  const jpeg = new Uint8Array(2 + segment.length + tail.length);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg.set(segment, 2);
  jpeg.set(tail, 2 + segment.length);
  assert.equal(Buffer.from(stripJpegMetadata(jpeg)).toString("latin1").includes("SECRET_EXIF_GPS"), false);

  const photoBytes = new Map<string, Uint8Array>();
  setCommunityPhotoStoreForTests({
    async put(key, value) {
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      photoBytes.set(key, copy);
    },
    async get(key) {
      const bytes = photoBytes.get(key);
      if (!bytes) return null;
      return { async arrayBuffer() { return bytes.slice().buffer; } };
    },
  });
  const saved = await saveCommunityPhoto(db, adminActor, { bytes: jpeg, contentType: "image/jpeg", childFace: true });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const stored = await db.select().from(communityPhotos).where(eq(communityPhotos.id, saved.id));
  assert.equal(stored[0]?.bytesBase64, null);
  const kept = photoBytes.get(stored[0]?.r2Key ?? "");
  assert.equal(Buffer.from(kept ?? new Uint8Array()).toString("latin1").includes("SECRET_EXIF_GPS"), false);
  setCommunityPhotoStoreForTests(undefined);
  const link = await openCommunityPhoto(db, adminActor, { id: saved.id, exp: "1", sig: "nope" });
  assert.equal(link.ok, false);
  assert.equal(await photoLinkValid(saved.id, "1", "nope"), false);
  const heldPost = await postCommunityMessage(db, adminActor, { channelId: "everyone", photoId: saved.id, body: "photo" });
  assert.equal(heldPost.ok, true);
  const creatorView = await listCommunity(db, mariActor, null);
  if (creatorView.ok && !creatorView.unchanged) {
    assert.equal(creatorView.messages.some((message) => message.body === "photo"), false);
  }
  const ownerView = await listCommunity(db, adminActor, null);
  if (ownerView.ok && !ownerView.unchanged) {
    assert.equal(ownerView.messages.some((message) => message.body === "photo" && message.held), true);
    assert.equal(ownerView.held.length > 0, true);
  }

  assert.equal((await moderateCommunity(db, adminActor, { action: "read_only", readOnly: false })).ok, true);
  assert.equal((await moderateCommunity(db, adminActor, { action: "slow", slowSeconds: 0 })).ok, true);
  await db.update(communitySettings).set({ readOnly: false, slowSeconds: 0 }).where(eq(communitySettings.id, "default"));
  setCommunityQueryTap(null);
  for (const table of touched) assert.equal(["deals", "payments", "drafts", "earnings"].includes(table), false, table);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("the member directory hides private fields and other creators cannot edit a profile", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const base = {
    creatorId: "mariclare",
    profileOn: true,
    displayName: "MariClare",
    displayNameOn: true,
    avatarOn: false,
    bio: "Stories from our kitchen table.",
    bioOn: true,
    niches: ["food"],
    nichesOn: false,
    handles: "@secret",
    handlesOn: false,
    audience: "not a range",
    audienceOn: true,
    formats: ["TikTok"],
    formatsOn: false,
    askMe: "lunchboxes",
    askMeOn: false,
    collabs: true,
    collabsOn: false,
    state: "TX",
    stateOn: false,
    brands: "VEV $1200",
    brandsOn: true,
    childName: "Sunny",
    childAge: "6–8",
    familyOn: true,
    familyConfirm: false,
    joinedOn: true,
  };
  const unconfirmed = await saveMyProfile(db, mariclare, base);
  assert.equal(unconfirmed.ok, false);
  const saved = await saveMyProfile(db, mariclare, { ...base, familyConfirm: true });
  assert.equal(saved.ok, true);
  const cards = await listPublicProfiles(db);
  const hers = cards.find((card) => card.creatorId === "mariclare");
  assert.equal(hers?.displayName, "MariClare");
  assert.equal(hers?.bio, "Stories from our kitchen table.");
  assert.ok(hers?.joined);
  assert.equal(hers?.family?.name, "Sunny");
  assert.deepEqual(hers?.brands, ["VEV"]);
  assert.equal("handles" in (hers ?? {}), false);
  assert.equal("audience" in (hers ?? {}), false);
  assert.equal("niches" in (hers ?? {}), false);
  const packed = JSON.stringify(cards);
  assert.equal(/full access|full_access|\bCore\b|@gmail|rate|earning|contract/i.test(packed), false);

  const other = await saveMyProfile(db, abby, { ...base, creatorId: "mariclare", familyConfirm: true });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.status, 403);

  assert.equal((await hideMyProfile(db, mariclare)).ok, true);
  assert.equal((await listPublicProfiles(db)).some((card) => card.creatorId === "mariclare"), false);
  assert.equal((await saveMyProfile(db, mariclare, { ...base, familyConfirm: true })).ok, true);

  const hidden = await moderateProfileField(db, admin, { creatorId: "mariclare", field: "bio", action: "hide", reason: "Too specific." });
  assert.equal(hidden.ok, true);
  const afterHide = (await listPublicProfiles(db)).find((card) => card.creatorId === "mariclare");
  assert.equal(afterHide?.bio, undefined);
  const notes = await db.select().from(creatorNotifications).where(eq(creatorNotifications.creatorId, "mariclare"));
  assert.equal(notes.some((note) => note.message.includes("Too specific.")), true);
  const creatorHide = await moderateProfileField(db, mariclare, { creatorId: "abby", field: "bio", action: "hide", reason: "no" });
  assert.equal(creatorHide.ok, false);

  assert.equal((await upsertCreator(db, { id: "profile-guest", name: "Profile Guest", email: "profile.guest@gmail.com", initials: "PG" })).status, 201);
  assert.equal((await saveMyProfile(db, { email: "profile.guest@gmail.com", name: "Profile Guest", role: "creator", creatorId: "profile-guest" }, {
    ...base,
    creatorId: "profile-guest",
    displayName: "Guest",
    familyConfirm: true,
    familyOn: false,
  })).ok, true);
  await db.delete(creators).where(eq(creators.id, "profile-guest"));
  assert.equal((await listPublicProfiles(db)).some((card) => card.creatorId === "profile-guest"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("a creator sees when the brand paid, the 20% fee, and when her cut was sent", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const created = await upsertDeal(db, {
    id: "phase9-pay",
    brand: "Phase9 Pay",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "scheduled_posted",
    visibleToCreator: true,
    rateCents: 100000,
  });
  assert.equal(created.status, 201);

  const managerPay = await markPayment(db, {
    dealId: "phase9-pay",
    paymentStatus: "brand_invoiced",
    actorEmail: "riley.manager@gmail.com",
    actorRole: "manager",
  });
  assert.equal(managerPay.ok, false);
  if (!managerPay.ok) assert.equal(managerPay.error, "Only an owner can update payment.");

  const invoiced = await markPayment(db, {
    dealId: "phase9-pay",
    paymentStatus: "brand_invoiced",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(invoiced.ok, true);
  const afterInvoice = creatorPayoutTracker((await getDealForViewer(db, mariclare, "phase9-pay"))?.payment ?? null);
  assert.equal(afterInvoice.brandPaidOn, null);
  assert.equal(afterInvoice.cutSentOn, null);
  assert.equal(afterInvoice.feeLabel, "$200 (20%)");
  assert.equal(afterInvoice.payoutLabel.includes("%"), false);

  const paid = await markPayment(db, {
    dealId: "phase9-pay",
    paymentStatus: "brand_paid",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(paid.ok, true);
  const afterBrand = creatorPayoutTracker((await getDealForViewer(db, mariclare, "phase9-pay"))?.payment ?? null);
  assert.match(afterBrand.brandPaidOn ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(afterBrand.cutSentOn, null);
  assert.equal(afterBrand.feeLabel, "$200 (20%)");

  assert.equal((await markPayment(db, {
    dealId: "phase9-pay",
    paymentStatus: "creator_payout_pending",
    actorEmail: admin.email,
    actorRole: "admin",
  })).ok, true);
  const pending = creatorPayoutTracker((await getDealForViewer(db, mariclare, "phase9-pay"))?.payment ?? null);
  assert.equal(pending.cutSentOn, null);
  assert.equal(pending.statusLabel, "Your payout is pending");

  assert.equal((await markPayment(db, {
    dealId: "phase9-pay",
    paymentStatus: "creator_paid",
    actorEmail: admin.email,
    actorRole: "admin",
  })).ok, true);
  const creatorDeal = await getDealForViewer(db, mariclare, "phase9-pay");
  const tracker = creatorPayoutTracker(creatorDeal?.payment ?? null);
  assert.match(tracker.cutSentOn ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(tracker.feeLabel, "$200 (20%)");
  assert.equal(tracker.statusLabel, "Paid");
  assert.equal(tracker.payoutLabel.includes("%"), false);
  assert.equal(JSON.stringify(creatorDeal).includes("Commission"), false);
  assert.equal((await getDealForViewer(db, admin, "phase9-pay"))?.workflowStage, "paid");

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("due dates remind three days ahead in the portal or the approval queue, and nothing is sent", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const created = await upsertDeal(db, {
    id: "phase10-dates",
    brand: "Phase10 Dates",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "draft_due",
    visibleToCreator: true,
  });
  assert.equal(created.status, 201);

  const creatorDate = await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "draft",
    dueOn: "2026-10-21",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorDate.ok, false);
  if (!creatorDate.ok) assert.equal(creatorDate.error, "You can't change due dates.");

  const managerDate = await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "draft",
    dueOn: "2026-10-21",
    actorEmail: "riley.manager@gmail.com",
    actorRole: "manager",
  });
  assert.equal(managerDate.ok, false);
  if (!managerDate.ok) assert.equal(managerDate.error, "That creator isn't on your list.");

  const bad = await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "draft",
    dueOn: "Oct 21",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(bad.ok, false);

  const draft = await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "draft",
    dueOn: "2026-10-21",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(draft.ok, true);
  if (draft.ok) assert.equal(draft.remindOn, "2026-10-18");
  assert.equal((await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "post",
    dueOn: "2026-10-20",
    actorEmail: admin.email,
    actorRole: "admin",
  })).ok, true);

  const portalNudge = await runDeliverableNudges(db, { today: "2026-10-18", channel: "portal", actorRole: "bot" });
  assert.equal(portalNudge.ok, true);
  if (!portalNudge.ok) return;
  assert.equal(portalNudge.nudged.length, 1);
  assert.equal(portalNudge.nudged[0]?.kind, "draft");
  assert.equal(portalNudge.nudged[0]?.channel, "portal");
  assert.equal(portalNudge.nudged[0]?.approvalId, null);
  const notices = await listUnreadCreatorNotices(db, "mariclare");
  const notice = notices.find((item) => item.dealId === "phase10-dates" && item.kind === "reminder");
  assert.equal(notice?.message, "Your draft for Phase10 Dates is due in 3 days, on 2026-10-21.");
  assert.equal(notice?.message.includes("@"), false);
  assert.equal(notice?.message.includes("$"), false);

  const again = await runDeliverableNudges(db, { today: "2026-10-18", channel: "portal", actorRole: "bot" });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.nudged.length, 0);

  const creatorRun = await runDeliverableNudges(db, { today: "2026-10-18", channel: "portal", actorRole: "creator" });
  assert.equal(creatorRun.ok, false);

  assert.equal((await saveDeliverableDate(db, {
    dealId: "phase10-dates",
    kind: "post",
    dueOn: "2026-10-21",
    actorEmail: admin.email,
    actorRole: "admin",
  })).ok, true);
  const queued = await runDeliverableNudges(db, { today: "2026-10-18", channel: "queue", actorRole: "bot" });
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  assert.equal(queued.nudged.length, 1);
  assert.equal(queued.nudged[0]?.kind, "post");
  const approvalId = queued.nudged[0]?.approvalId ?? "";
  const card = (await listApprovalQueue(db, "all")).find((row) => row.id === approvalId);
  assert.equal(card?.status, "pending");
  assert.equal(card?.gate, "reminder");
  assert.equal(card?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(card?.toEmail, mariclare.email);
  const sendable = await listApprovedApprovals(db);
  assert.equal(JSON.stringify(sendable).includes(approvalId), false);

  const off = await buildCalendarFeed(db, mariclare);
  assert.equal(off.ok, false);
  assert.equal((await setCalendarConnected(db, mariclare, true)).ok, true);
  const feed = await buildCalendarFeed(db, mariclare);
  assert.equal(feed.ok, true);
  if (!feed.ok) return;
  assert.equal(feed.body.includes("BEGIN:VCALENDAR"), true);
  assert.equal(feed.body.includes("DTSTART;VALUE=DATE:20261021"), true);
  assert.equal(feed.body.includes("Phase10 Dates"), true);
  assert.equal(feed.body.includes("@"), false);
  assert.equal(feed.body.includes("$"), false);
  const packed = JSON.stringify(await listCalendar(db, mariclare));
  assert.equal(packed.includes("phase10-dates"), true);
  assert.equal(packed.includes("@"), false);
  assert.equal(packed.includes("kosbling"), false);
  assert.equal((await listCalendar(db, admin)).some((item) => item.dealId === "kosbling"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("the brand list keeps contacts, responses, and screening notes, and hides rates from managers", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const created = await upsertDeal(db, {
    id: "phase11-soap",
    brand: "Phase11 Soap",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "offer_shared",
    visibleToCreator: true,
    contact: "Ada <ada@phase11.example>",
    rateCents: 150000,
    amountDisplay: "$1,500",
  });
  assert.equal(created.status, 201);
  await logOfferScreening(db, { dealId: "phase11-soap", actorEmail: admin.email, note: "Screened Phase11 Soap." });

  const managerWrite = await addBrandCrmEntry(db, {
    brand: "Phase11 Soap",
    kind: "response",
    response: "no_reply",
    note: "Waiting.",
    actorRole: "manager",
    actorName: "Riley",
  });
  assert.equal(managerWrite.ok, false);
  if (!managerWrite.ok) assert.equal(managerWrite.error, "Only an owner can update the brand list.");

  const added = await addBrandCrmEntry(db, {
    brand: "Phase11 Soap",
    kind: "response",
    response: "no_reply",
    note: "No reply yet.",
    actorRole: "admin",
    actorName: "Kamron",
  });
  assert.equal(added.ok, true);

  const ownerList = await listBrandCrm(db, admin);
  assert.equal(ownerList.ok, true);
  if (!ownerList.ok) return;
  const ownerCard = ownerList.brands.find((card) => card.brand === "Phase11 Soap");
  assert.equal(ownerCard?.deals[0]?.rateCents, 150000);
  assert.equal(ownerCard?.deals[0]?.amountDisplay, "$1,500");
  assert.equal(ownerCard?.contacts.some((contact) => contact.email === "ada@phase11.example"), true);
  assert.equal(ownerCard?.screenings.some((row) => row.note === "Screened Phase11 Soap."), true);
  assert.equal(ownerCard?.responses.some((row) => row.decision === "no_reply"), true);

  const hidden = await listBrandCrm(db, {
    email: "riley.manager@gmail.com",
    role: "manager",
    creatorId: null,
    name: "Riley",
    assignedCreatorIds: [],
  });
  assert.equal(hidden.ok, true);
  if (!hidden.ok) return;
  assert.equal(hidden.brands.some((card) => card.brand === "Phase11 Soap"), false);

  const managers = await listManagers(db);
  const riley = managers.find((manager) => manager.email === "riley.manager@gmail.com");
  assert.ok(riley);
  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: riley?.id ?? null,
    backupManagerId: null,
  })).ok, true);
  const managerList = await listBrandCrm(db, {
    email: "riley.manager@gmail.com",
    role: "manager",
    creatorId: null,
    name: "Riley",
    managerId: riley?.id,
    assignedCreatorIds: ["mariclare"],
  });
  assert.equal(managerList.ok, true);
  if (!managerList.ok) return;
  const managerCard = managerList.brands.find((card) => card.brand === "Phase11 Soap");
  assert.ok(managerCard);
  assert.equal(managerCard?.deals[0]?.rateCents, null);
  assert.equal(managerCard?.deals[0]?.amountDisplay, null);
  assert.equal(JSON.stringify(managerCard).includes("150000"), false);
  assert.equal(JSON.stringify(managerCard).includes("$1,500"), false);
  assert.equal(managerCard?.screenings.some((row) => row.note === "Screened Phase11 Soap."), true);

  const creatorList = await listBrandCrm(db, mariclare);
  assert.equal(creatorList.ok, false);
  if (!creatorList.ok) assert.equal(creatorList.error, "The brand list is for the team.");

  assert.equal((await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: "mariclare",
    primaryManagerId: null,
    backupManagerId: null,
  })).ok, true);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("usage rights flag a license nearing expiry and suggest a renewal sku", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  assert.equal(suggestUsageRenewal("2026-01-01", "2026-01-31").sku, "B-UA");
  assert.equal(suggestUsageRenewal("2026-01-01", "2026-04-01").sku, "B-UA90");
  assert.equal(suggestUsageRenewal("2026-01-01", "2027-01-01").sku, "B-UA12");
  assert.equal(suggestUsageRenewal("2026-01-01", null).sku, "B-UAP");
  assert.equal(usageFlag("2026-10-25", "2026-10-18"), "soon");
  assert.equal(usageFlag("2026-10-01", "2026-10-18"), "expired");
  assert.equal(usageFlag("2026-12-18", "2026-10-18"), null);
  assert.equal(usageFlag(null, "2026-10-18"), null);

  const created = await upsertDeal(db, {
    id: "phase12-usage",
    brand: "Phase12 Usage",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "draft_due",
    visibleToCreator: true,
  });
  assert.equal(created.status, 201);
  const blocked = await saveUsageRights(db, {
    dealId: "phase12-usage",
    startsOn: "2026-07-27",
    endsOn: "2026-10-25",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "You can't change usage rights.");
  const saved = await saveUsageRights(db, {
    dealId: "phase12-usage",
    startsOn: "2026-07-27",
    endsOn: "2026-10-25",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(saved.ok, true);
  const cards = await listUsageRights(db, mariclare, "2026-10-18");
  const card = cards.find((item) => item.dealId === "phase12-usage");
  assert.equal(card?.flag, "soon");
  assert.equal(card?.renewalSku, "B-UA90");
  assert.equal(JSON.stringify(card).includes("$"), false);
  assert.equal(cards.some((item) => item.dealId === "kosbling"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("a shared media kit shows hand-entered stats and hides pay, and Zernio stays off", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;

  try {
    assert.equal(zernioStatsEnabled(), false);
    assert.equal(await publicMediaKit(db, "mariclare"), null);
    const other = await saveMediaKit(db, { role: "creator", creatorId: "abby" }, {
      creatorId: "mariclare",
      published: true,
      displayName: "MariClare",
      bio: "Everyday life.",
      followers: "12000",
      avgViews: "4000",
      engagement: "3%",
      niches: "parenting, home",
    });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.error, "You can only edit your own media kit.");

    const saved = await saveMediaKit(db, mariclare, {
      creatorId: "mariclare",
      published: true,
      displayName: "MariClare",
      bio: "Everyday life.",
      followers: "12000",
      avgViews: "4000",
      engagement: "3%",
      niches: "parenting, home",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const kit = await publicMediaKit(db, saved.slug);
    assert.equal(kit?.displayName, "MariClare");
    assert.equal(kit?.followers, 12000);
    const packed = JSON.stringify(kit);
    assert.equal(packed.includes("@"), false);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.includes("rate"), false);
    assert.equal(fetchCalls, 0);
    const mine = await myMediaKit(db, mariclare);
    assert.equal(mine?.published, true);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ZERNIO_STATS_ENABLED;
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

test("a draft with a school, house number, location, or child's name is held for Kamron", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const caption = "Shot at Lincoln Elementary. My daughter Emma Johnson waves. We live at 123 Oak Street.";
  const locationTag = "Lincoln Park";
  const secrets = ["Emma Johnson", "Lincoln Elementary", "Lincoln Park", "123 Oak", "Oak Street"];

  assert.deepEqual(findSafetyKinds({ caption: "Unboxing on the counter." }), []);
  assert.deepEqual(
    findSafetyKinds({ filename: "v1-draft.mp4", caption, locationTag }).sort(),
    ["house", "location", "name", "school"],
  );

  const created = await upsertDeal(db, {
    id: "phase14-safety",
    brand: "Phase14 Soap",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "draft_due",
    visibleToCreator: true,
    uploadEnabled: true,
    contact: "hello@phase14.example",
  });
  assert.equal(created.status, 201);
  await insertDraft(db, {
    id: "phase14-v1",
    dealId: "phase14-safety",
    version: 1,
    filename: "v1-draft.mp4",
    mimeType: "video/mp4",
    sizeBytes: 800,
    uploadSessionUrl: "demo://local",
    driveFolderId: null,
    gmailThreadId: null,
    status: "uploading",
  });
  await recordDraftSafety(db, {
    draftId: "phase14-v1",
    dealId: "phase14-safety",
    filename: "v1-draft.mp4",
    caption,
    locationTag,
  });
  await recordDraftSafety(db, {
    draftId: "phase14-v1",
    dealId: "phase14-safety",
    filename: "v1-draft.mp4",
    caption,
    locationTag,
  });
  await markDraftProgress(db, "phase14-v1", { bytesReceived: 800, status: "new", driveFileId: "demo-not-uploaded", driveFileUrl: null });
  assert.equal((await onDraftSubmitted(db, "phase14-safety", { email: mariclare.email })).ok, true);

  const flagRows = await db.select().from(draftSafetyFlags).where(eq(draftSafetyFlags.draftId, "phase14-v1"));
  assert.equal(flagRows.length, 4);
  assert.deepEqual(flagRows.map((row) => row.kind).sort(), ["house", "location", "name", "school"]);
  const stored = JSON.stringify(flagRows);
  for (const secret of secrets) assert.equal(stored.includes(secret), false, secret);

  const deal = await getDealForViewer(db, admin, "phase14-safety");
  assert.equal(deal?.workflowStage, "draft_submitted");
  assert.deepEqual(deal?.drafts[0]?.safety.map((flag) => flag.kind).sort(), ["house", "location", "name", "school"]);
  const packedDeal = JSON.stringify(deal);
  for (const secret of secrets) assert.equal(packedDeal.includes(secret), false, secret);

  const creatorHolds = await listSafetyHolds(db, mariclare);
  assert.equal(creatorHolds.ok, false);
  if (!creatorHolds.ok) assert.equal(creatorHolds.error, "Safety holds are for the team.");
  const rileyLogin = await resolveLogin(db, "riley.manager@gmail.com");
  assert.equal(rileyLogin.ok, true);
  if (!rileyLogin.ok) return;
  const managerHolds = await listSafetyHolds(db, rileyLogin.viewer);
  assert.equal(managerHolds.ok, true);
  if (managerHolds.ok) assert.equal(managerHolds.holds.some((hold) => hold.dealId === "phase14-safety"), false);
  const ownerHolds = await listSafetyHolds(db, admin);
  assert.equal(ownerHolds.ok, true);
  if (!ownerHolds.ok) return;
  const hold = ownerHolds.holds.find((row) => row.draftId === "phase14-v1");
  assert.deepEqual(hold?.kinds.sort(), ["house", "location", "name", "school"]);
  const packedHolds = JSON.stringify(ownerHolds.holds);
  for (const secret of secrets) assert.equal(packedHolds.includes(secret), false, secret);

  const eventsBefore = deal?.stageEvents?.length ?? 0;
  const queueBefore = (await listApprovalQueue(db, "all")).filter((row) => row.dealId === "phase14-safety").length;
  const blocked = await reviewDraft(db, {
    draftId: "phase14-v1",
    decision: "approved",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.status, 409);
    assert.equal(blocked.error, "This draft is held for Kamron. Nothing was sent to the brand.");
  }
  const still = await getDealForViewer(db, admin, "phase14-safety");
  assert.equal(still?.workflowStage, "draft_submitted");
  assert.equal(still?.stageEvents?.length, eventsBefore);
  assert.equal(still?.drafts[0]?.status, "new");
  assert.equal(still?.drafts[0]?.review, null);
  assert.equal((await listApprovalQueue(db, "all")).filter((row) => row.dealId === "phase14-safety").length, queueBefore);

  const creatorClear = await clearSafetyHold(db, { draftId: "phase14-v1", actorEmail: mariclare.email, actorRole: "creator" });
  assert.equal(creatorClear.ok, false);
  if (!creatorClear.ok) assert.equal(creatorClear.error, "You can't clear a safety hold.");
  const managerClear = await clearSafetyHold(db, { draftId: "phase14-v1", actorEmail: rileyLogin.viewer.email, actorRole: "manager" });
  assert.equal(managerClear.ok, false);
  if (!managerClear.ok) assert.equal(managerClear.error, "Only Kamron can clear a safety hold.");
  assert.equal((await db.select().from(draftSafetyFlags).where(eq(draftSafetyFlags.draftId, "phase14-v1"))).every((row) => row.held), true);

  const cleared = await clearSafetyHold(db, { draftId: "phase14-v1", actorEmail: admin.email, actorRole: "admin" });
  assert.equal(cleared.ok, true);
  if (cleared.ok) assert.equal(cleared.cleared, 4);
  const approved = await reviewDraft(db, {
    draftId: "phase14-v1",
    decision: "approved",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(approved.ok, true);
  if (approved.ok) assert.ok(approved.approvalId);
  const after = await getDealForViewer(db, admin, "phase14-safety");
  assert.equal(after?.workflowStage, "manager_review");
  const queued = (await listApprovalQueue(db, "all")).find((row) => row.dealId === "phase14-safety" && row.gate === "video");
  assert.equal(queued?.status, "pending");
  assert.equal(queued?.fromEmail, "authentickambiz@gmail.com");
  for (const secret of secrets) assert.equal((queued?.body ?? "").includes(secret), false, secret);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("a monthly report is one page, and the email waits in the approval queue", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const created = await upsertDeal(db, {
    id: "phase15-report",
    brand: "Phase15 Soap",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "paid",
    visibleToCreator: true,
  });
  assert.equal(created.status, 201);
  const payment = await upsertPayment(db, {
    dealId: "phase15-report",
    creatorSplitPercent: 70,
    amountOwedCents: 100000,
    landedAmountCents: 100000,
    landedDate: "2026-10-02",
    paidOutDate: "2026-10-05",
    paymentStatus: "creator_paid",
  });
  assert.equal(payment.status, 201);
  await writeDailyAnalytics(db, {
    creatorId: "mariclare",
    date: "2026-10-01",
    platform: "instagram",
    followers: 1000,
    views: 400,
    example: false,
  });
  await writeDailyAnalytics(db, {
    creatorId: "mariclare",
    date: "2026-10-15",
    platform: "instagram",
    followers: 1100,
    views: 500,
    example: false,
  });

  const built = await buildMonthlyReport(db, "mariclare", "2026-10");
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const soap = built.report.earnings.dealsPaid.find((row) => row.brand === "Phase15 Soap");
  assert.equal(soap?.payoutLabel, "$800");
  assert.ok(built.report.earnings.paidCents >= 70000);
  assert.equal(built.report.deals.some((row) => row.brand === "Phase15 Soap"), true);
  assert.equal(built.report.growth.followers, 1100);
  assert.equal(built.report.growth.followerChange, 100);
  assert.equal(built.report.growth.views, 1900);
  const packed = JSON.stringify(built.report);
  assert.equal(packed.includes("Commission"), false);
  assert.equal(packed.includes("20%"), false);
  assert.equal(built.report.email.body.includes("Nothing has been sent."), true);
  assert.equal(built.report.email.subject, "Your October 2026 report");

  const creatorTry = await draftMonthlyReport(db, {
    creatorId: "mariclare",
    month: "2026-10",
    actorEmail: mariclare.email,
    actorRole: "creator",
  });
  assert.equal(creatorTry.ok, false);
  if (!creatorTry.ok) assert.equal(creatorTry.error, "Only Kamron can draft the monthly report.");
  const rileyLogin = await resolveLogin(db, "riley.manager@gmail.com");
  assert.equal(rileyLogin.ok, true);
  if (!rileyLogin.ok) return;
  const managerTry = await draftMonthlyReport(db, {
    creatorId: "mariclare",
    month: "2026-10",
    actorEmail: rileyLogin.viewer.email,
    actorRole: "manager",
  });
  assert.equal(managerTry.ok, false);
  if (!managerTry.ok) assert.equal(managerTry.error, "Only Kamron can draft the monthly report.");

  const drafted = await draftMonthlyReport(db, {
    creatorId: "mariclare",
    month: "2026-10",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(drafted.ok, true);
  if (!drafted.ok) return;
  const queue = await listApprovalQueue(db, "all");
  const queued = queue.find((row) => row.id === drafted.approvalId);
  assert.equal(queued?.status, "pending");
  assert.equal(queued?.gate, "report");
  assert.equal(queued?.fromEmail, "authentickambiz@gmail.com");
  assert.equal(queued?.toEmail, "mmaclamroc@gmail.com");
  assert.equal(queued?.body.includes("Phase15 Soap"), true);
  assert.equal(queued?.body.includes("$800"), true);
  assert.equal(queued?.body.includes("Nothing has been sent."), true);
  assert.equal((queued?.body ?? "").includes("Commission"), false);
  assert.equal((queued?.body ?? "").includes("20%"), false);

  const again = await draftMonthlyReport(db, {
    creatorId: "mariclare",
    month: "2026-10",
    actorEmail: admin.email,
    actorRole: "admin",
  });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error, "This month's report is already in the approval queue. Nothing was sent.");
  assert.equal((await listApprovalQueue(db, "all")).filter((row) => row.gate === "report").length, 1);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("a referral is tracked with a placeholder perk, and nothing is paid", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const paymentsBefore = (await db.select().from(payments)).length;
  const queueBefore = (await listApprovalQueue(db, "all")).length;
  delete process.env.REFERRAL_PERK_CENTS;
  assert.equal(await getReferralPerk(db), null);
  assert.equal(perkLabel(null), "Perk amount is not set.");
  assert.equal(REFERRAL_LAWYER_NOTE.includes("Nothing is paid automatically."), true);

  process.env.REFERRAL_PERK_CENTS = "2500";
  assert.equal(await getReferralPerk(db), 2500);
  const creatorPerk = await setReferralPerk(db, { amountCents: 5000, actorRole: "creator" });
  assert.equal(creatorPerk.ok, false);
  if (!creatorPerk.ok) assert.equal(creatorPerk.error, "Only Kamron can set the perk amount.");
  const saved = await setReferralPerk(db, { amountCents: 5000, actorRole: "admin" });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.label, "Placeholder perk: $50");
  assert.equal(await getReferralPerk(db), 5000);
  delete process.env.REFERRAL_PERK_CENTS;
  assert.equal(await getReferralPerk(db), 5000);

  const other = await recordReferral(db, {
    referrerCreatorId: "mariclare",
    referredName: "Nina Cole",
    referredEmail: "nina@phase16.example",
    actorEmail: abby.email,
    actorRole: "creator",
    actorCreatorId: "abby",
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.error, "You can only add a referral for yourself.");
  const bad = await recordReferral(db, {
    referrerCreatorId: "mariclare",
    referredName: "Nina Cole",
    referredEmail: "nina@example.invalid",
    actorEmail: mariclare.email,
    actorRole: "creator",
    actorCreatorId: "mariclare",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, "That email can't be saved.");
  const rileyLogin = await resolveLogin(db, "riley.manager@gmail.com");
  assert.equal(rileyLogin.ok, true);
  if (!rileyLogin.ok) return;
  const manager = await recordReferral(db, {
    referrerCreatorId: "mariclare",
    referredName: "Nina Cole",
    referredEmail: "nina@phase16.example",
    actorEmail: rileyLogin.viewer.email,
    actorRole: "manager",
    actorCreatorId: null,
  });
  assert.equal(manager.ok, false);
  if (!manager.ok) assert.equal(manager.error, "Referrals are for the creator and Kamron.");

  const added = await recordReferral(db, {
    referrerCreatorId: "mariclare",
    referredName: "Nina Cole",
    referredEmail: "nina@phase16.example",
    actorEmail: mariclare.email,
    actorRole: "creator",
    actorCreatorId: "mariclare",
  });
  assert.equal(added.ok, true);
  const listed = await listReferrals(db, "mariclare");
  assert.equal(listed.some((row) => row.referredName === "Nina Cole" && row.referredEmail === "nina@phase16.example"), true);
  const packed = JSON.stringify(listed);
  assert.equal(packed.includes("creator_paid"), false);
  assert.equal(packed.includes("paidOut"), false);
  assert.equal((await db.select().from(payments)).length, paymentsBefore);
  assert.equal((await listApprovalQueue(db, "all")).length, queueBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("home screen notices wait through quiet hours, and web push stays off", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  delete process.env.PUSH_ENABLED;

  try {
    assert.equal(inQuietHours(new Date("2026-10-18T12:00:00.000Z")), false);
    assert.equal(inQuietHours(new Date("2026-10-18T11:59:00.000Z")), true);
    assert.equal(inQuietHours(new Date("2026-10-19T01:00:00.000Z")), true);
    assert.equal(inQuietHours(new Date("2026-10-19T00:59:00.000Z")), false);
    assert.equal(pushEnabled(), false);

    const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    assert.equal(worker.includes("push"), true);
    assert.equal(worker.includes("notificationclick"), true);
    const manifest = readFileSync(new URL("../src/app/manifest.ts", import.meta.url), "utf8");
    assert.equal(manifest.includes('display: "standalone"'), true);
    assert.equal(manifest.includes("Momma Mari"), true);

    const bad = await queueHomeNotice(db, {
      email: mariclare.email,
      kind: "deal",
      title: "Nope",
      body: "Nope",
      now: new Date("2026-10-18T12:00:00.000Z"),
    });
    assert.equal(bad.ok, false);

    const morningOff = await queueHomeNotice(db, {
      email: mariclare.email,
      kind: "approval",
      title: "Email waiting",
      body: "A brand email is waiting for Kamron.",
      now: new Date("2026-10-18T12:00:00.000Z"),
    });
    assert.equal(morningOff.ok, true);
    if (morningOff.ok) assert.equal(morningOff.status, "off");
    assert.equal((await dueHomeNotices(db, mariclare.email)).length, 0);

    process.env.PUSH_ENABLED = "true";
    const night = await queueHomeNotice(db, {
      email: mariclare.email,
      kind: "mention",
      title: "Mention",
      body: "Someone mentioned you.",
      now: new Date("2026-10-19T01:00:00.000Z"),
    });
    assert.equal(night.ok, true);
    if (night.ok) assert.equal(night.status, "held");
    assert.equal((await dueHomeNotices(db, mariclare.email)).some((row) => row.kind === "mention"), false);

    const morning = await queueHomeNotice(db, {
      email: mariclare.email,
      kind: "reply",
      title: "Reply",
      body: "There is a reply.",
      now: new Date("2026-10-18T12:00:00.000Z"),
    });
    assert.equal(morning.ok, true);
    if (morning.ok) assert.equal(morning.status, "ready");
    const due = await dueHomeNotices(db, mariclare.email);
    assert.equal(due.some((row) => row.kind === "reply" && row.title === "Reply"), true);
    assert.equal(due.some((row) => row.kind === "mention"), false);
    const announcement = await queueHomeNotice(db, {
      email: admin.email,
      kind: "announcement",
      title: "Hello",
      body: "A note for the team.",
      now: new Date("2026-10-18T12:00:00.000Z"),
    });
    assert.equal(announcement.ok, true);
    assert.equal((await dueHomeNotices(db, mariclare.email)).some((row) => row.kind === "announcement"), false);
    assert.equal(fetchCalls, 0);
  } finally {
    delete process.env.PUSH_ENABLED;
    globalThis.fetch = originalFetch;
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

test("client fetches and plain links go through the base path", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/portal";
  try {
    assert.equal(withBasePath("/api/community/events"), "/portal/api/community/events");
    assert.equal(withBasePath("/"), "/portal/");
  } finally {
    if (previous == null) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }

  const misses: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".ts") || name.endsWith(".tsx")) scan(full);
    }
  }
  function scan(file: string) {
    const lines = readFileSync(file, "utf8").split("\n");
    const literal = /(`(?:\\`|[^`])*`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')/g;
    lines.forEach((line, index) => {
      if (line.includes("<Link")) return;
      literal.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = literal.exec(line))) {
        const body = match[1].slice(1, -1);
        if (!body.startsWith("/")) continue;
        const before = line.slice(0, match.index);
        if (/withBasePath\(\s*$/.test(before) || /publicBasePath\(\s*$/.test(before)) continue;
        if (/(?:fetch|href|src|register)\s*(?:=|\()\s*$/.test(before)) {
          misses.push(`${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`);
        }
      }
    });
  }
  walk(path.join(process.cwd(), "src"));
  assert.deepEqual(misses, []);
});

test("creator payout is the brand payment minus the 20% fee", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const even = feeAndPayout(100000);
  assert.equal(even.feeCents, 20000);
  assert.equal(even.payoutCents, 80000);
  assert.equal((even.feeCents ?? 0) + (even.payoutCents ?? 0), 100000);
  const odd = feeAndPayout(101);
  assert.equal((odd.feeCents ?? 0) + (odd.payoutCents ?? 0), 101);

  const created = await upsertDeal(db, {
    id: "review-payout",
    brand: "Review Payout",
    creatorId: "mariclare",
    status: "active",
    workflowStage: "paid",
    visibleToCreator: true,
  });
  assert.equal(created.status, 201);
  const payment = await upsertPayment(db, {
    dealId: "review-payout",
    creatorSplitPercent: 70,
    amountOwedCents: 100000,
    landedAmountCents: 100000,
  });
  assert.equal(payment.status, 201);
  if ("creatorPayoutCents" in payment.body && "creatorSplitPercent" in payment.body) {
    assert.equal(payment.body.creatorPayoutCents, 80000);
    assert.equal(payment.body.creatorSplitPercent, 80);
    assert.equal(20000 + payment.body.creatorPayoutCents, 100000);
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

test("the default timezone is Eastern", () => {
  const previous = process.env.AGENCY_TIMEZONE;
  delete process.env.AGENCY_TIMEZONE;
  try {
    assert.equal(agencyTimeZone(), "America/New_York");
  } finally {
    if (previous == null) delete process.env.AGENCY_TIMEZONE;
    else process.env.AGENCY_TIMEZONE = previous;
  }
});

test("the signature audit prefers Cloudflare's connecting IP", () => {
  const headers = (values: Record<string, string>) => ({
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  });
  assert.equal(requestClientIp(headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" })), "1.2.3.4");
  assert.equal(requestClientIp(headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" })), "8.8.8.8");
  assert.equal(requestClientIp(headers({ "x-real-ip": "7.7.7.7" })), "7.7.7.7");
  assert.equal(requestClientIp(headers({})), "unknown");
});

test("the questionnaire resumes, prefills her own profile, and scores a brand offer", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const choices = tagChoices(["parenting", "food"], ["food"], "toddler mom");
  assert.equal(choices.some((choice) => choice.add && choice.value === "toddler mom"), true);
  assert.equal(choices.some((choice) => choice.value === "food"), false);
  assert.equal(NICHE_CATALOG.length >= 200, true);
  const picker = readFileSync(path.join(process.cwd(), "src/components/tag-picker.tsx"), "utf8");
  assert.match(picker, /aria-activedescendant/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /Add "/);

  const blank: QuestionnaireAnswers = {
    niches: [],
    platforms: [],
    handles: {},
    audienceSize: "",
    audienceAge: "",
    genderSplit: "",
    locations: [],
    formats: [],
    frequency: "",
    rates: {},
    minVideo: "",
    typicalRate: "",
    maxSponsored: "",
    willDo: [],
    wontDo: [],
    acceptGifted: "",
    acceptCommissionOnly: "",
    brands: [],
    blocked: [],
    kidAges: [],
    kidsConfirm: false,
    onCamera: "",
    availability: "",
    turnaround: "",
    shipping: "",
    languages: [],
  };
  const high = matchOffer(
    { ...blank, niches: ["parenting"], platforms: ["TikTok"], brands: ["VEV"], languages: ["English"] },
    { brand: "VEV", subtitle: "parenting video" },
  );
  const blocked = matchOffer(
    { ...blank, niches: ["parenting"], platforms: ["TikTok"], brands: ["VEV"], blocked: ["VEV"], languages: ["English"] },
    { brand: "VEV", subtitle: "parenting video" },
  );
  assert.equal(high.score > blocked.score, true);
  assert.equal(blocked.score <= 12, true);
  assert.equal(blocked.reasons.some((reason) => reason.includes("no list")), true);
  assert.equal(JSON.stringify(high).includes("$"), false);

  assert.equal((await upsertCreator(db, { id: "quiz-guest", name: "Quiz Guest", email: "quiz.guest@gmail.com", initials: "QG" })).status, 201);
  const guest: Viewer = { email: "quiz.guest@gmail.com", name: "Quiz Guest", role: "creator", creatorId: "quiz-guest" };
  const noticesBefore = (await db.select().from(adminNotifications)).length;
  const approvalsBefore = (await db.select().from(approvalEmails)).length;

  const skipped = await saveQuestionnaireStep(db, guest, { step: "niches", skip: true, pause: false, patch: {} });
  assert.equal(skipped.ok, false);
  const emptyNiche = await saveQuestionnaireStep(db, guest, { step: "niches", skip: false, pause: false, patch: { niches: [] } });
  assert.equal(emptyNiche.ok, false);
  const saved = await saveQuestionnaireStep(db, guest, { step: "niches", skip: false, pause: false, patch: { niches: ["toddler mom", "food"] } });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.next, "platforms");
  const resumed = await questionnaireFor(db, "quiz-guest");
  assert.deepEqual(resumed.answers.niches, ["toddler mom", "food"]);
  assert.equal(resumed.step, "platforms");

  const kids = await saveQuestionnaireStep(db, guest, { step: "kids", skip: false, pause: false, patch: { kidAges: ["6–8"], kidsConfirm: false } });
  assert.equal(kids.ok, false);
  if (!kids.ok) assert.match(kids.error, /Confirm/);
  const skipKids = await saveQuestionnaireStep(db, guest, { step: "kids", skip: true, pause: false, patch: { kidAges: ["6–8"] } });
  assert.equal(skipKids.ok, true);
  const afterSkip = await questionnaireFor(db, "quiz-guest");
  assert.deepEqual(afterSkip.answers.niches, ["toddler mom", "food"]);
  assert.equal(afterSkip.answers.kidAges.length, 0);

  const profile = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "quiz-guest"));
  assert.equal(profile[0]?.nichesOn, false);
  assert.match(profile[0]?.niches ?? "", /toddler mom/);
  assert.equal(profile[0]?.formatsOn, false);
  assert.equal(profile[0]?.brandsOn, false);

  const custom = await saveMyProfile(db, guest, {
    creatorId: "quiz-guest",
    profileOn: false,
    displayName: "Quiz Guest",
    displayNameOn: false,
    avatarOn: false,
    bio: "",
    bioOn: false,
    niches: ["toddler mom"],
    nichesOn: false,
    handles: "",
    handlesOn: false,
    audience: "",
    audienceOn: false,
    formats: ["Photo diary"],
    formatsOn: false,
    askMe: "",
    askMeOn: false,
    collabs: false,
    collabsOn: false,
    state: "",
    stateOn: false,
    brands: "VEV $1200",
    brandsOn: false,
    childName: "",
    childAge: "",
    familyOn: false,
    familyConfirm: false,
    joinedOn: true,
  });
  assert.equal(custom.ok, true);
  const customRow = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "quiz-guest"));
  assert.match(customRow[0]?.niches ?? "", /toddler mom/);
  assert.match(customRow[0]?.formats ?? "", /Photo diary/);

  const staff = await saveQuestionnaireStep(db, admin, { step: "niches", skip: false, pause: false, patch: { niches: ["food"] } });
  assert.equal(staff.ok, false);
  const paused = await saveQuestionnaireStep(db, guest, { step: "platforms", skip: false, pause: true, patch: { platforms: ["TikTok"] } });
  assert.equal(paused.ok, true);
  if (paused.ok) assert.equal(paused.next, "home");
  assert.equal(await needsQuestionnaire(db, "quiz-guest"), false);
  const bot = await saveQuestionnaireStep(db, guest, { step: "bot", skip: false, pause: false, patch: {} });
  assert.equal(bot.ok, false);

  assert.equal((await db.select().from(adminNotifications)).length, noticesBefore);
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("offer screening respects floors, the profit guardrail, and who can see dollars", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const noticesBefore = (await db.select().from(adminNotifications)).length;
  const approvalsBefore = (await db.select().from(approvalEmails)).length;

  const rules: DealRules = {
    minRates: { tiktok: 50000 },
    targetRates: { tiktok: 80000 },
    minDealCents: 60000,
    blockedCategories: ["gambling"],
    blockedBrands: ["NopeBrand"],
    maxDealsPerMonth: 4,
    turnaround: "About a week",
    exclusivityMaxDays: 30,
    usageMinDays: 30,
    kidsOnCamera: "no",
    kidsLimits: "",
  };
  const blocked = screenOffer({
    rules,
    offer: { brand: "NopeBrand", amountCents: 200000, deliverables: ["1 TikTok"] },
    bestPastCents: null,
    nicheHit: false,
    openDeals: 0,
  });
  assert.equal(blocked.verdict, "blocked");
  assert.equal(blocked.fit <= 12, true);

  const below = screenOffer({
    rules,
    offer: { brand: "Kind", amountCents: 40000, deliverables: ["1 TikTok"], rush: true },
    bestPastCents: 90000,
    nicheHit: true,
    openDeals: 0,
    minProfitCents: 15000,
  });
  assert.equal(below.verdict, "below");
  assert.equal(below.suggestedAskCents, 110000);
  assert.equal((below.counterCents ?? 0) >= 60000, true);
  assert.equal(below.profitWarn, true);
  assert.equal(below.feeCents, 8000);

  const meets = screenOffer({
    rules,
    offer: { brand: "Kind", amountCents: 120000, deliverables: ["1 TikTok"] },
    bestPastCents: null,
    nicheHit: true,
    openDeals: 0,
    minProfitCents: 15000,
  });
  assert.equal(meets.verdict, "meets");
  assert.equal(meets.profitWarn, false);
  assert.equal(meets.suggestedAskCents, 80000);
  assert.equal(meets.feeCents, 24000);

  const ownerView = presentScreening(admin, below);
  assert.equal(ownerView.feeCents, 8000);
  assert.equal(ownerView.profitWarn, true);
  assert.equal(ownerView.suggestedAskCents, 110000);
  assert.match(ownerView.reasons.join(" "), /agency minimum/);

  const plainManager: Viewer = {
    email: "plain.manager@gmail.com",
    name: "Plain Manager",
    role: "manager",
    creatorId: null,
    permissions: { approveEmail: true, approveVideo: true, approveContract: false, countersign: false, canPriceDeals: false },
    assignedCreatorIds: ["abby"],
  };
  const hidden = presentScreening(plainManager, below);
  assert.equal(hidden.verdictLabel, "Below floor");
  assert.equal(hidden.suggestedAskCents, null);
  assert.equal(hidden.feeCents, null);
  assert.equal(hidden.profitWarn, false);
  assert.equal(JSON.stringify(hidden).includes("$"), false);
  assert.equal(JSON.stringify(hidden).includes("8000"), false);

  const pricedManager: Viewer = {
    ...plainManager,
    permissions: { ...plainManager.permissions!, canPriceDeals: true },
    assignedCreatorIds: ["quiz-guest"],
  };
  const priced = presentScreening(pricedManager, below);
  assert.equal(priced.suggestedAskCents, below.suggestedAskCents);
  assert.equal(priced.feeCents, null);
  assert.equal(priced.profitWarn, false);

  const denied = await saveDealRules(db, plainManager, "quiz-guest", rules);
  assert.equal(denied.ok, false);
  const allowed = await saveDealRules(db, pricedManager, "quiz-guest", rules);
  assert.equal(allowed.ok, true);

  const guest: Viewer = { email: "quiz.guest@gmail.com", name: "Quiz Guest", role: "creator", creatorId: "quiz-guest" };
  const rates = await saveQuestionnaireStep(db, guest, {
    step: "rates",
    skip: false,
    pause: false,
    patch: { rates: { TikTok: "400" } },
  });
  assert.equal(rates.ok, true);
  const brands = await saveQuestionnaireStep(db, guest, {
    step: "brands",
    skip: false,
    pause: false,
    patch: { brands: ["VEV"], blocked: ["NopeBrand"] },
  });
  assert.equal(brands.ok, true);
  const past = await upsertDeal(db, {
    id: "quiz-past-tiktok",
    brand: "Kind",
    creatorId: "quiz-guest",
    status: "active",
    workflowStage: "creator_interested",
    rateCents: 90000,
    deliverables: ["1 TikTok"],
    visibleToCreator: false,
  });
  assert.equal(past.status, 201);
  const prefilled = await prefillDealRules(db, "quiz-guest");
  assert.equal((prefilled.targetRates.tiktok ?? 0) >= 90000, true);
  assert.equal(prefilled.blockedBrands.includes("NopeBrand"), true);
  assert.equal(prefilled.minRates.tiktok, 40000);

  const floorDenied = await savePricingFloor(db, pricedManager, 20000);
  assert.equal(floorDenied.ok, false);
  const floorSaved = await savePricingFloor(db, admin, 20000);
  assert.equal(floorSaved.ok, true);

  assert.equal((await db.select().from(adminNotifications)).length, noticesBefore);
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("campaign matching keeps the roster first and outside offers stay in the queue", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const sentBefore = (await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length;

  const floor: DealRules = {
    minRates: { tiktok: 50000 },
    targetRates: { tiktok: 80000 },
    minDealCents: 60000,
    blockedCategories: [],
    blockedBrands: ["OutsideCo"],
    maxDealsPerMonth: 20,
    turnaround: "About a week",
    exclusivityMaxDays: 30,
    usageMinDays: 30,
    kidsOnCamera: "",
    kidsLimits: "",
  };
  const people = await db.select().from(creators);
  for (const person of people) {
    const saved = await saveDealRules(db, admin, person.id, floor);
    assert.equal(saved.ok, true);
  }

  const outside = await saveCampaign(db, admin, {
    brand: "OutsideCo",
    name: "Spring",
    budgetCents: 80000,
    niches: ["parenting"],
    platforms: ["TikTok"],
    deliverables: ["TikTok video"],
    slots: 1,
  });
  assert.equal(outside.ok, true);
  if (!outside.ok) return;
  const outsideRank = await rankRoster(db, (await listCampaigns(db)).find((row) => row.id === outside.id)!);
  assert.equal(outsideRank.every((row) => row.verdict === "blocked" && row.score <= 12), true);
  assert.equal(rosterHasAFit(outsideRank), false);
  assert.equal((await markOpenOutside(db, admin, outside.id)).ok, true);

  const kind = await saveCampaign(db, admin, {
    brand: "Kind Soap",
    name: "Fall",
    budgetCents: 200000,
    niches: ["parenting"],
    platforms: ["TikTok"],
    deliverables: ["TikTok video"],
    slots: 3,
  });
  assert.equal(kind.ok, true);
  if (!kind.ok) return;
  const kindCampaign = (await listCampaigns(db, { niche: "parenting", platform: "TikTok", minBudgetCents: 150000 })).find((row) => row.id === kind.id);
  assert.equal(Boolean(kindCampaign), true);
  assert.equal((await listCampaigns(db, { niche: "underwater basket" })).some((row) => row.id === kind.id), false);
  const kindRank = await rankRoster(db, kindCampaign!);
  assert.equal(kindRank[0]?.verdict, "meets");
  assert.equal(kindRank[0]?.score >= 45, true);
  assert.equal(rosterHasAFit(kindRank), true);
  assert.equal((await markOpenOutside(db, admin, kind.id)).ok, false);

  assert.equal(projectedCommission([80000, 40000]), 24000);
  const first = await allocateCampaign(db, admin, { campaignId: kind.id, creatorId: "mariclare", amountCents: 80000 });
  const second = await allocateCampaign(db, admin, { campaignId: kind.id, creatorId: "abby", amountCents: 40000 });
  assert.equal(first.ok && second.ok, true);
  if (first.ok) assert.equal(first.commissionCents, 16000);
  if (second.ok) assert.equal(second.commissionCents, 24000);
  const over = await allocateCampaign(db, admin, { campaignId: kind.id, creatorId: "authentickam", amountCents: 90000 });
  assert.equal(over.ok, false);

  const plainManager: Viewer = {
    email: "plain.manager@gmail.com",
    name: "Plain Manager",
    role: "manager",
    creatorId: null,
    permissions: { approveEmail: true, approveVideo: true, approveContract: false, countersign: false, canPriceDeals: false },
  };
  assert.equal(canSeeCommission(plainManager), false);
  assert.equal(canSeeCommission(admin), true);
  assert.equal((await saveCampaign(db, plainManager, { brand: "Nope", name: "Nope", budgetCents: 100, niches: [], platforms: [], deliverables: [], slots: 1 })).ok, false);
  assert.equal((await ownerDashboard(db, plainManager)).ok, false);

  const before = await ownerDashboard(db, admin, new Date("2026-10-19T16:00:00.000Z"));
  assert.equal(before.ok, true);
  if (!before.ok) return;
  assert.equal((await upsertDeal(db, {
    id: "dash-oct",
    brand: "Dash October",
    creatorId: "quiz-guest",
    status: "active",
    workflowStage: "creator_interested",
    rateCents: 100000,
    postDate: "2026-10-20",
    visibleToCreator: false,
  })).status, 201);
  assert.equal((await upsertDeal(db, {
    id: "dash-nov",
    brand: "Dash November",
    creatorId: "quiz-guest",
    status: "active",
    workflowStage: "creator_interested",
    rateCents: 50000,
    postDate: "2026-11-05",
    visibleToCreator: false,
  })).status, 201);
  const after = await ownerDashboard(db, admin, new Date("2026-10-19T16:00:00.000Z"));
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.commissionThisMonth - before.commissionThisMonth, 20000);
  assert.equal(after.commissionNextMonth - before.commissionNextMonth, 10000);
  assert.equal(after.winRate, after.won / (after.won + after.lost));
  assert.equal(after.pipeline.some((row) => row.stage === "creator_interested" && row.cents > 0), true);
  assert.equal(after.unfilledSlots >= 1, true);
  assert.equal(after.utilization.some((row) => row.maxDeals === 20), true);

  const early = await queueOutsideOffer(db, admin, { campaignId: kind.id, prospectId: "missing", amountCents: 10000 });
  assert.equal(early.ok, false);
  const prospect = await addProspect(db, admin, { name: "New Creator", email: "new.creator@gmail.com", niches: ["parenting"], notes: "From Kash Bot" });
  assert.equal(prospect.ok, true);
  if (!prospect.ok) return;
  const queued = await queueOutsideOffer(db, admin, { campaignId: outside.id, prospectId: prospect.id, amountCents: 70000 });
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const draft = (await db.select().from(approvalEmails)).find((row) => row.id === queued.approvalId);
  assert.equal(draft?.status, "pending");
  assert.equal(draft?.sentAt ?? null, null);
  assert.equal(draft?.fromEmail, "authentickambiz@gmail.com");
  const queue = await listApprovalQueue(db, "all");
  assert.equal(queue.some((row) => row.id === queued.approvalId && row.status === "pending" && row.brand === "OutsideCo"), true);
  assert.equal((await listApprovalQueue(db, "mariclare")).some((row) => row.id === queued.approvalId), false);
  const converted = await convertProspect(db, admin, prospect.id, "quiz-guest");
  assert.equal(converted.ok, true);
  assert.equal((await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length, sentBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("owner ranks drive campaign priority, pods stay private, and reinvestment is tracking only", async () => {
  const paymentsBefore = (await db.select().from(payments)).length;
  const sentBefore = (await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length;
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length;

  const weights = defaultWeights();
  const low = compositeScore({ ...emptyInputs(), engagement: 1, averageViews: 1000, followers: 1000, completion: 20, onTime: 20, revisions: 8, rehire: 10, response: 40 }, weights);
  const high = compositeScore(
    { ...emptyInputs(), audienceGrowth: 40, engagement: 10, averageViews: 100000, followers: 1000000, completion: 100, onTime: 100, rehire: 100, revenue: 1000000, community: 20, collabs: 8 },
    weights,
  );
  assert.ok(high.score > low.score);
  assert.ok(high.score <= 100 && low.score >= 0);
  assert.equal(tierFor(high.score), "Platinum");
  assert.equal(tierFor(70), "Gold");
  assert.equal(tierFor(50), "Silver");
  assert.equal(tierFor(49), "Bronze");
  assert.equal(collabLift([{ followers: 100, collabPosts: 0 }, { followers: 110, collabPosts: 0 }, { followers: 200, collabPosts: 3 }]), 80);

  const manager: Viewer = { role: "manager", email: "casey.manager@gmail.com", name: "Casey", creatorId: null, managerId: "not-a-real-manager" };
  assert.equal((await saveRankSettings(db, manager, weights, "weekly")).ok, false);
  assert.equal((await refreshRanks(db, manager, new Date("2026-10-19T16:00:00Z"))).ok, false);
  assert.equal((await leaderboard(db, manager)).ok, false);
  assert.equal((await saveRankSettings(db, admin, weights, "daily")).ok, true);
  const mariRules = await rulesFor(db, "mariclare");
  assert.equal((await saveDealRules(db, admin, "mariclare", { ...mariRules, blockedBrands: [...mariRules.blockedBrands, "Rank Soap"] })).ok, true);
  assert.equal((await saveRankInputs(db, admin, "abby", { ...emptyInputs(), engagement: 9, followers: 120000, completion: 90, onTime: 90, rehire: 80, revenue: 500000 })).ok, true);
  assert.equal((await saveRankInputs(db, admin, "authentickam", { ...emptyInputs(), engagement: 2, followers: 8000, completion: 40, onTime: 40 })).ok, true);
  assert.equal((await saveRankInputs(db, admin, "mariclare", { ...emptyInputs(), audienceGrowth: 40, engagement: 10, averageViews: 100000, followers: 900000, completion: 100, onTime: 100, rehire: 100, revenue: 1000000, community: 20, collabs: 8 })).ok, true);
  const first = await refreshRanks(db, admin, new Date("2026-10-19T16:00:00Z"));
  assert.equal(first.ok, true);
  const second = await refreshRanks(db, admin, new Date("2026-10-19T20:00:00Z"));
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.created, false);
  const nextDay = await refreshRanks(db, admin, new Date("2026-10-20T16:00:00Z"));
  assert.equal(nextDay.ok, true);
  if (nextDay.ok) assert.equal(nextDay.created, true);

  const saved = await saveCampaign(db, admin, {
    brand: "Rank Soap",
    name: "Ranked slots",
    budgetCents: 200000,
    niches: ["parenting"],
    platforms: ["TikTok"],
    deliverables: ["TikTok"],
    slots: 1,
    startsOn: "2026-12-01",
    endsOn: "2026-12-20",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const campaign = await campaignById(db, saved.id);
  assert.ok(campaign);
  const ranked = await rankRoster(db, campaign!);
  const abbyRow = ranked.find((row) => row.creatorId === "abby");
  const kam = ranked.find((row) => row.creatorId === "authentickam");
  const mari = ranked.find((row) => row.creatorId === "mariclare");
  assert.ok(abbyRow && kam && mari);
  assert.equal(mari?.verdict, "blocked");
  assert.notEqual(abbyRow?.verdict, "blocked");
  assert.ok((mari?.rosterScore ?? 0) > (abbyRow?.rosterScore ?? 0));
  assert.ok(ranked.indexOf(abbyRow!) < ranked.indexOf(mari!));
  assert.ok((abbyRow?.rosterScore ?? 0) > (kam?.rosterScore ?? 0));
  if (abbyRow?.verdict === kam?.verdict) assert.ok(ranked.indexOf(abbyRow) < ranked.indexOf(kam!));
  const hidden = presentRoster(manager, ranked);
  assert.equal(hidden[0]?.rosterRank, null);
  assert.equal(hidden[0]?.rosterScore, 0);
  assert.ok((presentRoster(admin, ranked).find((row) => row.creatorId === "abby")?.rosterRank ?? 0) >= 1);

  const choices = { breakdown: true, strengths: true, improve: false, trend: true, averages: false, contributors: false, collabs: false };
  assert.equal((await createRankReport(db, manager, { level: "creator", subjectId: "abby", choices, showRanks: true })).ok, false);
  const quiet = await createRankReport(db, admin, { level: "creator", subjectId: "abby", choices, showRanks: false });
  assert.equal(quiet.ok, true);
  if (!quiet.ok) return;
  const shared = await sharedReport(db, quiet.token);
  const lines = (shared?.sections ?? []).flatMap((section) => section.lines).join(" ");
  assert.equal(/\bScore \d|\bRank \d/.test(lines), false);
  const loud = await createRankReport(db, admin, { level: "creator", subjectId: "abby", choices: { ...choices, trend: false }, showRanks: true });
  assert.equal(loud.ok, true);
  if (!loud.ok) return;
  assert.match((await sharedReport(db, loud.token))?.sections.flatMap((section) => section.lines).join(" ") ?? "", /Score /);
  const bytes = await reportPdf({ title: "Abby snapshot", sections: shared?.sections ?? [] });
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), "%PDF");

  assert.equal((await suggestPods(db, manager)).ok, false);
  const lead = await addManager(db, { actorRole: "admin", name: "Pod Lead", email: "pod.lead@gmail.com" });
  assert.equal(lead.ok, true);
  if (!lead.ok) return;
  const pod = await savePod(db, admin, { name: "Parenting micro", managerId: lead.id, niche: "parenting", sizeBand: "micro", creatorIds: ["abby"] });
  assert.equal(pod.ok, true);
  if (!pod.ok) return;
  const otherManager: Viewer = { ...manager, managerId: "someone-else", email: "other.manager@gmail.com" };
  assert.equal(await podById(db, otherManager, pod.id), null);
  const leadViewer: Viewer = { role: "manager", email: "pod.lead@gmail.com", name: "Pod Lead", creatorId: null, managerId: lead.id };
  assert.ok(await podById(db, leadViewer, pod.id));
  const creator: Viewer = { role: "creator", email: "theofficialtheriots@gmail.com", name: "Abby", creatorId: "abby", managerId: null };
  const idea = await addCollab(db, creator, { podId: pod.id, title: "Duet the unboxing", body: "Joint video" });
  assert.equal(idea.ok, true);
  if (!idea.ok) return;
  const creatorPair = await pairCollab(db, creator, idea.id, "mariclare");
  assert.equal(creatorPair.ok, false);
  if (!creatorPair.ok) assert.match(creatorPair.error, /manager pairs/);
  assert.equal((await pairCollab(db, leadViewer, idea.id, "mariclare")).ok, false);

  const mariActor = { email: mariclare.email, name: "MariClare", role: "creator", creatorId: "mariclare" };
  const listed = await listCommunity(db, mariActor, null);
  assert.equal(listed.ok, true);
  if (listed.ok && !listed.unchanged) assert.equal(listed.channels.some((channel) => channel.kind === "pod"), false);
  const posted = await postCommunityMessage(db, mariActor, { channelId: `pod-${pod.id}`, body: "Can I join this room?" });
  assert.equal(posted.ok, false);
  if (!posted.ok) {
    assert.equal(posted.status, 403);
    assert.equal(posted.error, "That room is private.");
  }
  const abbyCreator = await findCreatorById(db, "abby");
  const memberPost = await postCommunityMessage(db, { email: abbyCreator?.email ?? "", name: "Abby", role: "creator", creatorId: "abby" }, { channelId: `pod-${pod.id}`, body: "Hello from the pod" });
  assert.equal(memberPost.ok, true);

  assert.equal((await addReinvestment(db, manager, { month: "2026-10", category: "tools", amountCents: 5000 })).ok, false);
  assert.equal((await addReinvestment(db, admin, { month: "2026-10", category: "tools", amountCents: 7000, note: "Editing app" })).ok, true);
  const summary = await reinvestmentSummary(db, admin, "2026-10");
  assert.equal(summary.ok, true);
  if (summary.ok) {
    assert.equal(summary.placeholder, true);
    assert.equal(summary.byCategory.find((row) => row.id === "tools")?.cents, 7000);
    assert.ok(summary.commissionCents >= 20000);
    assert.match(summary.label, /Nothing is moved/);
  }
  assert.equal((await db.select().from(payments)).length, paymentsBefore);
  assert.equal((await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length, sentBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("platform floors, the sponsor block, and the free bench", async () => {
  const paymentsBefore = (await db.select().from(payments)).length;
  const sentBefore = (await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length;
  const approvalsBefore = (await db.select().from(approvalEmails)).length;
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length;

  assert.equal(deliverableKind("1 TikTok"), "tiktok");
  assert.equal(deliverableKind("Stream segment"), "stream");
  assert.equal(deliverableKind("Viewer-hour"), "viewer_hour");
  assert.equal(deliverableKind("Dedicated YouTube video"), "youtube_dedicated");
  assert.equal(deliverableKind("Podcast pre-roll"), "podcast_pre");
  assert.equal(deliverableKind("Host-read"), "podcast_host");
  assert.equal(deliverableKind("LinkedIn post"), "linkedin");
  assert.equal(deliverableKind("Newsletter placement"), "newsletter");
  assert.equal(quotedAskCents("viewer_hour", 100, { viewers: 50, hours: 2 }), 10000);
  assert.equal(quotedAskCents("stream", 5000, { hours: 3 }), 15000);
  assert.equal(quotedAskCents("podcast_host", 2500, { downloads: 10000 }), 25000);
  assert.equal(feeAndPayout(100000).feeCents, 20000);
  assert.equal(NICHE_CATALOG.includes("gaming") && NICHE_CATALOG.includes("podcast") && NICHE_CATALOG.includes("ugc"), true);
  assert.equal(PLATFORM_OPTIONS.includes("Twitch") && PLATFORM_OPTIONS.includes("LinkedIn") && PLATFORM_OPTIONS.includes("Newsletter"), true);
  assert.deepEqual(MEDIA_KIT_CATALOG.map((item) => item.priceLabel), ["$179", "$99", "$229"]);

  const openRules: DealRules = {
    minRates: { tiktok: 50000, podcast_host: 2500, viewer_hour: 80 },
    targetRates: { podcast_host: 2500, viewer_hour: 80 },
    minDealCents: null,
    blockedCategories: [],
    blockedBrands: [],
    maxDealsPerMonth: null,
    turnaround: "",
    exclusivityMaxDays: null,
    usageMinDays: null,
    kidsOnCamera: "",
    kidsLimits: "",
  };
  const slots = screenOffer({
    rules: openRules,
    offer: { brand: "Lucky Slots", amountCents: 90000, deliverables: ["1 TikTok"] },
    bestPastCents: null,
    nicheHit: false,
    openDeals: 0,
  });
  assert.equal(slots.verdict, "blocked");
  assert.match(slots.reasons.join(" "), /Gambling/);
  const allowed = screenOffer({
    rules: openRules,
    offer: { brand: "Lucky Slots", amountCents: 90000, deliverables: ["1 TikTok"] },
    bestPastCents: null,
    nicheHit: false,
    openDeals: 0,
    categoryOverride: true,
  });
  assert.equal(allowed.verdict, "meets");
  assert.equal(allowed.categoryWarn, true);
  const podcast = screenOffer({
    rules: openRules,
    offer: { brand: "Kind Soap", amountCents: 10000, deliverables: ["Host-read"], downloads: 10000 },
    bestPastCents: null,
    nicheHit: false,
    openDeals: 0,
  });
  assert.equal(podcast.verdict, "below");
  assert.equal(podcast.feeCents, 2000);
  const stream = screenOffer({
    rules: openRules,
    offer: { brand: "Kind Soap", amountCents: 20000, deliverables: ["Viewer-hour"], viewers: 100, hours: 2 },
    bestPastCents: null,
    nicheHit: false,
    openDeals: 0,
  });
  assert.equal(stream.verdict, "meets");
  assert.equal(stream.feeCents, 4000);

  const manager: Viewer = { role: "manager", email: "casey.manager@gmail.com", name: "Casey", creatorId: null, managerId: "not-a-real-manager" };
  assert.equal((await setCategoryOverride(db, manager, "kosbling", true)).ok, false);
  assert.equal((await upsertDeal(db, {
    id: "bench-slots",
    brand: "Lucky Slots",
    creatorId: "quiz-guest",
    status: "active",
    workflowStage: "offer_received",
    rateCents: 80000,
    deliverables: ["1 TikTok"],
    visibleToCreator: false,
  })).status, 201);
  assert.equal((await setCategoryOverride(db, admin, "bench-slots", true)).ok, true);

  const savedKit = await saveMediaKit(db, mariclare, {
    creatorId: "mariclare",
    published: true,
    displayName: "MariClare",
    bio: "Everyday life.",
    followers: "12000",
    avgViews: "4000",
    engagement: "3%",
    niches: "parenting, gaming",
    platforms: [{ platform: "Twitch", metric: "Average concurrent viewers", value: "140" }],
  });
  assert.equal(savedKit.ok, true);
  if (!savedKit.ok) return;
  const kit = await publicMediaKit(db, savedKit.slug);
  const packed = JSON.stringify(kit);
  assert.equal(packed.includes("Average concurrent viewers"), true);
  assert.equal(packed.includes("$"), false);
  assert.equal(packed.includes("rate"), false);

  assert.equal((await joinBench(db, { name: "Nope", email: "someone@example.invalid", niches: ["ugc"], platforms: ["TikTok"], samples: [] })).ok, false);
  const joined = await joinBench(db, {
    name: "Bench Bea",
    email: "bench.bea@gmail.com",
    niches: ["ugc"],
    platforms: ["TikTok"],
    samples: [{ title: "Kitchen unboxing", url: "https://example.com/sample" }],
  });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal((await db.select().from(payments)).length, paymentsBefore);
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
  assert.equal((await setBenchScore(db, manager, joined.id, 80)).ok, false);
  assert.equal(benchPromotionSuggested(40), false);
  assert.equal((await setBenchScore(db, admin, joined.id, 82)).ok, true);
  assert.equal(benchPromotionSuggested(82), true);

  const fitting = await saveCampaign(db, admin, {
    brand: "Kind Soap",
    name: "Roster still fits",
    budgetCents: 200000,
    niches: [],
    platforms: ["TikTok"],
    deliverables: ["TikTok"],
    slots: 1,
    startsOn: "2026-12-01",
    endsOn: "2026-12-20",
  });
  assert.equal(fitting.ok, true);
  if (!fitting.ok) return;
  assert.match((await queueBenchOffer(db, admin, { campaignId: fitting.id, benchId: joined.id, amountCents: 8000 })).error ?? "", /roster/);

  const leftover = await saveCampaign(db, admin, {
    brand: "Bench Soap",
    name: "Passed by the roster",
    budgetCents: 10000,
    niches: [],
    platforms: ["TikTok"],
    deliverables: ["TikTok"],
    slots: 1,
    startsOn: "2026-12-01",
    endsOn: "2026-12-20",
  });
  assert.equal(leftover.ok, true);
  if (!leftover.ok) return;
  const queued = await queueBenchOffer(db, admin, { campaignId: leftover.id, benchId: joined.id, amountCents: 8000 });
  assert.equal(queued.ok, true);
  if (!queued.ok) return;
  const draft = (await db.select().from(approvalEmails)).find((row) => row.id === queued.approvalId);
  assert.equal(draft?.status, "pending");
  assert.equal(draft?.sentAt ?? null, null);
  assert.equal((await recordBenchPaid(db, admin, queued.id)).ok, false);
  assert.equal((await approveBenchOffer(db, admin, queued.id)).ok, true);
  assert.equal((await db.select().from(approvalEmails)).find((row) => row.id === queued.approvalId)?.status, "pending");
  const paid = await recordBenchPaid(db, admin, queued.id);
  assert.equal(paid.ok, true);
  if (paid.ok) assert.equal(paid.feeCents, 1600);
  assert.equal((await db.select().from(payments)).length, paymentsBefore);
  assert.equal((await db.select().from(approvalEmails)).filter((row) => row.status === "sent").length, sentBefore);

  assert.equal((await promoteBench(db, manager, joined.id, "abby")).ok, false);
  assert.equal((await promoteBench(db, admin, joined.id, "abby")).ok, true);
  const portfolio = await publicBenchPortfolio(db, (await listBench(db, admin)).find((person) => person.id === joined.id)?.slug ?? "");
  assert.equal(portfolio?.samples[0]?.title, "Kitchen unboxing");
  assert.equal(JSON.stringify(portfolio).includes("@"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("the creator menu, home cards, and billing stay on her own sign-in", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  assert.equal(firstName("Abby Theriot"), "Abby");
  assert.equal(firstName("MariClare"), "MariClare");
  assert.deepEqual(accountMenuItems("creator").map((item) => item.label), ["My profile", "Referrals", "Support", "Settings", "Billing and usage"]);
  assert.equal(accountMenuItems("manager").some((item) => item.label === "Billing and usage" || item.label === "My profile"), false);
  assert.equal(accountMenuItems("admin").some((item) => item.href === "/referrals"), true);
  assert.equal(isMenuTab("profile"), true);
  assert.equal(isMenuTab("referrals"), true);
  assert.equal(isMenuTab("deals"), false);
  const cards = creatorHomeCards({ offersWaiting: 2, payoutsPending: 1, accountsConnected: false });
  assert.equal(cards.find((card) => card.title === "Brand deals")?.status, "2 offers waiting");
  assert.equal(cards.find((card) => card.title === "Earnings & payouts")?.status, "1 payout pending");
  assert.equal(cards.find((card) => card.title === "Analytics")?.status, "Example numbers until accounts are connected");
  assert.equal(billingUsage({ tier: "Basic", used: 120 }).warning, "80");
  assert.equal(billingUsage({ tier: "Basic", used: 120 }).cap, 150);
  assert.equal(billingUsage({ tier: "Basic", used: 150 }).warning, "100");
  assert.equal(billingUsage({ tier: "Plus", used: 10 }).cap, 1000);
  assert.equal(billingUsage({ tier: "Pro", used: 10 }).cap, 2500);
  assert.equal(billingWarning("80"), "You've used 80% of your AI credits.");
  assert.equal(billingWarning("100"), "You've used all of your AI credits for this tier.");

  const queueBefore = (await db.select().from(approvalEmails)).length;
  const sent = await submitSupportMessage(db, mariclare, { subject: "Need a hand", body: "The upload button is confusing." });
  assert.equal(sent.ok, true);
  assert.equal((await db.select().from(approvalEmails)).length, queueBefore);
  assert.equal((await listSupportMessages(db, mariclare)).some((note) => note.subject === "Need a hand" && note.authorName === "You"), true);
  assert.equal((await listSupportMessages(db, abby)).some((note) => note.subject === "Need a hand"), false);
  assert.equal((await listSupportMessages(db, admin)).some((note) => note.subject === "Need a hand" && note.authorName === "MariClare"), true);

  const saved = await saveOwnSettings(db, mariclare, { emailNotices: false, pushNotices: true, quietHours: true, communityVisible: false });
  assert.equal(saved.ok, true);
  const mine = await readOwnAccount(db, mariclare);
  assert.equal(mine?.emailNotices, false);
  assert.equal(mine?.pushNotices, true);
  assert.equal(mine?.plan, "Core");
  assert.equal(mine?.stripe, false);
  await db.update(creatorAccounts).set({ aiCreditsUsed: 120, aiTier: "Basic" }).where(eq(creatorAccounts.creatorId, "mariclare"));
  const warned = await readOwnAccount(db, mariclare);
  assert.equal((warned?.usage.percent ?? 0) >= 80, true);
  assert.equal(warned?.warning, "You've used 80% of your AI credits.");
  const other = await readOwnAccount(db, abby);
  assert.equal(other?.emailNotices, true);
  assert.equal(other?.usage.used, 0);
  assert.equal(await readOwnAccount(db, admin), null);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("chat still posts when photo storage is missing, and the home screen button follows the device", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const actor = { email: admin.email, name: admin.name, role: "admin" as const, creatorId: null };
  setCommunityPhotoStoreForTests(null);
  try {
    const blocked = await saveCommunityPhoto(db, actor, {
      bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
      childFace: false,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error, PHOTOS_OFF);
    const posted = await postCommunityMessage(db, actor, { channelId: "everyone", body: "Text still works without photos." });
    assert.equal(posted.ok, true);
    const listed = await listCommunity(db, actor, null);
    assert.equal(listed.ok, true);
    if (listed.ok && !listed.unchanged) {
      assert.equal(listed.photosEnabled, false);
      assert.equal(listed.messages.some((message) => message.body === "Text still works without photos."), true);
    }
    const missing = communityFailure(new Error("D1_ERROR: no such table: community_messages"));
    assert.equal(missing.status, 503);
    const body = await missing.json() as { error?: string };
    assert.equal(body.error, "Community chat isn't set up on this database yet.");

    assert.equal(homeScreenOffer({ installed: true, ios: true, canPrompt: true }), "installed");
    assert.equal(homeScreenOffer({ installed: false, ios: true, canPrompt: false }), "ios");
    assert.equal(homeScreenOffer({ installed: false, ios: false, canPrompt: true }), "install");
    assert.equal(homeScreenOffer({ installed: false, ios: false, canPrompt: false }), "waiting");
    assert.equal(isIosHomeScreen("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
    assert.equal(isIosHomeScreen("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), false);
    const screen = readFileSync(new URL("../src/components/home-screen.tsx", import.meta.url), "utf8");
    assert.equal(screen.includes("beforeinstallprompt"), true);
    assert.equal(screen.includes("Add to Home Screen"), true);
    assert.equal(screen.includes("tap Share, then Add to Home Screen"), true);
  } finally {
    setCommunityPhotoStoreForTests(undefined);
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

test("July snapshots fill analytics, stay off other creators, and feed rank scores", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const file = JSON.parse(readFileSync(path.join(process.cwd(), "data/analytics-snapshots.json"), "utf8"));
  assert.equal(file.capturedOn, "2026-10-19");
  assert.equal(file.source, "July");
  const abbyIg = file.creators.find((creator: { creatorId: string }) => creator.creatorId === "abby").snapshots.find((row: { platform: string }) => row.platform === "Instagram");
  assert.equal(abbyIg.metrics.saves, null);
  assert.equal(Object.hasOwn(abbyIg.metrics, "comments"), false);
  assert.equal(Object.hasOwn(abbyIg.metrics, "avgStoryViews"), false);
  const twitch = file.creators.find((creator: { creatorId: string }) => creator.creatorId === "mariclare").snapshots.find((row: { platform: string }) => row.platform === "Twitch");
  assert.deepEqual(twitch.metrics, { followers: "462" });
  assert.equal(twitch.period, "Past 90d");
  const tiktok = file.creators.find((creator: { creatorId: string }) => creator.creatorId === "mariclare").snapshots.find((row: { platform: string }) => row.platform === "TikTok");
  assert.equal(tiktok.period, undefined);
  assert.equal(tiktok.metrics.followers, "2.3m");
  assert.equal(parseDisplayedCount("326k"), 326000);
  assert.equal(parseDisplayedCount("2,643,404"), 2643404);
  assert.equal(parseDisplayedCount(null), null);

  const owner = await analyticsBoard(db, admin);
  assert.equal(owner.showRevenue, true);
  const filled = owner.creators.filter((creator) => creator.platforms.length).map((creator) => creator.creatorId).sort();
  assert.deepEqual(filled, ["abby", "authentickam", "mariclare"]);
  const mari = owner.creators.find((creator) => creator.creatorId === "mariclare");
  assert.equal(mari?.totalAudience, "2,643,404");
  assert.equal(mari?.platforms.find((row) => row.platform === "Instagram")?.period, "Past 30d");
  assert.equal(mari?.platforms.find((row) => row.platform === "Instagram")?.metrics.followers, "326k");
  assert.equal(mari?.platforms.find((row) => row.platform === "TikTok")?.period, null);
  assert.equal(mari?.platforms.find((row) => row.platform === "TikTok")?.change, null);
  const abbyCard = owner.creators.find((creator) => creator.creatorId === "abby");
  assert.equal(abbyCard?.platforms.find((row) => row.platform === "Instagram")?.metrics.saves, null);
  assert.equal(JSON.stringify(abbyCard?.platforms.find((row) => row.platform === "Instagram")?.metrics).includes('"-1"'), false);
  assert.equal(JSON.stringify(abbyCard?.platforms.find((row) => row.platform === "Instagram")?.metrics).includes('"saves":-1'), false);

  const hers = await analyticsBoard(db, mariclare);
  assert.equal(hers.showRevenue, false);
  assert.deepEqual(hers.creators.map((creator) => creator.creatorId), ["mariclare"]);
  assert.equal(JSON.stringify(hers).includes("178k"), false);
  assert.equal(JSON.stringify(hers).includes("$"), false);
  assert.equal(Object.hasOwn(hers.creators[0].platforms[0], "revenueCents"), false);

  const made = await addManager(db, { actorRole: "admin", name: "Avery Lane", email: "avery.lane@gmail.com" });
  assert.equal(made.ok, true);
  if (!made.ok) return;
  assert.equal((await assignCreatorManagers(db, { actorRole: "admin", creatorId: "abby", primaryManagerId: made.id, backupManagerId: null })).ok, true);
  const manager: Viewer = {
    role: "manager",
    email: "avery.lane@gmail.com",
    name: "Avery Lane",
    creatorId: null,
    managerId: made.id,
    permissions: { approveEmail: false, approveVideo: false, approveContract: false, countersign: false, canPriceDeals: false },
  };
  const assigned = await analyticsBoard(db, manager);
  assert.deepEqual(assigned.creators.map((creator) => creator.creatorId), ["abby"]);
  assert.equal(JSON.stringify(assigned).includes("2.3m"), false);
  assert.equal(assigned.showRevenue, false);

  assert.equal((await saveOwnerSnapshot(db, mariclare, { creatorId: "abby", platform: "Facebook", capturedOn: "2026-10-19", metrics: { followers: "29.8k" }, revenueCents: 25000 })).ok, false);
  assert.equal((await saveOwnerSnapshot(db, admin, { creatorId: "abby", platform: "Facebook", capturedOn: "2026-10-19", metrics: { followers: "29.8k" }, revenueCents: 25000, merge: true })).ok, true);
  const priced = await analyticsBoard(db, {
    ...manager,
    permissions: { approveEmail: false, approveVideo: false, approveContract: false, countersign: false, canPriceDeals: true },
  });
  assert.equal(priced.creators[0].platforms.find((row) => row.platform === "Facebook")?.revenueCents, 25000);
  const hidden = await analyticsBoard(db, manager);
  assert.equal(Object.hasOwn(hidden.creators[0].platforms.find((row) => row.platform === "Facebook") ?? {}, "revenueCents"), false);
  assert.equal(hidden.creators[0].platforms.find((row) => row.platform === "Instagram")?.metrics.followers, "1,728");

  const manual = await inputsFor(db, "mariclare");
  const scored = await scoringInputs(db, "mariclare");
  assert.equal(scored.followers, 2643404);
  assert.equal(scored.engagement, 5.2);
  assert.equal(scored.averageViews, 88498);
  assert.equal(scored.audienceGrowth, manual.audienceGrowth);
  assert.equal(scored.completion, manual.completion);

  assert.equal(authorizeBot("Bearer wrong-token").ok, false);
  const posted = await writeAnalyticsSnapshots(db, {
    creatorId: "mariclare",
    platform: "Podcast",
    capturedOn: "2026-10-19",
    metrics: { followers: "12" },
  });
  assert.equal(posted.status, 200);
  assert.equal((await writeAnalyticsSnapshots(db, { creatorId: "missing", platform: "TikTok", capturedOn: "2026-10-19", metrics: { followers: "1" } })).status, 404);

  const brought = await importAnalyticsSnapshots(db, file);
  assert.equal(brought.ok, true);
  if (brought.ok) assert.equal(brought.saved, 11);
  const again = await importAnalyticsSnapshots(db, file);
  assert.equal(again.ok, true);
  const mariFollowers = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-19-past30d");
  assert.match(mariFollowers?.metricsJson ?? "", /326k/);
  const saves = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-abby-instagram-2026-10-19-past30d");
  assert.match(saves?.metricsJson ?? "", /"saves":null/);
  assert.equal((saves?.metricsJson ?? "").includes("-1"), false);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("a later Monday snapshot keeps earlier weeks and shows up on the public kit", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const earlier = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-19-past30d");
  assert.match(earlier?.metricsJson ?? "", /326k/);
  const added = await writeAnalyticsSnapshots(db, {
    creatorId: "mariclare",
    platform: "Instagram",
    capturedOn: "2026-10-26",
    source: "July",
    period: "Past 30d",
    metrics: {
      followers: "330k",
      engagement: "3.60%",
      views: "3.1m",
      reach: "1.3m",
      likes: "95k",
      comments: "810",
      shares: "2,900",
      saves: "5,800",
    },
    audience: { gender: ["Female 80%", "Male 20%"], age: ["18-24 41%"], country: ["USA 53%"] },
  });
  assert.equal(added.status, 200);
  const still = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-19-past30d");
  assert.match(still?.metricsJson ?? "", /326k/);
  assert.equal((await db.select().from(analyticsSnapshots)).filter((row) => row.creatorId === "mariclare" && row.platform === "Instagram").length, 2);

  const edited = await saveOwnerSnapshot(db, admin, {
    creatorId: "mariclare",
    platform: "Instagram",
    capturedOn: "2026-10-26",
    period: "Past 30d",
    source: "July",
    metrics: { followers: "331k" },
    merge: true,
  });
  assert.equal(edited.ok, true);
  const week = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-26-past30d");
  assert.match(week?.metricsJson ?? "", /331k/);
  assert.match(week?.metricsJson ?? "", /3\.60%/);
  const untouched = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-19-past30d");
  assert.match(untouched?.metricsJson ?? "", /326k/);
  assert.equal((untouched?.metricsJson ?? "").includes("331k"), false);

  const board = await analyticsBoard(db, mariclare);
  const instagram = board.creators[0].platforms.find((row) => row.platform === "Instagram");
  assert.equal(instagram?.metrics.followers, "331k");
  assert.equal(instagram?.trend.length, 2);
  assert.equal(instagram?.trend[0].followers, "326k");
  assert.notEqual(instagram?.change, null);

  const weeks = await publicWeeklySnapshots(db, "mariclare");
  const publicIg = weeks.find((row) => row.platform === "Instagram");
  assert.equal(publicIg?.followers, "331k");
  assert.equal(publicIg?.saves, "5,800");
  assert.deepEqual(publicIg?.audience?.location, ["USA 53%"]);
  assert.equal(publicIg?.trend.length, 2);
  const packed = JSON.stringify(await publicMediaKit(db, "mariclare"));
  assert.equal(packed.includes("@"), false);
  assert.equal(packed.includes("$"), false);
  assert.equal(packed.includes("rate"), false);
  assert.equal(packed.includes("331k"), true);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("brand offers use creator minimums, stay private, and update the brand list", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const approvalsBefore = (await db.select().from(approvalEmails)).length;
  const seedSql = readFileSync(path.join(process.cwd(), "drizzle/0034_brand_offers.sql"), "utf8");
  assert.match(seedSql, /INSERT OR IGNORE INTO creator_deal_rules/);
  assert.match(seedSql, /'mariclare'.*100000.*250000/);
  assert.match(seedSql, /'authentickam'.*25000/);
  assert.match(seedSql, /'abby'.*5000/);
  assert.equal(/update\s+deals/i.test(seedSql), false);

  const made = async (id: string, name: string, email: string) => {
    const result = await upsertCreator(db, { id, name, email });
    assert.equal(result.status, 201);
  };
  await made("offer-low", "Low Rank", "low.offer@gmail.com");
  await made("offer-mid", "Mid Rank", "mid.offer@gmail.com");
  await made("offer-high", "High Rank", "high.offer@gmail.com");
  await made("offer-paid", "Paid Creator", "paid.offer@gmail.com");
  await made("offer-quiz", "Quiz Rates", "quiz.rates@gmail.com");

  const blank: DealRules = {
    minRates: {},
    targetRates: {},
    minDealCents: null,
    blockedCategories: [],
    blockedBrands: [],
    maxDealsPerMonth: 1,
    turnaround: "",
    exclusivityMaxDays: null,
    usageMinDays: null,
    kidsOnCamera: "",
    kidsLimits: "",
    acceptedCategories: [],
    acceptGifted: false,
    acceptCommissionOnly: false,
  };
  assert.equal((await saveDealRules(db, admin, "offer-low", { ...blank, minDealCents: 5000, typicalRateCents: 8000 })).ok, true);
  assert.equal((await saveDealRules(db, admin, "offer-mid", { ...blank, minDealCents: 25000 })).ok, true);
  assert.equal((await saveDealRules(db, admin, "offer-high", { ...blank, minDealCents: 100000, typicalRateCents: 250000 })).ok, true);
  const ranked = [
    ["offer-low", 10, 3],
    ["offer-mid", 40, 2],
    ["offer-high", 90, 1],
  ] as const;
  for (const [creatorId, score, rank] of ranked) {
    await db.insert(creatorRankHistory).values({
      id: `rank-${creatorId}`,
      creatorId,
      score,
      tier: "Silver",
      rank,
      recordedOn: "2099-06-01",
      createdAt: "2099-06-01T00:00:00.000Z",
    });
  }

  const budgets = (cents: number, ids: string[]) => ids.map((creatorId) => ({ creatorId, amountCents: cents }));
  const offerInput = {
    contactName: "Ada Brand",
    contactEmail: "ada@spread.example",
    deliverables: ["TikTok video"],
    platforms: ["TikTok"],
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    nextFollowUp: "2026-11-15",
  };
  const manager: Viewer = { email: "plain.manager@gmail.com", name: "Plain Manager", role: "manager", creatorId: null };
  assert.equal((await createBrandOffer(db, manager, { ...offerInput, brand: "Nope", budgets: budgets(120000, ["offer-low"]) })).ok, false);

  const first = await createBrandOffer(db, admin, { ...offerInput, brand: "Spread Soap", budgets: budgets(120000, ["offer-low", "offer-mid"]) });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.flag, null);
  assert.deepEqual(first.creatorIds, ["offer-low", "offer-mid"]);

  const lowViewer: Viewer = { email: "low.offer@gmail.com", name: "Low Rank", role: "creator", creatorId: "offer-low" };
  const midViewer: Viewer = { email: "mid.offer@gmail.com", name: "Mid Rank", role: "creator", creatorId: "offer-mid" };
  const highViewer: Viewer = { email: "high.offer@gmail.com", name: "High Rank", role: "creator", creatorId: "offer-high" };
  const lowInbox = await listCreatorOffers(db, lowViewer);
  assert.equal(lowInbox.length, 1);
  assert.equal(lowInbox[0]?.brand, "Spread Soap");
  assert.equal(lowInbox[0]?.budgetCents, 120000);
  assert.equal(JSON.stringify(lowInbox).includes("5000"), false);
  assert.equal(JSON.stringify(lowInbox).includes("minimum"), false);
  assert.equal((await listCreatorOffers(db, highViewer)).length, 0);
  assert.equal((await listCreatorOffers(db, abby)).some((row) => row.brand === "Spread Soap"), false);

  const second = await createBrandOffer(db, admin, { ...offerInput, brand: "Second Soap", budgets: budgets(120000, ["offer-low", "offer-mid", "offer-high"]) });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.deepEqual(second.creatorIds, ["offer-high"]);
  const highInbox = await listCreatorOffers(db, highViewer);
  assert.equal(highInbox.length, 1);
  assert.equal(highInbox[0]?.budgetCents, 120000);
  assert.equal(JSON.stringify(highInbox).includes("5000"), false);
  assert.equal(JSON.stringify(highInbox).includes("offer-low"), false);

  const tiny = await createBrandOffer(db, admin, { ...offerInput, brand: "Tiny Soap", budgets: budgets(1000, ["offer-low", "offer-mid", "offer-high"]) });
  assert.equal(tiny.ok, true);
  if (!tiny.ok) return;
  assert.equal(tiny.flag, "pitch_retainer");
  assert.deepEqual(tiny.creatorIds, []);

  assert.equal((await saveDealRules(db, admin, "offer-low", { ...blank, minDealCents: 5000, acceptCommissionOnly: true })).ok, true);
  const trainee = await createBrandOffer(db, admin, { ...offerInput, brand: "Trainee Soap", budgets: budgets(1000, ["offer-low", "offer-high"]) });
  assert.equal(trainee.ok, true);
  if (!trainee.ok) return;
  assert.equal(trainee.flag, "commission_trainee");
  assert.deepEqual(trainee.creatorIds, []);

  const accepted = await respondToOffer(db, lowViewer, { allocationId: lowInbox[0]!.id, decision: "accepted" });
  assert.equal(accepted.ok, true);
  const asked = await respondToOffer(db, midViewer, { allocationId: (await listCreatorOffers(db, midViewer))[0]!.id, decision: "question", question: "Can I post this in December?" });
  assert.equal(asked.ok, false);
  const declined = await respondToOffer(db, highViewer, { allocationId: highInbox[0]!.id, decision: "declined" });
  assert.equal(declined.ok, false);
  assert.equal((await db.select().from(deals).where(eq(deals.creatorId, "offer-high"))).some((row) => row.brand === "Second Soap"), false);
  const emptyQuestion = await respondToOffer(db, midViewer, { allocationId: (await listCreatorOffers(db, midViewer))[0]!.id, decision: "question", question: " " });
  assert.equal(emptyQuestion.ok, false);
  assert.equal((await respondToOffer(db, highViewer, { allocationId: lowInbox[0]!.id, decision: "accepted" })).ok, false);

  const board = await listOfferBoard(db, admin);
  const spread = board.find((row) => row.brand === "Spread Soap");
  assert.equal(spread?.recipients.find((row) => row.creatorId === "offer-low")?.response, "accepted");
  assert.equal(spread?.recipients.find((row) => row.creatorId === "offer-mid")?.response, "pending");
  assert.equal(spread?.recipients.find((row) => row.creatorId === "offer-mid")?.question, null);
  assert.equal(board.find((row) => row.brand === "Tiny Soap")?.flagLabel, "Pitch agency retainer");
  assert.equal(board.find((row) => row.brand === "Trainee Soap")?.flagLabel, "Commission-only trainee");
  assert.equal(JSON.stringify(board).includes("minimumPerVideo"), false);

  const brands = await listBrandCrm(db, admin);
  assert.equal(brands.ok, true);
  if (!brands.ok) return;
  const spreadCard = brands.brands.find((card) => card.brand === "Spread Soap");
  assert.equal(spreadCard?.crm.find((row) => row.creatorId === "offer-low")?.outcome, "accepted");
  assert.equal(spreadCard?.crm.find((row) => row.creatorId === "offer-low")?.ratePaidCents, 120000);
  assert.equal(spreadCard?.crm.find((row) => row.creatorId === "offer-low")?.nextFollowUp, "2026-11-15");
  assert.equal(brands.brands.find((card) => card.brand === "Tiny Soap")?.crm[0]?.outcome, "Pitch agency retainer");
  assert.equal(brands.brands.find((card) => card.brand === "Tiny Soap")?.crm[0]?.creatorId, null);
  const hiddenRates = await listBrandCrm(db, manager);
  assert.equal(hiddenRates.ok, true);
  if (!hiddenRates.ok) return;
  assert.equal(JSON.stringify(hiddenRates.brands.find((card) => card.brand === "Spread Soap")).includes("120000"), false);

  const quizViewer: Viewer = { email: "quiz.rates@gmail.com", name: "Quiz Rates", role: "creator", creatorId: "offer-quiz" };
  const quizSaved = await saveQuestionnaireStep(db, quizViewer, {
    step: "rates",
    skip: false,
    pause: false,
    patch: {
      minVideo: "1000",
      typicalRate: "2500",
      maxSponsored: "3",
      rates: { TikTok: "75" },
      willDo: ["parenting"],
      wontDo: ["gambling"],
      acceptGifted: "yes",
      acceptCommissionOnly: "no",
    },
  });
  assert.equal(quizSaved.ok, true);
  const quizRules = await rulesFor(db, "offer-quiz");
  assert.equal(quizRules.minDealCents, 100000);
  assert.equal(quizRules.typicalRateCents, 250000);
  assert.equal(quizRules.maxDealsPerMonth, 3);
  assert.equal(quizRules.minRates.tiktok, 7500);
  assert.equal(quizRules.acceptedCategories?.includes("parenting"), true);
  assert.equal(quizRules.blockedCategories.includes("gambling"), true);
  assert.equal(quizRules.acceptGifted, true);
  assert.equal(quizRules.acceptCommissionOnly, false);

  const lowKnowledge = await creatorKnowledge(db, "offer-low");
  const highKnowledge = await creatorKnowledge(db, "offer-high");
  assert.equal(lowKnowledge?.minimumPerVideoCents, 5000);
  assert.equal(lowKnowledge?.acceptCommissionOnly, true);
  assert.equal(highKnowledge?.minimumPerVideoCents, 100000);
  assert.equal(highKnowledge?.typicalRateCents, 250000);
  assert.equal(JSON.stringify(highKnowledge).includes("offer-low"), false);
  assert.equal(Number(highKnowledge?.minimumPerVideoCents) === 5000, false);
  assert.deepEqual(highKnowledge?.platformMinimums, {});
  assert.equal(await creatorKnowledge(db, "missing-creator"), null);

  const closed = await upsertDeal(db, {
    id: "offer-closed-soap",
    brand: "Closed Soap Co",
    creatorId: "offer-paid",
    status: "delivered",
    workflowStage: "scheduled_posted",
    rateCents: 88000,
    visibleToCreator: false,
    deliverables: ["1 TikTok"],
  });
  assert.equal(closed.status, 201);
  for (const step of ["brand_invoiced", "brand_paid", "creator_payout_pending", "creator_paid"] as const) {
    const moved = await markPayment(db, { dealId: "offer-closed-soap", paymentStatus: step, actorEmail: admin.email, actorRole: "admin" });
    assert.equal(moved.ok, true);
  }
  const afterClose = await listBrandCrm(db, admin);
  assert.equal(afterClose.ok, true);
  if (!afterClose.ok) return;
  const closedCard = afterClose.brands.find((card) => card.brand === "Closed Soap Co");
  assert.equal(closedCard?.crm.some((row) => row.creatorId === "offer-paid" && row.outcome === "closed" && row.ratePaidCents === 88000), true);

  const packed = JSON.stringify(await publicMediaKit(db, "mariclare"));
  assert.equal(packed.includes("@"), false);
  assert.equal(packed.includes("$"), false);
  assert.equal(packed.includes("rate"), false);
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("live mail updates the deal, filters spam, and stays hidden until you share it", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const audience = "https://mommamari.com/portal/api/gmail/push";
  const serviceAccount = "portal-gmail-push@example.iam.gserviceaccount.com";
  const goodClaims = {
    iss: "https://accounts.google.com",
    aud: audience,
    email: serviceAccount,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  assert.equal((await verifyPubSubOidc(null, { audience, serviceAccount, verifyToken: async () => goodClaims })).ok, false);
  assert.equal((await verifyPubSubOidc("Bearer nope", { audience, serviceAccount, verifyToken: async () => null })).ok, false);
  assert.equal((await verifyPubSubOidc("Bearer t", { audience, serviceAccount, verifyToken: async () => ({ ...goodClaims, aud: "https://evil.example" }) })).ok, false);
  assert.equal((await verifyPubSubOidc("Bearer t", { audience, serviceAccount, verifyToken: async () => ({ ...goodClaims, email: "other@example.com" }) })).ok, false);
  assert.equal((await verifyPubSubOidc("Bearer t", { audience, serviceAccount, verifyToken: async () => ({ ...goodClaims, exp: 1 }) })).ok, false);
  assert.equal((await verifyPubSubOidc("Bearer t", { audience, serviceAccount, verifyToken: async () => goodClaims })).ok, true);
  assert.equal((await verifyPubSubOidc("Bearer t", { verifyToken: async () => goodClaims })).status, 503);

  for (const from of [
    "Spam <a@forceawakens.net>",
    "a@qq.com",
    "a@foxmail.com",
    "a@spam.163.com",
    "a@mail.ru",
    "a@deal.live",
    "a@deal.xyz",
    "a@deal.mobi",
    "a@deal.online",
    "a@deal.cc",
    "a@deal.shop",
    "a@deal.work",
    "a@deal.cloud",
  ]) {
    assert.equal(isSpamSender(from), true, from);
  }
  assert.equal(isSpamSender("Nina <nina@harbor.example>"), false);

  const watchUrl = new URL(googleGmailWatchAuthUrl("state", "mmaclamroc@gmail.com"));
  assert.equal(watchUrl.searchParams.get("scope"), GMAIL_READONLY_SCOPE);
  assert.equal(watchUrl.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
  assert.doesNotMatch(watchUrl.searchParams.get("scope") ?? "", /compose|gmail\.send/);
  const watchCookie = await createWatchCreatorCookie("mariclare");
  assert.equal(await readWatchCreatorCookie(watchCookie), "mariclare");
  assert.equal(await readWatchCreatorCookie("mariclare.1.nope"), null);

  const encoded = Buffer.from(JSON.stringify({ emailAddress: "mmaclamroc@gmail.com", historyId: 1001 })).toString("base64");
  assert.deepEqual(decodePushMessage({ message: { data: encoded } }), { emailAddress: "mmaclamroc@gmail.com", historyId: "1001" });
  assert.equal(decodePushMessage({}), null);

  let listed = 0;
  const priming = await ingestGmailPush(db, { emailAddress: "mmaclamroc@gmail.com", historyId: "1000" }, {
    client: {
      listAdded: async () => {
        listed += 1;
        return { latestHistoryId: "1000", messages: [] };
      },
      getMessage: async () => {
        throw new Error("should not read mail before a cursor exists");
      },
    },
  });
  assert.equal("primed" in priming.body && priming.body.primed, true);
  assert.equal(listed, 0);

  const spam: GmailHistoryMessage = { id: "live-spam-1", threadId: "live-spam-thread", from: "Junk <junk@forceawakens.net>", to: "mmaclamroc@gmail.com", subject: "You won", labelIds: ["INBOX"] };
  const inbound: GmailHistoryMessage = { id: "live-mail-1", threadId: "live-thread-1", from: "Nina Cole <nina@harbor.example>", to: "mmaclamroc@gmail.com", subject: "Harbor collab", labelIds: ["INBOX"] };
  const scripted = (rows: GmailHistoryMessage[], latestHistoryId: string) => ({
    listAdded: async () => ({ latestHistoryId, messages: rows.map((row) => ({ id: row.id, threadId: row.threadId })) }),
    getMessage: async (id: string) => {
      const found = rows.find((row) => row.id === id);
      if (!found) throw new Error(id);
      return found;
    },
  });
  const opened = await ingestGmailPush(db, { emailAddress: "MMACLamroc@gmail.com", historyId: "1100" }, { client: scripted([spam, inbound], "1100") });
  assert.equal(opened.status, 200);
  if (!("createdDealIds" in opened.body)) throw new Error("expected created deals");
  assert.deepEqual(opened.body.createdDealIds, ["mail-live-mail-1"]);
  assert.equal(opened.body.skippedSpam, 1);
  const hiddenId = "mail-live-mail-1";
  assert.equal(await getDealForViewer(db, mariclare, hiddenId), null);
  assert.equal(await getDealForViewer(db, abby, hiddenId), null);
  const ownerMail = await getDealForViewer(db, admin, hiddenId);
  assert.equal(ownerMail?.workflowStage, "offer_received");
  assert.equal(ownerMail?.visibleToCreator, false);
  assert.equal(ownerMail?.creatorId, "mariclare");
  assert.equal(ownerMail?.gmailThreadId, "live-thread-1");
  assert.equal(ownerMail?.brand, "Nina Cole");

  const again = await ingestGmailPush(db, { emailAddress: "mmaclamroc@gmail.com", historyId: "1200" }, { client: scripted([spam, inbound], "1200") });
  if (!("createdDealIds" in again.body) || !("skippedDuplicate" in again.body)) throw new Error("expected a repeat result");
  assert.deepEqual(again.body.createdDealIds, []);
  assert.equal((again.body.skippedDuplicate ?? 0) > 0, true);
  assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, "live-thread-1"))).length, 1);

  const followUp: GmailHistoryMessage = { id: "live-mail-2", threadId: "live-thread-1", from: "Nina Cole <nina@harbor.example>", to: "mmaclamroc@gmail.com", subject: "Checking in", labelIds: ["INBOX"] };
  const matched = await ingestGmailPush(db, { emailAddress: "mmaclamroc@gmail.com", historyId: "1300" }, { client: scripted([followUp], "1300") });
  if (!("matchedDealIds" in matched.body) || !("createdDealIds" in matched.body)) throw new Error("expected a match");
  assert.deepEqual(matched.body.matchedDealIds, [hiddenId]);
  assert.deepEqual(matched.body.createdDealIds, []);
  assert.equal((await db.select().from(deals).where(eq(deals.gmailThreadId, "live-thread-1"))).length, 1);

  const reply: GmailHistoryMessage = { id: "live-reply-1", threadId: "live-thread-1", from: "MariClare <mmaclamroc@gmail.com>", to: "nina@harbor.example", subject: "Re: Harbor collab", labelIds: ["SENT"] };
  const moved = await ingestGmailPush(db, { emailAddress: "mmaclamroc@gmail.com", historyId: "1400" }, { client: scripted([reply], "1400") });
  if (!("stageMoves" in moved.body)) throw new Error("expected a stage move");
  assert.deepEqual(moved.body.stageMoves, [hiddenId]);
  const afterReply = await getDealForViewer(db, admin, hiddenId);
  assert.equal(afterReply?.workflowStage, "interest_sent");
  assert.equal(afterReply?.visibleToCreator, false);
  assert.equal(await getDealForViewer(db, mariclare, hiddenId), null);
  const events = await listInboxEvents(db, "2000-01-01T00:00:00.000Z");
  assert.equal(events.some((event) => event.messageId === "live-mail-1" && event.dealId === hiddenId), true);
  assert.equal(events.some((event) => event.messageId === "live-reply-1"), false);
  assert.equal(events.some((event) => event.messageId === "live-spam-1"), false);
  assert.equal((await listInboxEvents(db, "2999-01-01T00:00:00.000Z")).length, 0);
  assert.equal(parseSince("not-a-date").ok, false);
  const mariLive = JSON.stringify(await listLiveDeals(db, mariclare));
  assert.equal(mariLive.includes(hiddenId), false);
  assert.equal(mariLive.includes("minimum"), false);
  assert.equal(mariLive.includes("kamronNotes"), false);
  assert.equal(mariLive.includes("$"), false);

  const kamPrime = await ingestGmailPush(db, { emailAddress: "authentickambiz@gmail.com", historyId: "50" }, {
    client: { listAdded: async () => ({ latestHistoryId: "50", messages: [] }), getMessage: async () => inbound },
  });
  assert.equal("primed" in kamPrime.body && kamPrime.body.primed, true);
  const kamMail: GmailHistoryMessage = { id: "live-kam-1", threadId: "live-kam-thread", from: "Pat <pat@brand.example>", to: "authentickambiz@gmail.com", subject: "Quick question", labelIds: ["INBOX"] };
  const kamOpened = await ingestGmailPush(db, { emailAddress: "authentickambiz@gmail.com", historyId: "60" }, { client: scripted([kamMail], "60") });
  if (!("createdDealIds" in kamOpened.body)) throw new Error("expected Kam's deal");
  const kamDealId = kamOpened.body.createdDealIds?.[0];
  assert.equal(kamDealId, "mail-live-kam-1");
  const kamCreator: Viewer = { email: "authentickambiz@gmail.com", role: "creator", creatorId: "authentickam", name: "AuthenticKam" };
  assert.equal(await getDealForViewer(db, kamCreator, kamDealId ?? ""), null);
  assert.equal(await getDealForViewer(db, abby, kamDealId ?? ""), null);
  assert.equal(await getDealForViewer(db, mariclare, kamDealId ?? ""), null);
  assert.equal((await getDealForViewer(db, admin, kamDealId ?? ""))?.creatorId, "authentickam");
  assert.equal((await getDealForViewer(db, admin, kamDealId ?? ""))?.visibleToCreator, false);

  const crmOnce = await upsertBrandCrmByDomain(db, {
    domain: "https://www.Harbor.example/hello",
    contactEmail: "Nina@harbor.example",
    brand: "Harbor Live CRM",
    outcome: "offered",
    ratePaidCents: 8000,
    actorName: "bot",
  });
  assert.equal(crmOnce.ok, true);
  if (!crmOnce.ok) return;
  const crmTwice = await upsertBrandCrmByDomain(db, {
    domain: "harbor.example",
    contactEmail: "nina@harbor.example",
    outcome: "negotiating",
    actorName: "bot",
  });
  assert.equal(crmTwice.ok, true);
  if (!crmTwice.ok) return;
  assert.equal(crmTwice.id, crmOnce.id);
  assert.equal(crmTwice.created, false);
  const crmRows = (await db.select().from(brandCrmEntries)).filter((row) => row.domain === "harbor.example" && row.contactEmail === "nina@harbor.example");
  assert.equal(crmRows.length, 1);
  assert.equal(crmRows[0]?.outcome, "negotiating");
  assert.equal(JSON.stringify({ id: crmTwice.id, created: crmTwice.created }).includes("8000"), false);

  const synced = await syncDeals(db, {
    deals: [
      {
        id: "sync-live",
        brand: "Sync Harbor",
        creatorId: "mariclare",
        workflowStage: "offer_received",
        visibleToCreator: false,
        kamronNotes: "internal quote 999001",
        minDealCents: 5000,
        typicalRateCents: 250000,
        amountDisplay: "$80",
      },
      { brand: "Missing id" },
    ],
  });
  assert.equal(synced.status, 200);
  const syncBody = synced.body as { results: { id: string | null; ok: boolean; error: string | null }[] };
  assert.equal(syncBody.results[0]?.ok, true);
  assert.equal(syncBody.results[0]?.id, "sync-live");
  assert.equal(syncBody.results[1]?.ok, false);
  assert.equal(JSON.stringify(syncBody).includes("999001"), false);
  assert.equal(JSON.stringify(syncBody).includes("5000"), false);
  assert.equal(JSON.stringify(syncBody).includes("minimum"), false);
  const syncRow = (await db.select().from(deals).where(eq(deals.id, "sync-live")))[0];
  assert.equal(syncRow?.kamronNotes, "internal quote 999001");
  assert.equal(syncRow?.rateCents, null);
  assert.equal(syncRow?.visibleToCreator, false);
  assert.equal(await getDealForViewer(db, mariclare, "sync-live"), null);
  const syncLive = (await listLiveDeals(db, admin)).find((deal) => deal.id === "sync-live");
  assert.equal(JSON.stringify(syncLive).includes("999001"), false);
  assert.equal(JSON.stringify(syncLive).includes("5000"), false);
  assert.equal(JSON.stringify(syncLive).includes("$"), false);

  const person = await upsertCreator(db, { id: "live-one", name: "Live One", email: "live.one@gmail.com", initials: "LO" });
  assert.equal(person.status, 201);
  const offer = await createBrandOffer(db, admin, {
    brand: "Harbor Live",
    contactName: "Nina Cole",
    contactEmail: "nina@harbor.example",
    deliverables: ["TikTok video"],
    platforms: ["TikTok"],
    nextFollowUp: "2026-12-01",
    budgets: [{ creatorId: "live-one", amountCents: 8000 }],
  });
  assert.equal(offer.ok, true);
  const liveViewer: Viewer = { email: "live.one@gmail.com", role: "creator", creatorId: "live-one", name: "Live One" };
  const inbox = await listCreatorOffers(db, liveViewer);
  assert.equal(inbox.length, 1);
  const decided = await respondToOffer(db, liveViewer, { allocationId: inbox[0]!.id, decision: "accepted" });
  assert.equal(decided.ok, true);
  assert.equal((await listDealsForViewer(db, liveViewer, "live-one")).some((deal) => deal.brand === "Harbor Live"), false);
  const hiddenHarbor = await getDealForViewer(db, admin, `offer-${inbox[0]!.id}`);
  assert.equal(hiddenHarbor?.workflowStage, "creator_interested");
  assert.equal(hiddenHarbor?.visibleToCreator, false);
  assert.equal((await publishDealReview(db, { dealId: hiddenHarbor?.id ?? "", actorEmail: admin.email, actorRole: "admin" })).ok, true);
  const shown = await listDealsForViewer(db, liveViewer, "live-one");
  const harbor = shown.find((deal) => deal.brand === "Harbor Live");
  assert.ok(harbor);
  assert.equal(harbor?.workflowStage, "creator_interested");
  assert.equal(harbor?.visibleToCreator, true);
  assert.equal(harbor?.amountDisplay, "$80");
  assert.equal(JSON.stringify(harbor).includes("minimum"), false);
  const liveBrands = await listBrandCrm(db, admin);
  assert.equal(liveBrands.ok, true);
  if (!liveBrands.ok) return;
  assert.equal(liveBrands.brands.find((card) => card.brand === "Harbor Live")?.crm.find((row) => row.creatorId === "live-one")?.outcome, "accepted");
  const beforeStage = harbor?.updatedAt;
  const staged = await setDealStage(db, {
    dealId: harbor?.id ?? "",
    toStage: "interest_sent",
    actorEmail: admin.email,
    actorRole: "admin",
    note: "Told the brand.",
  });
  assert.equal(staged.ok, true);
  const afterStage = await getDealForViewer(db, liveViewer, harbor?.id ?? "");
  assert.equal(afterStage?.workflowStage, "interest_sent");
  assert.equal(afterStage?.updatedAt === beforeStage, false);
  const afterBrands = await listBrandCrm(db, admin);
  assert.equal(afterBrands.ok, true);
  if (!afterBrands.ok) return;
  assert.equal(afterBrands.brands.find((card) => card.brand === "Harbor Live")?.crm.find((row) => row.creatorId === "live-one")?.outcome, "interest sent");
  const pulse = (await listLiveDeals(db, liveViewer)).find((deal) => deal.id === harbor?.id);
  assert.equal(pulse?.stageLabel, "Told the brand");
  assert.equal(pulse?.updatedLabel.startsWith("Last updated"), true);
  assert.equal(JSON.stringify(pulse).includes("minimum"), false);
  assert.equal(JSON.stringify(pulse).includes("$"), false);

  const renewed = await renewGmailWatches(db, async ({ mailbox, refreshToken }) => {
    if (mailbox === "mmaclamroc@gmail.com") assert.equal(refreshToken, "1//secret-refresh-token-not-for-storage");
    return { historyId: "9000", expiration: "1893456000000" };
  });
  assert.equal(renewed.find((row) => row.mailbox === "mmaclamroc@gmail.com")?.ok, true);
  assert.equal(renewed.find((row) => row.mailbox === "authentickambiz@gmail.com")?.ok, false);
  assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, "mmaclamroc@gmail.com")))[0]?.historyId, "9000");

  const previousCron = process.env.GMAIL_WATCH_CRON_SECRET;
  delete process.env.GMAIL_WATCH_CRON_SECRET;
  assert.equal(authorizeCron("Bearer secret").status, 503);
  process.env.GMAIL_WATCH_CRON_SECRET = "cron-secret";
  assert.equal(authorizeCron("Bearer cron-secret").ok, true);
  assert.equal(authorizeCron("Bearer wrong").status, 401);
  if (previousCron == null) delete process.env.GMAIL_WATCH_CRON_SECRET;
  else process.env.GMAIL_WATCH_CRON_SECRET = previousCron;

  const migration = readFileSync(path.join(process.cwd(), "drizzle/0035_live_sync.sql"), "utf8");
  assert.equal(migration.toLowerCase().includes("update deals"), false);
  assert.equal(migration.includes("KOSBLING"), true);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("owner review, rate confirm, upload deadline, and reply drafts leave creators out", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const approvalsBefore = (await db.select().from(approvalEmails)).length;

  const queued = await syncDeals(db, {
    deals: [{
      id: "review-sync",
      brand: "Review Soap",
      creatorId: "mariclare",
      workflowStage: "offer_received",
      visibleToCreator: true,
      kamronNotes: "internal quote 424242",
      postDate: "2026-11-20",
    }],
  });
  assert.equal(queued.status, 200);
  const reviewRow = (await db.select().from(deals).where(eq(deals.id, "review-sync")))[0];
  assert.equal(reviewRow?.visibleToCreator, false);
  assert.equal(reviewRow?.reviewStatus, "pending");
  assert.equal(await getDealForViewer(db, mariclare, "review-sync"), null);
  assert.equal((await listDealReviews(db)).some((row) => row.id === "review-sync"), true);
  assert.equal((await listDealReviews(db)).some((row) => row.id === "kosbling"), false);

  const creatorPublish = await publishDealReview(db, { dealId: "review-sync", actorEmail: mariclare.email, actorRole: "creator" });
  assert.equal(creatorPublish.ok, false);
  const edited = await editDealReview(db, {
    dealId: "review-sync",
    actorRole: "admin",
    brand: "Review Soap Co",
    postDate: "2026-11-20",
    kamronNotes: "keep private",
    productRequired: false,
    rushRevision: true,
    rateCents: 9000,
  });
  assert.equal(edited.ok, true);
  assert.equal(await getDealForViewer(db, mariclare, "review-sync"), null);

  const published = await publishDealReview(db, { dealId: "review-sync", actorEmail: admin.email, actorRole: "admin" });
  assert.equal(published.ok, true);
  const creatorDeal = await getDealForViewer(db, mariclare, "review-sync");
  assert.equal(creatorDeal?.visibleToCreator, true);
  assert.equal(creatorDeal?.brand, "Review Soap Co");
  assert.equal(creatorDeal?.workflowStage, "offer_shared");
  assert.equal(creatorDeal?.uploadDue, "2026-11-17");
  assert.equal(creatorDeal?.rushRevision, true);
  assert.equal(creatorDeal?.brandReplyDraft, null);
  assert.equal(creatorDeal?.reviewStatus, null);
  assert.equal(creatorDeal?.kamronNotes, null);
  assert.equal(JSON.stringify(creatorDeal).includes("keep private"), false);
  assert.equal(JSON.stringify(creatorDeal).includes("424242"), false);
  assert.equal(JSON.stringify(creatorDeal).includes("minimum"), false);

  const draft = await saveBrandReplyDraft(db, {
    dealId: "review-sync",
    actorEmail: admin.email,
    actorRole: "admin",
    body: "Hi, MariClare can do Review Soap Co for the agreed rate.",
  });
  assert.equal(draft.ok, true);
  const creatorAfterDraft = await getDealForViewer(db, mariclare, "review-sync");
  assert.equal(creatorAfterDraft?.brandReplyDraft, null);
  assert.equal(JSON.stringify(creatorAfterDraft).includes("agreed rate"), false);
  const ownerAfterDraft = await getDealForViewer(db, admin, "review-sync");
  assert.equal(ownerAfterDraft?.brandReplyDraft, "Hi, MariClare can do Review Soap Co for the agreed rate.");
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
  const creatorDraft = await saveBrandReplyDraft(db, {
    dealId: "review-sync",
    actorEmail: mariclare.email,
    actorRole: "creator",
    body: "secret reply from a creator",
  });
  assert.equal(creatorDraft.ok, false);
  assert.equal((await getDealForViewer(db, admin, "review-sync"))?.brandReplyDraft?.includes("secret reply"), false);

  const earlyConfirm = await confirmAgreedRate(db, { dealId: "review-sync", actorRole: "creator", creatorId: "mariclare" });
  assert.equal(earlyConfirm.ok, false);
  const askedRate = await askCreatorToConfirmRate(db, { dealId: "review-sync", actorRole: "admin" });
  assert.equal(askedRate.ok, true);
  const ready = await getDealForViewer(db, mariclare, "review-sync");
  assert.equal(ready?.canConfirmRate, true);
  assert.equal(ready?.agreedRateLabel, "$90");
  const other = await confirmAgreedRate(db, { dealId: "review-sync", actorRole: "creator", creatorId: "abby" });
  assert.equal(other.ok, false);
  const confirmed = await confirmAgreedRate(db, { dealId: "review-sync", actorRole: "creator", creatorId: "mariclare" });
  assert.equal(confirmed.ok, true);
  assert.equal((await getDealForViewer(db, mariclare, "review-sync"))?.rateConfirmedAt == null, false);
  assert.equal((await getDealForViewer(db, mariclare, "review-sync"))?.canConfirmRate, false);

  const passed = await setDealStage(db, {
    dealId: "review-sync",
    toStage: "creator_declined",
    actorEmail: mariclare.email,
    actorRole: "creator",
    creatorId: "mariclare",
  });
  assert.equal(passed.ok, false);
  assert.equal((await getDealForViewer(db, admin, "review-sync"))?.workflowStage, "offer_shared");

  assert.equal(uploadDueDate("2026-10-20"), "2026-10-17");
  assert.equal(deadlineFlag("2026-10-20", "draft_due", new Date("2026-10-16T16:00:00.000Z")), "reminder");
  assert.equal(deadlineFlag("2026-10-20", "draft_due", new Date("2026-10-18T16:00:00.000Z")), "overdue");
  assert.equal(deadlineFlag("2026-10-20", "draft_submitted", new Date("2026-10-18T16:00:00.000Z")), "none");
  assert.equal(uploadDueDate("not a date"), null);

  const product = await upsertDeal(db, {
    id: "review-product",
    brand: "Product Co",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "signed_by_creator",
    visibleToCreator: true,
  });
  assert.equal(product.status, 201);
  const waited = await advanceAfterSignature(db, "review-product");
  assert.equal(waited.ok, true);
  if (waited.ok) assert.equal(waited.workflowStage, "waiting_for_product");

  const plain = await upsertDeal(db, {
    id: "review-plain",
    brand: "Plain Co",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "signed_by_creator",
    visibleToCreator: true,
  });
  assert.equal(plain.status, 201);
  assert.equal((await editDealReview(db, { dealId: "review-plain", actorRole: "admin", productRequired: false })).ok, true);
  const produced = await advanceAfterSignature(db, "review-plain");
  assert.equal(produced.ok, true);
  if (produced.ok) assert.equal(produced.workflowStage, "draft_due");

  const hidden = await syncDeals(db, {
    deals: [{ id: "review-no", brand: "No Soap", creatorId: "abby", workflowStage: "offer_received", visibleToCreator: true }],
  });
  assert.equal(hidden.status, 200);
  const rejected = await rejectDealReview(db, { dealId: "review-no", actorEmail: admin.email, actorRole: "admin" });
  assert.equal(rejected.ok, true);
  assert.equal(await getDealForViewer(db, abby, "review-no"), null);
  assert.equal((await listDealReviews(db)).some((row) => row.id === "review-no"), false);
  assert.equal((await db.select().from(deals).where(eq(deals.id, "review-no")))[0]?.reviewStatus, "rejected");

  const kosblingReject = await rejectDealReview(db, { dealId: "kosbling", actorEmail: admin.email, actorRole: "admin" });
  assert.equal(kosblingReject.ok, false);
  if (!kosblingReject.ok) assert.equal(kosblingReject.status, 409);
  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
});

test("capability levels stay off until training is done, and draft-only waits for the owner", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const migration = readFileSync(path.join(process.cwd(), "drizzle/0036_capability_grants.sql"), "utf8");
  assert.equal(migration.toLowerCase().includes("update deals"), false);
  assert.equal(migration.includes("KOSBLING"), true);

  const added = await addManager(db, { actorRole: "admin", name: "Quinn Access", email: "quinn.access@gmail.com" });
  assert.equal(added.ok, true);
  if (!added.ok) return;
  const managerViewer: Viewer = {
    email: added.email,
    role: "manager",
    creatorId: null,
    name: "Quinn Access",
    managerId: added.id,
    assignedCreatorIds: ["mariclare"],
  };

  const opened = await upsertDeal(db, {
    id: "cap-deal",
    brand: "Capability Co",
    creatorId: "mariclare",
    status: "negotiating",
    workflowStage: "offer_shared",
    visibleToCreator: true,
    nextStep: "leave this",
  });
  assert.equal(opened.status, 201);
  const hidden = await upsertDeal(db, {
    id: "cap-approve",
    brand: "Approve Co",
    creatorId: "mariclare",
    status: "pitch",
    workflowStage: "offer_received",
    visibleToCreator: false,
  });
  assert.equal(hidden.status, 201);

  const blocked = await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "draft",
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 409);
  assert.equal((await listCapabilityGrants(db, "manager", added.id)).find((row) => row.capability === "negotiate")?.level, "off");

  const denied = await managerCapabilityAct(db, {
    email: added.email,
    capability: "negotiate",
    summary: "Try a note",
    effect: { kind: "negotiate", dealId: "cap-deal", note: "should not land" },
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "leave this");

  const partial = await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    checked: ["minimums", "practice"],
  });
  assert.equal(partial.ok, true);
  if (partial.ok) assert.equal(partial.complete, false);
  const stillBlocked = await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "draft",
  });
  assert.equal(stillBlocked.ok, false);
  if (!stillBlocked.ok) assert.equal(stillBlocked.error, "Mark the training complete before raising this level.");
  assert.equal((await listCapabilityGrants(db, "manager", added.id)).find((row) => row.capability === "negotiate")?.level, "off");

  const trained = await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    checked: TRAINING_ITEMS.negotiate.map((item) => item.id),
  });
  assert.equal(trained.ok, true);
  const draftedLevel = await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "draft",
  });
  assert.equal(draftedLevel.ok, true);

  const drafted = await managerCapabilityAct(db, {
    email: added.email,
    capability: "negotiate",
    summary: "Draft the next step",
    effect: { kind: "negotiate", dealId: "cap-deal", note: "draft note" },
  });
  assert.equal(drafted.ok, true);
  if (drafted.ok) assert.equal(drafted.mode, "draft");
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "leave this");
  const waiting = await listPendingCapabilityDrafts(db);
  const negotiateDraft = waiting.find((row) => row.summary === "Draft the next step");
  assert.ok(negotiateDraft);
  const approved = await reviewCapabilityDraft(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    draftId: negotiateDraft.id,
    intent: "approve",
  });
  assert.equal(approved.ok, true);
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "draft note");

  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "approval",
  })).ok, true);
  const asking = await managerCapabilityAct(db, {
    email: added.email,
    capability: "negotiate",
    summary: "Ask before changing the step",
    effect: { kind: "negotiate", dealId: "cap-deal", note: "approval note" },
  });
  assert.equal(asking.ok, true);
  if (asking.ok) assert.equal(asking.mode, "pending");
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "draft note");
  if (asking.ok && asking.draftId) {
    assert.equal((await reviewCapabilityDraft(db, {
      actorRole: "admin",
      actorEmail: admin.email,
      draftId: asking.draftId,
      intent: "approve",
    })).ok, true);
  }
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "approval note");

  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "full",
  })).ok, true);
  const immediate = await managerCapabilityAct(db, {
    email: added.email,
    capability: "negotiate",
    summary: "Update the step",
    effect: { kind: "negotiate", dealId: "cap-deal", note: "full note" },
  });
  assert.equal(immediate.ok, true);
  if (immediate.ok) assert.equal(immediate.mode, "applied");
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "full note");

  const sneak = await setCapabilityLevel(db, {
    actorRole: "manager",
    actorEmail: added.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "negotiate",
    level: "off",
  });
  assert.equal(sneak.ok, false);
  if (!sneak.ok) assert.equal(sneak.status, 403);
  assert.equal((await listCapabilityGrants(db, "manager", added.id)).find((row) => row.capability === "negotiate")?.level, "full");

  assert.equal((await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "draft_replies",
    checked: TRAINING_ITEMS.draft_replies.map((item) => item.id),
  })).ok, true);
  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "draft_replies",
    level: "draft",
  })).ok, true);
  const reply = await managerCapabilityAct(db, {
    email: added.email,
    capability: "draft_replies",
    summary: "Reply draft",
    effect: { kind: "draft_replies", dealId: "cap-deal", body: "cap-reply-secret-body" },
  });
  assert.equal(reply.ok, true);
  if (reply.ok) assert.equal(reply.mode, "draft");
  const creatorDeal = await getDealForViewer(db, mariclare, "cap-deal");
  const managerDeal = await getDealForViewer(db, managerViewer, "cap-deal");
  assert.equal(JSON.stringify(creatorDeal).includes("cap-reply-secret-body"), false);
  assert.equal(JSON.stringify(managerDeal).includes("cap-reply-secret-body"), false);
  assert.equal(creatorDeal?.brandReplyDraft ?? null, null);
  assert.equal(managerDeal?.brandReplyDraft ?? null, null);

  assert.equal((await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "outreach",
    checked: TRAINING_ITEMS.outreach.map((item) => item.id),
  })).ok, true);
  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "outreach",
    level: "draft",
  })).ok, true);
  const beforeMail = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "cap-deal"));
  const outreach = await managerCapabilityAct(db, {
    email: added.email,
    capability: "outreach",
    summary: "Queue a hello",
    effect: { kind: "outreach", dealId: "cap-deal", to: "brand@capability.example", subject: "Hello", body: "MariClare can film this." },
  });
  assert.equal(outreach.ok, true);
  if (outreach.ok) assert.equal(outreach.mode, "draft");
  assert.equal((await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "cap-deal"))).length, beforeMail.length);
  if (outreach.ok && outreach.draftId) {
    assert.equal((await reviewCapabilityDraft(db, {
      actorRole: "admin",
      actorEmail: admin.email,
      draftId: outreach.draftId,
      intent: "approve",
    })).ok, true);
  }
  const mailed = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "cap-deal"));
  const hello = mailed.find((row) => row.subject === "Hello");
  assert.ok(hello);
  assert.equal(hello.status, "pending");
  assert.equal(hello.fromEmail, "authentickambiz@gmail.com");
  assert.equal(hello.sentAt, null);

  assert.equal((await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "approve_deals",
    checked: TRAINING_ITEMS.approve_deals.map((item) => item.id),
  })).ok, true);
  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "manager",
    subjectId: added.id,
    capability: "approve_deals",
    level: "full",
  })).ok, true);
  const published = await managerCapabilityAct(db, {
    email: added.email,
    capability: "approve_deals",
    summary: "Publish Approve Co",
    effect: { kind: "approve_deals", dealId: "cap-approve" },
  });
  assert.equal(published.ok, true);
  if (published.ok) assert.equal(published.mode, "applied");
  const approveDeal = await getDealForViewer(db, admin, "cap-approve");
  assert.equal(approveDeal?.workflowStage, "offer_shared");
  assert.equal(approveDeal?.visibleToCreator, true);
  assert.equal(approveDeal?.reviewStatus, "published");
  assert.equal(await getDealForViewer(db, mariclare, "cap-approve") == null, false);

  const created = await createScopedBot(db, { actorRole: "admin", actorEmail: admin.email, name: "Inbox helper" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const shown = (await listScopedBots(db)).find((row) => row.id === created.id);
  assert.equal(shown?.reveal, created.token);
  assert.equal(Object.keys(shown ?? {}).includes("token_hash"), false);
  assert.equal(Object.keys(shown ?? {}).includes("tokenHash"), false);
  assert.equal((await setTrainingChecks(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "bot",
    subjectId: created.id,
    capability: "negotiate",
    checked: TRAINING_ITEMS.negotiate.map((item) => item.id),
  })).ok, true);
  assert.equal((await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "bot",
    subjectId: created.id,
    capability: "negotiate",
    level: "draft",
  })).ok, true);
  const caller = await resolveBotCaller(db, `Bearer ${created.token}`);
  assert.equal(caller.ok, true);
  if (!caller.ok) return;
  assert.equal(caller.unrestricted, false);
  const botDenied = await actWithCapability(db, {
    actorEmail: caller.email,
    actorRole: "bot",
    subjectType: "bot",
    subjectId: caller.botId ?? "",
    capability: "approve_deals",
    summary: "Publish something else",
    effect: { kind: "approve_deals", dealId: "cap-deal" },
  });
  assert.equal(botDenied.ok, false);
  if (!botDenied.ok) assert.equal(botDenied.status, 403);
  const botDraft = await actWithCapability(db, {
    actorEmail: caller.email,
    actorRole: "bot",
    subjectType: "bot",
    subjectId: caller.botId ?? "",
    capability: "negotiate",
    summary: "Bot draft only",
    effect: { kind: "negotiate", dealId: "cap-deal", note: "bot should not land" },
  });
  assert.equal(botDraft.ok, true);
  if (botDraft.ok) assert.equal(botDraft.mode, "draft");
  assert.equal((await getDealForViewer(db, admin, "cap-deal"))?.nextStep, "full note");

  await clearBotReveal(db, created.id);
  const packed = JSON.stringify(await listScopedBots(db));
  assert.equal(packed.includes(created.token), false);
  assert.equal(packed.includes("token_hash"), false);
  assert.equal(authorizeBot(`Bearer ${created.token}`).ok, false);
  assert.equal(authorizeBot(`Bearer ${process.env.BOT_API_TOKEN}`).ok, true);
  const master = await resolveBotCaller(db, `Bearer ${process.env.BOT_API_TOKEN}`);
  assert.equal(master.ok, true);
  if (master.ok) assert.equal(master.unrestricted, true);

  assert.equal((await revokeScopedBot(db, { actorRole: "admin", actorEmail: admin.email, botId: created.id })).ok, true);
  const revoked = await resolveBotCaller(db, `Bearer ${created.token}`);
  assert.equal(revoked.ok, false);
  if (!revoked.ok) assert.equal(revoked.status, 401);
  const retired = await setCapabilityLevel(db, {
    actorRole: "admin",
    actorEmail: admin.email,
    subjectType: "bot",
    subjectId: created.id,
    capability: "negotiate",
    level: "full",
  });
  assert.equal(retired.ok, false);
  if (!retired.ok) assert.equal(retired.status, 404);

  const ownerSecrets = await readCreatorAccountSecrets(db, admin, "mariclare");
  const managerSecrets = await readCreatorAccountSecrets(db, managerViewer, "mariclare");
  assert.equal(managerSecrets.ok, false);
  if (!managerSecrets.ok) {
    assert.equal(managerSecrets.status, 403);
    assert.equal(managerSecrets.error, "Managers never get creator account credentials.");
    assert.equal(managerSecrets.error.includes("cipher"), false);
    if (ownerSecrets.ok && ownerSecrets.cipher) assert.equal(JSON.stringify(managerSecrets).includes(ownerSecrets.cipher), false);
  }
  const previousUrl = (await findCreatorById(db, "mariclare"))?.accounts.tiktok.connectUrl ?? null;
  await db.update(creators).set({ tiktokConnectUrl: "https://secret.example/tiktok-token" }).where(eq(creators.id, "mariclare"));
  const planted = await findCreatorById(db, "mariclare");
  assert.ok(planted);
  const stripped = hideAccountCredentials(planted);
  assert.equal(stripped.accounts.tiktok.status, planted.accounts.tiktok.status);
  assert.equal(stripped.accounts.tiktok.connectUrl, null);
  assert.equal(JSON.stringify(stripped).includes("secret.example"), false);
  await db.update(creators).set({ tiktokConnectUrl: previousUrl }).where(eq(creators.id, "mariclare"));

  const audit = await listCapabilityAudit(db);
  assert.equal(audit.some((row) => row.action === "level_set"), true);
  assert.equal(audit.some((row) => row.action === "approved"), true);
  assert.equal(audit.some((row) => row.action === "denied"), true);

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
