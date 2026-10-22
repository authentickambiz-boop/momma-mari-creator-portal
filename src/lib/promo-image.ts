export type PromoSource = "email" | "website" | "owner";

export type PromoCandidate = {
  source: PromoSource;
  url: string;
  filename?: string | null;
  alt?: string | null;
  pageUrl?: string | null;
};

export type PromoChoice = {
  url: string;
  source: PromoSource;
  sourceLabel: "From brand email" | "From brand website" | "Owner upload";
  pageUrl: string | null;
  needsCheck: boolean;
  alt: string;
};

const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i;
const LOGO = /(^|[^a-z])(logo|logos|favicon|icon|avatar|wordmark|brandmark|sprite|badge)([^a-z]|$)/i;
const PIXEL = /(pixel|spacer|tracking|beacon|1x1)/i;
const STOP = new Set(["the", "and", "for", "with", "from", "this", "that", "your", "app", "product", "new"]);

const SOURCE_LABEL: Record<PromoSource, PromoChoice["sourceLabel"]> = {
  email: "From brand email",
  website: "From brand website",
  owner: "Owner upload",
};

export function brandInitial(brand: string) {
  const letter = brand.trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(letter) ? letter : "?";
}

export function isImageReference(filename: string, mimeType: string) {
  if (mimeType.toLowerCase().startsWith("image/")) return true;
  return IMAGE_EXT.test(filename);
}

export function isSkippableImage(text: string) {
  return PIXEL.test(text);
}

export function productTokens(name: string | null | undefined) {
  if (!name) return [];
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 3 && !STOP.has(part));
}

/** True when the text names the product, false when it does not, null when there is no product name to match. */
export function mentionsProduct(text: string, productName: string | null | undefined) {
  const tokens = productTokens(productName);
  if (tokens.length === 0) return null;
  const hay = text.toLowerCase();
  return tokens.some((token) => hay.includes(token));
}

export function candidateText(candidate: PromoCandidate) {
  return [candidate.filename, candidate.alt, candidate.url, candidate.pageUrl].filter(Boolean).join(" ");
}

export function imageNeedsCheck(candidate: PromoCandidate, productName: string | null | undefined) {
  const text = candidateText(candidate);
  if (LOGO.test(text)) return true;
  if (candidate.source === "owner") return false;
  return mentionsProduct(text, productName) === false;
}

function scoreCandidate(candidate: PromoCandidate, productName: string | null | undefined) {
  const text = candidateText(candidate);
  let score = 0;
  if (LOGO.test(text)) score += 5;
  const named = mentionsProduct(text, productName);
  if (named === true) score -= 3;
  if (named === false) score += 2;
  return score;
}

function pickWithin(candidates: PromoCandidate[], productName: string | null | undefined) {
  const usable = candidates.filter((candidate) => candidate.url && !isSkippableImage(candidateText(candidate)));
  if (usable.length === 0) return null;
  return [...usable].sort((left, right) => scoreCandidate(left, productName) - scoreCandidate(right, productName))[0] ?? null;
}

/**
 * Email photo, then the product page image, then an owner upload or link.
 * A weak match is still shown and marked for Kamron to check.
 */
export function choosePromoImage(input: {
  brand: string;
  productName: string | null;
  email?: PromoCandidate[];
  website?: PromoCandidate[];
  owner?: PromoCandidate[];
}): PromoChoice | null {
  const productName = input.productName?.trim() || null;
  const chosen = pickWithin(input.email ?? [], productName)
    ?? pickWithin(input.website ?? [], productName)
    ?? pickWithin(input.owner ?? [], productName);
  if (!chosen) return null;
  const altName = productName || `${input.brand.trim() || "Brand"} product`;
  return {
    url: chosen.url,
    source: chosen.source,
    sourceLabel: SOURCE_LABEL[chosen.source],
    pageUrl: chosen.source === "website" ? (chosen.pageUrl ?? null) : null,
    needsCheck: imageNeedsCheck(chosen, productName),
    alt: altName,
  };
}

export function publicImagePageUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (host === "0.0.0.0" || host === "::1" || host === "metadata.google.internal") return null;
  if (isPrivateHost(host)) return null;
  return url.toString();
}

function isPrivateHost(host: string) {
  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function absoluteUrl(value: string, pageUrl: string) {
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, key: "property" | "name", name: string) {
  const pattern = new RegExp(`<meta\\b[^>]*>`, "gi");
  for (const tag of html.match(pattern) ?? []) {
    const attr = tag.match(new RegExp(`${key}\\s*=\\s*["']${name}["']`, "i"));
    if (!attr) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (content?.[1]) return content[1];
  }
  return null;
}

/** og:image, twitter:image, or the main product image on a brand page. */
export function extractOpenGraphImage(html: string, pageUrl: string) {
  const found = metaContent(html, "property", "og:image:secure_url")
    ?? metaContent(html, "property", "og:image")
    ?? metaContent(html, "name", "twitter:image")
    ?? metaContent(html, "name", "twitter:image:src");
  if (found) {
    const abs = absoluteUrl(found, pageUrl);
    if (abs && !isSkippableImage(abs)) return abs;
  }
  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of images) {
    const interesting = /itemprop\s*=\s*["']image["']/i.test(tag) || /class\s*=\s*["'][^"']*product[^"']*["']/i.test(tag);
    if (!interesting) continue;
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!src?.[1]) continue;
    const abs = absoluteUrl(src[1], pageUrl);
    if (abs && !isSkippableImage(abs)) return abs;
  }
  return null;
}

export function imageUrlsInText(text: string) {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const cleaned = value.replace(/[),.;]+$/, "");
    if (!cleaned || seen.has(cleaned) || isSkippableImage(cleaned)) return;
    if (!IMAGE_EXT.test(cleaned) && !/<img/i.test(text)) return;
    if (!/^https?:\/\//i.test(cleaned)) return;
    seen.add(cleaned);
    found.push(cleaned);
  };
  for (const match of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(match[1] ?? "");
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const url = match[0] ?? "";
    if (IMAGE_EXT.test(url)) add(url);
  }
  return found;
}
