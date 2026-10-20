const BENCH_ERROR_TEXT = {
  name: "Add your name.",
  email: "Enter an email address.",
  again: "That email is already on the bench.",
  scoreOwner: "Only an owner can set a bench score.",
  score: "Use a score from 0 to 100.",
  missing: "That creator is not on the bench.",
  roster: "Only an owner can move someone onto the roster.",
  creator: "Pick a creator who is already on the roster.",
  offer: "Only an owner can offer a bench job.",
  campaign: "That campaign is not on the board.",
  closed: "That campaign is not open.",
  fit: "A roster creator still fits. The bench only gets what the roster passed on.",
  amount: "Enter the offer amount.",
  waiting: "That creator is not waiting on the bench.",
  approve: "Only an owner can approve a bench offer.",
  offerMissing: "That offer is not on the bench.",
  paid: "That job is already marked paid.",
  mark: "Only an owner can mark a bench job paid.",
  before: "Approve the offer before marking it paid.",
} as const;

export const BENCH_NOTES: Record<string, string> = {
  ...BENCH_ERROR_TEXT,
  "1": "That was not saved.",
};

export function benchErrorCode(error: string) {
  const match = (Object.keys(BENCH_ERROR_TEXT) as (keyof typeof BENCH_ERROR_TEXT)[])
    .find((code) => BENCH_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function benchErrorNote(code: string | undefined) {
  if (!code) return null;
  return BENCH_NOTES[code] ?? BENCH_NOTES["1"];
}
