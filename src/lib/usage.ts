import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, deals, usageRights } from "@/db/schema";
import { canSeeDeal } from "./authz";
import { nowIso } from "./format";
import { assertStaffAccess } from "./managers";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

/** Renewal suggestions only. Nothing here is charged. */
export const USAGE_CATALOG = [
  { sku: "B-UA", label: "Usage add-on", days: 30 },
  { sku: "B-UA90", label: "90-day usage", days: 90 },
  { sku: "B-UA12", label: "12-month usage", days: 365 },
  { sku: "B-UAP", label: "Perpetual usage", days: null },
] as const;

export const USAGE_DAY_TIERS = [30, 60, 90, 180, 365] as const;
export type UsageDayTier = (typeof USAGE_DAY_TIERS)[number];

export const USAGE_CHANNELS = [
  { id: "organic_repost", label: "Organic repost" },
  { id: "paid_ads", label: "Paid ads / whitelisting" },
  { id: "website", label: "Website" },
  { id: "email", label: "Email" },
] as const;

export type UsageChannelId = (typeof USAGE_CHANNELS)[number]["id"];

export const RENEWAL_OFFER_DAYS = [30, 60, 90] as const;

/** Owner panel: a window ending inside this many days, plus recently expired. */
export const USAGE_ENDING_SOON_DAYS = 14;
export const USAGE_RECENTLY_EXPIRED_DAYS = 7;

export const PERPETUAL_WITHHELD_ERROR = "Perpetual usage stays off unless the owner turns it on.";
export const USAGE_TIER_ERROR = "Pick a usage tier of 30, 60, 90, 180, or 365 days.";
export const USAGE_CHANNEL_ERROR = "Pick at least one channel.";
export const USAGE_FEE_ERROR = "Enter a dollar amount.";
export const USAGE_FEE_OWNER_ERROR = "Only the owner can record a renewal fee.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dayNumber(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function isUsageDayTier(value: number): value is UsageDayTier {
  return (USAGE_DAY_TIERS as readonly number[]).includes(value);
}

export function usageChannelLabel(id: string) {
  return USAGE_CHANNELS.find((channel) => channel.id === id)?.label ?? id;
}

/** End date is the start date plus the tier length, in calendar days. */
export function usageEndDate(startsOn: string, tierDays: number) {
  if (!isIsoDate(startsOn) || !Number.isInteger(tierDays)) return null;
  const [year, month, day] = startsOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + tierDays);
  return date.toISOString().slice(0, 10);
}

export function usageTierLabel(tier: string | null, startsOn: string, endsOn: string | null, perpetualOverride: boolean) {
  if (perpetualOverride || tier === "perpetual" || !endsOn) return "Perpetual";
  if (tier && isUsageDayTier(Number(tier))) return `${Number(tier)} days`;
  if (isIsoDate(startsOn) && isIsoDate(endsOn)) {
    const span = dayNumber(endsOn) - dayNumber(startsOn);
    if (isUsageDayTier(span)) return `${span} days`;
  }
  return "Custom";
}

