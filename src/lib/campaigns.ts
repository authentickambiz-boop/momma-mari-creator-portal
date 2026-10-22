import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  approvalEvents,
  campaignAllocations,
  campaigns,
  creators,
  deals,
  outsideOffers,
  prospects,
} from "@/db/schema";
import { BRAND_EMAIL_SENDER } from "./approvals";
import { latestRanks } from "./creator-rank";
import { rulesFor, screenOffer, type Screening } from "./deal-rules";
import { parseKickoffGoal } from "./brand-recap-report";
import { agencyTimeZone, feeAndPayout, nowIso } from "./format";
import { questionnaireFor } from "./questionnaire";
import { getDealStage } from "./stages";
import type { Viewer } from "./types";

export const CAMPAIGN_STATUSES = ["open", "filled", "paused", "closed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Empty stays empty. Other wording stays as written. A YYYY-MM-DD value has to be a real day. */
export function optionalCalendarDay(value: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !DATE_SHAPE.test(trimmed)) return { ok: true, value: trimmed || null };
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) return { ok: false, error: "Use a date like 2026-11-01." };
  return { ok: true, value: trimmed };
}

export type CampaignInput = {
  brand: string;
  name: string;
  budgetCents: number;
  niches: string[];
  platforms: string[];
  deliverables: string[];
  slots: number;
  startsOn?: string | null;
  endsOn?: string | null;
  status?: string;
  goalType?: string | null;
  goalTarget?: string | null;
};

export type CampaignRecord = {
  id: string;
  brand: string;
  name: string;
  budgetCents: number;
  niches: string[];
  platforms: string[];
  deliverables: string[];
  slots: number;
  startsOn: string | null;
  endsOn: string | null;
  status: string;
  openOutside: boolean;
  updatedAt: string;
  kind: string;
  offerFlag: string | null;
  goalType: string | null;
  goalTarget: string | null;
};

export type RankedCreator = {
  creatorId: string;
  name: string;
  score: number;
  verdict: Screening["verdict"];
  verdictLabel: string;
  askCents: number;
  reasons: string[];
  rosterScore: number;
  rosterRank: number | null;
};

export type BoardFilter = {
  niche?: string | null;
  platform?: string | null;
  minBudgetCents?: number | null;
  maxBudgetCents?: number | null;
};

function strings(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toCampaign(row: typeof campaigns.$inferSelect): CampaignRecord {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    budgetCents: row.budgetCents,
    niches: strings(row.nichesJson),
    platforms: strings(row.platformsJson),
    deliverables: strings(row.deliverablesJson),
    slots: row.slots,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    openOutside: row.openOutside,
    updatedAt: row.updatedAt,
    kind: row.kind || "campaign",
    offerFlag: row.offerFlag,
    goalType: row.goalType,
    goalTarget: row.goalTarget,
  };
}

export function canSeeMoney(viewer: Viewer) {
  return viewer.role === "admin" || Boolean(viewer.permissions?.canPriceDeals);
}

export function canSeeCommission(viewer: Viewer) {
  return viewer.role === "admin";
}

export async function listCampaigns(db: PortalDb, filter: BoardFilter = {}) {
  const rows = (await db.select().from(campaigns)).map(toCampaign);
  const niche = filter.niche?.trim().toLowerCase() ?? "";
  const platform = filter.platform?.trim().toLowerCase() ?? "";
  return rows
    .filter((row) => !niche || row.niches.some((item) => item.toLowerCase().includes(niche)))
    .filter((row) => !platform || row.platforms.some((item) => item.toLowerCase().includes(platform)))
    .filter((row) => filter.minBudgetCents == null || row.budgetCents >= filter.minBudgetCents)
    .filter((row) => filter.maxBudgetCents == null || row.budgetCents <= filter.maxBudgetCents)
    .sort((a, b) => b.budgetCents - a.budgetCents || a.brand.localeCompare(b.brand));
}

