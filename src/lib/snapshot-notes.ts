const SNAPSHOT_ERROR_TEXT = {
  platform: "Pick a platform from the list.",
  date: "Enter the capture date as YYYY-MM-DD.",
  roster: "That creator is not on the roster.",
  revenue: "Revenue has to be a dollar amount, or left blank.",
  numbers: "Enter at least one number July displayed. Leave the rest blank.",
  owner: "Only an owner can enter a snapshot.",
} as const;

export const SNAPSHOT_NOTES: Record<string, string> = {
  ...SNAPSHOT_ERROR_TEXT,
  "1": "That was not saved.",
};

export function snapshotErrorCode(error: string) {
  const match = (Object.keys(SNAPSHOT_ERROR_TEXT) as (keyof typeof SNAPSHOT_ERROR_TEXT)[])
    .find((code) => SNAPSHOT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function snapshotErrorNote(code: string | undefined) {
  if (!code) return null;
  return SNAPSHOT_NOTES[code] ?? SNAPSHOT_NOTES["1"];
}