export function usageChannelsLabel(channelsJson: string | null) {
  if (!channelsJson) return "Not set";
  try {
    const parsed = JSON.parse(channelsJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return "Not set";
    return parsed.map((id) => usageChannelLabel(String(id))).join(", ");
  } catch {
    return "Not set";
  }
}

export function normalizeUsageChannels(channels: string[]) {
  const picked: UsageChannelId[] = [];
  for (const channel of channels) {
    const known = USAGE_CHANNELS.find((item) => item.id === channel);
    if (!known) return { ok: false as const, error: USAGE_CHANNEL_ERROR };
    if (!picked.includes(known.id)) picked.push(known.id);
  }
  if (picked.length === 0) return { ok: false as const, error: USAGE_CHANNEL_ERROR };
  return { ok: true as const, channels: picked };
}

/**
 * A day tier computes the end date. Perpetual is stored only when the owner
 * passes perpetualOverride. Leaving the end blank does not grant perpetual.
 */
export function resolveUsageTerm(input: {
  startsOn: string;
  tier?: number | "perpetual" | null;
  endsOn?: string | null;
  perpetualOverride?: boolean;
  actorRole: string;
}): { ok: true; endsOn: string | null; tier: string | null; perpetual: boolean } | { ok: false; error: string } {
  if (typeof input.tier === "number") {
    if (!isUsageDayTier(input.tier)) return { ok: false, error: USAGE_TIER_ERROR };
    const endsOn = usageEndDate(input.startsOn, input.tier);
    if (!endsOn) return { ok: false, error: "Use dates like 2026-10-21." };
    return { ok: true, endsOn, tier: String(input.tier), perpetual: false };
  }
  if (input.tier === "perpetual" || input.perpetualOverride === true) {
    if (input.actorRole !== "admin" || input.perpetualOverride !== true) {
      return { ok: false, error: PERPETUAL_WITHHELD_ERROR };
    }
    return { ok: true, endsOn: null, tier: "perpetual", perpetual: true };
  }
  const endsOn = input.endsOn ? input.endsOn : null;
  if (endsOn) {
    if (!isIsoDate(endsOn)) return { ok: false, error: "Use dates like 2026-10-21." };
    if (dayNumber(endsOn) < dayNumber(input.startsOn)) {
      return { ok: false, error: "The end date has to be on or after the start." };
    }
    return { ok: true, endsOn, tier: null, perpetual: false };
  }
  return { ok: false, error: PERPETUAL_WITHHELD_ERROR };
}

/** Deals whose usage ends in the next 14 days, or ended in the last 7. Perpetual is excluded. */
export function usageWindowStatus(endsOn: string | null, today: string) {
  if (!endsOn || !isIsoDate(endsOn) || !isIsoDate(today)) return null;
  const daysLeft = dayNumber(endsOn) - dayNumber(today);
  if (daysLeft > USAGE_ENDING_SOON_DAYS || daysLeft < -USAGE_RECENTLY_EXPIRED_DAYS) return null;
  if (daysLeft < 0) return { status: "expired" as const, daysLeft };
  return { status: "soon" as const, daysLeft };
}

export function suggestUsageRenewal(startsOn: string, endsOn: string | null) {
  if (!endsOn) return USAGE_CATALOG.find((item) => item.sku === "B-UAP")!;
  const span = Math.max(1, dayNumber(endsOn) - dayNumber(startsOn));
  const timed = USAGE_CATALOG.filter((item) => item.days != null);
  return timed.reduce((best, item) => Math.abs((item.days ?? 0) - span) < Math.abs((best.days ?? 0) - span) ? item : best);
}

export function usageFlag(endsOn: string | null, today: string) {
  if (!endsOn) return null;
  const left = dayNumber(endsOn) - dayNumber(today);
  if (left < 0) return "expired" as const;
  if (left <= 30) return "soon" as const;
  return null;
}

/** Calendar days from today until the end date. Negative means the window has ended. */
export function usageDaysLeft(endsOn: string | null, today: string) {
  if (!endsOn || !isIsoDate(endsOn) || !isIsoDate(today)) return null;
  return dayNumber(endsOn) - dayNumber(today);
}

export type UsageCard = {
  dealId: string;
  brand: string;
  startsOn: string;
  endsOn: string | null;
  usageType: string | null;
  territory: string | null;
  exclusivityCategory: string | null;
  exclusivityEndsOn: string | null;
  tierLabel: string;
  channelsLabel: string;
  flag: "expired" | "soon" | null;
  renewalSku: string;
  renewalLabel: string;
};

export type UsageEndingRow = {
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  tierLabel: string;
  channelsLabel: string;
  endsOn: string;
  status: "soon" | "expired";
  daysLeft: number;
};

/** Owner-dashboard window. The rights table still uses the wider usageFlag. */
export const EXPIRY_ALERT_DAYS = 14;

export type ExpiryAlert = {
  dealId: string;
  brand: string;
  kind: "usage" | "exclusivity";
  endsOn: string;
  status: "soon" | "expired";
  daysLeft: number;
  category: string | null;
};

export function usageExpiryAlerts(
  cards: Pick<UsageCard, "dealId" | "brand" | "endsOn" | "exclusivityEndsOn" | "exclusivityCategory">[],
  today: string,
): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];
  for (const card of cards) {
    const usage = alertFor(card.endsOn, today);
    if (usage) {
      alerts.push({ dealId: card.dealId, brand: card.brand, kind: "usage", endsOn: card.endsOn!, category: null, ...usage });
    }
    const exclusivity = alertFor(card.exclusivityEndsOn, today);
    if (exclusivity) {
      alerts.push({
        dealId: card.dealId,
        brand: card.brand,
        kind: "exclusivity",
        endsOn: card.exclusivityEndsOn!,
        category: card.exclusivityCategory,
        ...exclusivity,
      });
    }
  }
  return alerts.sort((left, right) => left.endsOn.localeCompare(right.endsOn) || left.brand.localeCompare(right.brand));
}

