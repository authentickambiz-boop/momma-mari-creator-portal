const PROSPECT_ERROR_TEXT = {
  owner: "Only an owner can add a prospect.",
  name: "Add the prospect's name.",
  email: "Add a real email address.",
  move: "Only an owner can move a prospect onto the roster.",
  missing: "That prospect is not on the list.",
  roster: "Pick a creator who is already on the roster.",
} as const;

export const PROSPECT_NOTES: Record<string, string> = {
  ...PROSPECT_ERROR_TEXT,
  "1": "That was not saved.",
};

export function prospectErrorCode(error: string) {
  const match = (Object.keys(PROSPECT_ERROR_TEXT) as (keyof typeof PROSPECT_ERROR_TEXT)[])
    .find((code) => PROSPECT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function prospectErrorNote(code: string | undefined) {
  if (!code) return null;
  return PROSPECT_NOTES[code] ?? PROSPECT_NOTES["1"];
}
