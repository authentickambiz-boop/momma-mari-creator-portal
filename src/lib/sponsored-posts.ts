import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { campaigns, creators, deals, sponsoredPostSnapshots, sponsoredPosts } from "@/db/schema";
import { isOwner } from "./authz";
import { joinAnd, normalizeEmail, nowIso } from "./format";
import { SERVICE_PLATFORMS } from "./platforms";
import type { Viewer } from "./types";

export const SPONSORED_ERRORS = {
  owner: "Only the owner can log a sponsored post.",
  read: "Sponsored post tracking stays with the owner.",
  creator: "Choose a creator on the roster.",
  brand: "Name the brand.",
  platform: "Choose a platform the portal already supports.",
  url: "Paste the live post link.",
  date: "Enter the post date.",
  terms: "Add the deliverable terms.",
  private: "Leave pay figures off this log.",
  deal: "That deal is not this creator's.",
  dealBrand: "That deal is for a different brand.",
  dealMissing: "That deal is not in the portal.",
  campaign: "That campaign is not in the portal.",
  campaignBrand: "That campaign is for a different brand.",
  post: "That sponsored post is not in the log.",
  snapshot: "That checkpoint is not on this post.",
  checkpoint: "Name the checkpoint, such as 24 hours, 7 days, or 30 days.",
  checkpointTaken: "That checkpoint is already on this post. Edit that row.",
  metric: "Enter a whole number, or leave the box empty.",
  note: "Keep the note under 400 characters.",
  archived: "Choose whether to archive this post.",
} as const;

export const SPONSORED_CHECKPOINTS = [
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
] as const;

export const SPONSORED_SORTS = ["postedOn", "brand", "creator", "platform", "views7d"] as const;

export const SNAPSHOT_METRICS = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "promoCodeUses",
  "installs",
] as const;

export type SnapshotMetric = (typeof SNAPSHOT_METRICS)[number];
export type SponsoredSort = (typeof SPONSORED_SORTS)[number];

const METRIC_LABEL: Record<SnapshotMetric, string> = {
  views: "Views / reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  clicks: "Clicks",
  promoCodeUses: "Promo-code uses",
  installs: "Installs",
};

const CHECKPOINT_ORDER = ["24h", "7d", "30d"];
const PRIVATE_SPONSORED = /\$|\bminimums?\b|\bfloors?\b|\brates?\b|\bpay(?:out|ments?)?\b|\bfees?\b|\bcommissions?\b|\bcents\b|\binvoices?\b|\bdeposits?\b|80\s*\/\s*20|\b20\s*%|%/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type SnapshotNumbers = Record<SnapshotMetric, number | null>;

export type SponsoredSnapshotView = SnapshotNumbers & {
  id: string;
  checkpoint: string;
  checkpointLabel: string;
  note: string | null;
  enteredBy: string;
  enteredByName: string;
  updatedAt: string;
};

export type SponsoredPostView = {
  id: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  dealId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  platform: string;
  postUrl: string;
  postedOn: string;
  deliverableTerms: string;
  archived: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  snapshots: SponsoredSnapshotView[];
};

export type MetricStat = { count: number; total: number; average: number };
export type CheckpointRollup = Partial<Record<SnapshotMetric, MetricStat>>;

export type GroupRollup = {
  key: string;
  label: string;
  posts: number;
  checkpoints: Record<string, CheckpointRollup>;
};

export type SponsoredRollup = {
  posts: number;
  checkpoints: Record<string, CheckpointRollup>;
  byBrand: GroupRollup[];
  byCreator: GroupRollup[];
};

export type SponsoredChoices = {
  creators: { id: string; name: string }[];
  deals: { id: string; label: string }[];
  campaigns: { id: string; label: string }[];
  platforms: readonly string[];
};

export type SponsoredPostInput = {
  id?: string | null;
  brand?: string | null;
  creatorId?: string | null;
  dealId?: string | null;
  campaignId?: string | null;
  platform?: string | null;
  postUrl?: string | null;
  postedOn?: string | null;
  deliverableTerms?: string | null;
};

export type SponsoredSnapshotInput = {
  postId?: string | null;
  snapshotId?: string | null;
  checkpoint?: string | null;
  checkpointOther?: string | null;
  note?: string | null;
} & Partial<Record<SnapshotMetric, string | null>>;

