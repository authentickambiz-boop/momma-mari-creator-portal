import { SPONSORED_ERRORS } from "./sponsored-posts";

export const SPONSORED_NOTES: Record<string, string> = {
  ...SPONSORED_ERRORS,
  "1": "That was not saved.",
};

export function sponsoredErrorCode(error: string) {
  const match = (Object.keys(SPONSORED_ERRORS) as (keyof typeof SPONSORED_ERRORS)[])
    .find((code) => SPONSORED_ERRORS[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function sponsoredErrorNote(code: string | undefined) {
  if (!code) return null;
  return SPONSORED_NOTES[code] ?? SPONSORED_NOTES["1"];
}
