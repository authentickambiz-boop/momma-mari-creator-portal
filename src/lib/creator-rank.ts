import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorRankHistory, creatorRankInputs, creatorRankSettings, creators } from "@/db/schema";
import { agencyTimeZone, nowIso } from "./format";
import type { Viewer } from "./types";

export const RANK_FIELDS = [
  { id: "audienceGrowth", label: "Audience growth rate" },
  { id: "engagement", label: "Engagement rate" },
  { id: "averageViews", label: "Average views" },
  { id: "followers", label: "Follower count" },
  { id: "completion", label: "Deal completion rate" },
  { id: "onTime", label: "On-time deliverable rate" },
  { id: "revisions", label: "Revision count" },
  { id: "rehire", label: "Brand rehire rate" },
  { id: "response", label: "Response time" },
  { id: "revenue", label: "Revenue generated" },
  { id: "community", label: "Community participation" },
  { id: "collabs", label: "Collab activity" },
] as const;

export type RankFieldId = (typeof RANK_FIELDS)[number]["id"];
export type RankInputs = Record<RankFieldId, number>;
export type RankWeights = Record<RankFieldId, number>;

const LOWER_IS_BETTER = new Set<RankFieldId>(["revisions", "response"]);

const CAPS: Record<RankFieldId, number> = {
  audienceGrowth: 40,
  engagement: 10,
  averageViews: 100000,
  followers: 1000000,
  completion: 100,
  onTime: 100,
  revisions: 8,
  rehire: 100,
  response: 48,
  revenue: 1000000,
  community: 20,
  collabs: 8,
};

export function emptyInputs(): RankInputs {
  return {
    audienceGrowth: 0,
    engagement: 0,
    averageViews: 0,
    followers: 0,
    completion: 0,
    onTime: 0,
    revisions: 0,
    rehire: 0,
    response: 0,
    revenue: 0,
    community: 0,
    collabs: 0,
  };
}

export function defaultWeights(): RankWeights {
  const weights = emptyInputs();
  for (const field of RANK_FIELDS) weights[field.id] = 1;
  return weights;
}

export function fieldUnit(id: RankFieldId, value: number) {
  const cap = CAPS[id];
  if (id === "audienceGrowth") {
    const shifted = Math.min(40, Math.max(-20, value));
    return Math.round(((shifted + 20) / 60) * 100);
  }
  const clamped = Math.min(cap, Math.max(0, value));
  if (LOWER_IS_BETTER.has(id)) return Math.round((1 - clamped / cap) * 100);
  return Math.round((clamped / cap) * 100);
}

export function compositeScore(inputs: RankInputs, weights: RankWeights) {
  let weightSum = 0;
  let total = 0;
  const parts = RANK_FIELDS.map((field) => {
    const weight = Math.max(0, weights[field.id] ?? 0);
    const unit = fieldUnit(field.id, inputs[field.id] ?? 0);
    weightSum += weight;
    total += unit * weight;
    return { id: field.id, label: field.label, unit, weight };
  });
  const score = weightSum ? Math.round(total / weightSum) : 0;
  return { score: Math.max(0, Math.min(100, score)), parts };
}

export function tierFor(score: number) {
  if (score >= 85) return "Platinum";
  if (score >= 70) return "Gold";
  if (score >= 50) return "Silver";
  return "Bronze";
}

export function sizeBand(followers: number) {
  if (followers >= 1000000) return "mega";
  if (followers >= 500000) return "macro";
  if (followers >= 100000) return "mid";
  if (followers >= 10000) return "micro";
  return "nano";
}

export const SIZE_BANDS = [
  { id: "nano", label: "Nano", hint: "Under 10,000 followers" },
  { id: "micro", label: "Micro", hint: "10,000 to 99,999" },
  { id: "mid", label: "Mid", hint: "100,000 to 499,999" },
  { id: "macro", label: "Macro", hint: "500,000 to 999,999" },
  { id: "mega", label: "Mega", hint: "1,000,000 or more" },
] as const;

function asInputs(value: Partial<RankInputs> | null | undefined): RankInputs {
  const inputs = emptyInputs();
  for (const field of RANK_FIELDS) {
    const next = value?.[field.id];
    if (typeof next === "number" && Number.isFinite(next)) inputs[field.id] = next;
  }
  return inputs;
}

function asWeights(value: Partial<RankWeights> | null | undefined): RankWeights {
  const weights = defaultWeights();
  if (!value) return weights;
  for (const field of RANK_FIELDS) {
    const next = value[field.id];
    if (typeof next === "number" && Number.isFinite(next) && next >= 0) weights[field.id] = next;
  }
  return weights;
}

function periodKey(date: Date, cadence: string) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: agencyTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (cadence !== "weekly") return day;
  const [year, month, dateNumber] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, dateNumber));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - weekday + 1);
  return utc.toISOString().slice(0, 10);
}

