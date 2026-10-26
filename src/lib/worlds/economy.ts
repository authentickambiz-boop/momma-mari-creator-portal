/**
 * Worlds in-game economy. Every payout, limit, price, and rate lives here.
 * Amounts are Kash units. The ledger stores cents. No real money is involved.
 */

import type { CharacterSlotName } from "./character";

/** K with a line through it, the same idea as $. U+20AD KIP SIGN. */
export const KASH_MARK = "₭";

/** The name stays "Kash $". Amounts use {@link KASH_MARK} as the prefix people see. */
export const CURRENCY = { code: "KASH", label: "Kash $", mark: KASH_MARK } as const;

/** Ledger cents in one Kash unit. */
export const CENTS_PER_UNIT = 100;

export type ShopTier = "basic" | "common" | "rare" | "epic" | "legendary";

export type EconomyCategory = "clothing" | "decoration" | "real-estate";

export type EconomyItem = {
  sku: string;
  name: string;
  category: EconomyCategory;
  slot: CharacterSlotName | null;
  tier: ShopTier;
  /** Kash units. */
  price: number;
  /** In-home item slots. Properties only. */
  slots: number;
  /** In-home activities unlocked. The activities themselves are a later phase. */
  activities: number;
  note: string | null;
};

export const TIER_RANGES: Record<ShopTier, { min: number; max: number }> = {
  basic: { min: 15, max: 40 },
  common: { min: 41, max: 70 },
  rare: { min: 71, max: 100 },
  epic: { min: 1500, max: 20000 },
  legendary: { min: 45000, max: 100000 },
};

export const ECONOMY = {
  task: { min: 5, max: 50, steps: 4 },
  command: { amount: 2, cooldownMs: 60_000 },
  connect: { amount: 100 },
  minigame: { min: 5, max: 20, minRoundMs: 120_000 },
  daily: { amount: 10, maxStreak: 30 },
  reward: { amount: 10 },
  interest: { defaultWeeklyPercent: 1, maxWeeklyPercent: 10, cap: 10_000, catchupDays: 30 },
  decay: { afterDays: 30, weeklyPercent: 10 },
  botLevelMultiplier: 1,
} as const;

/** 1 is the easiest task, 5 is the hardest. Unknown categories stay at 1. */
export const TASK_DIFFICULTY: Record<string, number> = {
  content: 3,
  outreach: 4,
  growth: 4,
  finance: 3,
  personal: 2,
  health: 2,
  home: 2,
  family: 2,
  travel: 2,
};

export const ECONOMY_ITEMS: readonly EconomyItem[] = [
  { sku: "poster", name: "Poster", category: "decoration", slot: null, tier: "basic", price: 15, slots: 0, activities: 0, note: null },
  { sku: "desk-plant", name: "Desk plant", category: "decoration", slot: null, tier: "basic", price: 25, slots: 0, activities: 0, note: null },
  { sku: "watch", name: "Watch", category: "clothing", slot: "accessory", tier: "basic", price: 30, slots: 0, activities: 0, note: null },
  { sku: "rug", name: "Rug", category: "decoration", slot: null, tier: "basic", price: 35, slots: 0, activities: 0, note: null },
  { sku: "waves", name: "Waves", category: "clothing", slot: "hair", tier: "basic", price: 40, slots: 0, activities: 0, note: null },
  { sku: "heels", name: "Heels", category: "clothing", slot: "shoes", tier: "common", price: 45, slots: 0, activities: 0, note: null },
  { sku: "overalls", name: "Overalls", category: "clothing", slot: "bottom", tier: "common", price: 55, slots: 0, activities: 0, note: null },
  { sku: "jacket", name: "Jacket", category: "clothing", slot: "top", tier: "common", price: 60, slots: 0, activities: 0, note: null },
  { sku: "crown", name: "Crown", category: "clothing", slot: "headwear", tier: "rare", price: 80, slots: 0, activities: 0, note: null },
  {
    sku: "studio",
    name: "Studio",
    category: "real-estate",
    slot: null,
    tier: "epic",
    price: 1500,
    slots: 4,
    activities: 1,
    note: "Unlocks 4 item slots and 1 in-home activity. Activities arrive in a later phase.",
  },
  {
    sku: "apartment",
    name: "Apartment",
    category: "real-estate",
    slot: null,
    tier: "epic",
    price: 6000,
    slots: 8,
    activities: 2,
    note: "Unlocks 8 item slots and 2 in-home activities. Activities arrive in a later phase.",
  },
  {
    sku: "house",
    name: "House",
    category: "real-estate",
    slot: null,
    tier: "epic",
    price: 20000,
    slots: 12,
    activities: 3,
    note: "Unlocks 12 item slots and 3 in-home activities. Activities arrive in a later phase.",
  },
  {
    sku: "creator-loft",
    name: "Creator loft",
    category: "real-estate",
    slot: null,
    tier: "legendary",
    price: 45000,
    slots: 16,
    activities: 4,
    note: "Unlocks 16 item slots and 4 in-home activities. Activities arrive in a later phase.",
  },
  {
    sku: "mansion",
    name: "Mansion",
    category: "real-estate",
    slot: null,
    tier: "legendary",
    price: 100000,
    slots: 24,
    activities: 6,
    note: "Unlocks 24 item slots and 6 in-home activities. Activities arrive in a later phase.",
  },
];

