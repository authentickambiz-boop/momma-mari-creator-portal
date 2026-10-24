/** Worlds City stays off unless this is exactly the string "true". The live office does not read it. */
export function worldsCityEnabled(env?: { WORLDS_CITY?: string | undefined }) {
  const flag = env ? env.WORLDS_CITY : process.env.WORLDS_CITY;
  return flag === "true";
}

/**
 * The owner panel smoke page stays off unless both flags are exactly "true".
 * It renders the same panel the owner uses. It does not post or send mail.
 */
export function worldsCitySmokeEnabled(env?: { WORLDS_CITY?: string | undefined; WORLDS_CITY_SMOKE?: string | undefined }) {
  const source = env ?? { WORLDS_CITY: process.env.WORLDS_CITY, WORLDS_CITY_SMOKE: process.env.WORLDS_CITY_SMOKE };
  return source.WORLDS_CITY === "true" && source.WORLDS_CITY_SMOKE === "true";
}
