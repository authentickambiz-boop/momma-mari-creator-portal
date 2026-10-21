/**
 * Public brand packages, booked by the brand's budget.
 * Dollar amounts render only when PACKAGE_PRICES_APPROVED is the string "true".
 * Do not fill them from a creator's private rate floor.
 */

import { BRAND_INQUIRY_HREF, PUBLIC_ROBOTS } from "./public-site";

export type BrandPackage = {
  id: string;
  name: string;
  summary: string;
  budgetLabel: string;
  minBudgetCents: number;
  maxBudgetCents: number | null;
  priceCents: number;
  priceLabel: string;
};

export const BRAND_PACKAGES: BrandPackage[] = [
  {
    id: "test",
    name: "Test a post",
    summary: "One short video on one platform, with 30 days of organic usage.",
    budgetLabel: "Under $1,000",
    minBudgetCents: 1,
    maxBudgetCents: 99_999,
    priceCents: 75_000,
    priceLabel: "$750",
  },
  {
    id: "campaign",
    name: "Campaign",
    summary: "A cross-post plus 90 days of organic usage.",
    budgetLabel: "$1,000 to $5,000",
    minBudgetCents: 100_000,
    maxBudgetCents: 500_000,
    priceCents: 250_000,
    priceLabel: "$2,500",
  },
  {
    id: "ambassador",
    name: "Three-month ambassador",
    summary: "A season of posts. Usage and timing are agreed in the brief.",
    budgetLabel: "Over $5,000",
    minBudgetCents: 500_001,
    maxBudgetCents: null,
    priceCents: 750_000,
    priceLabel: "$7,500",
  },
];

export const PACKAGE_QUOTE_LABEL = "Request a quote";

export function packagePublicView(approved: boolean) {
  return {
    description: approved
      ? "Brand packages booked by budget."
      : "Brand packages booked by budget. Request a quote.",
    lede: approved
      ? "Pick a package by your budget."
      : "Pick a package by your budget. Request a quote and we reply within 3 business days.",
    robots: approved ? PUBLIC_ROBOTS : { index: false as const, follow: false as const },
    cards: BRAND_PACKAGES.map((item) => ({
      id: item.id,
      name: item.name,
      budgetLabel: item.budgetLabel,
      summary: item.summary,
      priceLabel: approved ? item.priceLabel : null,
      quoteHref: approved ? null : BRAND_INQUIRY_HREF,
      quoteLabel: approved ? null : PACKAGE_QUOTE_LABEL,
    })),
  };
}

export function parseBudgetDollars(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return { cents: null as number | null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: "Enter a budget in dollars." };
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000_000) return { error: "Enter a budget in dollars." };
  return { cents };
}

/** Picks a package from the brand's budget. It does not look at creator rate floors. */
export function packageForBudget(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return BRAND_PACKAGES.find((item) => cents >= item.minBudgetCents && (item.maxBudgetCents == null || cents <= item.maxBudgetCents)) ?? null;
}
