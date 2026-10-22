/** Fixed niche list shared by the profile, the questionnaire, and admin filters. */
export const CREATOR_NICHES = [
  { id: "lifestyle", label: "Lifestyle" },
  { id: "gaming", label: "Gaming" },
  { id: "streaming", label: "Streaming" },
  { id: "stay_at_home", label: "Stay-at-Home" },
  { id: "parenting", label: "Parenting" },
  { id: "diy", label: "DIY" },
  { id: "makeup_beauty", label: "Makeup / Beauty" },
  { id: "music", label: "Music" },
  { id: "sports_fitness", label: "Sports / Fitness" },
  { id: "modeling", label: "Modeling" },
  { id: "other", label: "Other" },
] as const;

export type CreatorNicheId = (typeof CREATOR_NICHES)[number]["id"];

export const CREATOR_NICHE_IDS = CREATOR_NICHES.map((niche) => niche.id);

export const MAX_NICHES = 5;
export const NICHE_OTHER_MAX = 40;

/** Internal signing note for streamers. Not shown on creator screens. */
export const VIEWER_BAR = 50;

export const NICHE_ERRORS = {
  empty: "Pick at least one niche.",
  max: "Pick up to 5.",
  list: "Pick a niche from the list.",
  other: "Other can be 40 characters.",
} as const;

export const STREAM_PROOF_TYPES = [
  { id: "kick", label: "Kick", proof: "VOD link or screenshot" },
  { id: "twitch", label: "Twitch", proof: "VOD link or screenshot" },
  { id: "youtube_live", label: "YouTube Live", proof: "VOD link or screenshot" },
] as const;

const LABEL_KEYS = new Map<string, CreatorNicheId>();
for (const niche of CREATOR_NICHES) {
  LABEL_KEYS.set(niche.id, niche.id);
  LABEL_KEYS.set(niche.label.toLowerCase(), niche.id);
}

const STREAM_NICHE_IDS = new Set<CreatorNicheId>(["gaming", "streaming"]);
const STREAM_PLATFORM_KEYS = new Set(["kick", "twitch", "youtube live", "youtube_live"]);

function collapsed(value: string) {
  return value.trim().toLowerCase().replace(/\s*\/\s*/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Maps a stored id or label onto the fixed list. Unknown text stays unmapped. */
export function nicheIdFromInput(value: string): CreatorNicheId | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = LABEL_KEYS.get(trimmed.toLowerCase());
  if (direct) return direct;
  const loose = collapsed(trimmed);
  for (const niche of CREATOR_NICHES) {
    if (collapsed(niche.id) === loose || collapsed(niche.label) === loose) return niche.id;
  }
  return null;
}

export function nicheLabel(value: string) {
  const id = nicheIdFromInput(value);
  if (!id) return value.trim();
  return CREATOR_NICHES.find((niche) => niche.id === id)?.label ?? value.trim();
}

/** Reads a JSON array, a comma list, or one legacy vertical. Does not write. */
export function nichesFromStored(raw: string | null | undefined, legacy?: string | null) {
  const parts: string[] = [];
  const pushRaw = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed) if (typeof item === "string") parts.push(item);
          return;
        }
      } catch {
        parts.push(trimmed);
        return;
      }
    }
    parts.push(...trimmed.split(","));
  };
  pushRaw(raw);
  pushRaw(legacy);
  const ids: CreatorNicheId[] = [];
  for (const part of parts) {
    const id = nicheIdFromInput(part);
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_NICHES) break;
  }
  return ids;
}

export function isStreamer(niches: string[], platforms: string[]) {
  if (niches.some((niche) => {
    const id = nicheIdFromInput(niche);
    return id ? STREAM_NICHE_IDS.has(id) : false;
  })) return true;
  return platforms.some((platform) => STREAM_PLATFORM_KEYS.has(platform.trim().toLowerCase()));
}

export function parseWholeCount(
  value: string,
  label: string,
  required: boolean,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) {
    if (required) return { ok: false, error: `${label} has to be a whole number.` };
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: `${label} has to be a whole number.` };
  const count = Number(trimmed);
  if (!Number.isSafeInteger(count)) return { ok: false, error: `${label} has to be a whole number.` };
  return { ok: true, value: count };
}

export function parseAvgViewers(value: string, required: boolean) {
  return parseWholeCount(value, "Average viewers", required);
}

export function parseHoursPerWeek(value: string) {
  return parseWholeCount(value, "Hours per week", false);
}

export function meetsViewerBar(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= VIEWER_BAR;
}

export function cleanAnalyticsProof(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  if (/^upload:[^\s]{1,80}$/.test(trimmed)) return { ok: true as const, value: trimmed };
  if (/^https?:\/\//i.test(trimmed) && trimmed.length <= 300) return { ok: true as const, value: trimmed };
  return { ok: false as const, error: "Analytics proof uses an http or https link." };
}

export function rosterMatchesNiche(row: { nicheIds: string[] }, nicheId: string) {
  const id = nicheIdFromInput(nicheId);
  if (!id) return false;
  return row.nicheIds.includes(id);
}
