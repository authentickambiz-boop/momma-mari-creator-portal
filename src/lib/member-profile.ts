import { stripJpegMetadata } from "./community";
import { PROFILE_ERROR_TEXT } from "./profile-notes";
import { MEMBER_PLATFORMS } from "./profile-shared";
import { isSafetyKind, type SafetyKind } from "./safety-shared";

export const AVATAR_MAX_BYTES = 150 * 1024;
export const COVER_MAX_BYTES = 220 * 1024;
export const PIN_MAX_BYTES = 40 * 1024;

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?1[\s.-]*)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]*[2-9]\d{2}[\s.-]*\d{4}\b/g;
const MINIMUM = /\b(?:rate[\s-]*)?minimums?\b(?:\s*(?:of|is|:)?\s*\$?\s*\d[\d,]*(?:\.\d{1,2})?)?|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:dollars?\s*)?minimums?\b/gi;
const MONEY = /\$\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:dollars|usd)\b/gi;

export type StoredPlatform = { platform: string; handle: string };
export type StoredPin = { url: string; title: string; thumb: string | null; thumbFilename: string };

export type PinDraft = {
  url: string;
  title: string;
  thumb?: Uint8Array | null;
  thumbFilename?: string;
  keptThumb?: string | null;
  keptThumbFilename?: string;
};

/** Drops emails, phone numbers, dollar amounts, and minimums from member-facing text. */
export function scrubMemberText(value: string) {
  return value
    .replace(EMAIL, "")
    .replace(PHONE, "")
    .replace(MONEY, "")
    .replace(MINIMUM, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

export function cleanFilename(value: string | null | undefined) {
  if (!value) return "";
  const base = value.split(/[/\\]/).pop() ?? "";
  return base.replace(/[^\w.\- ]+/g, "").slice(0, 80);
}

export function prepareMemberJpeg(bytes: Uint8Array, maxBytes: number): { ok: true; base64: string } | { ok: false } {
  if (bytes.length < 4 || bytes.length > maxBytes) return { ok: false };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false };
  const stripped = stripJpegMetadata(bytes);
  if (stripped.length < 4 || stripped.length > maxBytes) return { ok: false };
  if (stripped[0] !== 0xff || stripped[1] !== 0xd8) return { ok: false };
  let binary = "";
  for (const byte of stripped) binary += String.fromCharCode(byte);
  return { ok: true, base64: btoa(binary) };
}

export function memberImageSrc(value: string | null | undefined) {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  if (compact.length < 8 || compact.length > 300_000) return null;
  return `data:image/jpeg;base64,${compact}`;
}

export function cleanHandle(value: string) {
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed || trimmed.length > 30) return "";
  if (/[@\s$]/.test(trimmed) || /minimum/i.test(trimmed)) return "";
  if (!/^[\p{L}\p{N}._]+$/u.test(trimmed)) return "";
  return trimmed;
}

export function cleanMemberPlatforms(rows: { platform: string; handle: string }[]): StoredPlatform[] {
  const seen = new Set<string>();
  const out: StoredPlatform[] = [];
  for (const row of rows) {
    if (!(MEMBER_PLATFORMS as readonly string[]).includes(row.platform)) continue;
    if (seen.has(row.platform)) continue;
    const handle = cleanHandle(scrubMemberText(row.handle));
    if (!handle) continue;
    seen.add(row.platform);
    out.push({ platform: row.platform, handle });
  }
  return out;
}

export function parseStoredPlatforms(value: string | null | undefined): StoredPlatform[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return cleanMemberPlatforms(parsed.map((item) => {
      if (!item || typeof item !== "object") return { platform: "", handle: "" };
      const row = item as { platform?: unknown; handle?: unknown };
      return {
        platform: typeof row.platform === "string" ? row.platform : "",
        handle: typeof row.handle === "string" ? row.handle : "",
      };
    }));
  } catch {
    return [];
  }
}

function cleanPinUrl(value: string): { ok: true; url: string } | { ok: false } | { empty: true } {
  const trimmed = value.trim();
  if (!trimmed) return { empty: true };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false };
  if (parsed.username || parsed.password) return { ok: false };
  const url = parsed.toString().slice(0, 300);
  if (scrubMemberText(url) !== url) return { ok: false };
  return { ok: true, url };
}

export function cleanMemberPins(drafts: PinDraft[]): { ok: true; pins: StoredPin[] } | { ok: false; error: string } {
  const pins: StoredPin[] = [];
  for (const draft of drafts.slice(0, 3)) {
    const url = cleanPinUrl(draft.url);
    if ("empty" in url) continue;
    if (!url.ok) return { ok: false, error: PROFILE_ERROR_TEXT.link };
    const title = scrubMemberText(draft.title).slice(0, 80);
    if (!title) return { ok: false, error: PROFILE_ERROR_TEXT.pinTitle };
    let thumb: string | null = null;
    let thumbFilename = "";
    if (draft.thumb && draft.thumb.byteLength) {
      const prepared = prepareMemberJpeg(draft.thumb, PIN_MAX_BYTES);
      if (!prepared.ok) return { ok: false, error: PROFILE_ERROR_TEXT.pin };
      thumb = prepared.base64;
      thumbFilename = cleanFilename(draft.thumbFilename);
    } else if (draft.thumb === null) {
      thumb = null;
    } else if (draft.keptThumb && memberImageSrc(draft.keptThumb)) {
      thumb = draft.keptThumb.replace(/\s/g, "");
      thumbFilename = cleanFilename(draft.keptThumbFilename);
    }
    pins.push({ url: url.url, title, thumb, thumbFilename });
  }
  return { ok: true, pins };
}

export function parseStoredPins(value: string | null | undefined): StoredPin[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const pins: StoredPin[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as { url?: unknown; title?: unknown; thumb?: unknown; thumbFilename?: unknown };
      if (typeof row.url !== "string" || typeof row.title !== "string") continue;
      const url = cleanPinUrl(row.url);
      if (!("ok" in url) || !url.ok) continue;
      const title = scrubMemberText(row.title).slice(0, 80);
      if (!title) continue;
      const thumb = typeof row.thumb === "string" && memberImageSrc(row.thumb) ? row.thumb.replace(/\s/g, "") : null;
      pins.push({
        url: url.url,
        title,
        thumb,
        thumbFilename: cleanFilename(typeof row.thumbFilename === "string" ? row.thumbFilename : ""),
      });
      if (pins.length >= 3) break;
    }
    return pins;
  } catch {
    return [];
  }
}

export function storedSafetyKinds(value: string | null | undefined): SafetyKind[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SafetyKind => typeof item === "string" && isSafetyKind(item));
  } catch {
    return [];
  }
}

export function pinHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}
