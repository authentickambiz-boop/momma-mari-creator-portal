const SETTINGS_ERROR_TEXT = {
  own: "Settings for notices are on the creator's own sign-in.",
} as const;

export const SETTINGS_NOTES: Record<string, string> = {
  ...SETTINGS_ERROR_TEXT,
  "1": "That was not saved.",
};

export function settingsErrorCode(error: string) {
  const match = (Object.keys(SETTINGS_ERROR_TEXT) as (keyof typeof SETTINGS_ERROR_TEXT)[])
    .find((code) => SETTINGS_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function settingsErrorNote(code: string | undefined) {
  if (!code) return null;
  return SETTINGS_NOTES[code] ?? SETTINGS_NOTES["1"];
}

const SUPPORT_ERROR_TEXT = {
  subject: "Add a subject.",
  body: "Write a message.",
  long: "That note is too long.",
  portal: "Support notes stay in the portal.",
} as const;

export const SUPPORT_NOTES: Record<string, string> = {
  ...SUPPORT_ERROR_TEXT,
  "1": "That was not saved.",
};

export function supportErrorCode(error: string) {
  const match = (Object.keys(SUPPORT_ERROR_TEXT) as (keyof typeof SUPPORT_ERROR_TEXT)[])
    .find((code) => SUPPORT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function supportErrorNote(code: string | undefined) {
  if (!code) return null;
  return SUPPORT_NOTES[code] ?? SUPPORT_NOTES["1"];
}
