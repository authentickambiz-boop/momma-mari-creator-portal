import { AGENCY_COMMISSION_PERCENT, formatMoney } from "./format";
import {
  MEMBER_ONE_TIME_PERCENT_OFF,
  PAYMENT_OFFERS,
  memberPriceCents,
  memberServiceIncluded,
  oneTimeMemberNote,
  type PaymentOffer,
  type PaymentPrice,
  type SubscriptionPlanId,
} from "./payments-config";

/** Shown on the owner preview when a catalog row has no price. Never shown publicly. */
export const PRICE_NOT_SET = "Price not set yet.";

const PLAN_IDS: SubscriptionPlanId[] = ["plus", "pro", "business"];

const PLAN_NAMES: Record<SubscriptionPlanId, string> = {
  plus: "Plus",
  pro: "Pro",
  business: "Business",
};

const SERVICE_GROUPS: { id: string; title: string; offerIds: string[] }[] = [
  { id: "media_kits", title: "Media kits", offerIds: ["media_kit_build", "media_kit_bundle"] },
  { id: "rate_cards", title: "Rate cards", offerIds: ["rate_card_build"] },
  { id: "contract_reviews", title: "Contract reviews", offerIds: ["contract_review"] },
  { id: "starter_kits", title: "Starter kits", offerIds: ["starter_kit_basic", "starter_kit_pro", "starter_kit_plus"] },
];

const SERVICE_NAMES: Record<string, string> = {
  media_kit_build: "Media Kit Build",
  media_kit_bundle: "Media Kit + Rate Card Bundle",
  rate_card_build: "Rate Card Build",
  contract_review: "Contract Review",
  starter_kit_basic: "Creator Starter Kit Basic",
  starter_kit_pro: "Creator Starter Kit Pro",
  starter_kit_plus: "Creator Starter Kit Plus",
};

export type ShownPrice = {
  interval: "month" | "year";
  text: string;
  placeholder: boolean;
};

export type ShownPlan = {
  id: SubscriptionPlanId;
  name: string;
  prices: ShownPrice[];
};

export type ShownService = {
  id: string;
  name: string;
  price: string;
  placeholder: boolean;
  plus: string | null;
  pro: string | null;
  business: string | null;
};

export type ShownGroup = {
  id: string;
  title: string;
  services: ShownService[];
};

export type PricingPageModel = {
  preview: boolean;
  plans: ShownPlan[];
  groups: ShownGroup[];
  fee: {
    selfServe: string;
    signed: string;
    members: string;
  };
};

function listedPrice(price: PaymentPrice | undefined) {
  if (!price) return null;
  if (price.label.trim()) return { label: price.label, amountCents: price.amountCents };
  if (Number.isInteger(price.amountCents) && price.amountCents > 0) {
    return { label: formatMoney(price.amountCents), amountCents: price.amountCents };
  }
  return null;
}

function memberLines(amountCents: number) {
  const plus = MEMBER_ONE_TIME_PERCENT_OFF.plus;
  const pro = MEMBER_ONE_TIME_PERCENT_OFF.pro;
  const business = MEMBER_ONE_TIME_PERCENT_OFF.business;
  return {
    plus: `Plus ${plus}% off · ${formatMoney(memberPriceCents(amountCents, plus))}`,
    pro: `Pro ${pro}% off · ${formatMoney(memberPriceCents(amountCents, pro))}`,
    business: memberServiceIncluded(business)
      ? "Business · Included"
      : `Business ${business}% off · ${formatMoney(memberPriceCents(amountCents, business))}`,
  };
}

function planView(id: SubscriptionPlanId, offers: PaymentOffer[], preview: boolean): ShownPlan | null {
  const offer = offers.find((item) => item.id === id && item.kind === "subscription");
  const prices: ShownPrice[] = [];
  for (const interval of ["month", "year"] as const) {
    const listed = listedPrice(offer?.prices.find((price) => price.interval === interval));
    if (listed) prices.push({ interval, text: listed.label, placeholder: false });
    else if (preview) prices.push({ interval, text: PRICE_NOT_SET, placeholder: true });
  }
  if (!preview && prices.length === 0) return null;
  return { id, name: offer?.name ?? PLAN_NAMES[id], prices };
}

function serviceView(id: string, offers: PaymentOffer[], preview: boolean): ShownService | null {
  const offer = offers.find((item) => item.id === id && item.kind === "one_time");
  const listed = listedPrice(offer?.prices.find((price) => price.interval === "one_time") ?? offer?.prices[0]);
  if (!listed && !preview) return null;
  const members = listed ? memberLines(listed.amountCents) : null;
  return {
    id,
    name: offer?.name ?? SERVICE_NAMES[id] ?? id,
    price: listed?.label ?? PRICE_NOT_SET,
    placeholder: !listed,
    plus: members?.plus ?? null,
    pro: members?.pro ?? null,
    business: members?.business ?? null,
  };
}

export function pricingFeeCopy() {
  const percent = AGENCY_COMMISSION_PERCENT;
  return {
    selfServe: `Self-serve creators pay ${percent}% only on deals that come through Momma Mari.`,
    signed: `Signed creators pay ${percent}% on all deals and get these services included.`,
    members: oneTimeMemberNote(),
  };
}

/** Plans and one-time services from the Stripe catalog. Missing prices stay on the preview. */
export function pricingPageModel(preview: boolean, offers: PaymentOffer[] = PAYMENT_OFFERS): PricingPageModel {
  const plans = PLAN_IDS.flatMap((id) => {
    const plan = planView(id, offers, preview);
    return plan ? [plan] : [];
  });
  const groups = SERVICE_GROUPS.flatMap((group) => {
    const services = group.offerIds.flatMap((id) => {
      const service = serviceView(id, offers, preview);
      return service ? [service] : [];
    });
    if (services.length === 0) return [];
    return [{ id: group.id, title: group.title, services }];
  });
  return { preview, plans, groups, fee: pricingFeeCopy() };
}
