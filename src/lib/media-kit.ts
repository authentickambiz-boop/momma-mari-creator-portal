import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, mediaKits } from "@/db/schema";
import { nowIso } from "./format";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type MediaKitView = {
  slug: string;
  displayName: string;
  bio: string | null;
  followers: number | null;
  avgViews: number | null;
  engagement: string | null;
  niches: string[];
};

export function zernioStatsEnabled() {
  return process.env.ZERNIO_STATS_ENABLED === "true";
}

function slugFor(name: string, creatorId: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || creatorId;
  return base.slice(0, 40);
}

function nichesOf(value: string | null) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function toView(row: typeof mediaKits.$inferSelect): MediaKitView | null {
  if (!row.published || !row.displayName) return null;
  return {
    slug: row.slug,
    displayName: row.displayName,
    bio: row.bio,
    followers: row.followers,
    avgViews: row.avgViews,
    engagement: row.engagement,
    niches: nichesOf(row.niches),
  };
}

export async function myMediaKit(db: PortalDb, actor: { role: string; creatorId?: string | null }) {
  if (actor.role !== "creator" || !actor.creatorId) return null;
  const rows = await db.select().from(mediaKits).where(eq(mediaKits.creatorId, actor.creatorId));
  return rows[0] ?? null;
}

export async function publicMediaKit(db: PortalDb, slug: string) {
  const rows = await db.select().from(mediaKits).where(eq(mediaKits.slug, slug));
  const row = rows[0];
  if (!row) return null;
  return toView(row);
}

export async function saveMediaKit(
  db: PortalDb,
  actor: { role: string; creatorId?: string | null },
  input: {
    creatorId: string;
    published: boolean;
    displayName: string;
    bio: string;
    followers: string;
    avgViews: string;
    engagement: string;
    niches: string;
  },
): Promise<Result<{ slug: string }>> {
  if (actor.role !== "creator" || actor.creatorId !== input.creatorId) {
    return { ok: false, status: 403, error: "You can only edit your own media kit." };
  }
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  const creator = people[0];
  if (!creator) return { ok: false, status: 403, error: "That creator is not on the roster." };
  const displayName = input.displayName.trim();
  if (input.published && !displayName) return { ok: false, status: 400, error: "Add a display name before sharing the kit." };
  if (input.bio.length > 280) return { ok: false, status: 400, error: "Bio can be 280 characters." };
  const followers = input.followers.trim() === "" ? null : Number(input.followers);
  const avgViews = input.avgViews.trim() === "" ? null : Number(input.avgViews);
  if ((followers != null && (!Number.isInteger(followers) || followers < 0)) || (avgViews != null && (!Number.isInteger(avgViews) || avgViews < 0))) {
    return { ok: false, status: 400, error: "Followers and average views are whole numbers." };
  }
  const existing = await db.select().from(mediaKits).where(eq(mediaKits.creatorId, creator.id));
  const slug = existing[0]?.slug ?? slugFor(displayName || creator.name, creator.id);
  const values = {
    creatorId: creator.id,
    slug,
    published: input.published,
    displayName: displayName || null,
    bio: input.bio.trim() || null,
    followers,
    avgViews,
    engagement: input.engagement.trim().slice(0, 20) || null,
    niches: nichesOf(input.niches).join(", ") || null,
    updatedAt: nowIso(),
  };
  if (existing[0]) await db.update(mediaKits).set(values).where(eq(mediaKits.creatorId, creator.id));
  else await db.insert(mediaKits).values(values);
  return { ok: true, slug };
}
