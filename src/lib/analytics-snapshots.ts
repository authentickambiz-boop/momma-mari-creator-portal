import { eq, inArray } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { analyticsSnapshots, creators } from "@/db/schema";
import type { RankInputs } from "./creator-rank";
import { normalizeEmail, nowIso, parseJson } from "./format";
import { assignedCreatorIds } from "./managers";
import { PLATFORM_OPTIONS } from "./niche-catalog";
import type { Viewer } from "./types";

export interface SnapshotMetrics {
  [key: string]: string | null | SnapshotMetrics;
}
export type SnapshotAudience = Record<string, string[]>;

export type SnapshotDraft = {
  creatorId?: string;
  creatorEmail?: string;
  platform: string;
  capturedOn: string;
  source?: string;
  period?: string | null;
  handle?: string | null;
  benchmark?: string | null;
  updated?: string | null;
  channelName?: string | null;
  totalAudience?: string | null;
  largestPlatform?: string | null;
  location?: string | null;
  metrics?: SnapshotMetrics;
  audience?: SnapshotAudience | null;
  clips?: string[] | null;
  revenueCents?: number | null;
  merge?: boolean;
};

type StoredSnapshot = {
  id: string;
  creatorId: string;
  platform: string;
  capturedOn: string;
  source: string;
  period: string | null;
  handle: string | null;
  benchmark: string | null;
  updatedLabel: string | null;
  channelName: string | null;
  totalAudience: string | null;
  largestPlatform: string | null;
  location: string | null;
  metrics: SnapshotMetrics;
  audience: SnapshotAudience | null;
  clips: string[] | null;
  revenueCents: number | null;
};

export type SnapshotChange = {
  previousOn: string;
  followers: string | null;
  engagement: string | null;
};

export type PlatformSnapshot = {
  platform: string;
  capturedOn: string;
  source: string;
  period: string | null;
  handle: string | null;
  benchmark: string | null;
  updatedLabel: string | null;
  channelName: string | null;
  metrics: SnapshotMetrics;
  audience: SnapshotAudience | null;
  clips: string[] | null;
  change: SnapshotChange | null;
  revenueCents?: number | null;
};

