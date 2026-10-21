/** Public analytics hooks stay off until this is the string "true". */
export function analyticsEnabled() {
  return process.env.ANALYTICS_ENABLED === "true";
}
