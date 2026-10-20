const NOTICE_ERROR_TEXT = {
  missing: "Notification not found.",
  own: "That notice isn't yours.",
} as const;

/** A short code for a refused notice dismiss. Unknown wording stays the fixed fallback. */
export function noticeErrorCode(error: string) {
  const match = (Object.keys(NOTICE_ERROR_TEXT) as (keyof typeof NOTICE_ERROR_TEXT)[])
    .find((code) => NOTICE_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known notice sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function noticeErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return NOTICE_ERROR_TEXT[code as keyof typeof NOTICE_ERROR_TEXT] ?? null;
}
