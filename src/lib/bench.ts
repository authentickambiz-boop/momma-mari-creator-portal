import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, approvalEvents, benchCreators, benchOffers, creators, payments } from "@/db/schema";
import { BRAND_EMAIL_SENDER } from "./approvals";
import { campaignById, listCampaigns, rankRoster, rosterHasAFit } from "./campaigns";
import { feeAndPayout, nowIso } from "./format";
import { tierFor } from "./creator-rank";
import { BENCH_PROMOTE_SCORE } from "./platforms";
import type { Viewer } from "./types";

export type BenchSample = { title: string; url: string };

function slugFor(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creator";
  return `${base.slice(0, 32)}-${crypto.randomUUID().slice(0, 8)}`;
}

function samplesOf(value: string): BenchSample[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { title?: unknown; url?: unknown };
      if (typeof row.title !== "string" || !row.title.trim()) return [];
      return [{ title: row.title.trim().slice(0, 80), url: typeof row.url === "string" ? row.url.trim().slice(0, 200) : "" }];
    }).slice(0, 8);
  } catch {
    return [];
  }
}

function tagsOf(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function benchPromotionSuggested(score: number | null) {
  if (score == null) return false;
  const tier = tierFor(score);
  return score >= BENCH_PROMOTE_SCORE && (tier === "Gold" || tier === "Platinum");
}

export function benchJobFeeCents(amountCents: number) {
  return feeAndPayout(amountCents).feeCents ?? 0;
}

export async function joinBench(
  db: PortalDb,
  input: { name: string; email: string; niches: string[]; platforms: string[]; samples: BenchSample[] },
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false as const, error: "Add your name." };
  if (!email.includes("@") || email.endsWith(".invalid")) return { ok: false as const, error: "Enter an email address." };
  const existing = await db.select().from(benchCreators);
  if (existing.some((row) => row.email.toLowerCase() === email)) return { ok: false as const, error: "That email is already on the bench." };
  const id = crypto.randomUUID();
  await db.insert(benchCreators).values({
    id,
    name,
    email,
    slug: slugFor(name),
    nichesJson: JSON.stringify(input.niches.map((item) => item.trim()).filter(Boolean).slice(0, 12)),
    platformsJson: JSON.stringify(input.platforms.map((item) => item.trim()).filter(Boolean).slice(0, 12)),
    portfolioJson: JSON.stringify(input.samples.filter((item) => item.title.trim()).slice(0, 8)),
    score: null,
    status: "bench",
    creatorId: null,
    createdAt: nowIso(),
    promotedAt: null,
  });
  return { ok: true as const, id };
}

async function toBench(row: typeof benchCreators.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    slug: row.slug,
    niches: tagsOf(row.nichesJson),
    platforms: tagsOf(row.platformsJson),
    samples: samplesOf(row.portfolioJson),
    score: row.score,
    tier: row.score == null ? null : tierFor(row.score),
    suggestPromote: row.status === "bench" && benchPromotionSuggested(row.score),
    status: row.status,
    creatorId: row.creatorId,
    promotedAt: row.promotedAt,
  };
}

export async function listBench(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const rows = await db.select().from(benchCreators);
  const listed = [];
  for (const row of rows) listed.push(await toBench(row));
  return listed.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
}

export async function publicBenchPortfolio(db: PortalDb, slug: string) {
  const rows = await db.select().from(benchCreators).where(eq(benchCreators.slug, slug));
  const row = rows[0];
  if (!row) return null;
  const person = await toBench(row);
  return { name: person.name, niches: person.niches, platforms: person.platforms, samples: person.samples, status: person.status };
}

export async function setBenchScore(db: PortalDb, viewer: Viewer, benchId: string, score: number) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can set a bench score." };
  if (!Number.isInteger(score) || score < 0 || score > 100) return { ok: false as const, error: "Use a score from 0 to 100." };
  const rows = await db.select().from(benchCreators).where(eq(benchCreators.id, benchId));
  if (!rows[0]) return { ok: false as const, error: "That creator is not on the bench." };
  await db.update(benchCreators).set({ score }).where(eq(benchCreators.id, benchId));
  return { ok: true as const, suggestPromote: benchPromotionSuggested(score) };
}

