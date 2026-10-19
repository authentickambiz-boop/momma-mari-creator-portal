import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { campaignAllocations, campaigns, creators, deals } from "@/db/schema";
import { upsertBrandCrm } from "./brand-crm";
import { latestRanks } from "./creator-rank";
import { rulesFor, videoMinimumCents } from "./deal-rules";
import { agencyTimeZone, nowIso } from "./format";
import { getDealStage } from "./stages";
import type { Viewer } from "./types";

export const PITCH_RETAINER = "Pitch agency retainer";
export const COMMISSION_TRAINEE = "Commission-only trainee";

export function offerFlagLabel(flag: string | null) {
  if (flag === "pitch_retainer") return PITCH_RETAINER;
  if (flag === "commission_trainee") return COMMISSION_TRAINEE;
  return null;
}

export type OfferBudget = { creatorId: string; amountCents: number };

export type BrandOfferInput = {
  brand: string;
  contactName: string;
  contactEmail?: string | null;
  deliverables: string[];
  platforms: string[];
  startsOn?: string | null;
  endsOn?: string | null;
  nextFollowUp?: string | null;
  budgets: OfferBudget[];
};

type Candidate = {
  creatorId: string;
  name: string;
  amountCents: number;
  fits: boolean;
  rank: number;
  score: number;
  acceptGifted: boolean;
  acceptCommissionOnly: boolean;
};

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: agencyTimeZone(), year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
}

function monthOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return monthKey(date);
}

async function sponsoredThisMonth(db: PortalDb, creatorId: string, now = new Date()) {
  const month = monthKey(now);
  const [dealRows, allocations, offerRows] = await Promise.all([
    db.select().from(deals).where(eq(deals.creatorId, creatorId)),
    db.select().from(campaignAllocations).where(eq(campaignAllocations.creatorId, creatorId)),
    db.select().from(campaigns),
  ]);
  const offerIds = new Set(offerRows.filter((row) => row.kind === "offer").map((row) => row.id));
  let count = 0;
  for (const deal of dealRows) {
    const stage = getDealStage(deal.workflowStage);
    if ((stage?.order ?? 0) < 3 || deal.workflowStage === "creator_declined") continue;
    if (monthOf(deal.createdAt) === month) count += 1;
  }
  for (const row of allocations) {
    if (!offerIds.has(row.campaignId)) continue;
    if (row.response === "declined") continue;
    if (monthOf(row.createdAt) === month) count += 1;
  }
  return count;
}

export async function matchBrandOffer(db: PortalDb, input: { deliverables: string[]; budgets: OfferBudget[] }) {
  const people = await db.select().from(creators);
  const ranks = await latestRanks(db);
  const byId = new Map(people.map((person) => [person.id, person]));
  const candidates: Candidate[] = [];
  for (const budget of input.budgets) {
    const person = byId.get(budget.creatorId);
    if (!person) continue;
    const rules = await rulesFor(db, person.id);
    const minimum = videoMinimumCents(rules, input.deliverables);
    const cap = rules.maxDealsPerMonth;
    const sponsored = cap == null ? 0 : await sponsoredThisMonth(db, person.id);
    const rank = ranks.get(person.id);
    const clearsMinimum = minimum == null || budget.amountCents >= minimum;
    const underCap = cap == null || sponsored < cap;
    candidates.push({
      creatorId: person.id,
      name: person.name,
      amountCents: budget.amountCents,
      fits: clearsMinimum && underCap,
      rank: rank?.rank ?? 999,
      score: rank?.score ?? 0,
      acceptGifted: Boolean(rules.acceptGifted),
      acceptCommissionOnly: Boolean(rules.acceptCommissionOnly),
    });
  }
  const fits = candidates
    .filter((row) => row.fits)
    .sort((a, b) => b.rank - a.rank || a.score - b.score || a.name.localeCompare(b.name));
  let flag: "pitch_retainer" | "commission_trainee" | null = null;
  if (fits.length === 0 && candidates.length > 0) {
    flag = candidates.some((row) => row.acceptCommissionOnly || row.acceptGifted) ? "commission_trainee" : "pitch_retainer";
  }
  return { matches: fits, flag, candidates };
}

