import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { commissionCampaigns, commissionProductRequests } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import type { CommissionCampaign } from "./commission-campaigns";
import { nowIso } from "./format";
import type { Viewer } from "./types";

let warnedUnsetLimit = false;

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

export async function requestCommissionProduct(db: PortalDb, viewer: Viewer, campaignId: string) {
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
  const mine = await db.select().from(commissionProductRequests).where(eq(commissionProductRequests.creatorId, viewer.creatorId));
  if (mine.some((row) => row.status === "open")) {
    return { ok: false as const, error: "You already have an open product request. Wait until it is approved, declined, or cancelled." };
  }
  const used = mine.filter((row) => row.status !== "cancelled").length;
  if (used >= limit) return { ok: false as const, error: "You've reached the free commission limit." };
  try {
    await db.insert(commissionProductRequests).values({
      id: crypto.randomUUID(),
      creatorId: viewer.creatorId,
      campaignId: campaign.id,
      status: "open",
      createdAt: nowIso(),
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