export async function campaignById(db: PortalDb, id: string) {
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function saveCampaign(db: PortalDb, viewer: Viewer, input: CampaignInput, id?: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can add a campaign." };
  const brand = input.brand.trim();
  const name = input.name.trim();
  if (!brand || !name) return { ok: false as const, error: "Add the brand and the campaign name." };
  if (!Number.isInteger(input.budgetCents) || input.budgetCents < 0) return { ok: false as const, error: "Enter the budget in dollars." };
  if (!Number.isInteger(input.slots) || input.slots < 1) return { ok: false as const, error: "Add at least one creator slot." };
  const starts = optionalCalendarDay(input.startsOn);
  if (!starts.ok) return starts;
  const ends = optionalCalendarDay(input.endsOn);
  if (!ends.ok) return ends;
  const goal = parseKickoffGoal(input.goalType, input.goalTarget);
  if (!goal.ok) return { ok: false as const, error: goal.error };
  const status = input.status && CAMPAIGN_STATUSES.includes(input.status as CampaignStatus) ? input.status : "open";
  const timestamp = nowIso();
  const values = {
    brand,
    name,
    budgetCents: input.budgetCents,
    nichesJson: JSON.stringify(input.niches),
    platformsJson: JSON.stringify(input.platforms),
    deliverablesJson: JSON.stringify(input.deliverables),
    slots: input.slots,
    startsOn: starts.value,
    endsOn: ends.value,
    status,
    updatedAt: timestamp,
  };
  const goalFields = goal.set ? { goalType: goal.goalType, goalTarget: goal.goalTarget } : {};
  if (id) {
    const existing = await campaignById(db, id);
    if (!existing) return { ok: false as const, error: "That campaign is not on the board." };
    await db.update(campaigns).set({ ...values, ...goalFields }).where(eq(campaigns.id, id));
    return { ok: true as const, id };
  }
  const created = crypto.randomUUID();
  await db.insert(campaigns).values({
    id: created,
    openOutside: false,
    ...values,
    goalType: goal.goalType,
    goalTarget: goal.goalTarget,
  });
  return { ok: true as const, id: created };
}

export async function saveCampaignGoal(db: PortalDb, viewer: Viewer, campaignId: string, goalType: string, goalTarget: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can add a campaign." };
  const existing = await campaignById(db, campaignId);
  if (!existing) return { ok: false as const, error: "That campaign is not on the board." };
  const goal = parseKickoffGoal(goalType, goalTarget);
  if (!goal.ok) return { ok: false as const, error: goal.error };
  await db.update(campaigns).set({
    goalType: goal.goalType,
    goalTarget: goal.goalTarget,
    updatedAt: nowIso(),
  }).where(eq(campaigns.id, campaignId));
  return { ok: true as const, id: campaignId };
}

async function acceptedDeals(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  return rows.filter((deal) => {
    const stage = getDealStage(deal.workflowStage);
    return (stage?.order ?? 0) >= 3 && deal.workflowStage !== "creator_declined";
  });
}

async function openDealCount(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  return rows.filter((deal) => deal.status !== "paid" && deal.workflowStage !== "creator_declined").length;
}

export async function rankRoster(db: PortalDb, campaign: CampaignRecord): Promise<RankedCreator[]> {
  const people = await db.select().from(creators);
  const ranks = await latestRanks(db);
  const perSlot = Math.floor(campaign.budgetCents / Math.max(campaign.slots, 1));
  const ranked: RankedCreator[] = [];
  for (const person of people) {
    const rules = await rulesFor(db, person.id);
    const quiz = await questionnaireFor(db, person.id);
    const nicheHit = campaign.niches.some((niche) => quiz.answers.niches.some((item) => item.toLowerCase() === niche.toLowerCase()));
    const openDeals = await openDealCount(db, person.id);
    const history = await acceptedDeals(db, person.id);
    const screened = screenOffer({
      rules,
      offer: {
        brand: campaign.brand,
        subtitle: campaign.niches.join(" "),
        amountCents: perSlot,
        deliverables: campaign.deliverables,
      },
      bestPastCents: null,
      nicheHit,
      openDeals,
    });
    let score = 20;
    if (nicheHit) score += 25;
    if (quiz.answers.audienceSize.trim()) score += 10;
    if (screened.verdict === "meets") score += 25;
    else if (screened.verdict === "below") score += 8;
    if (rules.maxDealsPerMonth == null || openDeals < rules.maxDealsPerMonth) score += 10;
    if (history.length) score += 10;
    if (screened.verdict === "blocked") score = 8;
    score = Math.max(0, Math.min(100, score));
    ranked.push({
      creatorId: person.id,
      name: person.name,
      score,
      verdict: screened.verdict,
      verdictLabel: screened.verdict === "meets" ? "Meets rules" : screened.verdict === "below" ? "Below floor" : "Blocked",
      askCents: screened.suggestedAskCents,
      reasons: screened.reasons,
      rosterScore: ranks.get(person.id)?.score ?? 0,
      rosterRank: ranks.get(person.id)?.rank ?? null,
    });
  }
  const gate = (verdict: Screening["verdict"]) => (verdict === "meets" ? 0 : verdict === "below" ? 1 : 2);
  return ranked.sort((a, b) => {
    const gated = gate(a.verdict) - gate(b.verdict);
    if (gated !== 0) return gated;
    if (b.rosterScore !== a.rosterScore) return b.rosterScore - a.rosterScore;
    if (b.score !== a.score) return b.score - a.score;
    return b.askCents - a.askCents;
  });
}

export function presentRoster(viewer: Viewer, rows: RankedCreator[]) {
  const owner = viewer.role === "admin";
  return rows.map((row) => ({
    ...row,
    rosterScore: owner ? row.rosterScore : 0,
    rosterRank: owner ? row.rosterRank : null,
  }));
}

export function rosterHasAFit(ranked: RankedCreator[]) {
  return ranked.some((row) => row.verdict === "meets");
}

export async function allocationsFor(db: PortalDb, campaignId: string) {
  const rows = await db.select().from(campaignAllocations).where(eq(campaignAllocations.campaignId, campaignId));
  return rows;
}

export function projectedCommission(amounts: number[]) {
  return feeAndPayout(amounts.reduce((sum, amount) => sum + amount, 0)).feeCents ?? 0;
}

export async function allocateCampaign(
  db: PortalDb,
  viewer: Viewer,
  input: { campaignId: string; creatorId: string; amountCents: number },
) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can split a campaign." };
  const campaign = await campaignById(db, input.campaignId);
  if (!campaign) return { ok: false as const, error: "That campaign is not on the board." };
  if (campaign.kind === "offer") return { ok: false as const, error: "Brand offers are changed on the offers page." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false as const, error: "Enter how much of the budget she gets." };
  const creator = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!creator[0]) return { ok: false as const, error: "That creator is not on the roster." };
  const current = await allocationsFor(db, campaign.id);
  const spent = current.reduce((sum, row) => sum + row.amountCents, 0);
  if (spent + input.amountCents > campaign.budgetCents) return { ok: false as const, error: "That split is over the campaign budget." };
  if (current.length >= campaign.slots) return { ok: false as const, error: "Every creator slot is filled." };
  await db.insert(campaignAllocations).values({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    creatorId: input.creatorId,
    prospectId: null,
    amountCents: input.amountCents,
    createdAt: nowIso(),
  });
  return { ok: true as const, commissionCents: projectedCommission([...current.map((row) => row.amountCents), input.amountCents]) };
}