export async function createBrandOffer(db: PortalDb, viewer: Viewer, input: BrandOfferInput) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can send a brand offer." };
  const brand = input.brand.trim();
  const contactName = input.contactName.trim();
  const deliverables = input.deliverables.map((item) => item.trim()).filter(Boolean);
  const platforms = input.platforms.map((item) => item.trim()).filter(Boolean);
  const budgets = input.budgets.filter((row) => row.creatorId && Number.isInteger(row.amountCents) && row.amountCents >= 0);
  if (!brand) return { ok: false as const, error: "Name the brand." };
  if (!contactName) return { ok: false as const, error: "Add the brand contact." };
  if (!deliverables.length) return { ok: false as const, error: "Add at least one deliverable." };
  if (!platforms.length) return { ok: false as const, error: "Add at least one platform." };
  if (!budgets.length) return { ok: false as const, error: "Enter a budget for at least one creator." };
  const { matches, flag } = await matchBrandOffer(db, { deliverables, budgets });
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const sum = budgets.reduce((total, row) => total + row.amountCents, 0);
  await db.insert(campaigns).values({
    id,
    brand,
    name: `${brand} offer`,
    budgetCents: sum,
    nichesJson: "[]",
    platformsJson: JSON.stringify(platforms),
    deliverablesJson: JSON.stringify(deliverables),
    slots: Math.max(budgets.length, 1),
    startsOn: input.startsOn?.trim() || null,
    endsOn: input.endsOn?.trim() || null,
    status: matches.length ? "open" : "paused",
    openOutside: false,
    updatedAt: timestamp,
    contactName,
    contactEmail: input.contactEmail?.trim() || null,
    offerFlag: flag,
    nextFollowUp: input.nextFollowUp?.trim() || null,
    kind: "offer",
  });
  const amounts = new Map(budgets.map((row) => [row.creatorId, row.amountCents]));
  for (const match of matches) {
    await db.insert(campaignAllocations).values({
      id: crypto.randomUUID(),
      campaignId: id,
      creatorId: match.creatorId,
      prospectId: null,
      amountCents: amounts.get(match.creatorId) ?? match.amountCents,
      createdAt: timestamp,
      response: "pending",
      question: null,
      respondedAt: null,
    });
    await upsertBrandCrm(db, {
      brand,
      creatorId: match.creatorId,
      ratePaidCents: amounts.get(match.creatorId) ?? match.amountCents,
      outcome: "offered",
      nextFollowUp: input.nextFollowUp?.trim() || null,
      contactName,
      contactEmail: input.contactEmail,
      actorName: viewer.name,
      note: "Brand offer sent to her portal.",
    });
  }
  if (matches.length === 0) {
    await upsertBrandCrm(db, {
      brand,
      creatorId: null,
      ratePaidCents: null,
      outcome: offerFlagLabel(flag),
      nextFollowUp: input.nextFollowUp?.trim() || null,
      contactName,
      contactEmail: input.contactEmail,
      actorName: viewer.name,
      note: flag === "commission_trainee" ? COMMISSION_TRAINEE : `${PITCH_RETAINER}. Momma Mari marketing services.`,
    });
  }
  return { ok: true as const, id, flag, creatorIds: matches.map((row) => row.creatorId) };
}

function strings(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function listCreatorOffers(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return [];
  const [rows, offerRows] = await Promise.all([
    db.select().from(campaignAllocations).where(eq(campaignAllocations.creatorId, viewer.creatorId)),
    db.select().from(campaigns),
  ]);
  const offers = new Map(offerRows.filter((row) => row.kind === "offer").map((row) => [row.id, row]));
  return rows
    .filter((row) => offers.has(row.campaignId))
    .map((row) => {
      const offer = offers.get(row.campaignId)!;
      return {
        id: row.id,
        campaignId: offer.id,
        brand: offer.brand,
        contactName: offer.contactName,
        deliverables: strings(offer.deliverablesJson),
        platforms: strings(offer.platformsJson),
        startsOn: offer.startsOn,
        endsOn: offer.endsOn,
        budgetCents: row.amountCents,
        response: row.response ?? "pending",
        question: row.question,
      };
    })
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export async function listOfferBoard(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const [offerRows, allocations, people] = await Promise.all([
    db.select().from(campaigns),
    db.select().from(campaignAllocations),
    db.select().from(creators),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return offerRows
    .filter((row) => row.kind === "offer")
    .map((row) => ({
      id: row.id,
      brand: row.brand,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      deliverables: strings(row.deliverablesJson),
      platforms: strings(row.platformsJson),
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      nextFollowUp: row.nextFollowUp,
      flag: row.offerFlag,
      flagLabel: offerFlagLabel(row.offerFlag),
      recipients: allocations
        .filter((item) => item.campaignId === row.id)
        .map((item) => ({
          id: item.id,
          creatorId: item.creatorId,
          creatorName: item.creatorId ? names.get(item.creatorId) ?? "Creator" : "Creator",
          budgetCents: item.amountCents,
          response: item.response ?? "pending",
          question: item.question,
        })),
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export async function listFlaggedOffers(db: PortalDb) {
  const rows = await db.select().from(campaigns);
  return rows
    .filter((row) => row.kind === "offer" && row.offerFlag)
    .map((row) => ({
      id: row.id,
      brand: row.brand,
      flag: row.offerFlag,
      flagLabel: offerFlagLabel(row.offerFlag),
    }));
}

export async function respondToOffer(
  db: PortalDb,
  viewer: Viewer,
  input: { allocationId: string; decision: string; question?: string | null },
) {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false as const, error: "Open this from your own sign-in." };
  }
  if (input.decision !== "accepted" && input.decision !== "declined" && input.decision !== "question") {
    return { ok: false as const, error: "Accept, decline, or ask a question." };
  }
  const question = input.question?.trim() ?? "";
  if (input.decision === "question" && !question) return { ok: false as const, error: "Write the question for Kamron." };
  const rows = await db.select().from(campaignAllocations).where(eq(campaignAllocations.id, input.allocationId));
  const row = rows[0];
  if (!row || row.creatorId !== viewer.creatorId) return { ok: false as const, error: "That offer is not on your list." };
  const offerRows = await db.select().from(campaigns).where(eq(campaigns.id, row.campaignId));
  const offer = offerRows[0];
  if (!offer || offer.kind !== "offer") return { ok: false as const, error: "That offer is not on your list." };
  const timestamp = nowIso();
  await db.update(campaignAllocations).set({
    response: input.decision,
    question: input.decision === "question" ? question : row.question,
    respondedAt: timestamp,
  }).where(eq(campaignAllocations.id, row.id));
  await upsertBrandCrm(db, {
    brand: offer.brand,
    creatorId: viewer.creatorId,
    outcome: input.decision === "question" ? "question" : input.decision,
    actorName: viewer.name,
    note: input.decision === "question" ? question : null,
  });
  return { ok: true as const };
}
