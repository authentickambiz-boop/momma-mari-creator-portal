import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators } from "@/db/schema";
import type { Viewer } from "./types";

export const ACCOUNT_TIERS = ["free", "managed", "plus", "pro", "business"] as const;
export type AccountTier = (typeof ACCOUNT_TIERS)[number];

export function isFreeTier(value: string | null | undefined) {
  return value === "free";
}

export async function accountTierFor(db: PortalDb, creatorId: string): Promise<AccountTier> {
  const rows = await db.select({ accountTier: creators.accountTier }).from(creators).where(eq(creators.id, creatorId));
  const tier = rows[0]?.accountTier;
  if (tier === "free" || tier === "plus" || tier === "pro" || tier === "business" || tier === "managed") return tier;
  return "managed";
}

export async function creatorIsFree(db: PortalDb, creatorId: string) {
  return (await accountTierFor(db, creatorId)) === "free";
}

/** Free accounts cannot start platform OAuth or a custom bot. Staff are not blocked. */
export async function creatorBlockedFromConnections(db: PortalDb, viewer: Viewer | null) {
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) return false;
  return creatorIsFree(db, viewer.creatorId);
}
