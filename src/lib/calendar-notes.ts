const CALENDAR_ERROR_TEXT = {
  kind: "That date needs to be a draft or a post.",
  date: "Use a date like 2026-10-21.",
  missing: "Deal not found.",
  dates: "You can't change due dates.",
  list: "That creator isn't on your list.",
  own: "You can only connect your own calendar.",
} as const;

export const CALENDAR_NOTES: Record<string, string> = {
  ...CALENDAR_ERROR_TEXT,
  "1": "That was not saved.",
};

export function calendarErrorCode(error: string) {
  const match = (Object.keys(CALENDAR_ERROR_TEXT) as (keyof typeof CALENDAR_ERROR_TEXT)[])
    .find((code) => CALENDAR_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function calendarErrorNote(code: string | undefined) {
  if (!code) return null;
  return CALENDAR_NOTES[code] ?? CALENDAR_NOTES["1"];
}
