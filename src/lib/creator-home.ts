import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, creatorAccounts, deals, payments, supportMessages } from "@/db/schema";
import { normalizeEmail, nowIso, parseJson } from "./format";
import type { Viewer } from "./types";

export const AI_TIER_CAPS = { Basic: 150, Plus: 1000, Pro: 2500 } as const;
export type AiTier = keyof typeof AI_TIER_CAPS;
export type CreatorPlan = "Core" | "Full Access";

const MENU_TAB_IDS = new Set(["profile", "referrals", "support", "settings", "billing"]);

export function isMenuTab(id: string) {
  return MENU_TAB_IDS.has(id);
}

export function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0];
  return part || name;
}

export function accountMenuItems(role: Viewer["role"]) {
  if (role === "creator") {
    return [
      { href: "/profile", label: "My profile" },
      { href: "/referrals", label: "Referrals" },
      { href: "/support", label: "Support" },
      { href: "/settings", label: "Settings" },
      { href: "/billing", label: "Billing and usage" },
    ];
  }
  if (role === "admin") {
    return [
      { href: "/referrals", label: "Referrals" },
      { href: "/support", label: "Support" },
      { href: "/settings", label: "Settings" },
    ];
  }
  return [
    { href: "/support", label: "Support" },
    { href: "/settings", label: "Settings" },
  ];
}

export function creatorHomeCards(input: { offersWaiting: number; payoutsPending: number; accountsConnected: boolean }) {
  const offers = input.offersWaiting;
  const payouts = input.payoutsPending;
  return [
    {
      href: "/analytics",
      title: "Analytics",
      status: input.accountsConnected ? "Accounts connected" : "Example numbers until accounts are connected",
    },
    {
      href: "/#deals",
      title: "Brand deals",
      status: offers === 0 ? "No offers waiting" : offers === 1 ? "1 offer waiting" : `${offers} offers waiting`,
    },
    {
      href: "/inbox",
      title: "Deal inbox",
      status: "Brand threads from your connected Gmail",
    },
    {
      href: "/earnings",
      title: "Earnings & payouts",
      status: payouts === 0 ? "No payout waiting" : payouts === 1 ? "1 payout pending" : `${payouts} payouts pending`,
    },
  ];
}

export function creatorNeedsYou(rows: { id: string; brand: string; visibleToCreator: boolean; needsCreator: boolean; workflowStage: string | null }[]) {
  return rows
    .filter((deal) => deal.visibleToCreator && (deal.needsCreator || deal.workflowStage === "offer_shared"))
    .map((deal) => ({
      id: deal.id,
      title: deal.brand,
      detail: deal.workflowStage === "offer_shared" ? "Offer waiting for your answer" : "This deal needs you",
      href: `/deals/${deal.id}`,
    }));
}

export function isAiTier(value: string): value is AiTier {
  return value === "Basic" || value === "Plus" || value === "Pro";
}

export function billingUsage(input: { tier: string; used: number }) {
  const tier: AiTier = isAiTier(input.tier) ? input.tier : "Basic";
  const cap = AI_TIER_CAPS[tier];
  const used = Math.max(0, Math.round(input.used));
  const percent = Math.min(100, Math.round((used / cap) * 100));
  const warning = used >= cap ? "100" as const : used >= cap * 0.8 ? "80" as const : null;
  return { tier, cap, used, percent, warning };
}

export function billingWarning(warning: "80" | "100" | null) {
  if (warning === "100") return "You've used all of your AI credits for this tier.";
  if (warning === "80") return "You've used 80% of your AI credits.";
  return null;
}

type AccountRow = typeof creatorAccounts.$inferSelect;

export function blankCreatorAccount(creatorId: string): AccountRow {
  return {
    creatorId,
    plan: "Core",
    aiTier: "Basic",
    aiCreditsUsed: 0,
    addOns: "[]",
    emailNotices: true,
    pushNotices: false,
    quietHours: true,
    communityVisible: true,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    subscriptionPlan: null,
    subscriptionInterval: null,
    subscriptionEventAt: null,
    updatedAt: nowIso(),
  };
}

export async function readOwnAccount(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return null;
  const rows = await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, viewer.creatorId));
  const row = rows[0] ?? blankCreatorAccount(viewer.creatorId);
  const usage = billingUsage({ tier: row.aiTier, used: row.aiCreditsUsed });
  return {
    creatorId: viewer.creatorId,
    plan: row.plan === "Full Access" ? "Full Access" as const : "Core" as const,
    addOns: parseJson<string[]>(row.addOns, []),
    emailNotices: row.emailNotices,
    pushNotices: row.pushNotices,
    quietHours: row.quietHours,
    communityVisible: row.communityVisible,
    stripe: false,
    usage,
    warning: billingWarning(usage.warning),
  };
}

export async function saveOwnSettings(
  db: PortalDb,
  viewer: Viewer,
  input: { emailNotices: boolean; pushNotices: boolean; quietHours: boolean; communityVisible: boolean },
) {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false as const, status: 403, error: "Settings for notices are on the creator's own sign-in." };
  }
  const current = (await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, viewer.creatorId)))[0] ?? blankCreatorAccount(viewer.creatorId);
  const next = {
    ...current,
    emailNotices: input.emailNotices,
    pushNotices: input.pushNotices,
    quietHours: input.quietHours,
    communityVisible: input.communityVisible,
    updatedAt: nowIso(),
  };
  if ((await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, viewer.creatorId)))[0]) {
    await db.update(creatorAccounts).set(next).where(eq(creatorAccounts.creatorId, viewer.creatorId));
  } else {
    await db.insert(creatorAccounts).values(next);
  }
  return { ok: true as const };
}

export async function countOwnPayouts(db: PortalDb, creatorId: string) {
  const ownDeals = await db.select({ id: deals.id }).from(deals).where(eq(deals.creatorId, creatorId));
  const ids = new Set(ownDeals.map((deal) => deal.id));
  const paymentRows = await db.select().from(payments);
  return paymentRows.filter((row) => ids.has(row.dealId) && row.paymentStatus === "creator_payout_pending").length;
}

export async function submitSupportMessage(
  db: PortalDb,
  viewer: Viewer,
  input: { subject: string; body: string },
) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { ok: false as const, status: 400, error: "Add a subject." };
  if (!body) return { ok: false as const, status: 400, error: "Write a message." };
  if (subject.length > 140 || body.length > 4000) return { ok: false as const, status: 400, error: "That note is too long." };
  const before = (await db.select().from(approvalEmails)).length;
  const id = crypto.randomUUID();
  await db.insert(supportMessages).values({
    id,
    authorEmail: normalizeEmail(viewer.email),
    authorName: viewer.name,
    creatorId: viewer.creatorId,
    subject,
    body,
    createdAt: nowIso(),
  });
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) {
    return { ok: false as const, status: 500, error: "Support notes stay in the portal." };
  }
  return { ok: true as const, id };
}

export async function listSupportMessages(db: PortalDb, viewer: Viewer) {
  const rows = await db.select().from(supportMessages);
  const email = normalizeEmail(viewer.email);
  const visible = viewer.role === "admin" ? rows : rows.filter((row) => row.authorEmail === email);
  return visible
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((row) => ({
      id: row.id,
      authorName: viewer.role === "admin" ? row.authorName : "You",
      subject: row.subject,
      body: row.body,
      createdAt: row.createdAt,
    }));
}
