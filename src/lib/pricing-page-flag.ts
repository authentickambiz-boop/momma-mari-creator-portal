/** The public Plans & Services page stays off until this is the string "true". */
export function pricingPageEnabled() {
  return process.env.PRICING_PAGE_ENABLED === "true";
}
