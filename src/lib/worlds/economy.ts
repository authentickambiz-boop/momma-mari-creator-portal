/**
 * Kash, the in-game currency for Worlds City.
 * Amounts are Kash cents (100 cents = Kash $1.00).
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

export type CityShopItem = {
  sku: string;
  name: string;
  locationId: "clothing-shop" | "furniture-shop";
  priceCents: number;
  /** Plain ownership line. Momma Mari keeps the asset. */
  note: string;
};

const OWNED = `${ASSET_OWNER} owns this. You can use it in the city. No real payment was made.`;

export const CITY_SHOP: readonly CityShopItem[] = [
  { sku: "city-waves", name: "Waves", locationId: "clothing-shop", priceCents: 4_000, note: OWNED },
  { sku: "city-crown", name: "Crown", locationId: "clothing-shop", priceCents: 8_000, note: OWNED },
  { sku: "city-jacket", name: "Jacket", locationId: "clothing-shop", priceCents: 6_000, note: OWNED },
  { sku: "city-overalls", name: "Overalls", locationId: "clothing-shop", priceCents: 5_500, note: OWNED },
  { sku: "city-heels", name: "Heels", locationId: "clothing-shop", priceCents: 4_500, note: OWNED },
  { sku: "city-watch", name: "Watch", locationId: "clothing-shop", priceCents: 3_000, note: OWNED },
  { sku: "city-desk-plant", name: "Desk plant", locationId: "furniture-shop", priceCents: 2_500, note: OWNED },
  { sku: "city-poster", name: "Poster", locationId: "furniture-shop", priceCents: 1_500, note: OWNED },
  { sku: "city-rug", name: "Rug", locationId: "furniture-shop", priceCents: 3_500, note: OWNED },
  { sku: "city-lamp", name: "Loft lamp", locationId: "furniture-shop", priceCents: 4_200, note: OWNED },
];

export function formatKash(cents: number) {
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
