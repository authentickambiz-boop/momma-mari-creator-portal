import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { GIFTED_FINDERS_FEE_CENTS, GIFTED_TERMS_VERSION } from "../src/config/gifted-terms";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creators, deals, payments } from "../src/db/schema";
import { authorizeBot, upsertCreator, upsertDeal } from "../src/lib/bot-api";
import { listBrandCrm } from "../src/lib/brand-crm";
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
import {
  applyForGiftedOffer,
  applyForGiftedOfferByEmail,
  approveGiftedApplicant,
  createGiftedOffer,
  flagGiftedOwed,
  giftedAmountOwed,
  listGiftedBoard,
  listGiftedOverdue,
  markGiftedDelivered,
  markGiftedShipped,
  refreshGiftedOverdue,
} from "../src/lib/gifted";
import { joinBench } from "../src/lib/bench";
import { addManager } from "../src/lib/managers";
import { findCreatorById, getDealForViewer } from "../src/lib/queries";
import type { Viewer } from "../src/lib/types";
import { abby, admin, mariclare, openTestDb } from "./harness";

describe("permissions and gifts", { concurrency: 1 }, () => {
let db: PortalDb;
before(() => {
  db = openTestDb();
});

test("capability levels stay off until training is done, and draft-only waits for the owner", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const migration = readFileSync(path.join(process.cwd(), "drizzle/0037_capability_grants.sql"), "utf8");
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

test("gifted products require the draft terms, and a missed video is only flagged", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const kosblingList = await listBrandCrm(db, admin);
  assert.equal(kosblingList.ok, true);
  if (!kosblingList.ok) return;
  const kosblingCrm = kosblingList.brands.find((brand) => brand.key === "kosbling");
  const migration = readFileSync(path.join(process.cwd(), "drizzle/0038_gifted_products.sql"), "utf8");
  assert.equal(migration.toLowerCase().includes("update deals"), false);
  assert.equal(migration.includes("KOSBLING"), true);
  const terms = readFileSync(path.join(process.cwd(), "src/config/gifted-terms.ts"), "utf8");
  assert.equal(terms.includes("DRAFT"), true);
  assert.equal(/pending lawyer review/i.test(terms), true);
  assert.equal(/stripe/i.test(readFileSync(path.join(process.cwd(), "src/lib/gifted.ts"), "utf8")), false);
  assert.equal(GIFTED_FINDERS_FEE_CENTS, 5000);

  const managerTry = await createGiftedOffer(db, {
    actorRole: "manager",
    actorName: "Quinn",
    brand: "Glow Soap",
    product: "Glow bar",
    photos: "https://example.com/glow.jpg",
    deliverable: "1 TikTok",
    dueOn: "2026-11-20",
    retailValueCents: 2400,
  });
  assert.equal(managerTry.ok, false);
  if (!managerTry.ok) assert.equal(managerTry.status, 403);

  const posted = await createGiftedOffer(db, {
    actorRole: "admin",
    actorName: "Kamron",
    brand: "Glow Soap",
    product: "Glow bar",
    photos: "https://example.com/glow.jpg",
    deliverable: "1 TikTok",
    dueOn: "2026-11-20",
    retailValueCents: 2400,
  });
  assert.equal(posted.ok, true);
  if (!posted.ok) return;
  const brands = await listBrandCrm(db, admin);
  assert.equal(brands.ok, true);
  if (!brands.ok) return;
  const glow = brands.brands.find((brand) => brand.key === "glow soap");
  assert.equal(glow?.crm.some((row) => row.outcome === "future paid prospect"), true);
  assert.equal((await db.select().from(deals).where(eq(deals.brand, "Glow Soap"))).length, 0);

  const refused = await applyForGiftedOffer(db, {
    offerId: posted.id,
    creatorId: "mariclare",
    acceptTerms: false,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(refused.ok, false);
  const wrongVersion = await applyForGiftedOffer(db, {
    offerId: posted.id,
    creatorId: "mariclare",
    acceptTerms: true,
    termsVersion: "old",
  });
  assert.equal(wrongVersion.ok, false);
  assert.equal((await listGiftedBoard(db, mariclare)).find((offer) => offer.id === posted.id)?.mine, null);

  const applied = await applyForGiftedOffer(db, {
    offerId: posted.id,
    creatorId: "mariclare",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const mine = (await listGiftedBoard(db, mariclare)).find((offer) => offer.id === posted.id)?.mine;
  assert.equal(mine?.status, "applied");
  const adminCard = (await listGiftedBoard(db, admin)).find((offer) => offer.id === posted.id);
  const mari = adminCard?.applicants.find((row) => row.creatorId === "mariclare");
  assert.equal(mari?.termsVersion, GIFTED_TERMS_VERSION);
  assert.equal(mari?.termsAcceptedAt == null, false);
  assert.equal((await listGiftedBoard(db, abby)).find((offer) => offer.id === posted.id)?.applicants.length, 0);
  assert.equal((await applyForGiftedOffer(db, {
    offerId: posted.id,
    creatorId: "mariclare",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  })).ok, false);

  assert.equal((await upsertCreator(db, { id: "nova-gift", name: "Nova Lane", email: "nova.lane@gmail.com", initials: "NL" })).status, 201);
  const nova = await applyForGiftedOffer(db, {
    offerId: posted.id,
    creatorId: "nova-gift",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(nova.ok, true);
  const bench = await joinBench(db, { name: "Bee Bench", email: "bee.bench@gmail.com", niches: ["home"], platforms: ["TikTok"], samples: [] });
  assert.equal(bench.ok, true);
  const benchApply = await applyForGiftedOfferByEmail(db, {
    offerId: posted.id,
    email: "bee.bench@gmail.com",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(benchApply.ok, true);
  const signIn = await applyForGiftedOfferByEmail(db, {
    offerId: posted.id,
    email: "mmaclamroc@gmail.com",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(signIn.ok, false);
  if (!signIn.ok) assert.equal(signIn.error, "Sign in to apply. Free products are on your portal.");

  const creatorApprove = await approveGiftedApplicant(db, { actorRole: "creator", applicationId: applied.id });
  assert.equal(creatorApprove.ok, false);
  assert.equal((await approveGiftedApplicant(db, { actorRole: "admin", applicationId: applied.id })).ok, true);
  assert.equal((await markGiftedShipped(db, { actorRole: "admin", applicationId: applied.id })).ok, true);
  assert.equal((await markGiftedDelivered(db, { actorRole: "admin", applicationId: applied.id })).ok, true);
  assert.equal(await refreshGiftedOverdue(db, new Date("2026-10-19T16:00:00.000Z")), 0);

  const late = await createGiftedOffer(db, {
    actorRole: "admin",
    actorName: "Kamron",
    brand: "Late Soap",
    product: "Late bar",
    photos: "https://example.com/late.jpg",
    deliverable: "1 TikTok",
    dueOn: "2026-10-18",
    retailValueCents: 2400,
  });
  assert.equal(late.ok, true);
  if (!late.ok) return;
  const lateApply = await applyForGiftedOffer(db, {
    offerId: late.id,
    creatorId: "abby",
    acceptTerms: true,
    termsVersion: GIFTED_TERMS_VERSION,
  });
  assert.equal(lateApply.ok, true);
  if (!lateApply.ok) return;
  assert.equal(await refreshGiftedOverdue(db, new Date("2026-10-19T16:00:00.000Z")), 0);
  assert.equal((await listGiftedBoard(db, abby)).find((offer) => offer.id === late.id)?.mine?.status, "applied");
  assert.equal((await approveGiftedApplicant(db, { actorRole: "admin", applicationId: lateApply.id })).ok, true);
  const earlyFlag = await flagGiftedOwed(db, { actorRole: "admin", applicationId: lateApply.id });
  assert.equal(earlyFlag.ok, false);
  assert.equal((await markGiftedShipped(db, { actorRole: "admin", applicationId: lateApply.id })).ok, true);
  assert.equal((await markGiftedDelivered(db, { actorRole: "admin", applicationId: lateApply.id })).ok, true);
  assert.equal(await refreshGiftedOverdue(db, new Date("2026-10-19T16:00:00.000Z")) > 0, true);
  const owedAlert = (await listGiftedOverdue(db, admin, new Date("2026-10-19T16:00:00.000Z"))).find((row) => row.id === lateApply.id);
  assert.equal(owedAlert?.status, "overdue");
  const beforePayments = (await db.select().from(payments)).length;
  const flagged = await flagGiftedOwed(db, { actorRole: "admin", applicationId: lateApply.id });
  assert.equal(flagged.ok, true);
  const charged = (await listGiftedBoard(db, admin)).find((offer) => offer.id === late.id)?.applicants.find((row) => row.id === lateApply.id);
  assert.equal(charged?.status, "charged");
  assert.equal(charged?.amountOwedCents, giftedAmountOwed(2400));
  assert.equal(charged?.findersFeeCents, 5000);
  assert.equal((await db.select().from(payments)).length, beforePayments);

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  const kosblingListAfter = await listBrandCrm(db, admin);
  assert.equal(kosblingListAfter.ok, true);
  if (!kosblingListAfter.ok) return;
  const kosblingCrmAfter = kosblingListAfter.brands.find((brand) => brand.key === "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  assert.equal(JSON.stringify(kosblingCrmAfter?.crm ?? []), JSON.stringify(kosblingCrm?.crm ?? []));
});
});
