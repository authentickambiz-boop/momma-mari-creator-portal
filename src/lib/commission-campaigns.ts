import { and, asc, eq, gte } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { benchCreators, commissionCampaignInterest, commissionCampaigns, creators } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import { redactCommissionForFree } from "./commission-access";
import { nowIso } from "./format";
import type { Viewer } from "./types";

export const COMMISSION_RATE = "TBD";
export const COMMISSION_STATUSES = ["open", "closed"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

type Fail = { ok: false; status: number; error: string };

export type CommissionCampaign = {
  id: string;
  brand: string;
  title: string;
  description: string;
  terms: string;
  trackingLink: string | null;
  trackingPending: boolean;
  bonus: string | null;
  bonusPending: boolean;
  rate: typeof COMMISSION_RATE;
  status: CommissionStatus;
  createdAt: string;
  interestCount: number;
};

const PRICE_KEYS = ["rateCents", "budgetCents", "amountCents", "rate", "price", "priceCents"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function pendingText(value: unknown, max: number): { ok: true; value: string | null; pending: boolean } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: null, pending: true };
  if (typeof value !== "string") return { ok: false, error: "Tracking link must be a full link, or pending." };
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "pending") return { ok: true, value: null, pending: true };
  return { ok: true, value: trimmed.slice(0, max), pending: false };
}

function httpLink(value: unknown): { ok: true; value: string | null; pending: boolean } | { ok: false; error: string } {
  const parsed = pendingText(value, 400);
  if (!parsed.ok || parsed.pending) return parsed;
  if (!/^https?:\/\//i.test(parsed.value ?? "")) {
    return { ok: false, error: "Tracking link must be a full link, or pending." };
  }
  return parsed;
}

function toCampaign(
  row: typeof commissionCampaigns.$inferSelect,
  interestCount: number,
): CommissionCampaign {
  return {
    id: row.id,
    brand: row.brand,
    title: row.title,
    description: row.description,
    terms: row.terms,
    trackingLink: row.trackingLink,
    trackingPending: !row.trackingLink,
    bonus: row.bonus,
    bonusPending: !row.bonus,
    rate: COMMISSION_RATE,
    status: row.status === "closed" ? "closed" : "open",
    createdAt: row.createdAt,
    interestCount,
  };
}

async function interestCounts(db: PortalDb) {
  const rows = await db.select().from(commissionCampaignInterest);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.campaignId, (counts.get(row.campaignId) ?? 0) + 1);
  return counts;
}

/** Open commission campaigns for a signed-in creator. Brand contacts are not on this payload. */
export async function listOpenCommissionCampaigns(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return [];
  const [rows, counts, mine] = await Promise.all([
    db.select().from(commissionCampaigns).where(eq(commissionCampaigns.status, "open")).orderBy(asc(commissionCampaigns.createdAt)),
    interestCounts(db),
    db.select().from(commissionCampaignInterest).where(eq(commissionCampaignInterest.creatorId, viewer.creatorId)),
  ]);
  const interested = new Set(mine.map((row) => row.campaignId));
  const free = await creatorIsFree(db, viewer.creatorId);
  return rows.map((row) => {
    const campaign = {
      ...toCampaign(row, counts.get(row.id) ?? 0),
      interested: interested.has(row.id),
    };
    return free ? redactCommissionForFree(campaign) : campaign;
  });
}

export async function creatorIsOpenRoster(db: PortalDb, creatorId: string) {
  const [person, bench] = await Promise.all([
    db.select({ contracted: creators.contracted, email: creators.email }).from(creators).where(eq(creators.id, creatorId)),
    db.select({ status: benchCreators.status, email: benchCreators.email }).from(benchCreators),
  ]);
  const email = person[0]?.email?.trim().toLowerCase() ?? "";
  const onBench = bench.some((row) => row.status === "bench" && row.email.trim().toLowerCase() === email);
  return !person[0]?.contracted || onBench;
}

/** Owner list. Counts only. No brand contact, and the rate stays TBD. */
export async function listCommissionCampaignsForOwner(db: PortalDb, viewer: Viewer): Promise<{ ok: true; campaigns: CommissionCampaign[] } | Fail> {
  if (viewer.role !== "admin") return { ok: false, status: 403, error: "Only the owner can see commission campaigns." };
  const [rows, counts] = await Promise.all([
    db.select().from(commissionCampaigns).orderBy(asc(commissionCampaigns.createdAt)),
    interestCounts(db),
  ]);
  return { ok: true, campaigns: rows.map((row) => toCampaign(row, counts.get(row.id) ?? 0)) };
}

export async function showCommissionInterest(db: PortalDb, viewer: Viewer, campaignId: string): Promise<{ ok: true; already: boolean } | Fail> {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false, status: 403, error: "Sign in as a creator to show interest." };
  }
  const rows = await db.select().from(commissionCampaigns).where(eq(commissionCampaigns.id, campaignId));
  const campaign = rows[0];
  if (!campaign || campaign.status !== "open") {
    return { ok: false, status: campaign ? 409 : 404, error: campaign ? "That campaign is closed." : "That campaign is not open." };
  }
  const existing = await db.select().from(commissionCampaignInterest).where(and(
    eq(commissionCampaignInterest.campaignId, campaign.id),
    eq(commissionCampaignInterest.creatorId, viewer.creatorId),
  ));
  if (existing[0]) return { ok: true, already: true };
  await db.insert(commissionCampaignInterest).values({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    creatorId: viewer.creatorId,
    createdAt: nowIso(),
  });
  return { ok: true, already: false };
}

