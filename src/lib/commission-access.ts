import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { commissionCampaigns, commissionProductRequests } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import type { CommissionCampaign } from "./commission-campaigns";
import { nowIso } from "./format";
import type { Viewer } from "./types";

let warnedUnsetLimit = false;
let warnedInvalidCountMode = false;

/**
 * Kamron sets this. There is no default number.
 * Unset or invalid values keep free product requests closed.
 */
export function freeCommissionLimit() {
  const raw = process.env.FREE_COMMISSION_LIMIT;
  if (raw == null || raw.trim() === "") {
    if (!warnedUnsetLimit) {
      warnedUnsetLimit = true;
      console.warn("FREE_COMMISSION_LIMIT is unset. Free commission requests stay closed until Kamron sets it.");
    }
    return null;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 1) {
    if (!warnedUnsetLimit) {
      warnedUnsetLimit = true;
      console.warn("FREE_COMMISSION_LIMIT is not a positive whole number. Free commission requests stay closed.");
    }
    return null;
  }
  return value;
}

/** How requests count toward FREE_COMMISSION_LIMIT. The cap itself stays that number. */
export const FREE_COMMISSION_COUNT_MODES = [
  "lifetime",
  "lifetime_excluding_declined",
  "monthly_excluding_declined",
] as const;
export type FreeCommissionCountMode = (typeof FREE_COMMISSION_COUNT_MODES)[number];

/** Month windows for monthly_excluding_declined. Not AGENCY_TIMEZONE. */
export const FREE_COMMISSION_MONTH_TIME_ZONE = "America/New_York";

const LIFETIME_LIMIT_REACHED = "You've reached the free commission limit.";
const MONTHLY_LIMIT_REACHED = "You've reached this month's free commission limit.";

function isCountMode(value: string): value is FreeCommissionCountMode {
  return (FREE_COMMISSION_COUNT_MODES as readonly string[]).includes(value);
}

/**
 * Unset, blank, or unrecognized values are lifetime: declined and approved both count.
 * That is the behavior already shipping when this variable is absent.
 */
export function freeCommissionCountMode(): FreeCommissionCountMode {
  const raw = process.env.FREE_COMMISSION_COUNT_MODE;
  if (raw == null || raw.trim() === "") return "lifetime";
  const value = raw.trim();
  if (isCountMode(value)) return value;
  if (!warnedInvalidCountMode) {
    warnedInvalidCountMode = true;
    console.warn(
      "FREE_COMMISSION_COUNT_MODE is not lifetime, lifetime_excluding_declined, or monthly_excluding_declined. Free commission requests count as a lifetime total.",
    );
  }
  return "lifetime";
}

/** YYYY-MM in America/New_York, or null when the instant is not a real time. */
export function newYorkYearMonth(instant: Date): string | null {
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FREE_COMMISSION_MONTH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) return null;
  return `${year}-${month}`;
}

/**
 * Cancelled requests never count.
 * Declined requests count only in lifetime mode.
 * Monthly mode counts a request in the America/New_York month of createdAt.
 * Open and approved requests count whenever the other rules say so.
 */
export function countsTowardFreeCommissionLimit(
  row: { status: string; createdAt: string },
  mode: FreeCommissionCountMode,
  now: Date,
) {
  if (row.status === "cancelled") return false;
  if (row.status === "declined" && mode !== "lifetime") return false;
  if (mode !== "monthly_excluding_declined") return true;
  const createdMonth = newYorkYearMonth(new Date(row.createdAt));
  const currentMonth = newYorkYearMonth(now);
  if (!createdMonth || !currentMonth) return true;
  return createdMonth === currentMonth;
}

export function freeCommissionLimitReachedMessage(mode: FreeCommissionCountMode) {
  return mode === "monthly_excluding_declined" ? MONTHLY_LIMIT_REACHED : LIFETIME_LIMIT_REACHED;
}

export function redactCommissionForFree<T extends CommissionCampaign>(campaign: T): T {
  const brand = campaign.brand.trim();
  const hide = (value: string) => {
    let text = value;
    if (brand) {
      const pattern = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
      text = text.replace(pattern, "a brand");
    }
    return text
      .replace(/https?:\/\/\S+/gi, "[link hidden]")
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email hidden]")
      .replace(/@[\w.]+/g, "@hidden");
  };
  return {
    ...campaign,
    brand: "A brand",
    title: hide(campaign.title),
    description: hide(campaign.description),
    terms: hide(campaign.terms),
    trackingLink: null,
    trackingPending: true,
    bonus: campaign.bonus ? hide(campaign.bonus) : null,
  };
}

export async function openProductRequest(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(commissionProductRequests).where(and(
    eq(commissionProductRequests.creatorId, creatorId),
    eq(commissionProductRequests.status, "open"),
  ));
  return rows[0] ?? null;
}

export async function requestCommissionProduct(
  db: PortalDb,
  viewer: Viewer,
  campaignId: string,
  options?: { now?: Date },
) {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false as const, error: "Sign in as a creator to request a product." };
  }
  if (!(await creatorIsFree(db, viewer.creatorId))) {
    return { ok: false as const, error: "Product requests on this board are for free accounts." };
  }
  const limit = freeCommissionLimit();
  if (limit == null) return { ok: false as const, error: "Commission requests are coming soon." };
  const campaign = (await db.select().from(commissionCampaigns).where(eq(commissionCampaigns.id, campaignId)))[0];
  if (!campaign || campaign.status !== "open") {
    return { ok: false as const, error: campaign ? "That campaign is closed." : "That campaign is not open." };
  }
  const now = options?.now ?? new Date();
  const mine = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
  if (mine.some((row) => row.status === "open")) {
    return { ok: false as const, error: "You already have an open product request. Wait until it is approved, declined, or cancelled." };
  }
  const mode = freeCommissionCountMode();
  const used = mine.filter((row) => countsTowardFreeCommissionLimit(row, mode, now)).length;
  if (used >= limit) return { ok: false as const, error: freeCommissionLimitReachedMessage(mode) };
  try {
    await db.insert(commissionProductRequests).values({
      id: crypto.randomUUID(),
      creatorId: viewer.creatorId,
      campaignId: campaign.id,
      status: "open",
      createdAt: now.toISOString(),
      resolvedAt: null,
    });
  } catch {
    return { ok: false as const, error: "You already have an open product request. Wait until it is approved, declined, or cancelled." };
  }
  return { ok: true as const };
}

export async function resolveProductRequest(
  db: PortalDb,
  viewer: Viewer,
  requestId: string,
  status: "approved" | "declined" | "cancelled",
) {
  const rows = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.id, requestId));
  const row = rows[0];
  if (!row || row.status !== "open") return { ok: false as const, error: "That request is not open." };
  const own = viewer.role === "creator" && viewer.creatorId === row.creatorId;
  if (status === "cancelled") {
    if (!own && viewer.role !== "admin") return { ok: false as const, error: "You can only cancel your own request." };
  } else if (viewer.role !== "admin") {
    return { ok: false as const, error: "Only the owner can approve or decline a request." };
  }
  await db.update(commissionProductRequests).set({ status, resolvedAt: nowIso() }).where(eq(commissionProductRequests.id, requestId));
  return { ok: true as const };
}
