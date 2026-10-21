/** Public package dollar amounts stay hidden until this is the string "true". */
export function packagePricesApproved() {
  return process.env.PACKAGE_PRICES_APPROVED === "true";
}
