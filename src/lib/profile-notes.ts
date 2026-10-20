const PROFILE_ERROR_TEXT = {
  own: "You can only edit your own profile.",
  hidden: "That profile is hidden because this creator left the roster.",
  name: "Add a display name before showing your profile.",
  bio: "Bio can be 280 characters.",
  family: "Confirm the family details before saving them.",
} as const;

export const PROFILE_NOTES: Record<string, string> = {
  ...PROFILE_ERROR_TEXT,
  "1": "That was not saved.",
};

export function profileErrorCode(error: string) {
  const match = (Object.keys(PROFILE_ERROR_TEXT) as (keyof typeof PROFILE_ERROR_TEXT)[])
    .find((code) => PROFILE_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function profileErrorNote(code: string | undefined) {
  if (!code) return null;
  return PROFILE_NOTES[code] ?? PROFILE_NOTES["1"];
}
