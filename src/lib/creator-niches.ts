import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorOnboarding, creatorProfiles, creators } from "@/db/schema";
import { parseStoredPlatforms } from "./member-profile";
import {
  isStreamer,
  MAX_NICHES,
  meetsViewerBar,
  NICHE_ERRORS,
  NICHE_OTHER_MAX,
  nicheIdFromInput,
  nicheLabel,
  nichesFromStored,
  type CreatorNicheId,
} from "./creator-niche-shared";

export {
  CREATOR_NICHES,
  CREATOR_NICHE_IDS,
  MAX_NICHES,
  NICHE_OTHER_MAX,
  VIEWER_BAR,
  NICHE_ERRORS,
  STREAM_PROOF_TYPES,
  nicheIdFromInput,
  nicheLabel,
  nichesFromStored,
  isStreamer,
  parseWholeCount,
  parseAvgViewers,
  parseHoursPerWeek,
  meetsViewerBar,
  cleanAnalyticsProof,
  rosterMatchesNiche,
} from "./creator-niche-shared";
export type { CreatorNicheId } from "./creator-niche-shared";

function isBlockedNiche(value: string) {
  return /\bnsfw\b/i.test(value) || /\badult\b/i.test(value);
}

export function validateCreatorNiches(
  values: string[],
  nicheOther = "",
  options?: { required?: boolean },
): { ok: true; niches: CreatorNicheId[]; nicheOther: string } | { ok: false; error: string } {
  const required = options?.required !== false;
  const ids: CreatorNicheId[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (isBlockedNiche(trimmed)) return { ok: false, error: NICHE_ERRORS.list };
    const id = nicheIdFromInput(trimmed);
    if (!id) return { ok: false, error: NICHE_ERRORS.list };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_NICHES) return { ok: false, error: NICHE_ERRORS.max };
  if (required && ids.length === 0) return { ok: false, error: NICHE_ERRORS.empty };
  let other = "";
  if (ids.includes("other")) {
    other = nicheOther.trim();
    if (other.length > NICHE_OTHER_MAX) return { ok: false, error: NICHE_ERRORS.other };
  }
  return { ok: true, niches: ids, nicheOther: other };
}

export type AdminRosterRow = {
  creatorId: string;
  name: string;
  nicheIds: CreatorNicheId[];
  niches: string[];
  streamer: boolean;
  meetsBar: boolean;
};

export async function listAdminRoster(db: PortalDb): Promise<AdminRosterRow[]> {
  const people = await db.select().from(creators);
  const profiles = await db.select().from(creatorProfiles);
  const byCreator = new Map(profiles.map((row) => [row.creatorId, row]));
  return people
    .map((person) => {
      const profile = byCreator.get(person.id);
      const nicheIds = nichesFromStored(profile?.niches ?? null, null);
      const platforms = parseStoredPlatforms(profile?.platformsJson).map((item) => item.platform);
      const streamer = isStreamer(nicheIds, platforms);
      const viewers = profile?.avgViewers ?? null;
      return {
        creatorId: person.id,
        name: person.name,
        nicheIds,
        niches: nicheIds.map((id) => nicheLabel(id)),
        streamer,
        meetsBar: Boolean(profile?.meetsBar) || meetsViewerBar(viewers),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function legacyNicheFor(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorOnboarding).where(eq(creatorOnboarding.creatorId, creatorId));
  return rows[0]?.niche ?? null;
}