export type CreatorSnapshotCard = {
  creatorId: string;
  name: string;
  location: string | null;
  totalAudience: string | null;
  largestPlatform: string | null;
  platforms: PlatformSnapshot[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const METRIC_LABELS: Record<string, string> = {
  engagement: "Engagement",
  similarCreators: "Similar creators",
  followers: "Followers",
  subscribers: "Subscribers",
  views: "Views",
  totalViews: "Total views",
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  totalInteractions: "Total interactions",
  avgStoryViews: "Avg story views",
  avgLikes: "Avg likes",
  avgComments: "Avg comments",
  avgViews: "Avg views",
  avgShares: "Avg shares",
  avgPostLikes: "Avg post likes",
  avgPostComments: "Avg post comments",
  pageLikes: "Page likes",
  avgReactions: "Avg reactions",
  impressions: "Impressions",
};

export function metricLabel(key: string) {
  return METRIC_LABELS[key] ?? key;
}

export function parseDisplayedNumber(value: string | null | undefined) {
  if (value == null) return null;
  const cleaned = value.trim().replace(/,/g, "").replace(/%$/, "");
  if (!cleaned || cleaned === "…") return null;
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return amount * 1000;
  if (suffix === "m") return amount * 1_000_000;
  return amount;
}

export function parseDisplayedCount(value: string | null | undefined) {
  const amount = parseDisplayedNumber(value);
  return amount == null ? null : Math.round(amount);
}

function isMetrics(value: unknown): value is SnapshotMetrics {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanMetrics(value: unknown): SnapshotMetrics {
  if (!isMetrics(value)) return {};
  const metrics: SnapshotMetrics = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) {
      if (key === "saves") metrics.saves = null;
      continue;
    }
    if (typeof entry === "string") {
      if (key === "saves" && entry.trim() === "-1") {
        metrics.saves = null;
        continue;
      }
      metrics[key] = entry;
      continue;
    }
    if (isMetrics(entry)) {
      const nested = cleanMetrics(entry);
      if (Object.keys(nested).length) metrics[key] = nested;
    }
  }
  return metrics;
}

function displayed(metrics: SnapshotMetrics, key: string) {
  const value = metrics[key];
  return typeof value === "string" ? value : null;
}

function collectAverageViews(metrics: SnapshotMetrics) {
  const found: number[] = [];
  const top = parseDisplayedCount(displayed(metrics, "avgViews"));
  if (top != null) found.push(top);
  for (const group of ["longForm", "shorts"] as const) {
    const nested = metrics[group];
    if (!isMetrics(nested)) continue;
    const views = parseDisplayedCount(displayed(nested, "avgViews"));
    if (views != null) found.push(views);
  }
  return found;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function followerCount(metrics: SnapshotMetrics) {
  return parseDisplayedCount(displayed(metrics, "followers") ?? displayed(metrics, "subscribers"));
}

function periodKeyOf(period: string | null | undefined) {
  return period?.trim() ?? "";
}

function snapshotId(creatorId: string, platform: string, capturedOn: string, periodKey: string) {
  const platformSlug = platform.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const periodSlug = periodKey ? `-${periodKey.toLowerCase().replace(/[^a-z0-9]+/g, "")}` : "";
  return `snap-${creatorId}-${platformSlug}-${capturedOn}${periodSlug}`;
}

function knownPlatform(platform: string) {
  return PLATFORM_OPTIONS.find((option) => option.toLowerCase() === platform.trim().toLowerCase()) ?? null;
}

async function creatorFor(db: PortalDb, draft: SnapshotDraft) {
  if (draft.creatorId) {
    const rows = await db.select().from(creators).where(eq(creators.id, draft.creatorId));
    return rows[0] ?? null;
  }
  if (draft.creatorEmail) {
    const email = normalizeEmail(draft.creatorEmail);
    const rows = await db.select().from(creators);
    return rows.find((row) => row.email.toLowerCase() === email) ?? null;
  }
  return null;
}

export async function saveSnapshot(db: PortalDb, draft: SnapshotDraft, source: string) {
  const platform = knownPlatform(draft.platform ?? "");
  if (!platform) return { ok: false as const, status: 400, error: "Pick a platform from the list." };
  if (!DATE.test(draft.capturedOn ?? "")) return { ok: false as const, status: 400, error: "Enter the capture date as YYYY-MM-DD." };
  const person = await creatorFor(db, draft);
  if (!person) return { ok: false as const, status: 404, error: "That creator is not on the roster." };
  const metrics = cleanMetrics(draft.metrics);
  const hasMetric = JSON.stringify(metrics) !== "{}";
  const revenue = draft.revenueCents == null ? null : draft.revenueCents;
  if (revenue != null && (!Number.isInteger(revenue) || revenue < 0)) {
    return { ok: false as const, status: 400, error: "Revenue has to be a dollar amount, or left blank." };
  }
  if (!hasMetric && revenue == null) return { ok: false as const, status: 400, error: "Enter at least one number July displayed. Leave the rest blank." };
  const period = draft.period?.trim() || null;
  const key = periodKeyOf(period);
  const timestamp = nowIso();
  const id = snapshotId(person.id, platform, draft.capturedOn, key);
  const existing = await db.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.id, id));
  const previous = existing[0];
  const mergedMetrics = draft.merge && previous ? { ...parseJson<SnapshotMetrics>(previous.metricsJson, {}), ...metrics } : metrics;
  const values = {
    creatorId: person.id,
    platform,
    capturedOn: draft.capturedOn,
    source: draft.source?.trim() || previous?.source || source,
    periodKey: key,
    period,
    handle: draft.handle?.trim() || (draft.merge ? previous?.handle ?? null : null),
    benchmark: draft.benchmark?.trim() || (draft.merge ? previous?.benchmark ?? null : null),
    updatedLabel: draft.updated?.trim() || (draft.merge ? previous?.updatedLabel ?? null : null),
    channelName: draft.channelName?.trim() || (draft.merge ? previous?.channelName ?? null : null),
    totalAudience: draft.totalAudience?.trim() || (draft.merge ? previous?.totalAudience ?? null : null),
    largestPlatform: draft.largestPlatform?.trim() || (draft.merge ? previous?.largestPlatform ?? null : null),
    location: draft.location?.trim() || (draft.merge ? previous?.location ?? null : null),
    metricsJson: JSON.stringify(mergedMetrics),
    audienceJson: draft.audience ? JSON.stringify(draft.audience) : draft.merge ? previous?.audienceJson ?? null : null,
    clipsJson: draft.clips?.length ? JSON.stringify(draft.clips) : draft.merge ? previous?.clipsJson ?? null : null,
    revenueCents: revenue == null && draft.merge ? previous?.revenueCents ?? null : revenue,
    updatedAt: timestamp,
  };
  if (previous) await db.update(analyticsSnapshots).set(values).where(eq(analyticsSnapshots.id, id));
  else await db.insert(analyticsSnapshots).values({ ...values, id, createdAt: timestamp });
  return { ok: true as const, id, creatorId: person.id };
}

export async function saveOwnerSnapshot(
  db: PortalDb,
  viewer: Viewer,
  draft: SnapshotDraft,
) {
  if (viewer.role !== "admin") return { ok: false as const, status: 403, error: "Only an owner can enter a snapshot." };
  return saveSnapshot(db, draft, "owner");
}