/** Create or update. A price is refused. A brand contact is not stored. */
export async function saveCommissionCampaign(db: PortalDb, body: unknown) {
  if (!isRecord(body)) return { status: 400, body: { error: "Expected a JSON object." } };
  for (const key of PRICE_KEYS) {
    if (key in body && body[key] != null && body[key] !== "" && body[key] !== COMMISSION_RATE) {
      return { status: 400, body: { error: "Rate stays TBD. This board does not store a price." } };
    }
  }
  const requestedId = clip(body.id, 80);
  const existing = requestedId
    ? (await db.select().from(commissionCampaigns).where(eq(commissionCampaigns.id, requestedId)))[0]
    : null;
  const brand = "brand" in body || !existing ? clip(body.brand, 160) : existing.brand;
  const title = "title" in body || !existing ? clip(body.title, 160) : existing.title;
  const description = "description" in body || !existing ? clip(body.description, 4000) : existing.description;
  const terms = "terms" in body || "commissionTerms" in body || "affiliateTerms" in body || !existing
    ? clip(body.terms ?? body.commissionTerms ?? body.affiliateTerms, 2000)
    : existing.terms;
  if (!brand) return { status: 400, body: { error: "Name the brand." } };
  if (!title) return { status: 400, body: { error: "Add a title." } };
  if (!description) return { status: 400, body: { error: "Add a description." } };
  if (!terms) return { status: 400, body: { error: "Add the commission or affiliate terms." } };
  const statusText = "status" in body || !existing ? (clip(body.status, 20).toLowerCase() || "open") : existing.status;
  if (statusText !== "open" && statusText !== "closed") {
    return { status: 400, body: { error: "Status must be open or closed." } };
  }
  const tracking = "trackingLink" in body ? httpLink(body.trackingLink) : null;
  if (tracking && !tracking.ok) return { status: 400, body: { error: tracking.error } };
  const bonus = "bonus" in body ? pendingText(body.bonus, 240) : null;
  if (bonus && !bonus.ok) return { status: 400, body: { error: "Bonus must be text, or pending." } };
  const timestamp = nowIso();
  const id = existing?.id ?? (requestedId || crypto.randomUUID());
  const row = {
    brand,
    title,
    description,
    terms,
    trackingLink: tracking ? tracking.value : existing?.trackingLink ?? null,
    bonus: bonus ? bonus.value : existing?.bonus ?? null,
    rateLabel: COMMISSION_RATE,
    status: statusText,
    updatedAt: timestamp,
  };
  if (existing) {
    await db.update(commissionCampaigns).set(row).where(eq(commissionCampaigns.id, id));
  } else {
    await db.insert(commissionCampaigns).values({ ...row, id, createdAt: timestamp });
  }
  const saved = (await db.select().from(commissionCampaigns).where(eq(commissionCampaigns.id, id)))[0];
  const counts = await interestCounts(db);
  return {
    status: existing ? 200 : 201,
    body: { created: !existing, campaign: saved ? toCampaign(saved, counts.get(id) ?? 0) : null },
  };
}

export async function listBotCommissionCampaigns(db: PortalDb) {
  const [rows, counts] = await Promise.all([
    db.select().from(commissionCampaigns).orderBy(asc(commissionCampaigns.createdAt)),
    interestCounts(db),
  ]);
  return {
    status: 200,
    body: { campaigns: rows.map((row) => toCampaign(row, counts.get(row.id) ?? 0)) },
  };
}

export function interestSince(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: true as const, since: null };
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
    return { ok: false as const, status: 400, error: "since must be a time like 2026-10-21T00:00:00.000Z." };
  }
  return { ok: true as const, since: trimmed };
}

export async function listCommissionInterest(db: PortalDb, campaignId: string, since: string | null) {
  const bound = interestSince(since);
  if (!bound.ok) return { status: bound.status, body: { error: bound.error } };
  const campaign = (await db.select().from(commissionCampaigns).where(eq(commissionCampaigns.id, campaignId)))[0];
  if (!campaign) return { status: 404, body: { error: "That campaign is not open." } };
  const interest = bound.since
    ? await db.select().from(commissionCampaignInterest).where(and(
      eq(commissionCampaignInterest.campaignId, campaignId),
      gte(commissionCampaignInterest.createdAt, bound.since),
    )).orderBy(asc(commissionCampaignInterest.createdAt))
    : await db.select().from(commissionCampaignInterest).where(eq(commissionCampaignInterest.campaignId, campaignId)).orderBy(asc(commissionCampaignInterest.createdAt));
  const people = await db.select({ id: creators.id, name: creators.name, email: creators.email }).from(creators);
  const byId = new Map(people.map((person) => [person.id, person]));
  return {
    status: 200,
    body: {
      campaignId,
      interest: interest.map((row) => {
        const person = byId.get(row.creatorId);
        return {
          creatorId: row.creatorId,
          name: person?.name ?? "Creator",
          email: person?.email ?? "",
          createdAt: row.createdAt,
        };
      }),
    },
  };
}
