const SHOWCASE_ERROR_TEXT = {
  owner: "Only an owner can choose who is on the public page.",
  roster: "That creator is not on the roster.",
  bio: "Bio can be 280 characters.",
  pay: "Leave pay and email addresses off the public bio.",
  photo: "Use a photo file saved for this page.",
  face: "Confirm the photo shows the creator only, with no child's face.",
} as const;

export const SHOWCASE_NOTES: Record<string, string> = {
  ...SHOWCASE_ERROR_TEXT,
  "1": "That was not saved.",
};

export function showcaseErrorCode(error: string) {
  const match = (Object.keys(SHOWCASE_ERROR_TEXT) as (keyof typeof SHOWCASE_ERROR_TEXT)[])
    .find((code) => SHOWCASE_ERROR_TEXT[code] === error);
  return match ?? "1";
}

export function showcaseErrorNote(code: string | undefined) {
  if (!code) return null;
  return SHOWCASE_NOTES[code] ?? SHOWCASE_NOTES["1"];
}
