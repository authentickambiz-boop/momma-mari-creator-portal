const GIFT_ERROR_TEXT = {
  photos: "Add at least one photo link.",
  six: "Use up to six photo links.",
  http: "Photo links have to start with http:// or https://.",
  owner: "Only Kamron can post a free product.",
  brand: "Name the brand.",
  product: "Name the product.",
  video: "Say what video they owe, such as 1 TikTok.",
  due: "Use a due date like 2026-11-20.",
  retail: "Enter the product's retail value.",
  who: "Apply as a creator or as someone on the bench.",
  terms: "Accept the current terms before you apply.",
  missing: "That free product is not posted.",
  roster: "That creator is not on the roster.",
  bench: "That person is not on the free bench.",
  again: "You already applied for this product.",
  email: "Enter the email you used for the bench.",
  portal: "Sign in to apply. Free products are on your portal.",
  join: "Join the bench or sign in first.",
  update: "Only Kamron can update this.",
  application: "That application is not here.",
  status: "That status can't be set from here.",
  owed: "The product has not been marked delivered, so nothing is owed yet.",
  link: "Add the link to the posted video.",
  own: "You can only post your own video.",
  creator: "Sign in as a creator to apply.",
} as const;

export const GIFT_NOTES: Record<string, string> = {
  ...GIFT_ERROR_TEXT,
  "1": "That was not saved.",
};

export function giftErrorCode(error: string) {
  const match = (Object.keys(GIFT_ERROR_TEXT) as (keyof typeof GIFT_ERROR_TEXT)[])
    .find((code) => GIFT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function giftErrorNote(code: string | undefined) {
  if (!code) return null;
  return GIFT_NOTES[code] ?? GIFT_NOTES["1"];
}