function alertFor(endsOn: string | null, today: string) {
  if (!endsOn) return null;
  const daysLeft = dayNumber(endsOn) - dayNumber(today);
  if (daysLeft < 0) return { status: "expired" as const, daysLeft };
  if (daysLeft <= EXPIRY_ALERT_DAYS) return { status: "soon" as const, daysLeft };
  return null;
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, 160) : null;
}

async function canEdit(db: PortalDb, creatorId: string, actor: { email: string; role: string }) {
  if (actor.role === "admin" || actor.role === "bot") return { ok: true as const };
  if (actor.role === "manager") {
    return assertStaffAccess(db, {
      actorEmail: actor.email,
      actorRole: "manager",
      creatorId,
      permission: "stage",
    });
  }
  return { ok: false as const, status: 403, error: "You can't change usage rights." };
}

export async function saveUsageRights(
  db: PortalDb,
  input: {
    dealId: string;
    startsOn: string;
    endsOn: string | null;
    tier?: number | "perpetual" | null;
    channels?: string[] | null;
    perpetualOverride?: boolean;
    renewalFeeCents?: number | null;
    usageType?: string | null;
    territory?: string | null;
    exclusivityCategory?: string | null;
    exclusivityEndsOn?: string | null;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ id: string; endsOn: string | null }>> {
  if (!isIsoDate(input.startsOn) || (input.endsOn != null && input.endsOn !== "" && !isIsoDate(input.endsOn))) {
    return { ok: false, status: 400, error: "Use dates like 2026-10-21." };
  }
  if (input.exclusivityEndsOn && !isIsoDate(input.exclusivityEndsOn)) {
    return { ok: false, status: 400, error: "Use dates like 2026-10-21." };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const allowed = await canEdit(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
  if (!allowed.ok) return allowed;
  const term = resolveUsageTerm({
    startsOn: input.startsOn,
    tier: input.tier,
    endsOn: input.endsOn,
    perpetualOverride: input.perpetualOverride,
    actorRole: input.actorRole,
  });
  if (!term.ok) return { ok: false, status: 400, error: term.error };
  let channelsJson: string | undefined;
  if (input.channels != null) {
    const parsed = normalizeUsageChannels(input.channels);
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
    channelsJson = JSON.stringify(parsed.channels);
  }
  if (input.renewalFeeCents != null) {
    if (!Number.isInteger(input.renewalFeeCents) || input.renewalFeeCents <= 0) {
      return { ok: false, status: 400, error: USAGE_FEE_ERROR };
    }
    if (input.actorRole !== "admin") return { ok: false, status: 403, error: USAGE_FEE_OWNER_ERROR };
  }
  const timestamp = nowIso();
  const existing = await db.select().from(usageRights).where(eq(usageRights.dealId, deal.id));
  const id = existing[0]?.id ?? crypto.randomUUID();
  const extra: Partial<typeof usageRights.$inferInsert> = {};
  if (input.usageType !== undefined) extra.usageType = cleanText(input.usageType);
  if (input.territory !== undefined) extra.territory = cleanText(input.territory);
  if (input.exclusivityCategory !== undefined) extra.exclusivityCategory = cleanText(input.exclusivityCategory);
  if (input.exclusivityEndsOn !== undefined) extra.exclusivityEndsOn = input.exclusivityEndsOn || null;
  if (channelsJson !== undefined) extra.channelsJson = channelsJson;
  if (input.renewalFeeCents !== undefined) extra.renewalFeeCents = input.renewalFeeCents;
  const saved = {
    startsOn: input.startsOn,
    endsOn: term.endsOn,
    tier: term.tier,
    perpetualOverride: term.perpetual,
    updatedAt: timestamp,
    ...extra,
  };
  if (existing[0]) {
    await db.update(usageRights).set(saved).where(eq(usageRights.id, id));
  } else {
    await db.insert(usageRights).values({
      id,
      dealId: deal.id,
      usageType: extra.usageType ?? null,
      territory: extra.territory ?? null,
      exclusivityCategory: extra.exclusivityCategory ?? null,
      exclusivityEndsOn: extra.exclusivityEndsOn ?? null,
      channelsJson: extra.channelsJson ?? null,
      renewalFeeCents: extra.renewalFeeCents ?? null,
      createdAt: timestamp,
      ...saved,
    });
  }
  return { ok: true, id, endsOn: term.endsOn };
}

export async function listUsageRights(db: PortalDb, viewer: Viewer, today: string): Promise<UsageCard[]> {
  const rows = await db.select().from(usageRights);
  const dealRows = await db.select().from(deals);
  const byId = new Map(dealRows.map((deal) => [deal.id, deal]));
  return rows.flatMap((row) => {
    const deal = byId.get(row.dealId);
    if (!deal || !canSeeDeal(viewer, deal)) return [];
    const renewal = suggestUsageRenewal(row.startsOn, row.endsOn);
    return [{
      dealId: deal.id,
      brand: deal.brand,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      usageType: row.usageType,
      territory: row.territory,
      exclusivityCategory: row.exclusivityCategory,
      exclusivityEndsOn: row.exclusivityEndsOn,
      tierLabel: usageTierLabel(row.tier, row.startsOn, row.endsOn, row.perpetualOverride),
      channelsLabel: usageChannelsLabel(row.channelsJson),
      flag: usageFlag(row.endsOn, today),
      renewalSku: renewal.sku,
      renewalLabel: renewal.label,
    }];
  }).sort((left, right) => (left.endsOn ?? "9999").localeCompare(right.endsOn ?? "9999"));
}

export async function listUsageEndingSoon(db: PortalDb, viewer: Viewer, today: string): Promise<UsageEndingRow[]> {
  const [rows, dealRows, creatorRows] = await Promise.all([
    db.select().from(usageRights),
    db.select().from(deals),
    db.select().from(creators),
  ]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorsById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const items: UsageEndingRow[] = [];
  for (const row of rows) {
    const window = usageWindowStatus(row.endsOn, today);
    if (!window || !row.endsOn) continue;
    const deal = dealsById.get(row.dealId);
    if (!deal || !canSeeDeal(viewer, deal)) continue;
    items.push({
      dealId: deal.id,
      brand: deal.brand,
      creatorId: deal.creatorId,
      creatorName: creatorsById.get(deal.creatorId)?.name ?? "Creator",
      tierLabel: usageTierLabel(row.tier, row.startsOn, row.endsOn, row.perpetualOverride),
      channelsLabel: usageChannelsLabel(row.channelsJson),
      endsOn: row.endsOn,
      status: window.status,
      daysLeft: window.daysLeft,
    });
  }
  return items.sort((left, right) => left.endsOn.localeCompare(right.endsOn) || left.brand.localeCompare(right.brand));
}
