export const EMAIL_SETUPS = ["business", "personal", "hosted"] as const;
export type EmailSetup = (typeof EMAIL_SETUPS)[number];

export const HOSTED_EMAIL_DOMAIN = "mommamari.com";

/**
 * Portal-side Stripe catalog for hosted creator email.
 * Nothing is charged from the portal. Stripe is not connected yet.
 * Roster creators are the people already on the Momma Mari creator list.
 */
export const STRIPE_CATALOG = {
  hostedCreatorEmail: {
    name: "hosted creator email",
    domain: HOSTED_EMAIL_DOMAIN,
    charged: false,
    public: {
      setupLabel: "$99 one-time setup",
      monthlyLabel: "$19/month",
      priceLabel: "$99 one-time setup + $19/month",
    },
    roster: {
      setupLabel: "$79 one-time setup",
      monthlyLabel: "$15/month",
      priceLabel: "$79 one-time setup + $15/month",
    },
  },
} as const;

export function isEmailSetup(value: string | null | undefined): value is EmailSetup {
  return value === "business" || value === "personal" || value === "hosted";
}

export function emailSetupLabel(choice: EmailSetup) {
  if (choice === "business") return "New business Gmail";
  if (choice === "personal") return "Personal email, brand mail only";
  return "Momma Mari hosted email";
}

export function hostedEmailAddOn() {
  const item = STRIPE_CATALOG.hostedCreatorEmail;
  return {
    name: item.name,
    domain: item.domain,
    charged: item.charged,
    applies: "roster" as const,
    priceLabel: item.roster.priceLabel,
    rosterPriceLabel: item.roster.priceLabel,
    publicPriceLabel: item.public.priceLabel,
  };
}

export function hostedEmailRequestMessage(address: string) {
  const offer = hostedEmailAddOn();
  return `Hosted email requested: ${address}. Paid add-on: ${offer.name}. Roster: ${offer.rosterPriceLabel}. Public: ${offer.publicPriceLabel}. Not charged yet.`;
}

/** Turn a requested name into name@mommamari.com. Returns null when it is not a usable mailbox name. */
export function hostedEmailPreview(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const localSource = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
  const local = localSource
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  if (!local || local.length > 64) return null;
  if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(local)) return null;
  return `${local}@${HOSTED_EMAIL_DOMAIN}`;
}
