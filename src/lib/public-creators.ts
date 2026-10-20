import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { analyticsSnapshots, creatorShowcases, creators } from "@/db/schema";
import { capturedLabel, parseDisplayedCount, type SnapshotAudience, type SnapshotMetrics } from "./analytics-snapshots";
import { nowIso, parseJson } from "./format";
import type { Viewer } from "./types";

export const MEET_HREF = "/meet";
export const MEET_LABEL = "Meet Our Creators";

const PHOTO_PATH = /^\/creators\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/;

export type PublicAverageViews = { label: string; value: string };

export type PublicPlatformCard = {
  platform: string;
  handle?: string;
  followers?: string;
  followersLabel: "Followers" | "Subscribers";
  engagement?: string;
  averageViews?: string;
  averageViewParts?: PublicAverageViews[];
  audience?: { label: string; value: string }[];
  period?: string;
  capturedOn: string;
  source?: string;
};

export type PublicMeetCreator = {
  id: string;
  name: string;
  initials: string;
  bio?: string;
  photo?: string;
  location?: string;
  totalAudience?: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
  platforms: PublicPlatformCard[];
};

type ShowcaseRow = typeof creatorShowcases.$inferSelect;
type CreatorRow = typeof creators.$inferSelect;
type SnapshotRow = typeof analyticsSnapshots.$inferSelect;

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

