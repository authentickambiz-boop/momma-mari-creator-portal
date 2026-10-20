const RIGHTS_ERROR_TEXT = {
  own: "You can't change usage rights.",
  date: "Use dates like 2026-10-21.",
  end: "The end date has to be on or after the start.",
  missing: "Deal not found.",
} as const;

export const RIGHTS_NOTES: Record<string, string> = {
  ...RIGHTS_ERROR_TEXT,
  "1": "That was not saved.",
};

export function rightsErrorCode(error: string) {
  const match = (Object.keys(RIGHTS_ERROR_TEXT) as (keyof typeof RIGHTS_ERROR_TEXT)[])
    .find((code) => RIGHTS_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function rightsErrorNote(code: string | undefined) {
  if (!code) return null;
  return RIGHTS_NOTES[code] ?? RIGHTS_NOTES["1"];
}
