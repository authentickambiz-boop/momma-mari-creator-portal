/**
 * Still a draft. The public wording says the terms are pending legal review.
 * Stripe is a later step. The portal only flags an amount owed.
 */
export const GIFTED_TERMS_STATUS = "DRAFT" as const;

export const GIFTED_TERMS_VERSION = "draft-2";

/** $50 finder's fee, in cents. Added to the product's retail value when an amount is flagged. */
export const GIFTED_FINDERS_FEE_CENTS = 5000;

export const GIFTED_TERMS_TEXT = `These terms are pending legal review.

Receiving this product means you must deliver the required video by the due date. If you receive the product and do not deliver the video by that deadline, you will owe the full retail cost of the product plus a $50 finder's fee.

Nothing is charged automatically. Momma Mari reviews the amount before it is flagged.`;
