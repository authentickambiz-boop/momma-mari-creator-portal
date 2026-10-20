const BRAND_ERROR_TEXT = {
  owner: "Only an owner can update the brand list.",
  name: "Name the brand.",
  kind: "Add a contact or a response.",
  response: "Choose interested, declined, no reply, or negotiating.",
  missing: "That brand is not on a deal yet.",
} as const;

export const BRAND_NOTES: Record<string, string> = {
  ...BRAND_ERROR_TEXT,
  "1": "That was not saved.",
};

export function brandErrorCode(error: string) {
  const match = (Object.keys(BRAND_ERROR_TEXT) as (keyof typeof BRAND_ERROR_TEXT)[])
    .find((code) => BRAND_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function brandErrorNote(code: string | undefined) {
  if (!code) return null;
  return BRAND_NOTES[code] ?? BRAND_NOTES["1"];
}
