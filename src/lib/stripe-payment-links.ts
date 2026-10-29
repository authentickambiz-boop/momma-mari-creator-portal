import {
  MEMBER_ONE_TIME_PERCENT_OFF,
  PAYMENT_OFFERS,
  memberServiceIncluded,
  type SubscriptionPlanId,
} from "./payments-config";

export const BUY_NOW_LABEL = "Buy now";

/**
 * Live Stripe Payment Links for one-time services.
 * Plans use STRIPE_PLAN_LINKS. There is no $25 listing here.
 */
export const STRIPE_PAYMENT_LINKS = [
  { id: "media_kit_build", href: "https://buy.stripe.com/7sYeV697ndFk1ge0hr18c00" },
  { id: "rate_card_build", href: "https://buy.stripe.com/fZubIUdnD44K4sqd4d18c01" },
  { id: "media_kit_bundle", href: "https://buy.stripe.com/4gM5kw2IZ0Sy4sq7JT18c02" },
  { id: "contract_review", href: "https://buy.stripe.com/00w14gfvL7gW7ECc0918c03" },
  { id: "starter_kit_basic", href: "https://buy.stripe.com/3cIaEQgzPgRw1geggp18c04" },
  { id: "starter_kit_pro", href: "https://buy.stripe.com/6oU9AMfvL44Kf74d4d18c05" },
  { id: "starter_kit_plus", href: "https://buy.stripe.com/dRmeV6abr0Syf742pz18c06" },
] as const;

export type PublicPaymentLink = {
  id: string;
  name: string;
  priceLabel: string;
  amountCents: number;
  quoteHref: string;
  quoteLabel: string;
};

/** Prices come from the catalog so the button and the label cannot drift. */
export function publicPaymentLinks(): PublicPaymentLink[] {
  return STRIPE_PAYMENT_LINKS.map((link) => {
    const offer = PAYMENT_OFFERS.find((item) => item.id === link.id && item.kind === "one_time");
    const price = offer?.prices.find((item) => item.interval === "one_time");
    if (!offer || !price || !price.label.trim()) {
      throw new Error(`Missing one-time price for ${link.id}`);
    }
    return {
      id: link.id,
      name: offer.name,
      priceLabel: price.label,
      amountCents: price.amountCents,
      quoteHref: link.href,
      quoteLabel: BUY_NOW_LABEL,
    };
  });
}

/** Live Payment Links for Plus, Pro, and Business. Prices stay on the catalog labels. */
export const STRIPE_PLAN_LINKS = [
  { id: "plus", interval: "month", href: "https://buy.stripe.com/4gM5kw83jat87EC4xH18c09" },
  { id: "plus", interval: "year", href: "https://buy.stripe.com/cNi28kfvL8l01ged4d18c0a" },
  { id: "pro", interval: "month", href: "https://buy.stripe.com/7sY7sEerH58Of745BL18c0b" },
  { id: "pro", interval: "year", href: "https://buy.stripe.com/eVq9AMfvLfNsgb8fcl18c0c" },
  { id: "business", interval: "month", href: "https://buy.stripe.com/3cI4gs2IZ1WCgb84xH18c07" },
  { id: "business", interval: "year", href: "https://buy.stripe.com/3cI4gsgzPat8gb80hr18c08" },
] as const;

export type PublicPlanPrice = {
  interval: "month" | "year";
  label: string;
  amountCents: number;
  href: string;
};

export type PublicPlan = {
  id: SubscriptionPlanId;
  name: string;
  features: string[];
  prices: PublicPlanPrice[];
};

/** The same sentences as the member note, one plan at a time. */
export function planFeatureLines(id: SubscriptionPlanId): string[] {
  const percent = MEMBER_ONE_TIME_PERCENT_OFF[id];
  if (id === "plus") return [`Plus members get ${percent}% off one-time services.`];
  if (id === "pro") return [`Pro members get ${percent}% off.`];
  if (memberServiceIncluded(percent)) return ["Business members get them included."];
  return [`Business members get ${percent}% off.`];
}

const PLAN_ORDER: SubscriptionPlanId[] = ["plus", "pro", "business"];

export function publicPlans(): PublicPlan[] {
  return PLAN_ORDER.map((id) => {
    const offer = PAYMENT_OFFERS.find((item) => item.id === id && item.kind === "subscription");
    if (!offer) throw new Error(`Missing plan ${id}`);
    const prices = (["month", "year"] as const).map((interval) => {
      const price = offer.prices.find((item) => item.interval === interval);
      const link = STRIPE_PLAN_LINKS.find((item) => item.id === id && item.interval === interval);
      if (!price || !price.label.trim() || !link) throw new Error(`Missing ${id} ${interval} payment link`);
      return { interval, label: price.label, amountCents: price.amountCents, href: link.href };
    });
    return { id, name: offer.name, features: planFeatureLines(id), prices };
  });
}
