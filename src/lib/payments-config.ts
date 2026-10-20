/**
 * Live Stripe price ids for the creator portal.
 * The secret key is never stored here. Read it from STRIPE_SECRET_KEY at call time.
 */

export type BillingInterval = "month" | "year";
export type OfferInterval = BillingInterval | "one_time";
export type OfferKind = "subscription" | "one_time";
export type SubscriptionPlanId = "plus" | "pro" | "business";

export type PaymentPrice = {
  priceId: string;
  amountCents: number;
  currency: "usd";
  interval: OfferInterval;
  label: string;
};

export type PaymentOffer = {
  id: string;
  name: string;
  kind: OfferKind;
  productId: string;
  prices: PaymentPrice[];
};

export const BILLING_PORTAL_FALLBACK_URL = "https://billing.stripe.com/p/login/7sYeV697ndFk1ge0hr18c00";

/** Checkout, the billing portal, and the fulfillment queue run only when this is the string "true". */
export function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === "true";
}

export const PAYMENT_OFFERS: PaymentOffer[] = [
  {
    id: "plus",
    name: "Plus",
    kind: "subscription",
    productId: "prod_VTdB5ZhL2EISRu",
    prices: [
      { priceId: "price_1USge24Qt4QNnGtbzVyAvTzx", amountCents: 1900, currency: "usd", interval: "month", label: "$19/mo" },
      { priceId: "price_1USge14Qt4QNnGtbMn9OrVlO", amountCents: 19000, currency: "usd", interval: "year", label: "$190/yr" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    kind: "subscription",
    productId: "prod_VTdCXTD9zLJy1c",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbEdLVLq31", amountCents: 3900, currency: "usd", interval: "month", label: "$39/mo" },
      { priceId: "price_1USge14Qt4QNnGtbVNVCjxMl", amountCents: 39000, currency: "usd", interval: "year", label: "$390/yr" },
    ],
  },
  {
    id: "business",
    name: "Business",
    kind: "subscription",
    productId: "prod_VTdDIgUpQfQIDM",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbVilv7y1G", amountCents: 19900, currency: "usd", interval: "month", label: "$199/mo" },
      { priceId: "price_1USge14Qt4QNnGtbfuda9E0h", amountCents: 199000, currency: "usd", interval: "year", label: "$1,990/yr" },
    ],
  },
  {
    id: "media_kit_build",
    name: "Media Kit Build",
    kind: "one_time",
    productId: "prod_VTdFlV7vPpOV8r",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbBc2n8AMS", amountCents: 14900, currency: "usd", interval: "one_time", label: "$149" },
    ],
  },
  {
    id: "rate_card_build",
    name: "Rate Card Build",
    kind: "one_time",
    productId: "prod_VTdFZikKAo5gxC",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbrhvFiG9Z", amountCents: 7900, currency: "usd", interval: "one_time", label: "$79" },
    ],
  },
  {
    id: "media_kit_bundle",
    name: "Media Kit + Rate Card Bundle",
    kind: "one_time",
    productId: "prod_VTdFAnFv3tosEN",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbbYPnHYlR", amountCents: 19900, currency: "usd", interval: "one_time", label: "$199" },
    ],
  },
  {
    id: "contract_review",
    name: "Contract Review",
    kind: "one_time",
    productId: "prod_VTdGztC8GOI7te",
    prices: [
      { priceId: "price_1USge64Qt4QNnGtbHkGoim98", amountCents: 12500, currency: "usd", interval: "one_time", label: "$125" },
    ],
  },
  {
    id: "starter_kit_basic",
    name: "Creator Starter Kit Basic",
    kind: "one_time",
    productId: "prod_VTdGZ48TNRphgo",
    prices: [
      { priceId: "price_1USge74Qt4QNnGtbk2AI0l8o", amountCents: 14900, currency: "usd", interval: "one_time", label: "$149" },
    ],
  },
  {
    id: "starter_kit_pro",
    name: "Creator Starter Kit Pro",
    kind: "one_time",
    productId: "prod_VTdGw0hmEhSrFf",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbK1uy1sPg", amountCents: 29900, currency: "usd", interval: "one_time", label: "$299" },
    ],
  },
  {
    id: "starter_kit_plus",
    name: "Creator Starter Kit Plus",
    kind: "one_time",
    productId: "prod_VTdH2qGBfTyHj7",
    prices: [
      { priceId: "price_1USge14Qt4QNnGtbQGHpC9IL", amountCents: 49900, currency: "usd", interval: "one_time", label: "$499" },
    ],
  },
];

export function subscriptionOffers() {
  return PAYMENT_OFFERS.filter((offer) => offer.kind === "subscription");
}

export function oneTimeOffers() {
  return PAYMENT_OFFERS.filter((offer) => offer.kind === "one_time");
}

export function findOfferPrice(offerId: string, interval: string) {
  const offer = PAYMENT_OFFERS.find((item) => item.id === offerId);
  if (!offer) return null;
  const price = offer.prices.find((item) => item.interval === interval);
  if (!price) return null;
  return { offer, price };
}

export function offerForPriceId(priceId: string) {
  for (const offer of PAYMENT_OFFERS) {
    const price = offer.prices.find((item) => item.priceId === priceId);
    if (price) return { offer, price };
  }
  return null;
}

export function isSubscriptionPlan(value: string | null | undefined): value is SubscriptionPlanId {
  return value === "plus" || value === "pro" || value === "business";
}

/**
 * Percent off one-time services for a member in good standing.
 * 100 means the service is included: no Checkout session, straight to the fulfillment queue.
 * Change these numbers here. Do not copy them into Checkout or the billing page.
 */
export const MEMBER_ONE_TIME_PERCENT_OFF: Record<SubscriptionPlanId, number> = {
  plus: 10,
  pro: 20,
  business: 100,
};

const MEMBER_STATUSES = new Set(["active", "trialing"]);

export function memberOneTimePercent(plan: string | null | undefined, status: string | null | undefined) {
  if (!isSubscriptionPlan(plan) || !status || !MEMBER_STATUSES.has(status)) return 0;
  const percent = MEMBER_ONE_TIME_PERCENT_OFF[plan];
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return 0;
  return percent;
}

export function memberServiceIncluded(percentOff: number) {
  return percentOff >= 100;
}

export function memberPriceCents(amountCents: number, percentOff: number) {
  if (percentOff <= 0) return amountCents;
  if (memberServiceIncluded(percentOff)) return 0;
  return Math.max(0, amountCents - Math.round((amountCents * percentOff) / 100));
}

export function memberCouponId(plan: SubscriptionPlanId, percentOff: number) {
  return `portal_${plan}_${percentOff}`;
}

export function oneTimeMemberNote() {
  const plus = MEMBER_ONE_TIME_PERCENT_OFF.plus;
  const pro = MEMBER_ONE_TIME_PERCENT_OFF.pro;
  const business = MEMBER_ONE_TIME_PERCENT_OFF.business;
  const businessLine = memberServiceIncluded(business)
    ? "Business members get them included."
    : `Business members get ${business}% off.`;
  return `Plus members get ${plus}% off one-time services. Pro members get ${pro}% off. ${businessLine} Signed creators get them included.`;
}
