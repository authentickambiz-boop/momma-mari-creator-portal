const CAMPAIGN_ERROR_TEXT = {
  filter: "Enter the budget in dollars, like 500.",
  owner: "Only an owner can add a campaign.",
  name: "Add the brand and the campaign name.",
  budget: "Enter the budget in dollars.",
  slots: "Add at least one creator slot.",
  missing: "That campaign is not on the board.",
  split: "Only an owner can split a campaign.",
  offer: "Brand offers are changed on the offers page.",
  share: "Enter how much of the budget she gets.",
  roster: "That creator is not on the roster.",
  over: "That split is over the campaign budget.",
  filled: "Every creator slot is filled.",
  outside: "Only an owner can open a campaign to outside creators.",
  fit: "A roster creator still fits this campaign.",
  queue: "Only an owner can queue an outside offer.",
  closed: "This campaign is still for the roster.",
  amount: "Enter the offer amount.",
  prospect: "That prospect is not on the list.",
  date: "Use a date like 2026-11-01.",
  goal: "Add both the goal and the target number.",
  target: "Enter the target as a number, like 100000.",
} as const;

export const CAMPAIGN_NOTES: Record<string, string> = {
  ...CAMPAIGN_ERROR_TEXT,
  "1": "That was not saved.",
};

export function campaignErrorCode(error: string) {
  const match = (Object.keys(CAMPAIGN_ERROR_TEXT) as (keyof typeof CAMPAIGN_ERROR_TEXT)[])
    .find((code) => CAMPAIGN_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function campaignErrorNote(code: string | undefined) {
  if (!code) return null;
  return CAMPAIGN_NOTES[code] ?? CAMPAIGN_NOTES["1"];
}
