const KIT_ERROR_TEXT = {
  own: "You can only edit your own media kit.",
  roster: "That creator is not on the roster.",
  name: "Add a display name before sharing the kit.",
  bio: "Bio can be 280 characters.",
  numbers: "Followers and average views are whole numbers.",
} as const;

export const KIT_NOTES: Record<string, string> = {
  ...KIT_ERROR_TEXT,
  "1": "That was not saved.",
};

export function kitErrorCode(error: string) {
  const match = (Object.keys(KIT_ERROR_TEXT) as (keyof typeof KIT_ERROR_TEXT)[])
    .find((code) => KIT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function kitErrorNote(code: string | undefined) {
  if (!code) return null;
  return KIT_NOTES[code] ?? KIT_NOTES["1"];
}
