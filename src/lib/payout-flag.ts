/** Bank or Stripe transfers stay off until this is the string "true". The ledger itself only records dates. */
export function payoutTransfersEnabled() {
  return process.env.CREATOR_PAYOUT_TRANSFERS_ENABLED === "true";
}