export function isPrivateSponsoredText(value: string) {
  return PRIVATE_SPONSORED.test(value);
}

export function safeSponsoredText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text || isPrivateSponsoredText(text)) return null;
  return text;
}

export function brandKey(brand: string) {
  return brand.trim().toLowerCase();
}

export function metricLabel(metric: SnapshotMetric) {
  return METRIC_LABEL[metric];
}

export function checkpointLabel(id: string) {
  const known = SPONSORED_CHECKPOINTS.find((checkpoint) => checkpoint.id === id);
  if (known) return known.label;
  const hours = id.match(/^(\d+)h$/);
  if (hours) return Number(hours[1]) === 1 ? "1 hour" : `${hours[1]} hours`;
  const days = id.match(/^(\d+)d$/);
  if (days) return Number(days[1]) === 1 ? "1 day" : `${days[1]} days`;
  const weeks = id.match(/^(\d+)w$/);
  if (weeks) return Number(weeks[1]) === 1 ? "1 week" : `${weeks[1]} weeks`;
  return id;
}

export function isStandardCheckpoint(id: string) {
  return SPONSORED_CHECKPOINTS.some((checkpoint) => checkpoint.id === id);
}

export function compareCheckpoints(a: string, b: string) {
  const left = CHECKPOINT_ORDER.indexOf(a);
  const right = CHECKPOINT_ORDER.indexOf(b);
  if (left >= 0 && right >= 0) return left - right;
  if (left >= 0) return -1;
  if (right >= 0) return 1;
  return a.localeCompare(b);
}

export function normalizeCheckpoint(value: string | null | undefined) {
  const text = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!text || isPrivateSponsoredText(text)) return null;
  const known = SPONSORED_CHECKPOINTS.find((checkpoint) => checkpoint.id === text || checkpoint.label.toLowerCase() === text);
  if (known) return known.id;
  const aliases: Record<string, string> = {
    "24 hour": "24h",
    "24 hours": "24h",
    "24hr": "24h",
    "24 hrs": "24h",
    "1 day": "24h",
    "7 day": "7d",
    "7 days": "7d",
    "1 week": "7d",
    "30 day": "30d",
    "30 days": "30d",
  };
  if (aliases[text]) return aliases[text];
  const compact = text.replace(/[\s_]+/g, "");
  const match = compact.match(/^(\d+)(h|d|w|hours|hour|days|day|weeks|week)$/);
  if (match) {
    const count = Number(match[1]);
    if (!Number.isInteger(count) || count < 1 || count > 3650) return null;
    const unit = match[2].startsWith("h") ? "h" : match[2].startsWith("w") ? "w" : "d";
    const id = `${count}${unit}`;
    if (id === "1d" || id === "24h") return "24h";
    if (id === "7d" || id === "1w") return "7d";
    if (id === "30d") return "30d";
    return id;
  }
  if (/^[a-z0-9][a-z0-9-]{0,19}$/.test(compact)) return compact;
  return null;
}

export function canonicalPlatform(value: string | null | undefined) {
  const text = (value ?? "").trim().toLowerCase();
  return SERVICE_PLATFORMS.find((platform) => platform.toLowerCase() === text) ?? null;
}

export function parseOptionalCount(raw: string | null | undefined): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = (raw ?? "").trim().replace(/,/g, "");
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: SPONSORED_ERRORS.metric };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { ok: false, error: SPONSORED_ERRORS.metric };
  return { ok: true, value };
}

export function parseSponsoredSort(value: string | null | undefined): SponsoredSort {
  return SPONSORED_SORTS.includes(value as SponsoredSort) ? value as SponsoredSort : "postedOn";
}

export function parseSponsoredDir(value: string | null | undefined): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

export function formatSponsoredCount(value: number) {
  return value.toLocaleString("en-US");
}

