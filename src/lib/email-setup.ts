export const EMAIL_SETUPS = ["business", "personal", "hosted"] as const;
export type EmailSetup = (typeof EMAIL_SETUPS)[number];

/**
 * Portal-side Stripe catalog. Prices are not charged from here.
 * "placeholder" means Kamron has not set a Stripe price yet.
 */
export const STRIPE_CATALOG = {
  hostedCreatorEmail: {
    name: "hosted creator email",
    priceLabel: "placeholder",
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

export function hostedEmailRequestMessage(address: string) {
  const item = STRIPE_CATALOG.hostedCreatorEmail;
  return `Hosted email requested: ${address}. Paid add-on: ${item.name}. Price: ${item.priceLabel}.`;
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith(".invalid");
}
