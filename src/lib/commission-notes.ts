const COMMISSION_ERROR_TEXT = {
  brand: "Name the brand.",
  title: "Add a title.",
  description: "Add a description.",
  terms: "Add the commission or affiliate terms.",
  status: "Status must be open or closed.",
  link: "Tracking link must be a full link, or pending.",
  rate: "Rate stays TBD. This board does not store a price.",
  missing: "That campaign is not open.",
  closed: "That campaign is closed.",
  creator: "Sign in as a creator to show interest.",
  since: "since must be a time like 2026-10-21T00:00:00.000Z.",
  id: "id is required.",
} as const;

export const COMMISSION_NOTES: Record<string, string> = {
  ...COMMISSION_ERROR_TEXT,
  "1": "That was not saved.",
};

export function commissionErrorCode(error: string) {
  const match = (Object.keys(COMMISSION_ERROR_TEXT) as (keyof typeof COMMISSION_ERROR_TEXT)[])
    .find((code) => COMMISSION_ERROR_TEXT[code] === error);
  return match ?? "1";
}

export function commissionErrorNote(code: string | undefined) {
  if (!code) return null;
  return COMMISSION_NOTES[code] ?? COMMISSION_NOTES["1"];
}
