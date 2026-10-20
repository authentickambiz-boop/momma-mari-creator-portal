const RULES_ERROR_TEXT = {
  edit: "You can't edit these deal rules.",
  floor: "Only an owner can set the agency minimum.",
  profit: "Enter the minimum profit in dollars.",
  override: "Only an owner can override a sponsor category.",
  missing: "That deal is not on the list.",
} as const;

export const RULES_NOTES: Record<string, string> = {
  ...RULES_ERROR_TEXT,
  "1": "That was not saved.",
};

export function rulesErrorCode(error: string) {
  const match = (Object.keys(RULES_ERROR_TEXT) as (keyof typeof RULES_ERROR_TEXT)[])
    .find((code) => RULES_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function rulesErrorNote(code: string | undefined) {
  if (!code) return null;
  return RULES_NOTES[code] ?? RULES_NOTES["1"];
}
