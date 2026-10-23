/**
 * In-game currency. Amounts are currency-dollars, stored as cents in the ledger.
 * Real money is never moved here. The shop spends this currency only.
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
import { findOfficeBot } from "./office-catalog";

export const GAME_WALLET_PATH = "/api/worlds/game-wallet";
export const GAME_CURRENCY = "currency-dollars";

export const EARN_TYPES = ["task", "command", "connect", "minigame", "reward"] as const;
export type EarnType = (typeof EARN_TYPES)[number];

export const DEFAULT_EARN_CENTS: Record<EarnType, number> = {
  task: 1000,
  command: 500,
  connect: 2500,
  minigame: 1500,
  reward: 1000,
};

export const BRAND_PAID_STATUSES = ["brand_paid", "creator_payout_pending", "creator_paid"] as const;

export type ShopCategory = "clothing" | "decoration" | "real-estate";

export type ShopItem = {
  sku: string;
  name: string;
  category: ShopCategory;
  slot: CharacterSlotName | null;
  priceCents: number;
  note: string | null;
};

/** Clothing skus match character slot item ids. Decorations and the lot do not change the bot. */
export const GAME_CATALOG: readonly ShopItem[] = [
  { sku: "waves", name: "Waves", category: "clothing", slot: "hair", priceCents: 4000, note: null },
  { sku: "crown", name: "Crown", category: "clothing", slot: "headwear", priceCents: 8000, note: null },
  { sku: "jacket", name: "Jacket", category: "clothing", slot: "top", priceCents: 6000, note: null },
  { sku: "overalls", name: "Overalls", category: "clothing", slot: "bottom", priceCents: 5500, note: null },
  { sku: "heels", name: "Heels", category: "clothing", slot: "shoes", priceCents: 4500, note: null },
  { sku: "watch", name: "Watch", category: "clothing", slot: "accessory", priceCents: 3000, note: null },
  { sku: "desk-plant", name: "Desk plant", category: "decoration", slot: null, priceCents: 2500, note: null },
  { sku: "poster", name: "Poster", category: "decoration", slot: null, priceCents: 1500, note: null },
  { sku: "rug", name: "Rug", category: "decoration", slot: null, priceCents: 3500, note: null },
  {
    sku: "studio-lot",
    name: "Studio lot",
    category: "real-estate",
    slot: null,
    priceCents: 50000,
    note: "Placeholder. Buying this does not place a building.",
  },
];

export type LedgerDirection = "credit" | "debit";

export type GameResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export function formatGameUnits(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const whole = Math.abs(safe - Math.round(safe)) < 0.001;
  const text = whole ? String(Math.round(safe)) : safe.toFixed(2);
  return `${text} ${GAME_CURRENCY}`;
}

export function unitsToCents(amount: number) {
  return Math.round(amount * 100);
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

export function parseEarnRates(body: unknown): GameResult<Record<EarnType, number>> {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Expected earn rates." };
  const extra = Object.keys(body).find((key) => !(EARN_TYPES as readonly string[]).includes(key));
  if (extra || Object.keys(body).length !== EARN_TYPES.length) {
    return { ok: false, status: 400, error: "Rates are task, command, connect, minigame, and reward." };
  }
  const value = {} as Record<EarnType, number>;
  for (const type of EARN_TYPES) {
    const amount = body[type];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
      return { ok: false, status: 400, error: `${type} must be a currency amount.` };
    }
    const cents = unitsToCents(amount);
    if (Math.abs(amount * 100 - cents) > 0.001) return { ok: false, status: 400, error: `${type} uses cents at most.` };
    value[type] = cents;
  }
  return { ok: true, value };
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
