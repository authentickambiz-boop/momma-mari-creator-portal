const RECAP_ERROR_TEXT = {
  owner: "Only the owner can edit a recap.",
  deal: "That deal is not on the board.",
  goal: "Add both the goal and the target number.",
  target: "Enter the target as a number, like 100000.",
  post: "Add the post link, platform, posted date, and the deliverable it fulfills.",
  date: "Use a posted date like 2026-10-14.",
  url: "The post link has to start with http:// or https://.",
  platform: "Choose a platform from the list.",
  deliverable: "Choose one of the contracted deliverables.",
  snapshot: "Add the window, the metric, the number, and where it came from.",
  source: "Choose WithJuly / platform, link check, or creator-submitted.",
  fake: "That figure looks like a sample. Enter the recorded one.",
  private: "That text mentions private deal terms. It was not saved.",
  import: "Nothing in that import was saved. Check each line.",
  note: "Keep the next campaign note under 500 characters.",
  draft: "That recap draft is not on the list yet.",
} as const;

export const RECAP_NOTES: Record<string, string> = {
  ...RECAP_ERROR_TEXT,
  "1": "That was not saved.",
};

export function recapErrorCode(error: string) {
  const match = (Object.keys(RECAP_ERROR_TEXT) as (keyof typeof RECAP_ERROR_TEXT)[])
    .find((code) => RECAP_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function recapErrorNote(code: string | undefined) {
  if (!code) return null;
  return RECAP_NOTES[code] ?? RECAP_NOTES["1"];
}
