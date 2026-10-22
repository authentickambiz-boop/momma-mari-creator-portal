export const PROFILE_ERROR_TEXT = {
  own: "You can only edit your own profile.",
  hidden: "That profile is hidden because this creator left the roster.",
  name: "Add a display name before showing your profile.",
  bio: "Bio can be 160 characters.",
  family: "Confirm the family details before saving them.",
  about: "About me lines can be 40 characters.",
  picture: "Use a JPEG under 150 KB for the profile picture.",
  banner: "Use a JPEG under 220 KB for the cover.",
  pin: "Use a JPEG under 40 KB for a pinned post.",
  link: "Pinned posts use an http or https link.",
  pinTitle: "Add a title for each pinned post.",
  niches: "Pick at least one niche.",
  nicheMax: "Pick up to 5.",
  nicheList: "Pick a niche from the list.",
  nicheOther: "Other can be 40 characters.",
  viewers: "Average viewers has to be a whole number.",
  hours: "Hours per week has to be a whole number.",
  followers: "Enter a follower count as a whole number.",
  platformUrl: "Profile links start with http:// or https://.",
  handles: "Add a handle for each platform you fill in.",
  proof: "Analytics proof uses an http or https link.",
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
