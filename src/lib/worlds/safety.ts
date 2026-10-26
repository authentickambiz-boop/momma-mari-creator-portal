/**
 * Worlds has no adult category and no explicit copy.
 * Submissions that read that way are refused and not stored.
 */

export const WORLDS_TEXT_REJECTION = "That stays out of Worlds. Rewrite it and try again.";

const WORD = /\b(?:nsfw|porn|porno|xxx|nude|nudes|nudity|naked|erotic|erotica|onlyfans|fansly|lingerie|fetish|orgasm|horny|hentai|sexy|sexual|sex)\b/i;
const PHRASE = /\b(?:adult\s+content|explicit\s+content|18\s*\+)\b/i;
const COMPACT = /(?:nsfw|onlyfans|fansly|porn|porno|nude|nudes|naked|erotic|erotica|lingerie|fetish|orgasm|horny|hentai)/;

function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/3/g, "e")
    .replace(/[@4]/g, "a")
    .replace(/0/g, "o")
    .replace(/1|!/g, "i")
    .replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
}

/** Null when the text can stay in Worlds. The rejection does not repeat the note. */
export function worldsTextRejection(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (WORD.test(trimmed) || PHRASE.test(trimmed)) return WORLDS_TEXT_REJECTION;
  if (COMPACT.test(fold(trimmed))) return WORLDS_TEXT_REJECTION;
  for (const token of trimmed.toLowerCase().split(/[^a-z0-9@$!]+/)) {
    const folded = fold(token);
    if (folded === "sex" || folded === "sexy" || folded === "xxx" || folded === "nsfw") return WORLDS_TEXT_REJECTION;
  }
  return null;
}