export async function rankSettings(db: PortalDb) {
  const rows = await db.select().from(creatorRankSettings).where(eq(creatorRankSettings.id, "default"));
  if (!rows[0]) return { weights: defaultWeights(), cadence: "weekly" as const };
  let parsed: Partial<RankWeights> = {};
  try {
    parsed = JSON.parse(rows[0].weightsJson) as Partial<RankWeights>;
  } catch {
    parsed = {};
  }
  return { weights: asWeights(parsed), cadence: rows[0].cadence === "daily" ? "daily" as const : "weekly" as const };
}

export async function saveRankSettings(db: PortalDb, viewer: Viewer, weights: RankWeights, cadence: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can change rank weights." };
  const next = cadence === "daily" ? "daily" : "weekly";
  const values = {
    id: "default",
    weightsJson: JSON.stringify(asWeights(weights)),
    cadence: next,
    updatedAt: nowIso(),
  };
  const existing = await db.select().from(creatorRankSettings).where(eq(creatorRankSettings.id, "default"));
  if (existing[0]) await db.update(creatorRankSettings).set(values).where(eq(creatorRankSettings.id, "default"));
  else await db.insert(creatorRankSettings).values(values);
  return { ok: true as const };
}

export async function inputsFor(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorRankInputs).where(eq(creatorRankInputs.creatorId, creatorId));
  if (!rows[0]) return emptyInputs();
  try {
    return asInputs(JSON.parse(rows[0].inputsJson) as Partial<RankInputs>);
  } catch {
    return emptyInputs();
  }
}

export async function saveRankInputs(db: PortalDb, viewer: Viewer, creatorId: string, inputs: RankInputs) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can edit rank inputs." };
  const people = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!people[0]) return { ok: false as const, error: "That creator is not on the roster." };
  const values = { creatorId, inputsJson: JSON.stringify(asInputs(inputs)), updatedAt: nowIso() };
  const existing = await db.select().from(creatorRankInputs).where(eq(creatorRankInputs.creatorId, creatorId));
  if (existing[0]) await db.update(creatorRankInputs).set(values).where(eq(creatorRankInputs.creatorId, creatorId));
  else await db.insert(creatorRankInputs).values(values);
  return { ok: true as const };
}

export async function latestRanks(db: PortalDb) {
  const rows = await db.select().from(creatorRankHistory);
  const map = new Map<string, { score: number; rank: number; tier: string; recordedOn: string }>();
  for (const row of rows) {
    const current = map.get(row.creatorId);
    if (!current || row.recordedOn > current.recordedOn) {
      map.set(row.creatorId, { score: row.score, rank: row.rank, tier: row.tier, recordedOn: row.recordedOn });
    }
  }
  return map;
}

export async function rankHistory(db: PortalDb, viewer: Viewer, creatorId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Ranks stay on the owner's sign-in." };
  const rows = await db.select().from(creatorRankHistory).where(eq(creatorRankHistory.creatorId, creatorId));
  return {
    ok: true as const,
    rows: rows
      .map((row) => ({ recordedOn: row.recordedOn, score: row.score, rank: row.rank, tier: row.tier }))
      .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
  };
}

export async function leaderboard(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Ranks stay on the owner's sign-in." };
  const people = await db.select().from(creators);
  const ranks = await latestRanks(db);
  const settings = await rankSettings(db);
  const rows = [];
  for (const person of people) {
    const saved = ranks.get(person.id);
    const inputs = await inputsFor(db, person.id);
    const scored = compositeScore(inputs, settings.weights);
    rows.push({
      creatorId: person.id,
      name: person.name,
      score: saved?.score ?? scored.score,
      rank: saved?.rank ?? null,
      tier: saved?.tier ?? tierFor(scored.score),
      recordedOn: saved?.recordedOn ?? null,
      parts: scored.parts,
    });
  }
  rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.score - a.score || a.name.localeCompare(b.name));
  return { ok: true as const, cadence: settings.cadence, weights: settings.weights, rows };
}

export async function refreshRanks(db: PortalDb, viewer: Viewer, now = new Date()) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can update ranks." };
  const settings = await rankSettings(db);
  const key = periodKey(now, settings.cadence);
  const existing = await db.select().from(creatorRankHistory);
  if (existing.some((row) => row.recordedOn === key)) return { ok: true as const, recordedOn: key, created: false };
  const people = await db.select().from(creators);
  const scored = [];
  for (const person of people) {
    const inputs = await inputsFor(db, person.id);
    const result = compositeScore(inputs, settings.weights);
    scored.push({ creatorId: person.id, name: person.name, score: result.score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const timestamp = nowIso();
  for (let index = 0; index < scored.length; index += 1) {
    const row = scored[index];
    await db.insert(creatorRankHistory).values({
      id: crypto.randomUUID(),
      creatorId: row.creatorId,
      score: row.score,
      tier: tierFor(row.score),
      rank: index + 1,
      recordedOn: key,
      createdAt: timestamp,
    });
  }
  return { ok: true as const, recordedOn: key, created: true };
}
