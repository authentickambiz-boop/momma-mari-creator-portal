const FINISH_ERROR_TEXT = {
  connect: "Choose how brand email should work, then connect it.",
  host: "Enter the address you want Momma Mari to host.",
  profile: "Name your bot, and add a niche, content style, rates, and at least one platform.",
  niches: "Pick at least one niche.",
  nicheMax: "Pick up to 5.",
  nicheList: "Pick a niche from the list.",
  nicheOther: "Other can be 40 characters.",
} as const;

/** A short code for the finish-profile form. Unknown wording stays the fixed fallback. */
export function finishErrorCode(error: string) {
  const match = (Object.keys(FINISH_ERROR_TEXT) as (keyof typeof FINISH_ERROR_TEXT)[])
    .find((code) => FINISH_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known finish-profile sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function finishErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return FINISH_ERROR_TEXT[code as keyof typeof FINISH_ERROR_TEXT] ?? null;
}
