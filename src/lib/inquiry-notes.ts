const INQUIRY_ERROR_TEXT = {
  name: "Name the brand.",
  email: "Use a real work email.",
} as const;

/** A short code for the public inquiry form. Unknown wording stays the fixed fallback. */
export function inquiryErrorCode(error: string) {
  const match = (Object.keys(INQUIRY_ERROR_TEXT) as (keyof typeof INQUIRY_ERROR_TEXT)[])
    .find((code) => INQUIRY_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known inquiry sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function inquiryErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return INQUIRY_ERROR_TEXT[code as keyof typeof INQUIRY_ERROR_TEXT] ?? null;
}
