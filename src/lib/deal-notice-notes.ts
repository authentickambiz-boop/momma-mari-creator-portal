const DEAL_NOTICE_TEXT = {
  owner: "Only Kamron can review deals.",
  missing: "Deal not found.",
  reply: "Write the reply first.",
  rate: "Set the agreed rate before asking the creator to confirm it.",
  creator: "Only the creator can confirm this rate.",
  own: "You can only confirm your own deal.",
  ready: "This rate is not ready for you yet.",
  again: "You already confirmed this rate.",
  dollars: "Enter the rate in dollars.",
  rejected: "This deal was rejected.",
  shared: "This deal is already on the creator's list.",
  stage: "That is not a deal stage.",
  move: "You can't move this deal.",
  choose: "Choose I'm interested or Not for me.",
  ownOffer: "You can only respond to your own offers.",
  answered: "You already answered this offer.",
  pass: "Creators don't pass on terms from here.",
  waiting: "This offer is not on your list yet.",
  brandEmail: "This offer has no brand email yet.",
} as const;

export const DEAL_NOTICE_NOTES: Record<string, string> = {
  ...DEAL_NOTICE_TEXT,
  "1": "That was not saved.",
};

export function dealNoticeCode(error: string) {
  const match = (Object.keys(DEAL_NOTICE_TEXT) as (keyof typeof DEAL_NOTICE_TEXT)[])
    .find((code) => DEAL_NOTICE_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function dealNoticeNote(code: string | undefined) {
  if (!code) return null;
  return DEAL_NOTICE_NOTES[code] ?? DEAL_NOTICE_NOTES["1"];
}

/** The sentence for a known code. The generic fallback and unknown codes stay null. */
export function dealNoticeSpecific(code: string | undefined) {
  if (!code || !(code in DEAL_NOTICE_TEXT)) return null;
  return DEAL_NOTICE_TEXT[code as keyof typeof DEAL_NOTICE_TEXT];
}