export function unitsToCents(amount: number) {
  return Math.round(amount * CENTS_PER_UNIT);
}

export function centsToUnits(cents: number) {
  return cents / CENTS_PER_UNIT;
}

export function formatKash(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const whole = Math.abs(abs - Math.round(abs)) < 0.001;
  const text = whole ? String(Math.round(abs)) : abs.toFixed(2);
  return `${negative ? "-" : ""}${KASH_MARK}${text}`;
}

/** Stub. Bot level does not change payouts yet. The id is reserved for a later multiplier. */
export function botLevelMultiplier(botId?: string) {
  return botId ? ECONOMY.botLevelMultiplier : ECONOMY.botLevelMultiplier;
}

function scaled(cents: number, botId?: string) {
  return Math.max(0, Math.round(cents * botLevelMultiplier(botId)));
}

export function taskDifficulty(category?: string) {
  if (!category) return 1;
  return TASK_DIFFICULTY[category] ?? 1;
}

export function taskPayoutCents(difficulty: number, botId?: string) {
  const steps = ECONOMY.task.steps;
  const rank = Math.min(steps + 1, Math.max(1, Math.round(difficulty)));
  const min = unitsToCents(ECONOMY.task.min);
  const max = unitsToCents(ECONOMY.task.max);
  return scaled(min + Math.round(((max - min) * (rank - 1)) / steps), botId);
}

export function commandPayoutCents(botId?: string) {
  return scaled(unitsToCents(ECONOMY.command.amount), botId);
}

export function connectPayoutCents(botId?: string) {
  return scaled(unitsToCents(ECONOMY.connect.amount), botId);
}

/** score is 0 to 1 within the minigame range. */
export function minigamePayoutCents(score = 0, botId?: string) {
  const t = Math.min(1, Math.max(0, score));
  const min = unitsToCents(ECONOMY.minigame.min);
  const max = unitsToCents(ECONOMY.minigame.max);
  return scaled(Math.round(min + (max - min) * t), botId);
}

export function dailyPayoutCents(botId?: string) {
  return scaled(unitsToCents(ECONOMY.daily.amount), botId);
}

export function rewardPayoutCents(botId?: string) {
  return scaled(unitsToCents(ECONOMY.reward.amount), botId);
}

export function itemPriceCents(item: EconomyItem) {
  return unitsToCents(item.price);
}

export function findEconomyItem(sku: string) {
  return ECONOMY_ITEMS.find((item) => item.sku === sku) ?? null;
}

export function catalogPricesFitTiers() {
  return ECONOMY_ITEMS.every((item) => {
    const range = TIER_RANGES[item.tier];
    return item.price >= range.min && item.price <= range.max;
  });
}

