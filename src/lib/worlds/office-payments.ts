/**
 * Worlds never move money. The flag only chooses the refusal text.
 * There is no success path and no charge, even when the flag is on.
 */

export function worldsPaymentsEnabled() {
  return process.env.WORLDS_PAYMENTS_ENABLED === "true";
}

export function refuseWorldsPayment() {
  const error = worldsPaymentsEnabled()
    ? "The office does not move money. Pay stays needs your OK in Grok Bot."
    : "Worlds payments are off. Nothing was charged.";
  return { ok: false as const, charged: false as const, status: 403 as const, error };
}