export async function markOpenOutside(db: PortalDb, viewer: Viewer, campaignId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can open a campaign to outside creators." };
  const campaign = await campaignById(db, campaignId);
  if (!campaign) return { ok: false as const, error: "That campaign is not on the board." };
  if (campaign.kind === "offer") return { ok: false as const, error: "Brand offers are changed on the offers page." };
  const ranked = await rankRoster(db, campaign);
  if (rosterHasAFit(ranked)) return { ok: false as const, error: "A roster creator still fits this campaign." };
  await db.update(campaigns).set({ openOutside: true, updatedAt: nowIso() }).where(eq(campaigns.id, campaignId));
  return { ok: true as const };
}

export async function addProspect(db: PortalDb, viewer: Viewer, input: { name: string; email: string; niches: string[]; notes?: string }) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can add a prospect." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false as const, error: "Add the prospect's name." };
  if (!email.includes("@") || email.endsWith(".invalid")) return { ok: false as const, error: "Add a real email address." };
  const id = crypto.randomUUID();
  await db.insert(prospects).values({
    id,
    name,
    email,
    nichesJson: JSON.stringify(input.niches),
    notes: input.notes?.trim() || null,
    convertedCreatorId: null,
    createdAt: nowIso(),
  });
  return { ok: true as const, id };
}

export async function listProspects(db: PortalDb) {
  const rows = await db.select().from(prospects);
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      niches: strings(row.nichesJson),
      notes: row.notes,
      convertedCreatorId: row.convertedCreatorId,
      createdAt: row.createdAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function convertProspect(db: PortalDb, viewer: Viewer, prospectId: string, creatorId: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can move a prospect onto the roster." };
  const rows = await db.select().from(prospects).where(eq(prospects.id, prospectId));
  if (!rows[0]) return { ok: false as const, error: "That prospect is not on the list." };
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, error: "Pick a creator who is already on the roster." };
  await db.update(prospects).set({ convertedCreatorId: creatorId }).where(eq(prospects.id, prospectId));
  return { ok: true as const };
}

export async function queueOutsideOffer(
  db: PortalDb,
  viewer: Viewer,
  input: { campaignId: string; prospectId: string; amountCents: number },
) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can queue an outside offer." };
  const campaign = await campaignById(db, input.campaignId);
  if (!campaign) return { ok: false as const, error: "That campaign is not on the board." };
  if (campaign.kind === "offer") return { ok: false as const, error: "Brand offers are changed on the offers page." };
  if (!campaign.openOutside) return { ok: false as const, error: "This campaign is still for the roster." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false as const, error: "Enter the offer amount." };
  const prospectRows = await db.select().from(prospects).where(eq(prospects.id, input.prospectId));
  const prospect = prospectRows[0];
  if (!prospect) return { ok: false as const, error: "That prospect is not on the list." };
  const timestamp = nowIso();
  const offerId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  await db.insert(outsideOffers).values({
    id: offerId,
    campaignId: campaign.id,
    prospectId: prospect.id,
    amountCents: input.amountCents,
    status: "queued",
    approvalId,
    createdAt: timestamp,
  });
  await db.insert(approvalEmails).values({
    id: approvalId,
    dealId: offerId,
    gate: "report",
    status: "pending",
    toEmail: prospect.email,
    subject: `${campaign.brand}: ${campaign.name}`,
    body: `Hi ${prospect.name}, we have a ${campaign.brand} campaign that may be a fit. Kamron still has to approve this note before it goes out.`,
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
    subject: `${campaign.brand}: ${campaign.name}`,
    body: null,
    note: "Outside creator offer. Nothing is sent until you approve it.",
    createdAt: timestamp,
  });
  return { ok: true as const, id: offerId, approvalId, status: "pending" as const };
}

