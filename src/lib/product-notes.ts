const PRODUCT_ERROR_TEXT = {
  carrier: "Carrier and tracking number are required.",
  missing: "Deal not found.",
  tracking: "You can't add tracking.",
  own: "You can't update this deal.",
  list: "That creator isn't on your list.",
  past: "This deal is already past the product. Nothing was changed.",
  move: "You can't move this deal.",
} as const;

/** A short code for the tracking form. Unknown wording stays the fixed fallback. */
export function productErrorCode(error: string) {
  const match = (Object.keys(PRODUCT_ERROR_TEXT) as (keyof typeof PRODUCT_ERROR_TEXT)[])
    .find((code) => PRODUCT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known tracking sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function productErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return PRODUCT_ERROR_TEXT[code as keyof typeof PRODUCT_ERROR_TEXT] ?? null;
}
