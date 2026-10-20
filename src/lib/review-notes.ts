const REVIEW_ERROR_TEXT = {
  own: "You can't approve your own video.",
  choose: "Choose Approve or Request changes.",
  missing: "Draft not found.",
  seed: "Seed drafts stay as they are. Nothing was changed.",
  upload: "This upload is still in progress.",
  reviewed: "This version was already reviewed.",
  note: "Tell her what to fix.",
  email: "This deal has no brand email yet.",
  held: "This draft is held for Kamron. Nothing was sent to the brand.",
  deal: "Deal not found.",
  list: "That creator isn't on your list.",
  video: "You can't approve videos.",
  move: "You can't move this deal.",
} as const;

/** A short code for the draft review form. Unknown wording stays the fixed fallback. */
export function reviewErrorCode(error: string) {
  const match = (Object.keys(REVIEW_ERROR_TEXT) as (keyof typeof REVIEW_ERROR_TEXT)[])
    .find((code) => REVIEW_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known review sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function reviewErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return REVIEW_ERROR_TEXT[code as keyof typeof REVIEW_ERROR_TEXT] ?? null;
}
