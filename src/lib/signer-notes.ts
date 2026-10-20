const SIGNER_ERROR_TEXT = {
  owner: "Only an admin can mark a signer as a minor.",
  missing: "Creator not found.",
} as const;

/** A short code for a refused signer flag. Unknown wording stays the fixed fallback. */
export function signerErrorCode(error: string) {
  const match = (Object.keys(SIGNER_ERROR_TEXT) as (keyof typeof SIGNER_ERROR_TEXT)[])
    .find((code) => SIGNER_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known signer sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function signerErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return SIGNER_ERROR_TEXT[code as keyof typeof SIGNER_ERROR_TEXT] ?? null;
}
