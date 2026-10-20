const SAFETY_ERROR_TEXT = {
  creator: "You can't clear a safety hold.",
  owner: "Only Kamron can clear a safety hold.",
} as const;

/** A short code for a refused safety clear. Unknown wording stays the fixed fallback. */
export function safetyErrorCode(error: string) {
  const match = (Object.keys(SAFETY_ERROR_TEXT) as (keyof typeof SAFETY_ERROR_TEXT)[])
    .find((code) => SAFETY_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known safety sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function safetyErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return SAFETY_ERROR_TEXT[code as keyof typeof SAFETY_ERROR_TEXT] ?? null;
}