export function formatSponsoredAverage(value: number) {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatSponsoredDay(isoDate: string) {
  const match = isoDate.match(DAY);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return isoDate;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function sponsoredPostHref(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

export function snapshotMetricPairs(snapshot: SnapshotNumbers) {
  return SNAPSHOT_METRICS.flatMap((metric) => {
    const value = snapshot[metric];
    if (value == null) return [];
    return [{ metric, label: METRIC_LABEL[metric], value }];
  });
}

export function metricStat(group: { checkpoints: Record<string, CheckpointRollup> }, checkpoint: string, metric: SnapshotMetric) {
  return group.checkpoints[checkpoint]?.[metric] ?? null;
}

export function checkpointSummary(
  group: { checkpoints: Record<string, CheckpointRollup> },
  checkpoint: string,
  options?: { omit?: SnapshotMetric[] },
) {
  const rollup = group.checkpoints[checkpoint];
  if (!rollup) return null;
  const omit = new Set(options?.omit ?? []);
  const parts: string[] = [];
  for (const metric of SNAPSHOT_METRICS) {
    if (omit.has(metric)) continue;
    const stat = rollup[metric];
    if (!stat) continue;
    parts.push(`${METRIC_LABEL[metric]}: avg ${formatSponsoredAverage(stat.average)}, total ${formatSponsoredCount(stat.total)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function emptyNumbers(): SnapshotNumbers {
  return {
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    clicks: null,
    promoCodeUses: null,
    installs: null,
  };
}

function parseDay(value: string | null | undefined) {
  const text = (value ?? "").trim();
  const match = text.match(DAY);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2015 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return text;
}

function parsePostUrl(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text || text.length > 500) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseTerms(value: string | null | undefined) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 400) return { ok: false as const, error: SPONSORED_ERRORS.terms };
  if (isPrivateSponsoredText(text)) return { ok: false as const, error: SPONSORED_ERRORS.private };
  return { ok: true as const, value: text };
}

function parseNote(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return { ok: true as const, value: null };
  if (text.length > 400) return { ok: false as const, error: SPONSORED_ERRORS.note };
  if (isPrivateSponsoredText(text)) return { ok: false as const, error: SPONSORED_ERRORS.private };
  return { ok: true as const, value: text };
}

function actor(viewer: Viewer) {
  return {
    email: normalizeEmail(viewer.email),
    name: viewer.name.trim() || normalizeEmail(viewer.email),
  };
}

function viewsAt(post: SponsoredPostView, checkpoint: string) {
  return post.snapshots.find((snapshot) => snapshot.checkpoint === checkpoint)?.views ?? null;
}

export function sortSponsoredPosts(posts: SponsoredPostView[], sort: SponsoredSort, dir: "asc" | "desc") {
  const direction = dir === "asc" ? 1 : -1;
  const text = (left: string, right: string) => left.localeCompare(right, "en", { sensitivity: "base" }) * direction;
  return posts.slice().sort((a, b) => {
    if (sort === "views7d") {
      const left = viewsAt(a, "7d");
      const right = viewsAt(b, "7d");
      if (left == null && right == null) return b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id);
      if (left == null) return 1;
      if (right == null) return -1;
      if (left !== right) return (left - right) * direction;
    } else if (sort === "brand") {
      const compared = text(a.brand, b.brand);
      if (compared) return compared;
    } else if (sort === "creator") {
      const compared = text(a.creatorName, b.creatorName);
      if (compared) return compared;
    } else if (sort === "platform") {
      const compared = text(a.platform, b.platform);
      if (compared) return compared;
    } else {
      const compared = a.postedOn.localeCompare(b.postedOn) * direction;
      if (compared) return compared;
    }
    return b.postedOn.localeCompare(a.postedOn) || a.id.localeCompare(b.id);
  });
}

function stats(values: number[]): MetricStat | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return { count: values.length, total, average: total / values.length };
}

function checkpointRollups(posts: SponsoredPostView[]) {
  const buckets = new Map<string, Map<SnapshotMetric, number[]>>();
  for (const post of posts) {
    for (const snapshot of post.snapshots) {
      let metrics = buckets.get(snapshot.checkpoint);
      if (!metrics) {
        metrics = new Map();
        buckets.set(snapshot.checkpoint, metrics);
      }
      for (const metric of SNAPSHOT_METRICS) {
        const value = snapshot[metric];
        if (value == null) continue;
        const list = metrics.get(metric) ?? [];
        list.push(value);
        metrics.set(metric, list);
      }
    }
  }
  const checkpoints: Record<string, CheckpointRollup> = {};
  for (const [checkpoint, metrics] of buckets) {
    const rollup: CheckpointRollup = {};
    for (const metric of SNAPSHOT_METRICS) {
      const stat = stats(metrics.get(metric) ?? []);
      if (stat) rollup[metric] = stat;
    }
    checkpoints[checkpoint] = rollup;
  }
  return checkpoints;
}

function groupRollups(posts: SponsoredPostView[], keyOf: (post: SponsoredPostView) => string, labelOf: (post: SponsoredPostView) => string) {
  const groups = new Map<string, { label: string; posts: SponsoredPostView[] }>();
  const ordered = posts.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const post of ordered) {
    const key = keyOf(post);
    const existing = groups.get(key);
    if (existing) existing.posts.push(post);
    else groups.set(key, { label: labelOf(post), posts: [post] });
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      posts: group.posts.length,
      checkpoints: checkpointRollups(group.posts),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}

/** Averages use posts that are still on the list. Checkpoints are not added together. */
export function rollupSponsoredPosts(posts: SponsoredPostView[]): SponsoredRollup {
  const active = posts.filter((post) => !post.archived);
  return {
    posts: active.length,
    checkpoints: checkpointRollups(active),
    byBrand: groupRollups(active, (post) => brandKey(post.brand), (post) => post.brand),
    byCreator: groupRollups(active, (post) => post.creatorId, (post) => post.creatorName),
  };
}

export function sponsoredRecapText(input: { brand: string; posts: SponsoredPostView[]; rollup: SponsoredRollup }) {
  const lines: string[] = ["Momma Mari sponsored post recap", `Brand: ${input.brand}`];
  const shown = input.posts.filter((post) => !post.archived && brandKey(post.brand) === brandKey(input.brand));
  lines.push(`Posts: ${shown.length}`);
  const names = [...new Set(shown.map((post) => safeSponsoredText(post.creatorName)).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b));
  if (names.length) lines.push(`Creators: ${joinAnd(names)}`);
  const views = metricStat(input.rollup, "7d", "views");
  lines.push(`Average 7-day views: ${views ? formatSponsoredAverage(views.average) : "not entered yet"}`);
  lines.push(`Total 7-day views: ${views ? formatSponsoredCount(views.total) : "not entered yet"}`);
  const seven = checkpointSummary(input.rollup, "7d", { omit: ["views"] });
  if (seven) lines.push(`7 days — ${seven}`);
  lines.push("");
  for (const post of shown.slice().sort((a, b) => a.postedOn.localeCompare(b.postedOn) || a.creatorName.localeCompare(b.creatorName))) {
    const creator = safeSponsoredText(post.creatorName) ?? "Creator";
    lines.push(`${creator} · ${post.platform} · ${formatSponsoredDay(post.postedOn)}`);
    const href = sponsoredPostHref(post.postUrl);
    if (href) lines.push(href);
    const terms = safeSponsoredText(post.deliverableTerms);
    lines.push(terms ? `Deliverable: ${terms}` : "Deliverable: not shown");
    if (post.dealId) lines.push("Portal deal: linked");
    const campaign = safeSponsoredText(post.campaignName);
    if (campaign) lines.push(`Campaign: ${campaign}`);
    const extras = post.snapshots.map((snapshot) => snapshot.checkpoint).filter((id) => !CHECKPOINT_ORDER.includes(id));
    for (const id of [...CHECKPOINT_ORDER, ...extras]) {
      const snapshot = post.snapshots.find((item) => item.checkpoint === id);
      const label = checkpointLabel(id);
      if (!snapshot) {
        lines.push(`${label} — not entered yet`);
        continue;
      }
      const pairs = snapshotMetricPairs(snapshot);
      lines.push(pairs.length
        ? `${label} — ${pairs.map((pair) => `${pair.label}: ${formatSponsoredCount(pair.value)}`).join(" · ")}`
        : `${label} — no counts entered`);
      const note = safeSponsoredText(snapshot.note);
      if (note) lines.push(`Note: ${note}`);
      lines.push(`Entered by ${safeSponsoredText(snapshot.enteredByName) ?? "the owner"}`);
    }
    lines.push("");
  }
  lines.push("This summary is for a recap email. The portal does not send it.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function loadPosts(db: PortalDb): Promise<SponsoredPostView[]> {
  const [postRows, snapshotRows, creatorRows, campaignRows] = await Promise.all([
    db.select().from(sponsoredPosts),
    db.select().from(sponsoredPostSnapshots),
    db.select({ id: creators.id, name: creators.name }).from(creators),
    db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns),
  ]);
  const names = new Map(creatorRows.map((creator) => [creator.id, creator.name]));
  const campaignNames = new Map(campaignRows.map((campaign) => [campaign.id, campaign.name]));
  const snapshots = new Map<string, SponsoredSnapshotView[]>();
  for (const row of snapshotRows) {
    const list = snapshots.get(row.postId) ?? [];
    list.push({
      id: row.id,
      checkpoint: row.checkpoint,
      checkpointLabel: checkpointLabel(row.checkpoint),
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      clicks: row.clicks,
      promoCodeUses: row.promoCodeUses,
      installs: row.installs,
      note: row.note,
      enteredBy: row.enteredBy,
      enteredByName: row.enteredByName,
      updatedAt: row.updatedAt,
    });
    snapshots.set(row.postId, list);
  }
  return postRows.map((row) => ({
    id: row.id,
    brand: row.brand,
    creatorId: row.creatorId,
    creatorName: names.get(row.creatorId) ?? "Creator",
    dealId: row.dealId,
    campaignId: row.campaignId,
    campaignName: row.campaignId ? campaignNames.get(row.campaignId) ?? null : null,
    platform: row.platform,
    postUrl: row.postUrl,
    postedOn: row.postedOn,
    deliverableTerms: row.deliverableTerms,
    archived: Boolean(row.archived),
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    snapshots: (snapshots.get(row.id) ?? []).sort((a, b) => compareCheckpoints(a.checkpoint, b.checkpoint)),
  }));
}

function uniqueBrands(posts: SponsoredPostView[]) {
  const labels = new Map<string, string>();
  const ordered = posts.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const post of ordered) {
    const key = brandKey(post.brand);
    if (!labels.has(key)) labels.set(key, post.brand);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export async function listSponsoredPosts(db: PortalDb, viewer: Viewer, filter: {
  brand?: string | null;
  creatorId?: string | null;
  includeArchived?: boolean;
  sort?: string | null;
  dir?: string | null;
} = {}) {
  if (viewer.role === "manager") return { ok: false as const, error: SPONSORED_ERRORS.read };
  if (viewer.role === "creator" && !viewer.creatorId) return { ok: false as const, error: SPONSORED_ERRORS.read };
  const sort = parseSponsoredSort(filter.sort);
  const dir = parseSponsoredDir(filter.dir);
  const posts = await loadPosts(db);
  const creatorId = viewer.role === "creator" ? viewer.creatorId : filter.creatorId?.trim() || null;
  const scoped = creatorId && creatorId !== "all" ? posts.filter((post) => post.creatorId === creatorId) : posts;
  const brands = uniqueBrands(scoped);
  const requestedBrand = filter.brand?.trim() ?? "";
  const branded = requestedBrand ? scoped.filter((post) => brandKey(post.brand) === brandKey(requestedBrand)) : scoped;
  const includeArchived = viewer.role === "admin" && Boolean(filter.includeArchived);
  const visible = includeArchived ? branded : branded.filter((post) => !post.archived);
  return {
    ok: true as const,
    posts: sortSponsoredPosts(visible, sort, dir),
    rollup: rollupSponsoredPosts(branded),
    brands,
    sort,
    dir,
  };
}

export async function sponsoredPostChoices(db: PortalDb, viewer: Viewer) {
  if (!isOwner(viewer)) return { ok: false as const, error: SPONSORED_ERRORS.owner };
  const [creatorRows, dealRows, campaignRows] = await Promise.all([
    db.select({ id: creators.id, name: creators.name }).from(creators),
    db.select({ id: deals.id, brand: deals.brand, creatorId: deals.creatorId }).from(deals),
    db.select({ id: campaigns.id, brand: campaigns.brand, name: campaigns.name }).from(campaigns),
  ]);
  const names = new Map(creatorRows.map((creator) => [creator.id, creator.name]));
  const people = creatorRows.slice().sort((a, b) => a.name.localeCompare(b.name));
  const dealLabels = dealRows.map((deal) => ({
    id: deal.id,
    label: `${deal.brand} · ${names.get(deal.creatorId) ?? "Creator"}`,
  }));
  const seen = new Map<string, number>();
  for (const deal of dealLabels) seen.set(deal.label, (seen.get(deal.label) ?? 0) + 1);
  return {
    ok: true as const,
    choices: {
      creators: people,
      deals: dealLabels
        .map((deal) => ({ id: deal.id, label: (seen.get(deal.label) ?? 0) > 1 ? `${deal.label} · ${deal.id}` : deal.label }))
        .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })),
      campaigns: campaignRows
        .map((campaign) => ({ id: campaign.id, label: `${campaign.brand} · ${campaign.name}` }))
        .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })),
      platforms: SERVICE_PLATFORMS,
    } satisfies SponsoredChoices,
  };
}

export async function saveSponsoredPost(db: PortalDb, viewer: Viewer, input: SponsoredPostInput) {
  if (!isOwner(viewer)) return { ok: false as const, error: SPONSORED_ERRORS.owner };
  const creatorId = (input.creatorId ?? "").trim();
  const creatorRows = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!creatorRows[0]) return { ok: false as const, error: SPONSORED_ERRORS.creator };
  const platform = canonicalPlatform(input.platform);
  if (!platform) return { ok: false as const, error: SPONSORED_ERRORS.platform };
  const postUrl = parsePostUrl(input.postUrl);
  if (!postUrl) return { ok: false as const, error: SPONSORED_ERRORS.url };
  const postedOn = parseDay(input.postedOn);
  if (!postedOn) return { ok: false as const, error: SPONSORED_ERRORS.date };
  const terms = parseTerms(input.deliverableTerms);
  if (!terms.ok) return terms;

  let brand = (input.brand ?? "").trim().replace(/\s+/g, " ");
  if (brand && (brand.length > 80 || isPrivateSponsoredText(brand))) return { ok: false as const, error: SPONSORED_ERRORS.private };

  const dealId = (input.dealId ?? "").trim();
  if (dealId) {
    const dealRows = await db.select({ id: deals.id, brand: deals.brand, creatorId: deals.creatorId }).from(deals).where(eq(deals.id, dealId));
    const deal = dealRows[0];
    if (!deal) return { ok: false as const, error: SPONSORED_ERRORS.dealMissing };
    if (deal.creatorId !== creatorId) return { ok: false as const, error: SPONSORED_ERRORS.deal };
    if (brand && brandKey(brand) !== brandKey(deal.brand)) return { ok: false as const, error: SPONSORED_ERRORS.dealBrand };
    brand = deal.brand.trim();
  }

  const campaignId = (input.campaignId ?? "").trim();
  if (campaignId) {
    const campaignRows = await db.select({ id: campaigns.id, brand: campaigns.brand }).from(campaigns).where(eq(campaigns.id, campaignId));
    const campaign = campaignRows[0];
    if (!campaign) return { ok: false as const, error: SPONSORED_ERRORS.campaign };
    if (brand && brandKey(brand) !== brandKey(campaign.brand)) return { ok: false as const, error: SPONSORED_ERRORS.campaignBrand };
    if (!brand) brand = campaign.brand.trim();
  }

  if (!brand || brand.length > 80) return { ok: false as const, error: SPONSORED_ERRORS.brand };
  if (isPrivateSponsoredText(brand)) return { ok: false as const, error: SPONSORED_ERRORS.private };

  const who = actor(viewer);
  const timestamp = nowIso();
  const values = {
    brand,
    creatorId,
    dealId: dealId || null,
    campaignId: campaignId || null,
    platform,
    postUrl,
    postedOn,
    deliverableTerms: terms.value,
    updatedAt: timestamp,
  };
  const existingId = (input.id ?? "").trim();
  if (existingId) {
    const existing = await db.select({ id: sponsoredPosts.id }).from(sponsoredPosts).where(eq(sponsoredPosts.id, existingId));
    if (!existing[0]) return { ok: false as const, error: SPONSORED_ERRORS.post };
    await db.update(sponsoredPosts).set(values).where(eq(sponsoredPosts.id, existingId));
    return { ok: true as const, id: existingId };
  }
  const id = crypto.randomUUID();
  await db.insert(sponsoredPosts).values({
    ...values,
    id,
    archived: false,
    createdBy: who.email,
    createdByName: who.name,
    createdAt: timestamp,
  });
  return { ok: true as const, id };
}

export async function setSponsoredPostArchived(db: PortalDb, viewer: Viewer, postId: string, archived: boolean) {
  if (!isOwner(viewer)) return { ok: false as const, error: SPONSORED_ERRORS.owner };
  const id = postId.trim();
  const existing = await db.select({ id: sponsoredPosts.id }).from(sponsoredPosts).where(eq(sponsoredPosts.id, id));
  if (!existing[0]) return { ok: false as const, error: SPONSORED_ERRORS.post };
  await db.update(sponsoredPosts).set({ archived, updatedAt: nowIso() }).where(eq(sponsoredPosts.id, id));
  return { ok: true as const, id };
}

export async function saveSponsoredSnapshot(db: PortalDb, viewer: Viewer, input: SponsoredSnapshotInput) {
  if (!isOwner(viewer)) return { ok: false as const, error: SPONSORED_ERRORS.owner };
  const postId = (input.postId ?? "").trim();
  const post = await db.select({ id: sponsoredPosts.id }).from(sponsoredPosts).where(eq(sponsoredPosts.id, postId));
  if (!post[0]) return { ok: false as const, error: SPONSORED_ERRORS.post };
  const rawCheckpoint = (input.checkpointOther ?? "").trim() ? input.checkpointOther : input.checkpoint;
  const checkpoint = normalizeCheckpoint(rawCheckpoint);
  if (!checkpoint) return { ok: false as const, error: SPONSORED_ERRORS.checkpoint };
  const numbers = emptyNumbers();
  for (const metric of SNAPSHOT_METRICS) {
    const parsed = parseOptionalCount(input[metric]);
    if (!parsed.ok) return parsed;
    numbers[metric] = parsed.value;
  }
  const note = parseNote(input.note);
  if (!note.ok) return note;
  const rows = await db.select().from(sponsoredPostSnapshots).where(eq(sponsoredPostSnapshots.postId, postId));
  const snapshotId = (input.snapshotId ?? "").trim();
  const byId = snapshotId ? rows.find((row) => row.id === snapshotId) : undefined;
  if (snapshotId && !byId) return { ok: false as const, error: SPONSORED_ERRORS.snapshot };
  const byCheckpoint = rows.find((row) => row.checkpoint === checkpoint);
  if (byCheckpoint && byId && byCheckpoint.id !== byId.id) return { ok: false as const, error: SPONSORED_ERRORS.checkpointTaken };
  const who = actor(viewer);
  const timestamp = nowIso();
  const values = {
    checkpoint,
    ...numbers,
    note: note.value,
    enteredBy: who.email,
    enteredByName: who.name,
    updatedAt: timestamp,
  };
  const target = byId ?? byCheckpoint;
  if (target) {
    await db.update(sponsoredPostSnapshots).set(values).where(eq(sponsoredPostSnapshots.id, target.id));
    return { ok: true as const, id: target.id };
  }
  const id = crypto.randomUUID();
  await db.insert(sponsoredPostSnapshots).values({ ...values, id, postId, createdAt: timestamp });
  return { ok: true as const, id };
}

export async function sponsoredBrandRecap(db: PortalDb, viewer: Viewer, brand: string) {
  if (!isOwner(viewer)) return { ok: false as const, error: SPONSORED_ERRORS.read };
  const requested = brand.trim().replace(/\s+/g, " ");
  if (!requested || requested.length > 80 || isPrivateSponsoredText(requested)) {
    return { ok: false as const, error: SPONSORED_ERRORS.brand };
  }
  const posts = (await loadPosts(db)).filter((post) => !post.archived && brandKey(post.brand) === brandKey(requested));
  const label = posts.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.brand ?? requested;
  const rollup = rollupSponsoredPosts(posts);
  return {
    ok: true as const,
    brand: label,
    posts,
    rollup,
    text: sponsoredRecapText({ brand: label, posts, rollup }),
  };
}