function isMetrics(value: unknown): value is SnapshotMetrics {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textMetric(metrics: SnapshotMetrics, key: string) {
  const value = metrics[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function placeLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text.includes(",")) return null;
  return text;
}

function audienceHighlights(audience: SnapshotAudience | null) {
  if (!audience) return [];
  const highlights: { label: string; value: string }[] = [];
  const gender = audience.gender?.find((line) => line.trim());
  const age = audience.age?.find((line) => line.trim());
  const location = (audience.location ?? audience.country)?.find((line) => line.trim());
  if (gender) highlights.push({ label: "Gender", value: gender });
  if (age) highlights.push({ label: "Age", value: age });
  if (location) highlights.push({ label: "Location", value: location });
  return highlights;
}

function averageViews(metrics: SnapshotMetrics): { averageViews?: string; averageViewParts?: PublicAverageViews[] } {
  const top = textMetric(metrics, "avgViews");
  if (top) return { averageViews: top };
  const parts: PublicAverageViews[] = [];
  const groups: [string, string][] = [["longForm", "Long-form"], ["shorts", "Shorts"]];
  for (const [key, label] of groups) {
    const nested = metrics[key];
    if (!isMetrics(nested)) continue;
    const value = textMetric(nested, "avgViews");
    if (value) parts.push({ label, value });
  }
  return parts.length ? { averageViewParts: parts } : {};
}

/** A local creator portrait. Remote URLs and any other path stay off the page. */
export function publicPhotoPath(value: string | null | undefined) {
  const path = value?.trim() ?? "";
  if (!PHOTO_PATH.test(path)) return null;
  return path;
}

function cleanBio(value: string) {
  const bio = value.trim();
  if (bio.length > 280) return { ok: false as const, error: "Bio can be 280 characters." };
  if (/[@$]|\brates?\b|\bminimums?\b/i.test(bio)) {
    return { ok: false as const, error: "Leave pay and email addresses off the public bio." };
  }
  return { ok: true as const, bio: bio || null };
}

function platformCard(row: SnapshotRow): PublicPlatformCard {
  const metrics = parseJson<SnapshotMetrics>(row.metricsJson, {});
  const audience = row.audienceJson ? parseJson<SnapshotAudience>(row.audienceJson, {}) : null;
  const followers = textMetric(metrics, "followers");
  const subscribers = textMetric(metrics, "subscribers");
  const engagement = textMetric(metrics, "engagement");
  const handle = row.handle?.trim() || null;
  const period = row.period?.trim() || null;
  const source = row.source?.trim() || null;
  const highlights = audienceHighlights(audience);
  const views = averageViews(metrics);
  const card: PublicPlatformCard = {
    platform: row.platform,
    followersLabel: subscribers && !followers ? "Subscribers" : "Followers",
    capturedOn: row.capturedOn,
  };
  if (handle) card.handle = handle;
  if (followers) card.followers = followers;
  else if (subscribers) card.followers = subscribers;
  if (engagement) card.engagement = engagement;
  if (views.averageViews) card.averageViews = views.averageViews;
  if (views.averageViewParts) card.averageViewParts = views.averageViewParts;
  if (highlights.length) card.audience = highlights;
  if (period) card.period = period;
  if (source) card.source = source;
  return card;
}

function followerSortKey(card: PublicPlatformCard) {
  return parseDisplayedCount(card.followers) ?? -1;
}

function latestSnapshots(rows: SnapshotRow[]) {
  const platforms = [...new Set(rows.map((row) => row.platform))];
  return platforms.flatMap((platform) => {
    const history = rows
      .filter((row) => row.platform === platform)
      .sort((left, right) => left.capturedOn.localeCompare(right.capturedOn) || left.id.localeCompare(right.id));
    const latest = history.at(-1);
    return latest ? [latest] : [];
  });
}

function toPublicCard(creator: CreatorRow, showcase: ShowcaseRow, snapshots: SnapshotRow[]): PublicMeetCreator | null {
  if (!showcase.publicOn) return null;
  if (creator.email.toLowerCase().endsWith(".invalid")) return null;
  const latest = latestSnapshots(snapshots);
  const platforms = latest.map(platformCard).sort((left, right) => {
    const delta = followerSortKey(right) - followerSortKey(left);
    return delta || left.platform.localeCompare(right.platform);
  });
  const newest = [...latest].sort((left, right) => right.capturedOn.localeCompare(left.capturedOn))[0];
  const location = placeLabel(newest?.location) ?? latest.map((row) => placeLabel(row.location)).find(Boolean) ?? null;
  const totalAudience = newest?.totalAudience?.trim() || latest.map((row) => row.totalAudience?.trim()).find(Boolean) || null;
  const lastUpdated = newest?.capturedOn ?? showcase.updatedAt.slice(0, 10);
  const card: PublicMeetCreator = {
    id: creator.id,
    name: creator.name,
    initials: creator.initials,
    lastUpdated,
    lastUpdatedLabel: capturedLabel(lastUpdated),
    platforms,
  };
  const bio = showcase.bio?.trim();
  const photo = publicPhotoPath(showcase.photoPath);
  if (bio) card.bio = bio;
  if (photo) card.photo = photo;
  if (location) card.location = location;
  if (totalAudience) card.totalAudience = totalAudience;
  return card;
}

export async function publicMeetCreators(db: PortalDb): Promise<PublicMeetCreator[]> {
  const [people, showcases, snapshots] = await Promise.all([
    db.select().from(creators),
    db.select().from(creatorShowcases),
    db.select().from(analyticsSnapshots),
  ]);
  const peopleById = new Map(people.map((creator) => [creator.id, creator]));
  return showcases.flatMap((showcase) => {
    const creator = peopleById.get(showcase.creatorId);
    if (!creator) return [];
    const card = toPublicCard(creator, showcase, snapshots.filter((row) => row.creatorId === creator.id));
    return card ? [card] : [];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export async function publicMeetCreator(db: PortalDb, id: string) {
  const cards = await publicMeetCreators(db);
  return cards.find((creator) => creator.id === id) ?? null;
}

export function workWithHref(creatorId: string) {
  return `/inquire?with=${encodeURIComponent(creatorId)}`;
}

export function workWithLabel(name: string) {
  return `Work with ${name}`;
}

export async function ownerShowcase(db: PortalDb, viewer: Viewer, creatorId: string) {
  if (viewer.role !== "admin") return null;
  const rows = await db.select().from(creatorShowcases).where(eq(creatorShowcases.creatorId, creatorId));
  return rows[0] ?? null;
}

export async function saveOwnerShowcase(
  db: PortalDb,
  viewer: Viewer,
  input: { creatorId: string; publicOn: boolean; bio: string; photoPath: string; creatorOnlyPhoto: boolean },
): Promise<Result<{ saved: true }>> {
  if (viewer.role !== "admin") return { ok: false, status: 403, error: "Only an owner can choose who is on the public page." };
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "That creator is not on the roster." };
  const bio = cleanBio(input.bio);
  if (!bio.ok) return { ok: false, status: 400, error: bio.error };
  const photo = input.photoPath.trim();
  if (photo && !publicPhotoPath(photo)) return { ok: false, status: 400, error: "Use a photo file saved for this page." };
  if (photo && !input.creatorOnlyPhoto) {
    return { ok: false, status: 400, error: "Confirm the photo shows the creator only, with no child's face." };
  }
  const timestamp = nowIso();
  const values = {
    creatorId: input.creatorId,
    publicOn: input.publicOn,
    bio: bio.bio,
    photoPath: photo || null,
    updatedAt: timestamp,
  };
  const existing = await db.select().from(creatorShowcases).where(eq(creatorShowcases.creatorId, input.creatorId));
  if (existing[0]) await db.update(creatorShowcases).set(values).where(eq(creatorShowcases.creatorId, input.creatorId));
  else await db.insert(creatorShowcases).values(values);
  return { ok: true, saved: true };
}