export async function promoteBench(db: PortalDb, viewer: Viewer, benchId: string, creatorId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can move someone onto the roster." };
  const rows = await db.select().from(benchCreators).where(eq(benchCreators.id, benchId));
  if (!rows[0]) return { ok: false as const, error: "That creator is not on the bench." };
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, error: "Pick a creator who is already on the roster." };
  await db.update(benchCreators).set({ status: "promoted", creatorId, promotedAt: nowIso() }).where(eq(benchCreators.id, benchId));
  return { ok: true as const };
}

export async function leftoverCampaigns(db: PortalDb) {
  const campaigns = await listCampaigns(db, {});
  const open = campaigns.filter((campaign) => campaign.status === "open" && campaign.kind !== "offer");
  const leftover = [];
  for (const campaign of open) {
    const ranked = await rankRoster(db, campaign);
    if (!rosterHasAFit(ranked)) leftover.push(campaign);
  }
  return leftover;
}

export async function queueBenchOffer(db: PortalDb, viewer: Viewer, input: { campaignId: string; benchId: string; amountCents: number }) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can offer a bench job." };
  const campaign = await campaignById(db, input.campaignId);
  if (!campaign) return { ok: false as const, error: "That campaign is not on the board." };
  if (campaign.status !== "open") return { ok: false as const, error: "That campaign is not open." };
  if (rosterHasAFit(await rankRoster(db, campaign))) {
    return { ok: false as const, error: "A roster creator still fits. The bench only gets what the roster passed on." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false as const, error: "Enter the offer amount." };
  const benchRows = await db.select().from(benchCreators).where(eq(benchCreators.id, input.benchId));
  const bench = benchRows[0];
  if (!bench || bench.status !== "bench") return { ok: false as const, error: "That creator is not waiting on the bench." };
  const timestamp = nowIso();
  const offerId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  await db.insert(benchOffers).values({
    id: offerId,
    campaignId: campaign.id,
    benchId: bench.id,
    amountCents: input.amountCents,
    status: "pending",
    approvalId,
    feeCents: null,
    createdAt: timestamp,
  });
  await db.insert(approvalEmails).values({
    id: approvalId,
    dealId: offerId,
    gate: "report",
    status: "pending",
    toEmail: bench.email,
    subject: `${campaign.brand}: a bench offer`,
    body: `Hi ${bench.name}, a leftover ${campaign.brand} job may be a fit. Kamron still has to approve this note before it goes out. Joining the bench was free. The 20% applies only if this job is paid.`,
    fromEmail: BRAND_EMAIL_SENDER,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(approvalEvents).values({
    id: crypto.randomUUID(),
    approvalId,
    action: "drafted",
    actorEmail: viewer.email,
    actorRole: viewer.role,
    subject: `${campaign.brand}: a bench offer`,
    body: null,
    note: "Bench offer. Nothing is sent until you approve it.",
    createdAt: timestamp,
  });
  return { ok: true as const, id: offerId, approvalId };
}

export async function approveBenchOffer(db: PortalDb, viewer: Viewer, offerId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can approve a bench offer." };
  const rows = await db.select().from(benchOffers).where(eq(benchOffers.id, offerId));
  const offer = rows[0];
  if (!offer) return { ok: false as const, error: "That offer is not on the bench." };
  if (offer.status === "paid") return { ok: false as const, error: "That job is already marked paid." };
  await db.update(benchOffers).set({ status: "approved" }).where(eq(benchOffers.id, offerId));
  return { ok: true as const };
}

export async function recordBenchPaid(db: PortalDb, viewer: Viewer, offerId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can mark a bench job paid." };
  const before = (await db.select().from(payments)).length;
  const rows = await db.select().from(benchOffers).where(eq(benchOffers.id, offerId));
  const offer = rows[0];
  if (!offer) return { ok: false as const, error: "That offer is not on the bench." };
  if (offer.status !== "approved") return { ok: false as const, error: "Approve the offer before marking it paid." };
  const feeCents = benchJobFeeCents(offer.amountCents);
  await db.update(benchOffers).set({ status: "paid", feeCents }).where(eq(benchOffers.id, offerId));
  const after = (await db.select().from(payments)).length;
  return { ok: true as const, feeCents, paymentsUnchanged: before === after };
}

export async function listBenchOffers(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  return db.select().from(benchOffers);
}
