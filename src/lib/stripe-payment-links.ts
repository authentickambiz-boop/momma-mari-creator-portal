import { PAYMENT_OFFERS } from "./payments-config";

export const BUY_NOW_LABEL = "Buy now";

/**
 * Live Stripe Payment Links for one-time services.
 * Monthly plans stay off this list. There is no $25 listing here.
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
