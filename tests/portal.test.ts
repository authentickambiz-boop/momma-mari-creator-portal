import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { createDb, type PortalDb } from "../src/db/index";
import { openDatabase } from "../src/db/local-d1";
import { canChangeDealStage, resolveViewedCreator } from "../src/lib/authz";
import { addFeedback, authorizeBot, updateDeal, upsertCreator, upsertDeal, upsertPayment, writeDailyAnalytics } from "../src/lib/bot-api";
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
import {
  GMAIL_SCOPES,
  createGmailOAuthState,
  createOAuthState,
  googleAuthUrl,
  googleGmailAuthUrl,
  googleRedirectUri,
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
import { STRIPE_CATALOG } from "../src/lib/email-setup";
import { createSession, readSignedSessionId } from "../src/lib/session";
import { decryptToken } from "../src/lib/token-crypto";
import { assertCanUpload, parseContentRange, validateChunk } from "../src/lib/uploads";
import type { Viewer } from "../src/lib/types";

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

test("hosted creator email is a paid add-on request with a placeholder price", async () => {
  const missing = await saveEmailSetup(db, "abby", "hosted", "not-an-email");
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
    assert.equal(requested.hostedEmailAddress, "deals@abbybrand.com");
  }
  const again = await saveEmailSetup(db, "abby", "hosted", "deals@abbybrand.com");
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.notified, false);

  const setup = await emailSetupFor(db, "abby");
  assert.equal(setup.choice, "hosted");
  assert.equal(setup.hostedEmailAddress, "deals@abbybrand.com");
  const message = hostedEmailRequestMessage("deals@abbybrand.com");
  assert.equal(message, "Hosted email requested: deals@abbybrand.com. Paid add-on: hosted creator email. Price: placeholder.");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.name, "hosted creator email");
  assert.equal(STRIPE_CATALOG.hostedCreatorEmail.priceLabel, "placeholder");

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
  assert.equal(profile?.hostedEmailAddress, "deals@abbybrand.com");
  assert.equal(profile?.gmailConnected, false);
  assert.deepEqual(profile?.hostedEmailAddOn, { name: "hosted creator email", priceLabel: "placeholder" });
  assert.equal(JSON.stringify(profile).includes("v1:"), false);

  const changed = await saveEmailSetup(db, "abby", "hosted", "brands@abbybrand.com");
  assert.equal(changed.ok, true);
  if (changed.ok) assert.equal(changed.notified, false);
  const updated = (await listUnreadNotices(db)).filter((note) => note.creatorId === "abby" && note.kind === "hosted_email");
  assert.equal(updated.length, 1);
  assert.match(updated[0]?.message ?? "", /brands@abbybrand.com/);
});
});