function draftsFromBody(body: unknown): SnapshotDraft[] | { error: string } {
  if (!body || typeof body !== "object") return { error: "Expected JSON." };
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.snapshots)) return record.snapshots as SnapshotDraft[];
  if (Array.isArray(record.creators)) {
    const drafts: SnapshotDraft[] = [];
    for (const creator of record.creators as Record<string, unknown>[]) {
      const snapshots = Array.isArray(creator.snapshots) ? creator.snapshots : [];
      for (const snapshot of snapshots as Record<string, unknown>[]) {
        drafts.push({
          ...(snapshot as SnapshotDraft),
          creatorId: typeof creator.creatorId === "string" ? creator.creatorId : undefined,
          capturedOn: typeof snapshot.capturedOn === "string" ? snapshot.capturedOn : String(record.capturedOn ?? ""),
          source: typeof snapshot.source === "string" ? snapshot.source : typeof record.source === "string" ? record.source : undefined,
          totalAudience: typeof creator.totalAudience === "string" ? creator.totalAudience : null,
          largestPlatform: typeof creator.largestPlatform === "string" ? creator.largestPlatform : null,
          location: typeof creator.location === "string" ? creator.location : null,
        });
      }
    }
    return drafts;
  }
  if (typeof record.platform === "string") return [record as SnapshotDraft];
  return { error: "Expected a snapshot, a snapshots list, or creators." };
}

export async function writeAnalyticsSnapshots(db: PortalDb, body: unknown) {
  const drafts = draftsFromBody(body);
  if ("error" in drafts && !Array.isArray(drafts)) return { status: 400, body: { error: drafts.error } };
  const list = drafts as SnapshotDraft[];
  if (!list.length) return { status: 400, body: { error: "Expected at least one snapshot." } };
  const ids: string[] = [];
  for (const draft of list) {
    const saved = await saveSnapshot(db, draft, "bot");
    if (!saved.ok) return { status: saved.status, body: { error: saved.error } };
    ids.push(saved.id);
  }
  return { status: 200, body: { saved: ids.length, ids } };
}

export async function importAnalyticsSnapshots(db: PortalDb, body: unknown) {
  const result = await writeAnalyticsSnapshots(db, body);
  if (result.status !== 200) return { ok: false as const, error: String((result.body as { error?: string }).error ?? "Could not import.") };
  return { ok: true as const, saved: (result.body as { saved: number }).saved };
}

function toStored(row: typeof analyticsSnapshots.$inferSelect): StoredSnapshot {
  return {
    id: row.id,
    creatorId: row.creatorId,
    platform: row.platform,
    capturedOn: row.capturedOn,
    source: row.source,
    period: row.period,
    handle: row.handle,
    benchmark: row.benchmark,
    updatedLabel: row.updatedLabel,
    channelName: row.channelName,
    totalAudience: row.totalAudience,
    largestPlatform: row.largestPlatform,
    location: row.location,
    metrics: parseJson<SnapshotMetrics>(row.metricsJson, {}),
    audience: row.audienceJson ? parseJson<SnapshotAudience>(row.audienceJson, {}) : null,
    clips: row.clipsJson ? parseJson<string[]>(row.clipsJson, []) : null,
    revenueCents: row.revenueCents,
  };
}

function changeBetween(latest: StoredSnapshot, previous: StoredSnapshot | undefined): SnapshotChange | null {
  if (!previous) return null;
  const nextFollowers = followerCount(latest.metrics);
  const prevFollowers = followerCount(previous.metrics);
  const nextEngagement = parseDisplayedNumber(displayed(latest.metrics, "engagement"));
  const prevEngagement = parseDisplayedNumber(displayed(previous.metrics, "engagement"));
  let followers: string | null = null;
  if (nextFollowers != null && prevFollowers != null) {
    const delta = nextFollowers - prevFollowers;
    const percent = prevFollowers > 0 ? roundTenth((delta / prevFollowers) * 100) : null;
    const sign = delta > 0 ? "+" : "";
    followers = percent == null ? `${sign}${delta.toLocaleString("en-US")}` : `${sign}${delta.toLocaleString("en-US")} (${sign}${percent}%)`;
  }
  let engagement: string | null = null;
  if (nextEngagement != null && prevEngagement != null) {
    const delta = roundTenth(nextEngagement - prevEngagement);
    const sign = delta > 0 ? "+" : "";
    engagement = `${sign}${delta} pts`;
  }
  return { previousOn: previous.capturedOn, followers, engagement };
}

