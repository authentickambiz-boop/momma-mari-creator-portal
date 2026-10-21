import type { PortalDb } from "@/db";
import { parseDisplayedCount } from "./analytics-snapshots";
import { publicMeetCreators, type PublicMeetCreator } from "./public-creators";

export type RosterFeedCreator = {
  id: string;
  name: string;
  displayName: string;
  totalAudience: string | null;
  totalFollowers: number | null;
  platforms: { platform: string; followers: string | null; followersCount: number | null }[];
};

export type RosterFeed = {
  source: "portal";
  creators: RosterFeedCreator[];
  combinedFollowers: number;
  combinedLabel: string;
};

const DISPLAY_NAMES: Record<string, string> = {
  mariclare: "MariClare",
  authentickam: "AuthenticKam",
  abby: "Abby",
};

export function combinedFollowersLabel(total: number) {
  if (total <= 0) return "0";
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(2)}M`;
  return total.toLocaleString("en-US");
}

function toFeedCreator(creator: PublicMeetCreator): RosterFeedCreator {
  return {
    id: creator.id,
    name: creator.name,
    displayName: DISPLAY_NAMES[creator.id] ?? creator.name,
    totalAudience: creator.totalAudience ?? null,
    totalFollowers: parseDisplayedCount(creator.totalAudience),
    platforms: creator.platforms.map((platform) => ({
      platform: platform.platform,
      followers: platform.followers ?? null,
      followersCount: parseDisplayedCount(platform.followers),
    })),
  };
}

/** Public roster for the main site. Follower totals come from the portal snapshots. Pay, email, and ages stay off. */
export async function publicRosterFeed(db: PortalDb): Promise<RosterFeed> {
  const cards = await publicMeetCreators(db);
  const creators = cards.map(toFeedCreator);
  const combinedFollowers = creators.reduce((sum, creator) => sum + (creator.totalFollowers ?? 0), 0);
  return {
    source: "portal",
    creators,
    combinedFollowers,
    combinedLabel: combinedFollowersLabel(combinedFollowers),
  };
}
