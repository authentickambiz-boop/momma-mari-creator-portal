/** Stripe Invoicing stays off until this is the string "true". Checkout is a separate flag. */
export function stripeInvoicingEnabled() {
  return process.env.STRIPE_INVOICING_ENABLED === "true";
}
