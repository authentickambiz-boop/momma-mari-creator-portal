const OFFER_ERROR_TEXT = {
  email: "Use a real contact email, or leave it blank. Nothing was emailed.",
  owner: "Only an owner can send a brand offer.",
  name: "Name the brand.",
  contact: "Add the brand contact.",
  deliverable: "Add at least one deliverable.",
  platform: "Add at least one platform.",
  budget: "Enter a budget for at least one creator.",
  dollars: "Enter each budget in dollars, like 500, or leave it blank.",
  signin: "Open this from your own sign-in.",
  interest: "Tell Kamron you're interested. Passing and questions stay with him.",
  list: "That offer is not on your list.",
  stage: "That is not a deal stage.",
  missing: "Deal not found.",
  move: "You can't move this deal.",
} as const;

export const OFFER_NOTES: Record<string, string> = {
  ...OFFER_ERROR_TEXT,
  "1": "That was not saved.",
};

export function offerErrorCode(error: string) {
  const match = (Object.keys(OFFER_ERROR_TEXT) as (keyof typeof OFFER_ERROR_TEXT)[])
    .find((code) => OFFER_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function offerErrorNote(code: string | undefined) {
  if (!code) return null;
  return OFFER_NOTES[code] ?? OFFER_NOTES["1"];
}