export const DEFAULT_WEEKLY_BPS = ECONOMY.interest.defaultWeeklyPercent * 100;
export const MAX_WEEKLY_BPS = ECONOMY.interest.maxWeeklyPercent * 100;
export const INTEREST_CAP_CENTS = unitsToCents(ECONOMY.interest.cap);
export const MAX_INTEREST_CATCHUP_DAYS = ECONOMY.interest.catchupDays;
export const DECAY_WEEKLY_BPS = ECONOMY.decay.weeklyPercent * 100;

/** Daily slice of the weekly rate, on the bank balance up to the cap. */
export function dailyInterestCents(balanceCents: number, weeklyBps: number) {
  if (!Number.isInteger(balanceCents) || balanceCents <= 0) return 0;
  const bps = Math.min(MAX_WEEKLY_BPS, Math.max(0, Math.trunc(weeklyBps)));
  if (bps === 0) return 0;
  const base = Math.min(balanceCents, INTEREST_CAP_CENTS);
  return Math.floor((base * bps) / (7 * 10_000));
}

/** Daily slice of the weekly decay rate. */
export function dailyDecayCents(agedCents: number) {
  if (!Number.isInteger(agedCents) || agedCents <= 0) return 0;
  return Math.floor((agedCents * DECAY_WEEKLY_BPS) / (7 * 10_000));
}

if (!catalogPricesFitTiers()) {
  throw new Error("An economy price is outside its tier range.");
}

/**
 * City practice Kash. Amounts are cents (100 cents = Kash $1.00).
 * This ledger is not the live game wallet and it never calls a processor.
 */

export const KASH_NAME = "Kash";
export const ASSET_OWNER = "Momma Mari";

/** There is no earnings cap. Per-action limits and cooldowns still apply. */
export const EARNINGS_CAP_CENTS: number | null = null;

/** Real-money purchases and payouts stay off. Nothing here charges a card or a bank. */
export const REAL_PAYMENTS = false;

export const ACTION_LIMITS = {
  paid: { limit: 5, windowMs: 86_400_000, cooldownMs: 60_000 },
  lesson: { limit: 24, windowMs: 86_400_000, cooldownMs: 5_000 },
  shop: { limit: 12, windowMs: 86_400_000, cooldownMs: 2_000 },
  visit: { limit: 30, windowMs: 86_400_000, cooldownMs: 2_000 },
  /** Likes, comments, follows, and story drafts share one daily cap. */
  social: { limit: 8, windowMs: 86_400_000, cooldownMs: 20_000 },
} as const;

export type ActionClass = keyof typeof ACTION_LIMITS;

export const HOME_TIERS = ["studio", "apartment", "house", "creator-loft", "mansion"] as const;
export type HomeTier = (typeof HOME_TIERS)[number];

export const HOME_TIER_LABEL: Record<HomeTier, string> = {
  studio: "Studio",
  apartment: "Apartment",
  house: "House",
  "creator-loft": "Creator loft",
  mansion: "Mansion",
};

/** Unlock price in Kash cents. Studio is the starter and costs nothing. */
export const HOME_TIER_PRICE_CENTS: Record<HomeTier, number> = {
  studio: 0,
  apartment: 4_000,
  house: 12_000,
  "creator-loft": 20_000,
  mansion: 40_000,
};

export const HOME_TIER_FLOORS: Record<HomeTier, number> = {
  studio: 1,
  apartment: 2,
  house: 2,
  "creator-loft": 2,
  mansion: 3,
};

export const HOME_TIER_SCALE: Record<HomeTier, number> = {
  studio: 1,
  apartment: 1.12,
  house: 1.28,
  "creator-loft": 1.4,
  mansion: 1.72,
};

/** Practice price for one empty lot. Apartments are not sold as side yards. */
export const LOT_PRICE_CENTS: Record<Exclude<HomeTier, "apartment">, number> = {
  studio: 1_800,
  house: 7_500,
  "creator-loft": 12_000,
  mansion: 22_000,
};

/** One more floor on the shared apartment complex. Practice Kash only. */
export const APARTMENT_UNIT_PRICE_CENTS = 2_400;
export const APARTMENT_BASE_FLOORS = 3;
export const APARTMENT_MAX_FLOORS = 11;

