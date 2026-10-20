const GROWTH_ERROR_TEXT = {
  weights: "Only an owner can change rank weights.",
  inputs: "Only an owner can edit rank inputs.",
  roster: "That creator is not on the roster.",
  ranks: "Ranks stay on the owner's sign-in.",
  update: "Only an owner can update ranks.",
  podSave: "Only an owner can save a pod.",
  name: "Name the pod.",
  manager: "Pick a manager.",
  creators: "Add at least one creator.",
  pod: "That pod is not on your list.",
  title: "Add a title and a date.",
  idea: "Add a creator before posting an idea.",
  collab: "Name the collab.",
  board: "That collab is not on the board.",
  pair: "A manager pairs creators for a collab.",
  member: "Pick a creator in this pod.",
  shout: "Write the shout-out.",
  goalRole: "A manager sets the pod goal.",
  goal: "Add a goal and a target.",
  goalMissing: "That goal is not on this pod.",
  numbers: "A manager records the pod numbers.",
  month: "Use a month like 2026-10.",
  report: "Only an owner can build a rank report.",
  level: "Pick a creator, a team, or a cross-team report.",
  target: "Only an owner can set the reinvestment target.",
  percent: "Use a whole percent from 0 to 100.",
  log: "Only an owner can log reinvestment.",
  category: "Pick a category.",
  amount: "Enter the amount in dollars.",
  reinvest: "Reinvestment stays on the owner's sign-in.",
} as const;

export const GROWTH_NOTES: Record<string, string> = {
  ...GROWTH_ERROR_TEXT,
  "1": "That was not saved.",
};

export function growthErrorCode(error: string) {
  const match = (Object.keys(GROWTH_ERROR_TEXT) as (keyof typeof GROWTH_ERROR_TEXT)[])
    .find((code) => GROWTH_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function growthErrorNote(code: string | undefined) {
  if (!code) return null;
  return GROWTH_NOTES[code] ?? GROWTH_NOTES["1"];
}
