const RIGHTS_ERROR_TEXT = {
  own: "You can't change usage rights.",
  date: "Use dates like 2026-10-21.",
  end: "The end date has to be on or after the start.",
  missing: "Deal not found.",
  perpetual: "Perpetual usage stays off unless the owner turns it on.",
  tier: "Pick a usage tier of 30, 60, 90, 180, or 365 days.",
  channel: "Pick at least one channel.",
  fee: "Enter a dollar amount.",
  ownerFee: "Only the owner can record a renewal fee.",
  window: "Set a usage window before recording a renewal fee.",
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
