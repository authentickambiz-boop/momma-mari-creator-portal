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
      { href: "/worlds", label: "Bot office", newTab: true },
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

const UNRECORDED = /\b(example|placeholder|sample|fake|lorem|tbd|xxx|demo)\b/i;

export type CreatorHomeStat = { value: string; label: string };

/** A figure with a real label. Example copy, blanks, and stand-in words stay off the home page. */
export function isRecordedHomeStat(stat: CreatorHomeStat) {
  const value = stat.value.trim();
  const label = stat.label.trim();
  if (!value || !label) return false;
  if (UNRECORDED.test(value) || UNRECORDED.test(label)) return false;
  return true;
}

/**
 * Creator home cards. Each card needs a recorded figure.
 * Stats are WithJuly labels. A deal, inbox, or payout card with nothing waiting is left off.
 */
export function creatorHomeCards(input: { offersWaiting: number; payoutsPending: number; stats?: CreatorHomeStat[]; inboxThreads?: number }) {
  const cards: { href: string; title: string; status: string }[] = [];
  const seen = new Set<string>();
  const push = (card: { href: string; title: string; status: string }) => {
    const title = card.title.trim();
    const status = card.status.trim();
    if (!title || !status) return;
    if (UNRECORDED.test(title) || UNRECORDED.test(status)) return;
    const key = `${card.href}|${title}|${status}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ href: card.href, title, status });
  };
  for (const stat of input.stats ?? []) {
    if (!isRecordedHomeStat(stat)) continue;
    push({ href: "/analytics", title: stat.value, status: stat.label });
  }
  const offers = input.offersWaiting;
  if (offers > 0) {
    push({
      href: "/#deals",
      title: "Brand deals",
      status: offers === 1 ? "1 deal needs you" : `${offers} deals need you`,
    });
  }
  const threads = input.inboxThreads ?? 0;
  if (threads > 0) {
    push({
      href: "/inbox",
      title: "Deal inbox",
      status: threads === 1 ? "1 brand thread" : `${threads} brand threads`,
    });
  }
  const payouts = input.payoutsPending;
  if (payouts > 0) {
    push({
      href: "/earnings",
      title: "Earnings & payouts",
      status: payouts === 1 ? "1 payout pending" : `${payouts} payouts pending`,
    });
  }
  return cards;
}

/** Stages where the creator still has something to do on a deal she already accepted. */
const CREATOR_WORK_STAGES = new Set([
  "approved_by_agency",
  "awaiting_signature",
  "waiting_for_product",
  "product_received",
  "draft_due",
  "brand_revisions",
  "brand_approved",
]);

const CREATOR_QUIET_STAGES = new Set([
  "on_hold",
  "brand_quiet",
  "cancelled",
  "creator_declined",
  "offer_received",
  "offer_shared",
  "paid",
]);

/** Creator Brand deals list. Pre-acceptance offers stay on Offers. Quiet and waiting-on-the-brand cards stay off this list. */
export function creatorBrandDealNeedsAction(deal: {
  visibleToCreator: boolean;
  needsCreator: boolean;
  uploadEnabled?: boolean;
  workflowStage: string | null;
  status?: string | null;
}) {
  if (!deal.visibleToCreator) return false;
  if (deal.status === "paid" || deal.workflowStage === "paid") return false;
  const stage = deal.workflowStage;
  if (!stage || CREATOR_QUIET_STAGES.has(stage)) return false;
  if (deal.needsCreator || deal.uploadEnabled) return true;
  return CREATOR_WORK_STAGES.has(stage);
}

export function creatorNeedsYou(rows: { id: string; brand: string; visibleToCreator: boolean; needsCreator: boolean; uploadEnabled?: boolean; workflowStage: string | null; status?: string | null }[]) {
  return rows
    .filter((deal) => creatorBrandDealNeedsAction(deal))
    .map((deal) => ({
      id: deal.id,
      title: deal.brand,
      detail: "This deal needs you",
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