async function idsFor(db: PortalDb, viewer: Viewer) {
  if (viewer.role === "creator") return viewer.creatorId ? [viewer.creatorId] : [];
  if (viewer.role === "manager") {
    if (viewer.assignedCreatorIds) return viewer.assignedCreatorIds;
    if (viewer.managerId) return assignedCreatorIds(db, viewer.managerId);
    return [];
  }
  const rows = await db.select({ id: creators.id }).from(creators);
  return rows.map((row) => row.id);
}

export function canSeeSnapshotRevenue(viewer: Viewer) {
  return viewer.role === "admin" || (viewer.role === "manager" && Boolean(viewer.permissions?.canPriceDeals));
}

export async function analyticsBoard(db: PortalDb, viewer: Viewer) {
  const ids = await idsFor(db, viewer);
  const showRevenue = canSeeSnapshotRevenue(viewer);
  if (!ids.length) return { ok: true as const, showRevenue, creators: [] as CreatorSnapshotCard[] };
  const people = await db.select().from(creators).where(inArray(creators.id, ids));
  const rows = (await db.select().from(analyticsSnapshots).where(inArray(analyticsSnapshots.creatorId, ids))).map(toStored);
  const cards = people
    .map((person) => {
      const mine = rows.filter((row) => row.creatorId === person.id);
      const platforms = [...new Set(mine.map((row) => row.platform))];
      const latestRows = platforms.map((platform) => {
        const history = mine.filter((row) => row.platform === platform).sort((a, b) => a.capturedOn.localeCompare(b.capturedOn) || a.id.localeCompare(b.id));
        const latest = history.at(-1)!;
        const previous = history.length > 1 ? history[history.length - 2] : undefined;
        const platformRow: PlatformSnapshot = {
          platform: latest.platform,
          capturedOn: latest.capturedOn,
          source: latest.source,
          period: latest.period,
          handle: latest.handle,
          benchmark: latest.benchmark,
          updatedLabel: latest.updatedLabel,
          channelName: latest.channelName,
          metrics: latest.metrics,
          audience: latest.audience,
          clips: latest.clips,
          change: changeBetween(latest, previous),
        };
        if (showRevenue) platformRow.revenueCents = latest.revenueCents;
        return platformRow;
      });
      latestRows.sort((a, b) => a.platform.localeCompare(b.platform));
      const sample = mine[0];
      return {
        creatorId: person.id,
        name: person.name,
        location: sample?.location ?? null,
        totalAudience: sample?.totalAudience ?? null,
        largestPlatform: sample?.largestPlatform ?? null,
        platforms: latestRows,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true as const, showRevenue, creators: cards };
}

export async function rankFieldsFromSnapshots(db: PortalDb, creatorId: string): Promise<Partial<RankInputs>> {
  const rows = (await db.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.creatorId, creatorId))).map(toStored);
  if (!rows.length) return {};
  const platforms = [...new Set(rows.map((row) => row.platform))];
  const latest: StoredSnapshot[] = [];
  const growth: number[] = [];
  for (const platform of platforms) {
    const history = rows.filter((row) => row.platform === platform).sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
    const current = history.at(-1);
    if (!current) continue;
    latest.push(current);
    const previous = history.length > 1 ? history[history.length - 2] : undefined;
    const nowFollowers = current ? followerCount(current.metrics) : null;
    const thenFollowers = previous ? followerCount(previous.metrics) : null;
    if (nowFollowers != null && thenFollowers != null && thenFollowers > 0) {
      growth.push(((nowFollowers - thenFollowers) / thenFollowers) * 100);
    }
  }
  const fields: Partial<RankInputs> = {};
  const total = parseDisplayedCount(latest.find((row) => row.totalAudience)?.totalAudience);
  if (total != null) fields.followers = total;
  else {
    const counts = latest.map((row) => followerCount(row.metrics)).filter((value): value is number => value != null);
    if (counts.length) fields.followers = counts.reduce((sum, value) => sum + value, 0);
  }
  const engagement = latest
    .map((row) => parseDisplayedNumber(displayed(row.metrics, "engagement")))
    .filter((value): value is number => value != null);
  const engagementMean = mean(engagement);
  if (engagementMean != null) fields.engagement = roundTenth(engagementMean);
  const views = latest.flatMap((row) => collectAverageViews(row.metrics));
  const viewsMean = mean(views);
  if (viewsMean != null) fields.averageViews = Math.round(viewsMean);
  const growthMean = mean(growth);
  if (growthMean != null) fields.audienceGrowth = roundTenth(growthMean);
  const revenue = latest.map((row) => row.revenueCents).filter((value): value is number => value != null);
  if (revenue.length) fields.revenue = revenue.reduce((sum, value) => sum + value, 0) / 100;
  return fields;
}

export function capturedLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !month || !day) return iso;
  return `${months[month - 1]} ${day}, ${year}`;
}
