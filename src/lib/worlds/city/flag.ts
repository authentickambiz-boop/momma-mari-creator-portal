/** Worlds City stays off unless this is exactly the string "true". The live office does not read it. */
export function worldsCityEnabled(env?: { WORLDS_CITY?: string | undefined }) {
  const flag = env ? env.WORLDS_CITY : process.env.WORLDS_CITY;
  return flag === "true";
}
