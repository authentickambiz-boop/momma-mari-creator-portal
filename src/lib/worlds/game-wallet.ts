/**
 * In-game Kash. Amounts and prices live in economy.ts.
 * Real money is never moved here. The shop spends Kash only.
 */

import { isOwner } from "@/lib/authz";
import type { Viewer } from "@/lib/types";
import {
  CHARACTER_SLOTS,
  SHOP_CLOTHING,
  characterSubjectForViewer,
  parseCharacterSubject,
  type CharacterConfig,
  type CharacterSlotName,
  type CharacterSubject,
} from "./character";
import {
  CURRENCY,
  ECONOMY_ITEMS,
  MAX_WEEKLY_BPS,
  centsToUnits,
  findEconomyItem,
  formatKash,
  itemPriceCents,
  unitsToCents,
  type EconomyItem,
  type ShopTier,
} from "./economy";
import { findOfficeBot } from "./office-catalog";

export const GAME_WALLET_PATH = "/api/worlds/game-wallet";
export const ECONOMY_STATS_PATH = "/api/worlds/economy/stats";
export const GAME_CURRENCY = CURRENCY.label;

export const EARN_TYPES = ["task", "command", "connect", "minigame", "daily", "reward"] as const;
export type EarnType = (typeof EARN_TYPES)[number];

export type { EconomyItem, ShopTier };
export { CURRENCY, findEconomyItem, formatKash, unitsToCents, centsToUnits };

export const BRAND_PAID_STATUSES = ["brand_paid", "creator_payout_pending", "creator_paid"] as const;

/** Shown in wallet history while the creator commission credit is switched off. */
export const COMMISSION_CREDIT_COMING_SOON = "Creator commission credit is coming soon.";

/** Off unless the env value is on, true, or 1. While off, payments are not read. */
export function creatorCommissionCreditEnabled() {
  const raw = (process.env.WORLDS_CREATOR_COMMISSION_CREDIT ?? "").trim().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}

export type ShopCategory = EconomyItem["category"];

export type ShopItem = {
  sku: string;
  name: string;
  category: ShopCategory;
  slot: CharacterSlotName | null;
  tier: ShopTier;
  priceCents: number;
  slots: number;
  activities: number;
  note: string | null;
};

/** Clothing skus match character slot item ids. Prices come from the economy config. */
export const GAME_CATALOG: readonly ShopItem[] = ECONOMY_ITEMS.map((item) => ({
  sku: item.sku,
  name: item.name,
  category: item.category,
  slot: item.slot,
  tier: item.tier,
  priceCents: itemPriceCents(item),
  slots: item.slots,
  activities: item.activities,
  note: item.note,
}));

export type LedgerDirection = "credit" | "debit";

export type GameResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export function formatGameUnits(amount: number) {
  return formatKash(amount);
}

export function findShopItem(sku: string) {
  return GAME_CATALOG.find((item) => item.sku === sku) ?? null;
}

export function shopItemForSlot(slot: CharacterSlotName, item: string) {
  return GAME_CATALOG.find((product) => product.slot === slot && product.sku === item) ?? null;
}

/** Shop clothes the look uses that this inventory does not include. */
export function wearBlock(config: CharacterConfig, owned: readonly string[]) {
  const have = new Set(owned);
  for (const slot of CHARACTER_SLOTS) {
    const item = config.slots[slot].item;
    if (!(SHOP_CLOTHING[slot] as readonly string[]).includes(item)) continue;
    if (!have.has(item)) return "Buy that item in the Worlds shop before you wear it.";
  }
  return null;
}

/** Real-money currency purchases stay off. This does not call a processor. */
export function refuseCurrencyPurchase() {
  return {
    ok: false as const,
    charged: false as const,
    status: 403 as const,
    error: "Real-money purchases are off. Nothing was charged.",
  };
}

export function walletAccessStatus(error: string) {
  if (error.startsWith("Sign in")) return 401;
  if (error.startsWith("That bot") || error.startsWith("This sign-in")) return 404;
  if (error.startsWith("You can only") || error.startsWith("Only the owner")) return 403;
  return 400;
}

