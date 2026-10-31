import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { commissionProductRequests, creatorAccounts, creators, signupReferrals } from "../src/db/schema";
import { accountTierFor, creatorBlockedFromConnections } from "../src/lib/account-tier";
import { listOpenCommissionCampaigns, saveCommissionCampaign } from "../src/lib/commission-campaigns";
import { freeCommissionLimit, redactCommissionForFree, requestCommissionProduct, resolveProductRequest } from "../src/lib/commission-access";
import { activeFreeStep, freeOnboardingState, saveFreeHandles, saveFreeNiche } from "../src/lib/free-onboarding";
import { finishOnboarding } from "../src/lib/onboarding";
import { paymentsEnabled } from "../src/lib/payments-config";
import { pricingComparison } from "../src/lib/pricing-comparison";
import { portalHomeReturn } from "../src/lib/portal-return";
import { resolveLogin } from "../src/lib/queries";
import { analyticsLevel, whereToStart } from "../src/lib/where-to-start";
import { dismissWelcomeChecklist, welcomeChecklist } from "../src/lib/welcome-checklist";
import {
  CODE_CHECK_LIMIT,
  checkInviteCode,
  completeFreeSignup,
  creatorCanShareCode,
  ensureInviteCode,
  prepareFreeSignup,
  setInviteCodeCap,
  setInviteCodeDisabled,
  setSignupCodeRequired,
  signupCodeRequired,
} from "../src/lib/signup-codes";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("free tier onboarding", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("existing creators stay managed, strangers still cannot sign in, and payments stay off", async () => {
    assert.equal(await accountTierFor(db, "mariclare"), "managed");
    assert.equal((await resolveLogin(db, "someone@gmail.com")).ok, false);
    assert.equal(paymentsEnabled(), false);
    assert.equal(source(".env.example").includes("FREE_COMMISSION_LIMIT=\n") || source(".env.example").includes("FREE_COMMISSION_LIMIT=\r\n") || /FREE_COMMISSION_LIMIT=\s*$/m.test(source(".env.example")), true);
    assert.equal(source("src/lib/payments-config.ts").includes('process.env.PAYMENTS_ENABLED === "true"'), true);
    assert.equal(source("src/app/loading.tsx").includes("Loading your deals"), false);
    assert.match(source("src/app/page.tsx"), /You have no deals yet\. Check back daily, or browse our/);
    assert.match(source("src/app/page.tsx"), /commission-only section/);
    assert.match(source("src/app/page.tsx"), /\/login\?next=\//);
    assert.match(source("src/app/login/page.tsx"), /Create a free account/);
    assert.match(source("src/app/signup/page.tsx"), /Invite code/);
    assert.equal(portalHomeReturn("/"), "/");
    assert.equal(portalHomeReturn("https://evil.example"), null);
    for (const file of ["src/app/signup/page.tsx", "src/components/pricing-comparison.tsx", "src/components/site-footer.tsx", "src/app/apply/page.tsx"]) {
      assert.equal(source(file).includes("LLC"), false);
      assert.equal(source(file).toLowerCase().includes("follower minimum"), false);
    }
    const comparison = pricingComparison();
    assert.deepEqual(comparison.columns.map((column) => [column.name, column.price, column.button]), [
      ["Free", "$0", "Create a free account"],
      ["Plus", "$19/mo", "Buy now"],
      ["Pro", "$39/mo", "Upgrade"],
      ["Business", "$199/mo", "Upgrade"],
    ]);
    assert.equal(comparison.columns[2].highlight, true);
    assert.equal(comparison.columns[3].featured, true);
    assert.match(comparison.columns[1].href, /^https:\/\/buy\.stripe\.com\//);
    assert.match(source("src/components/pricing-comparison.tsx"), /<TierButtons columns=\{model\.columns\} \/>[\s\S]*<TierButtons columns=\{model\.columns\} \/>/);
    assert.equal(source("src/components/pricing-comparison.tsx").toLowerCase().includes("waitlist"), false);
  });

  test("a valid invite code creates a free account and records who referred whom", async () => {
    await db.update(creators).set({ contracted: true }).where(eq(creators.id, "mariclare"));
    const code = await ensureInviteCode(db, "mariclare");
    assert.ok(code);
    const prepared = await prepareFreeSignup(db, { code: code!.code, honeypot: "", ip: "203.0.113.10" });
    assert.equal(prepared.ok, true);
    if (!prepared.ok || !prepared.grant) throw new Error("expected a grant");
    const created = await completeFreeSignup(db, "New.Creator@gmail.com", prepared.grant);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(await accountTierFor(db, created.viewer.creatorId), "free");
    const referral = await db.select().from(signupReferrals).where(eq(signupReferrals.referredCreatorId, created.viewer.creatorId));
    assert.equal(referral[0]?.referrerCreatorId, "mariclare");
    assert.equal(await creatorBlockedFromConnections(db, created.viewer), true);
    const bot = await finishOnboarding(db, created.viewer.creatorId, {
      botName: "New Bot",
      niche: "lifestyle",
      kidsAges: "",
      contentStyle: "warm",
      rates: "100",
      favoriteBrands: "",
      platforms: ["tiktok"],
    });
    assert.equal(bot.ok, false);

    const bad = await checkInviteCode(db, "NOPECODE", "203.0.113.11");
    assert.equal(bad.ok, false);
    assert.equal((await setInviteCodeDisabled(db, admin, code!.id, true)).ok, true);
    const disabled = await checkInviteCode(db, code!.code, "203.0.113.12");
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.error, "disabled");
    await setInviteCodeDisabled(db, admin, code!.id, false);
    await setInviteCodeCap(db, admin, code!.id, 1);
    const capped = await checkInviteCode(db, code!.code, "203.0.113.13");
    assert.equal(capped.ok, false);
    if (!capped.ok) assert.equal(capped.error, "used");

    assert.equal(await signupCodeRequired(db), true);
    assert.equal((await setSignupCodeRequired(db, admin, false)).ok, true);
    assert.equal(await signupCodeRequired(db), false);
    const open = await prepareFreeSignup(db, { code: "", honeypot: "", ip: "203.0.113.20" });
    assert.equal(open.ok, true);
    if (open.ok) assert.equal(open.grant, null);
    const second = await completeFreeSignup(db, "solo.free@gmail.com", null);
    assert.equal(second.ok, true);
    await setSignupCodeRequired(db, admin, true);
    const blocked = await completeFreeSignup(db, "needs.code@gmail.com", null);
    assert.equal(blocked.ok, false);

    let limited = false;
    for (let index = 0; index < CODE_CHECK_LIMIT + 2; index += 1) {
      const result = await checkInviteCode(db, "NOPECODE", "198.51.100.8");
      if (!result.ok && result.error === "rate") limited = true;
    }
    assert.equal(limited, true);
    const honeypot = await prepareFreeSignup(db, { code: code!.code, honeypot: "https://spam.example", ip: "203.0.113.30" });
    assert.equal(honeypot.ok, false);
  });

  test("plus members do not get a code, and Pro or signed creators do", async () => {
    assert.equal(await creatorCanShareCode(db, "abby"), false);
    await db.insert(creatorAccounts).values({
      creatorId: "abby",
      plan: "Plus",
      aiTier: "plus",
      aiCreditsUsed: 0,
      addOns: "[]",
      emailNotices: true,
      pushNotices: false,
      quietHours: true,
      communityVisible: false,
      subscriptionPlan: "plus",
      subscriptionStatus: "active",
      updatedAt: "2026-10-31T00:00:00.000Z",
    });
    assert.equal(await creatorCanShareCode(db, "abby"), false);
    await db.update(creatorAccounts).set({ subscriptionPlan: "pro" }).where(eq(creatorAccounts.creatorId, "abby"));
    assert.equal(await creatorCanShareCode(db, "abby"), true);
    assert.ok(await ensureInviteCode(db, "abby"));
    await db.update(creatorAccounts).set({ subscriptionPlan: "business" }).where(eq(creatorAccounts.creatorId, "abby"));
    assert.equal(await creatorCanShareCode(db, "abby"), true);
  });

  test("free commission deals hide the brand, and one open request is enforced", async () => {
    const previous = process.env.FREE_COMMISSION_LIMIT;
    delete process.env.FREE_COMMISSION_LIMIT;
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => { warnings.push(String(message ?? "")); };
    assert.equal(freeCommissionLimit(), null);
    console.warn = original;
    assert.equal(warnings.some((line) => line.includes("FREE_COMMISSION_LIMIT is unset")), true);

    await saveCommissionCampaign(db, {
      id: "camp-zebra",
      brand: "ZebraBrand",
      title: "ZebraBrand spring kit",
      description: "Email secret@zebrabrand.com and open https://zebra.example/track",
      terms: "Commission for @zebrabrand",
      trackingLink: "https://zebra.example/track",
      status: "open",
    });
    const created = await completeFreeSignup(db, "solo.viewer@gmail.com", null);
    assert.equal(created.ok, false);
    await setSignupCodeRequired(db, admin, false);
    const signedUp = await completeFreeSignup(db, "solo.viewer@gmail.com", null);
    assert.equal(signedUp.ok, true);
    if (!signedUp.ok) return;
    const viewer = signedUp.viewer;
    const board = await listOpenCommissionCampaigns(db, viewer);
    const zebra = board.find((item) => item.id === "camp-zebra");
    assert.ok(zebra);
    assert.equal(JSON.stringify(zebra).includes("ZebraBrand"), false);
    assert.equal(JSON.stringify(zebra).includes("zebra.example"), false);
    assert.equal(JSON.stringify(zebra).includes("secret@zebrabrand.com"), false);
    assert.equal(zebra?.brand, "A brand");
    const managed = await listOpenCommissionCampaigns(db, mariclare);
    assert.equal(managed.some((item) => item.brand === "ZebraBrand"), true);

    const closed = await requestCommissionProduct(db, viewer, "camp-zebra");
    assert.equal(closed.ok, false);
    if (!closed.ok) assert.match(closed.error, /coming soon/);
    process.env.FREE_COMMISSION_LIMIT = "1";
    const first = await requestCommissionProduct(db, viewer, "camp-zebra");
    assert.equal(first.ok, true);
    const second = await requestCommissionProduct(db, viewer, "camp-zebra");
    assert.equal(second.ok, false);
    if (!second.ok) assert.match(second.error, /open product request/);
    const open = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
    assert.equal(open.filter((row) => row.status === "open").length, 1);
    await resolveProductRequest(db, viewer, open[0].id, "cancelled");
    const afterCancel = await requestCommissionProduct(db, viewer, "camp-zebra");
    assert.equal(afterCancel.ok, true);
    const reopened = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
    const current = reopened.find((row) => row.status === "open");
    assert.ok(current);
    await resolveProductRequest(db, admin, current!.id, "approved");
    const cappedRequest = await requestCommissionProduct(db, viewer, "camp-zebra");
    assert.equal(cappedRequest.ok, false);
    if (!cappedRequest.ok) assert.match(cappedRequest.error, /free commission limit/);
    if (previous === undefined) delete process.env.FREE_COMMISSION_LIMIT;
    else process.env.FREE_COMMISSION_LIMIT = previous;
    assert.equal(redactCommissionForFree({
      id: "x",
      brand: "ZebraBrand",
      title: "ZebraBrand",
      description: "hi",
      terms: "terms",
      trackingLink: "https://zebra.example/track",
      trackingPending: false,
      bonus: null,
      bonusPending: true,
      rate: "TBD",
      status: "open",
      createdAt: "2026-10-31T00:00:00.000Z",
      interestCount: 0,
    }).trackingLink, null);
  });

  test("onboarding resumes on the first incomplete step and the checklist ticks itself", async () => {
    await setSignupCodeRequired(db, admin, false);
    const created = await completeFreeSignup(db, "steps.free@gmail.com", null);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const viewer = created.viewer;
    let state = await freeOnboardingState(db, viewer.creatorId);
    assert.equal(activeFreeStep(state.firstIncomplete, "uploads"), "handles");
    const saved = await saveFreeHandles(db, viewer, [{ platform: "tiktok", handle: "@steps", followers: "1200", views: "" }]);
    assert.equal(saved.ok, true);
    state = await freeOnboardingState(db, viewer.creatorId);
    assert.equal(activeFreeStep(state.firstIncomplete, "uploads"), "niche");
    assert.equal((await saveFreeNiche(db, viewer, ["gaming"], "")).ok, true);
    state = await freeOnboardingState(db, viewer.creatorId);
    assert.equal(state.firstIncomplete, "uploads");
    const level = analyticsLevel({ followers: 1200, views: null, uploads: 0 });
    assert.equal(level, "building");
    assert.equal(whereToStart("gaming", level).topic, "editing");
    const list = await welcomeChecklist(db, viewer.creatorId);
    assert.equal(list.items.find((item) => item.id === "handles")?.done, true);
    assert.equal(list.items.find((item) => item.id === "stats")?.done, false);
    assert.equal(list.complete, false);
    assert.equal((await dismissWelcomeChecklist(db, viewer)).ok, false);
    assert.equal(state.finished, false);
  });
});
