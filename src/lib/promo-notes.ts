const PROMO_ERROR_TEXT = {
  role: "Only Kamron can save a product image.",
  link: "Use a public https link, or leave it blank.",
  file: "Upload an image under 750 KB.",
  missing: "That item is not on file.",
} as const;

export const PROMO_NOTES: Record<string, string> = {
  ...PROMO_ERROR_TEXT,
  "1": "That image was not saved.",
};

export function promoErrorCode(error: string) {
  const match = (Object.keys(PROMO_ERROR_TEXT) as (keyof typeof PROMO_ERROR_TEXT)[])
    .find((code) => PROMO_ERROR_TEXT[code] === error);
  return match ?? "1";
}

export function promoErrorNote(code: string | undefined) {
  if (!code) return null;
  return PROMO_NOTES[code] ?? PROMO_NOTES["1"];
}