export async function listOutsideOffers(db: PortalDb, campaignId?: string) {
  const rows = await db.select().from(outsideOffers);
  return rows.filter((row) => !campaignId || row.campaignId === campaignId);
}

function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: agencyTimeZone(), year: "numeric", month: "2-digit" }).format(date);
  return parts.slice(0, 7);
}

function shiftMonth(key: string, by: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function ownerDashboard(db: PortalDb, viewer: Viewer, now = new Date()) {
  if (viewer.role !== "admin") return { ok: false as const, error: "The dashboard is for the owner." };
  const dealRows = await db.select().from(deals);
  const pipeline = new Map<string, number>();
  for (const deal of dealRows) {
    const stage = deal.workflowStage || "unknown";
    const amount = deal.rateCents ?? deal.pipelineCents ?? 0;
    pipeline.set(stage, (pipeline.get(stage) ?? 0) + amount);
  }
  const thisMonth = monthKey(now);
  const nextMonth = shiftMonth(thisMonth, 1);
  const commissionFor = (month: string) => {
    const cents = dealRows
      .filter((deal) => deal.workflowStage !== "creator_declined" && deal.workflowStage !== "paid")
      .filter((deal) => (deal.postDate ?? "").startsWith(month))
      .reduce((sum, deal) => sum + (deal.rateCents ?? 0), 0);
    return feeAndPayout(cents).feeCents ?? 0;
  };
  const won = dealRows.filter((deal) => (getDealStage(deal.workflowStage)?.order ?? 0) >= 3 && deal.workflowStage !== "creator_declined");
  const lost = dealRows.filter((deal) => deal.workflowStage === "creator_declined");
  const decided = won.length + lost.length;
  const byCreator = new Map<string, number[]>();
  const byNiche = new Map<string, number[]>();
  for (const deal of won) {
    if (!deal.rateCents) continue;
    const list = byCreator.get(deal.creatorId) ?? [];
    list.push(deal.rateCents);
    byCreator.set(deal.creatorId, list);
    const quiz = await questionnaireFor(db, deal.creatorId);
    for (const niche of quiz.answers.niches) {
      const nicheList = byNiche.get(niche) ?? [];
      nicheList.push(deal.rateCents);
      byNiche.set(niche, nicheList);
    }
  }
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const people = await db.select().from(creators);
  const utilization = [];
  for (const person of people) {
    const rules = await rulesFor(db, person.id);
    if (rules.maxDealsPerMonth == null) continue;
    utilization.push({
      creatorId: person.id,
      name: person.name,
      openDeals: await openDealCount(db, person.id),
      maxDeals: rules.maxDealsPerMonth,
    });
  }
  const board = await listCampaigns(db);
  let unfilledSlots = 0;
  for (const campaign of board) {
    if (campaign.status !== "open") continue;
    const taken = (await allocationsFor(db, campaign.id)).length;
    unfilledSlots += Math.max(0, campaign.slots - taken);
  }
  const prospectRows = await listProspects(db);
  const converted = prospectRows.filter((row) => row.convertedCreatorId).length;
  const outside = await listOutsideOffers(db);
  return {
    ok: true as const,
    pipeline: [...pipeline.entries()].map(([stage, cents]) => ({ stage, cents })).sort((a, b) => a.stage.localeCompare(b.stage)),
    commissionThisMonth: commissionFor(thisMonth),
    commissionNextMonth: commissionFor(nextMonth),
    winRate: decided ? won.length / decided : null,
    won: won.length,
    lost: lost.length,
    averageByCreator: [...byCreator.entries()].map(([creatorId, values]) => ({
      creatorId,
      name: people.find((person) => person.id === creatorId)?.name ?? creatorId,
      cents: average(values),
    })),
    averageByNiche: [...byNiche.entries()].map(([niche, values]) => ({ niche, cents: average(values) })),
    utilization,
    unfilledSlots,
    prospects: prospectRows.length,
    converted,
    outsideOffers: outside.length,
  };
}