export function apartmentFloors(claimedUnits: number) {
  const extra = Number.isFinite(claimedUnits) ? Math.max(0, Math.trunc(claimedUnits)) : 0;
  return APARTMENT_BASE_FLOORS + extra;
}

export type ShopItemKind = "wear" | "indoor" | "outdoor" | "oversized";

export type CityShopItem = {
  sku: string;
  name: string;
  locationId: "clothing-shop" | "furniture-shop";
  priceCents: number;
  /** Plain ownership line. Momma Mari keeps the asset. */
  note: string;
  kind: ShopItemKind;
  /** Lowest home tier that may buy this. Apartments cannot buy yard, outdoor, or oversized pieces. */
  minTier: HomeTier;
};

const CITY_OWNED = `${ASSET_OWNER} owns this. You can use it in the city. No real payment was made.`;

export const CITY_SHOP: readonly CityShopItem[] = [
  { sku: "city-waves", name: "Waves", locationId: "clothing-shop", priceCents: 4_000, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-crown", name: "Crown", locationId: "clothing-shop", priceCents: 8_000, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-jacket", name: "Jacket", locationId: "clothing-shop", priceCents: 6_000, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-overalls", name: "Overalls", locationId: "clothing-shop", priceCents: 5_500, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-heels", name: "Heels", locationId: "clothing-shop", priceCents: 4_500, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-watch", name: "Watch", locationId: "clothing-shop", priceCents: 3_000, note: CITY_OWNED, kind: "wear", minTier: "studio" },
  { sku: "city-desk-plant", name: "Desk plant", locationId: "furniture-shop", priceCents: 2_500, note: CITY_OWNED, kind: "indoor", minTier: "studio" },
  { sku: "city-poster", name: "Poster", locationId: "furniture-shop", priceCents: 1_500, note: CITY_OWNED, kind: "indoor", minTier: "studio" },
  { sku: "city-rug", name: "Rug", locationId: "furniture-shop", priceCents: 3_500, note: CITY_OWNED, kind: "indoor", minTier: "studio" },
  { sku: "city-lamp", name: "Loft lamp", locationId: "furniture-shop", priceCents: 4_200, note: CITY_OWNED, kind: "indoor", minTier: "apartment" },
  { sku: "city-patio", name: "Patio set", locationId: "furniture-shop", priceCents: 7_500, note: CITY_OWNED, kind: "outdoor", minTier: "house" },
  { sku: "city-fence", name: "Picket fence", locationId: "furniture-shop", priceCents: 6_400, note: CITY_OWNED, kind: "outdoor", minTier: "house" },
  { sku: "city-planter", name: "Yard planter", locationId: "furniture-shop", priceCents: 3_200, note: CITY_OWNED, kind: "outdoor", minTier: "house" },
  { sku: "city-sectional", name: "Sectional", locationId: "furniture-shop", priceCents: 9_800, note: CITY_OWNED, kind: "oversized", minTier: "house" },
  { sku: "city-backdrop", name: "Studio backdrop", locationId: "furniture-shop", priceCents: 8_600, note: CITY_OWNED, kind: "oversized", minTier: "creator-loft" },
  { sku: "city-bench", name: "Gallery bench", locationId: "furniture-shop", priceCents: 11_000, note: CITY_OWNED, kind: "oversized", minTier: "mansion" },
];

/** City prices are cents. The live wallet keeps {@link formatKash}. */
export function formatCityKash(cents: number) {
  const safe = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}Kash $${whole}.${frac}`;
}

export function shopItemsFor(locationId: string) {
  return CITY_SHOP.filter((item) => item.locationId === locationId);
}

export function findCityShopItem(sku: string) {
  return CITY_SHOP.find((item) => item.sku === sku) ?? null;
}

export function homeTierRank(tier: HomeTier) {
  return HOME_TIERS.indexOf(tier);
}

/** Real-money purchases stay off. This does not call a processor. */
export function refuseRealPayment() {
  return {
    ok: false as const,
    charged: false as const,
    error: "Real payments are off. Nothing was charged.",
  };
}
