const EMAIL_SETUP_ERROR_TEXT = {
  name: "Enter the name you want before @mommamari.com.",
  missing: "Creator not found.",
} as const;

const EMAIL_SETUP_NOTES = {
  name: "Enter the name you want before @mommamari.com, like abby.",
  missing: "Creator not found.",
  choice: "Pick business email, the email you already use, or a hosted address. Nothing was changed.",
} as const;

/** A short code for the email-setup form. Unknown wording stays the fixed fallback. */
export function emailSetupErrorCode(error: string) {
  const match = (Object.keys(EMAIL_SETUP_ERROR_TEXT) as (keyof typeof EMAIL_SETUP_ERROR_TEXT)[])
    .find((code) => EMAIL_SETUP_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known email-setup sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function emailSetupErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return EMAIL_SETUP_NOTES[code as keyof typeof EMAIL_SETUP_NOTES] ?? null;
}