export function walletAccess(
  viewer: Viewer | null,
  action: "read" | "spend" | "grant" | "rates",
  subject?: CharacterSubject,
): GameResult<CharacterSubject | null> {
  if (!viewer) return { ok: false, status: 401, error: "Sign in to see your wallet." };
  if (action === "grant") {
    if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can grant a reward." };
    return { ok: true, value: subject ?? null };
  }
  if (action === "rates") {
    if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can change currency rates." };
    return { ok: true, value: null };
  }
  const own = characterSubjectForViewer(viewer);
  if (action === "spend") {
    if (!subject || !own || subject.kind !== "user" || subject.id !== own.id) {
      return { ok: false, status: 403, error: "You can only spend from your own wallet." };
    }
    return { ok: true, value: subject };
  }
  if (!subject) {
    if (!own) return { ok: false, status: 404, error: "This sign-in has no wallet yet." };
    return { ok: true, value: own };
  }
  if (isOwner(viewer)) {
    if (subject.kind === "bot" && !findOfficeBot(subject.id)) {
      return { ok: false, status: 404, error: "That bot is not on the roster." };
    }
    return { ok: true, value: subject };
  }
  if (!own || own.kind !== subject.kind || own.id !== subject.id) {
    return { ok: false, status: 403, error: "You can only read your own wallet." };
  }
  return { ok: true, value: subject };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRewardGrant(body: unknown): GameResult<{ subject: CharacterSubject; source: string; idempotencyKey: string }> {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Expected a reward." };
  const subject = parseCharacterSubject(body.subjectKind, body.subjectId);
  if (!subject.ok) return { ok: false, status: 400, error: subject.error };
  if (subject.value.kind === "bot" && !findOfficeBot(subject.value.id)) {
    return { ok: false, status: 404, error: "That bot is not on the roster." };
  }
  if (typeof body.source !== "string" || !body.source.trim() || body.source.trim().length > 80) {
    return { ok: false, status: 400, error: "source is a short label." };
  }
  if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{1,80}$/.test(body.idempotencyKey)) {
    return { ok: false, status: 400, error: "idempotencyKey is required." };
  }
  return { ok: true, value: { subject: subject.value, source: body.source.trim(), idempotencyKey: body.idempotencyKey } };
}

export function ledgerSum(rows: { direction: string; amountCents: number }[]) {
  return rows.reduce((sum, row) => sum + (row.direction === "debit" ? -row.amountCents : row.amountCents), 0);
}

/** Spendable wallet, protected bank, or earnings waiting at the bank. */
export const GAME_BUCKETS = ["wallet", "bank", "uncollected"] as const;
export type GameBucket = (typeof GAME_BUCKETS)[number];

export {
  DEFAULT_WEEKLY_BPS,
  MAX_INTEREST_CATCHUP_DAYS,
  MAX_WEEKLY_BPS,
  dailyDecayCents,
  dailyInterestCents,
} from "./economy";

export const BANK_PERKS = [
  { id: "later", name: "Bank perks", note: "Bank-only perks will show up here later." },
] as const;

export type BankPerk = (typeof BANK_PERKS)[number];

const IDEMPOTENCY = /^[A-Za-z0-9:_-]{1,80}$/;

export function bucketOf(value: string | null | undefined): GameBucket {
  if (value === "bank" || value === "uncollected") return value;
  return "wallet";
}

export function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(day: string, count: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (date ?? 1) + count)).toISOString().slice(0, 10);
}

export function parseWeeklyInterest(value: unknown): GameResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_WEEKLY_BPS / 100) {
    return { ok: false, status: 400, error: "Interest is a weekly percent from 0 to 10." };
  }
  const bps = Math.round(value * 100);
  if (Math.abs(value * 100 - bps) > 0.001) {
    return { ok: false, status: 400, error: "Interest uses hundredths of a percent." };
  }
  return { ok: true, value: bps };
}

export function parseIdempotencyKey(value: unknown): GameResult<string> {
  if (typeof value !== "string" || !IDEMPOTENCY.test(value)) {
    return { ok: false, status: 400, error: "idempotencyKey is required." };
  }
  return { ok: true, value };
}

/** Empty means the whole source bucket. A number is Kash. */
export function parseMoveAmount(value: unknown, allowAll: boolean): GameResult<number | null> {
  if (value === undefined || value === null || value === "") {
    if (allowAll) return { ok: true, value: null };
    return { ok: false, status: 400, error: "Amount must be more than zero." };
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    return { ok: false, status: 400, error: "Amount must be more than zero." };
  }
  const cents = unitsToCents(value);
  if (Math.abs(value * 100 - cents) > 0.001) return { ok: false, status: 400, error: "Amount uses cents at most." };
  if (cents <= 0) return { ok: false, status: 400, error: "Amount must be more than zero." };
  return { ok: true, value: cents };
}

export function parseCollectDestination(value: unknown): GameResult<"wallet" | "bank"> {
  if (value !== "wallet" && value !== "bank") {
    return { ok: false, status: 400, error: "Collect into the wallet or the bank." };
  }
  return { ok: true, value };
}
