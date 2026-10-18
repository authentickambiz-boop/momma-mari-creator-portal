import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { createDb, type PortalDb } from "../src/db/index";
import { openDatabase } from "../src/db/local-d1";
import { resolveViewedCreator } from "../src/lib/authz";
import { addFeedback, authorizeBot, updateDeal, upsertCreator, upsertPayment, writeDailyAnalytics } from "../src/lib/bot-api";
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
  email: "abby.pending-signin@momma-mari.invalid",
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

  // Abby's sign-in email is not confirmed; her placeholder must not open a session.
  const placeholder = await resolveLogin(db, "abby.pending-signin@momma-mari.invalid");
  assert.equal(placeholder.ok, false);
  const retiredSeed = await resolveLogin(db, "abby.theriot@example.com");
  assert.equal(retiredSeed.ok, false);
});

test("0003 fills in the Abby and AuthenticKam profiles without inventing splits", async () => {
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
  assert.ok(abbyRow?.email.endsWith(".invalid"));
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
  const oldEmail = await resolveLogin(db, "abby.pending-signin@momma-mari.invalid");
  const newEmail = await resolveLogin(db, "abby.real@gmail.com");
  assert.equal(oldEmail.ok, false);
  assert.equal(newEmail.ok, true);
  if (newEmail.ok) assert.equal(newEmail.viewer.creatorId, "abby");
});
});
