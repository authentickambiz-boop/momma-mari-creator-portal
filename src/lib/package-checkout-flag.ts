import { paymentsEnabled } from "./payments-config";

/**
 * Deposit checkout for brand packages stays off unless both flags are the string "true".
 * Creator checkout uses PAYMENTS_ENABLED on its own. This second flag keeps package deposits off.
 */
export function packageCheckoutEnabled() {
  return paymentsEnabled() && process.env.BRAND_PACKAGE_CHECKOUT_ENABLED === "true";
}
