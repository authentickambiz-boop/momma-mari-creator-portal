const INVITE_ERROR_TEXT = {
  missing: "Invite not found.",
  own: "That invite is not yours.",
} as const;

export const INVITE_NOTES: Record<string, string> = {
  ...INVITE_ERROR_TEXT,
  "1": "That was not saved.",
};

export function inviteErrorCode(error: string) {
  const match = (Object.keys(INVITE_ERROR_TEXT) as (keyof typeof INVITE_ERROR_TEXT)[])
    .find((code) => INVITE_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function inviteErrorNote(code: string | undefined) {
  if (!code) return null;
  return INVITE_NOTES[code] ?? INVITE_NOTES["1"];
}
