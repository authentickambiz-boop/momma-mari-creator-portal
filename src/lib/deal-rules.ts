import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorDealRules, creators, dealCategoryOverrides, deals, pricingSettings } from "@/db/schema";
import { feeAndPayout, formatMoney, nowIso } from "./format";
import { assignedCreatorIds } from "./managers";
import { questionnaireFor } from "./questionnaire";
import { getDealStage } from "./stages";
import type { Viewer } from "./types";

export const DELIVERABLES = [
  { id: "tiktok", label: "TikTok video" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
  { id: "ugc", label: "UGC" },
  { id: "live", label: "LIVE" },
  { id: "bundle", label: "Bundle" },
  { id: "stream", label: "Stream segment" },
  { id: "viewer_hour", label: "Viewer-hour" },
  { id: "youtube_integration", label: "YouTube integration" },
  { id: "youtube_dedicated", label: "Dedicated YouTube video" },
  { id: "podcast_pre", label: "Podcast pre-roll" },
  { id: "podcast_mid", label: "Podcast mid-roll" },
  { id: "podcast_host", label: "Host-read spot" },
  { id: "linkedin", label: "LinkedIn post" },
  { id: "x_post", label: "X post" },
  { id: "facebook", label: "Facebook post" },
  { id: "pinterest", label: "Pinterest pin" },
  { id: "snapchat", label: "Snapchat story" },
  { id: "newsletter", label: "Newsletter placement" },
  { id: "blog", label: "Blog post" },
] as const;

export type DeliverableId = (typeof DELIVERABLES)[number]["id"];

export const DEFAULT_ADDONS = [
  { id: "usage", label: "Extra usage", cents: 40000 },
  { id: "exclusivity", label: "Exclusivity", cents: 30000 },
  { id: "rush", label: "Rush turnaround", cents: 20000 },
] as const;

export const DEFAULT_MIN_PROFIT_CENTS = 15000;

export type DealRules = {
  minRates: Partial<Record<DeliverableId, number>>;
  targetRates: Partial<Record<DeliverableId, number>>;
  minDealCents: number | null;
  blockedCategories: string[];
  blockedBrands: string[];
  maxDealsPerMonth: number | null;
  turnaround: string;
  exclusivityMaxDays: number | null;
  usageMinDays: number | null;
  kidsOnCamera: "" | "yes" | "no" | "limits";
  kidsLimits: string;
  typicalRateCents?: number | null;
  acceptedCategories?: string[];
  acceptGifted?: boolean;
  acceptCommissionOnly?: boolean;
};

export type OfferTerms = {
  brand: string;
  subtitle?: string | null;
  amountCents: number | null;
  deliverables: string[];
  usageText?: string | null;
  exclusivityDays?: number | null;
  rush?: boolean;
  kidsOnCamera?: boolean;
  hours?: number | null;
  viewers?: number | null;
  downloads?: number | null;
};

export type Screening = {
  verdict: "meets" | "below" | "blocked";
  fit: number;
  reasons: string[];
  moneyReasons: string[];
  suggestedAskCents: number;
  counterCents: number | null;
  feeCents: number | null;
  profitWarn: boolean;
  minProfitCents: number;
  categoryWarn: boolean;
};

const EMPTY: DealRules = {
  minRates: {},
  targetRates: {},
  minDealCents: null,
  blockedCategories: [],
  blockedBrands: [],
  maxDealsPerMonth: null,
  turnaround: "",
  exclusivityMaxDays: null,
  usageMinDays: null,
  kidsOnCamera: "",
  kidsLimits: "",
  typicalRateCents: null,
  acceptedCategories: [],
  acceptGifted: false,
  acceptCommissionOnly: false,
};

export function dollarsToCents(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function deliverableKind(text: string): DeliverableId | null {
  const value = text.toLowerCase();
  if (value.includes("bundle")) return "bundle";
  if (value.includes("viewer-hour") || value.includes("viewer hour")) return "viewer_hour";
  if (value.includes("stream")) return "stream";
  if (value.includes("pre-roll") || value.includes("preroll")) return "podcast_pre";
  if (value.includes("mid-roll") || value.includes("midroll")) return "podcast_mid";
  if (value.includes("host-read") || value.includes("host read")) return "podcast_host";
  if (value.includes("podcast")) return "podcast_host";
  if (value.includes("dedicated")) return "youtube_dedicated";
  if (value.includes("integration")) return "youtube_integration";
  if (value.includes("linkedin")) return "linkedin";
  if (value.includes("newsletter")) return "newsletter";
  if (value.includes("snapchat") || value.includes("snap ")) return "snapchat";
  if (value.includes("pinterest")) return "pinterest";
  if (value.includes("facebook")) return "facebook";
  if (value.includes("blog")) return "blog";
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("reel")) return "reel";
  if (value.includes("story") || value.includes("stories")) return "story";
  if (value.includes("ugc")) return "ugc";
  if (value.includes("youtube")) return "youtube_integration";
  if (value.includes("x post") || value.includes("twitter") || value.includes("tweet")) return "x_post";
  if (value.includes("live")) return "live";
  return null;
}

const CPM_KINDS = new Set<DeliverableId>(["podcast_pre", "podcast_mid", "podcast_host"]);

export function quotedAskCents(
  kind: DeliverableId,
  unitRateCents: number,
  qty: { hours?: number | null; viewers?: number | null; downloads?: number | null },
) {
  if (unitRateCents <= 0) return 0;
  if (kind === "viewer_hour" && qty.viewers && qty.hours) return Math.round(unitRateCents * qty.viewers * qty.hours);
  if (kind === "stream" && qty.hours) return Math.round(unitRateCents * qty.hours);
  if (CPM_KINDS.has(kind) && qty.downloads) return Math.round((unitRateCents * qty.downloads) / 1000);
  return unitRateCents;
}

export const RESTRICTED_SPONSORS = [
  { id: "gambling", label: "Gambling", pattern: /\bgambl|\bcasino\b|\bsportsbook\b|\bstake\b|\broobet\b|\bslots\b/i },
  { id: "crypto", label: "Crypto", pattern: /\bcrypto\b|\bbitcoin\b|\bnft\b/i },
  { id: "investment", label: "Investment advice", pattern: /investment advice|investing advice|stock tips|\bforex\b/i },
] as const;

export function restrictedSponsor(text: string) {
  return RESTRICTED_SPONSORS.find((item) => item.pattern.test(text)) ?? null;
}

export function kindsIn(texts: string[]) {
  const found = new Set<DeliverableId>();
  for (const text of texts) {
    const kind = deliverableKind(text);
    if (kind) found.add(kind);
  }
  return [...found];
}

function rateFor(map: Partial<Record<DeliverableId, number>>, kinds: DeliverableId[]) {
  if (kinds.includes("bundle") && map.bundle) return map.bundle;
  const picked = kinds.map((kind) => map[kind] ?? 0).filter((value) => value > 0);
  if (!picked.length) return 0;
  return kinds.length > 1 ? picked.reduce((sum, value) => sum + value, 0) : picked[0];
}

export function screenOffer(input: {
  rules: DealRules;
  offer: OfferTerms;
  bestPastCents: number | null;
  nicheHit: boolean;
  openDeals: number;
  addons?: { id: string; cents: number }[];
  minProfitCents?: number;
  categoryOverride?: boolean;
}): Screening {
  const rules = input.rules;
  const offer = input.offer;
  const kinds = kindsIn([...(offer.deliverables ?? []), offer.subtitle ?? ""]);
  const brand = offer.brand.trim().toLowerCase();
  const haystack = `${offer.brand} ${offer.subtitle ?? ""} ${offer.deliverables.join(" ")} ${offer.usageText ?? ""}`.toLowerCase();
  const blockedBrand = rules.blockedBrands.some((item) => item.trim() && (brand === item.toLowerCase() || haystack.includes(item.toLowerCase())));
  const blockedCategory = rules.blockedCategories.find((item) => item.trim() && haystack.includes(item.toLowerCase()));
  const kidsBlocked = Boolean(offer.kidsOnCamera) && rules.kidsOnCamera === "no";
  const reasons: string[] = [];
  const moneyReasons: string[] = [];
  let verdict: Screening["verdict"] = "meets";
  const restricted = restrictedSponsor(haystack);
  const categoryWarn = Boolean(restricted && input.categoryOverride);
  if (restricted && !input.categoryOverride) {
    verdict = "blocked";
    reasons.push(`${restricted.label} sponsors are blocked unless the owner overrides this deal.`);
  } else if (blockedBrand) {
    verdict = "blocked";
    reasons.push("This brand is on her no list.");
  } else if (blockedCategory) {
    verdict = "blocked";
    reasons.push(`She won't work with ${blockedCategory}.`);
  } else if (kidsBlocked) {
    verdict = "blocked";
    reasons.push("This offer needs kids on camera, and her rule is no.");
  } else {
    if (categoryWarn && restricted) {
      reasons.push(`Owner override: ${restricted.label} is allowed on this deal. Have a lawyer review it before anyone is contacted.`);
    }
    const floor = kinds.length === 1 ? quotedAskCents(kinds[0], rateFor(rules.minRates, kinds), offer) : rateFor(rules.minRates, kinds);
    if (rules.minDealCents != null && offer.amountCents != null && offer.amountCents < rules.minDealCents) {
      verdict = "below";
      moneyReasons.push(`The offer is under her ${formatMoney(rules.minDealCents)} minimum.`);
      reasons.push("The offer is under her minimum deal value.");
    }
    if (floor > 0 && offer.amountCents != null && offer.amountCents < floor) {
      verdict = "below";
      moneyReasons.push(`The offer is under her ${formatMoney(floor)} rate for this deliverable.`);
      reasons.push("The offer is under her rate for this deliverable.");
    }
    if (rules.exclusivityMaxDays != null && (offer.exclusivityDays ?? 0) > rules.exclusivityMaxDays) {
      verdict = "below";
      reasons.push("The exclusivity is longer than she allows.");
    }
    if (rules.maxDealsPerMonth != null && input.openDeals >= rules.maxDealsPerMonth) {
      verdict = "below";
      reasons.push("She is already at her monthly deal cap.");
    }
    if (verdict === "meets") reasons.push("The offer clears her rules.");
  }
  if (input.nicheHit) reasons.push("A niche matches this offer.");

  const catalog = input.addons ?? DEFAULT_ADDONS.map((item) => ({ id: item.id, cents: item.cents }));
  const usageAsked = (offer.usageText ?? "").toLowerCase();
  const usageDays = Number(usageAsked.match(/(\d+)\s*-?\s*day/)?.[1] ?? 0);
  const addonCents = catalog
    .filter((item) => {
      if (item.id === "usage") return usageDays > (rules.usageMinDays ?? 30) || /spark|paid ads|whitelisting/.test(usageAsked);
      if (item.id === "exclusivity") return (offer.exclusivityDays ?? 0) > 0 || usageAsked.includes("exclusiv");
      if (item.id === "rush") return Boolean(offer.rush) || /rush|asap/.test(haystack);
      return false;
    })
    .reduce((sum, item) => sum + item.cents, 0);
  const target = kinds.length === 1 ? quotedAskCents(kinds[0], rateFor(rules.targetRates, kinds), offer) : rateFor(rules.targetRates, kinds);
  const minimum = kinds.length === 1 ? quotedAskCents(kinds[0], rateFor(rules.minRates, kinds), offer) : rateFor(rules.minRates, kinds);
  const base = Math.max(target, input.bestPastCents ?? 0, minimum);
  const suggestedAskCents = base + addonCents;
  const counterCents = verdict === "below" ? Math.max(suggestedAskCents, rules.minDealCents ?? 0, minimum) : null;
  const basis = offer.amountCents ?? suggestedAskCents;
  const feeCents = feeAndPayout(basis).feeCents;
  const minProfitCents = input.minProfitCents ?? DEFAULT_MIN_PROFIT_CENTS;
  const profitWarn = feeCents != null && feeCents < minProfitCents;

  let fit = 35;
  if (input.nicheHit) fit += 15;
  if (verdict === "meets") fit += 25;
  if (verdict === "below") fit += 8;
  if (input.bestPastCents && offer.amountCents != null && offer.amountCents >= input.bestPastCents) fit += 10;
  if (verdict === "blocked") fit = 8;
  fit = Math.max(0, Math.min(100, fit));

  return {
    verdict,
    fit,
    reasons,
    moneyReasons,
    suggestedAskCents,
    counterCents,
    feeCents,
    profitWarn,
    minProfitCents,
    categoryWarn,
  };
}

export function presentScreening(viewer: Pick<Viewer, "role" | "permissions">, full: Screening) {
  const owner = viewer.role === "admin";
  const priced = owner || Boolean(viewer.permissions?.canPriceDeals);
  const reasons = [...full.reasons];
  if (priced) reasons.push(...full.moneyReasons);
  if (owner && full.profitWarn) {
    reasons.push(`20% of this deal is under the ${formatMoney(full.minProfitCents)} agency minimum.`);
  }
  return {
    verdict: full.verdict,
    verdictLabel: full.verdict === "meets" ? "Meets rules" : full.verdict === "below" ? "Below floor" : "Blocked",
    fit: full.fit,
    reasons,
    suggestedAskCents: priced ? full.suggestedAskCents : null,
    counterCents: priced ? full.counterCents : null,
    feeCents: owner ? full.feeCents : null,
    profitWarn: owner ? full.profitWarn : false,
    minProfitCents: owner ? full.minProfitCents : null,
    categoryWarn: full.categoryWarn,
  };
}

function asRules(value: Partial<DealRules> | null | undefined): DealRules {
  return {
    ...EMPTY,
    ...value,
    minRates: value?.minRates ?? {},
    targetRates: value?.targetRates ?? {},
    blockedCategories: value?.blockedCategories ?? [],
    blockedBrands: value?.blockedBrands ?? [],
    acceptedCategories: value?.acceptedCategories ?? [],
    typicalRateCents: value?.typicalRateCents ?? null,
    acceptGifted: Boolean(value?.acceptGifted),
    acceptCommissionOnly: Boolean(value?.acceptCommissionOnly),
  };
}

export async function savedRules(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorDealRules).where(eq(creatorDealRules.creatorId, creatorId));
  if (!rows[0]) return null;
  try {
    return asRules(JSON.parse(rows[0].rulesJson) as Partial<DealRules>);
  } catch {
    return asRules(null);
  }
}

export async function pricingFloor(db: PortalDb) {
  const rows = await db.select().from(pricingSettings).where(eq(pricingSettings.id, "default"));
  return rows[0]?.minAgencyProfitCents ?? DEFAULT_MIN_PROFIT_CENTS;
}

export async function savePricingFloor(db: PortalDb, viewer: Viewer, cents: number) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can set the agency minimum." };
  if (!Number.isInteger(cents) || cents < 0) return { ok: false as const, error: "Enter the minimum profit in dollars." };
  const timestamp = nowIso();
  const existing = await db.select().from(pricingSettings).where(eq(pricingSettings.id, "default"));
  const values = {
    id: "default",
    minAgencyProfitCents: cents,
    catalogJson: existing[0]?.catalogJson ?? JSON.stringify(DEFAULT_ADDONS),
    updatedAt: timestamp,
  };
  if (existing[0]) await db.update(pricingSettings).set(values).where(eq(pricingSettings.id, "default"));
  else await db.insert(pricingSettings).values(values);
  return { ok: true as const };
}

async function assigned(db: PortalDb, viewer: Viewer) {
  if (viewer.assignedCreatorIds) return viewer.assignedCreatorIds;
  if (!viewer.managerId) return [];
  return assignedCreatorIds(db, viewer.managerId);
}

export async function canViewRules(db: PortalDb, viewer: Viewer, creatorId: string) {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "manager") return false;
  return (await assigned(db, viewer)).includes(creatorId);
}

export function canEditRules(viewer: Viewer) {
  return viewer.role === "admin" || (viewer.role === "manager" && Boolean(viewer.permissions?.canPriceDeals));
}

export async function prefillDealRules(db: PortalDb, creatorId: string): Promise<DealRules> {
  const quiz = await questionnaireFor(db, creatorId);
  const rules = asRules(null);
  rules.blockedBrands = [...quiz.answers.blocked];
  rules.blockedCategories = [];
  rules.turnaround = quiz.answers.turnaround;
  rules.kidsOnCamera = quiz.answers.onCamera === "Yes" ? "yes" : quiz.answers.onCamera === "No" ? "no" : quiz.answers.onCamera === "With limits" ? "limits" : "";
  for (const [label, raw] of Object.entries(quiz.answers.rates)) {
    const cents = dollarsToCents(raw);
    const kind = deliverableKind(label);
    if (cents == null || !kind) continue;
    rules.minRates[kind] = cents;
    rules.targetRates[kind] = cents;
  }
  const history = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  for (const deal of history) {
    const stage = getDealStage(deal.workflowStage);
    const accepted = (stage?.order ?? 0) >= 3 && deal.workflowStage !== "creator_declined" && deal.rateCents;
    if (!accepted || !deal.rateCents) continue;
    let parsed: string[] = [];
    try {
      const value = JSON.parse(deal.deliverablesJson) as unknown;
      parsed = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch {
      parsed = [];
    }
    for (const kind of kindsIn(parsed)) {
      rules.targetRates[kind] = Math.max(rules.targetRates[kind] ?? 0, deal.rateCents);
    }
  }
  return rules;
}

export async function rulesFor(db: PortalDb, creatorId: string) {
  return (await savedRules(db, creatorId)) ?? prefillDealRules(db, creatorId);
}

export async function categoryOverrideFor(db: PortalDb, dealId: string) {
  const rows = await db.select().from(dealCategoryOverrides).where(eq(dealCategoryOverrides.dealId, dealId));
  return Boolean(rows[0]?.overridden);
}

export async function setCategoryOverride(db: PortalDb, viewer: Viewer, dealId: string, overridden: boolean) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can override a sponsor category." };
  const deal = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!deal[0]) return { ok: false as const, error: "That deal is not on the list." };
  const values = { dealId, overridden, updatedAt: nowIso() };
  const existing = await db.select().from(dealCategoryOverrides).where(eq(dealCategoryOverrides.dealId, dealId));
  if (existing[0]) await db.update(dealCategoryOverrides).set(values).where(eq(dealCategoryOverrides.dealId, dealId));
  else await db.insert(dealCategoryOverrides).values(values);
  return { ok: true as const };
}

export async function writeDealRules(db: PortalDb, creatorId: string, rules: DealRules) {
  const timestamp = nowIso();
  const values = { creatorId, rulesJson: JSON.stringify(asRules(rules)), updatedAt: timestamp };
  const existing = await db.select().from(creatorDealRules).where(eq(creatorDealRules.creatorId, creatorId));
  if (existing[0]) await db.update(creatorDealRules).set(values).where(eq(creatorDealRules.creatorId, creatorId));
  else await db.insert(creatorDealRules).values(values);
}

export async function saveDealRules(db: PortalDb, viewer: Viewer, creatorId: string, rules: DealRules) {
  if (!(await canViewRules(db, viewer, creatorId)) || !canEditRules(viewer)) {
    return { ok: false as const, error: "You can't edit these deal rules." };
  }
  await writeDealRules(db, creatorId, rules);
  return { ok: true as const };
}

export async function applyQuestionnaireRates(
  db: PortalDb,
  creatorId: string,
  answers: {
    minVideo?: string;
    typicalRate?: string;
    maxSponsored?: string;
    willDo?: string[];
    wontDo?: string[];
    acceptGifted?: string;
    acceptCommissionOnly?: string;
    rates?: Record<string, string>;
  },
) {
  const current = (await savedRules(db, creatorId)) ?? asRules(null);
  const next = asRules({
    ...current,
    minRates: { ...current.minRates },
    targetRates: { ...current.targetRates },
    blockedCategories: [...current.blockedCategories],
    blockedBrands: [...current.blockedBrands],
    acceptedCategories: [...(current.acceptedCategories ?? [])],
  });
  const minVideo = dollarsToCents(answers.minVideo ?? "");
  if (minVideo != null) next.minDealCents = minVideo;
  const typical = dollarsToCents(answers.typicalRate ?? "");
  if (typical != null) next.typicalRateCents = typical;
  const cap = Number(answers.maxSponsored ?? "");
  if ((answers.maxSponsored ?? "").trim() && Number.isInteger(cap) && cap >= 0) next.maxDealsPerMonth = cap;
  if (answers.willDo?.length) next.acceptedCategories = answers.willDo;
  if (answers.wontDo?.length) next.blockedCategories = answers.wontDo;
  if (answers.acceptGifted === "yes" || answers.acceptGifted === "no") next.acceptGifted = answers.acceptGifted === "yes";
  if (answers.acceptCommissionOnly === "yes" || answers.acceptCommissionOnly === "no") {
    next.acceptCommissionOnly = answers.acceptCommissionOnly === "yes";
  }
  for (const [label, raw] of Object.entries(answers.rates ?? {})) {
    const cents = dollarsToCents(raw);
    const kind = deliverableKind(label);
    if (cents == null || !kind) continue;
    next.minRates[kind] = cents;
  }
  await writeDealRules(db, creatorId, next);
  return next;
}

export function videoMinimumCents(rules: DealRules, deliverables: string[]) {
  const kinds = kindsIn(deliverables);
  const platform = kinds.map((kind) => rules.minRates[kind] ?? 0).filter((value) => value > 0);
  const platformFloor = platform.length ? Math.max(...platform) : 0;
  const floor = Math.max(rules.minDealCents ?? 0, platformFloor);
  return floor > 0 ? floor : null;
}

export async function creatorKnowledge(db: PortalDb, creatorId: string) {
  const people = await db.select().from(creators).where(eq(creators.id, creatorId));
  const person = people[0];
  if (!person) return null;
  const rules = await rulesFor(db, creatorId);
  return {
    creatorId: person.id,
    name: person.name,
    minimumPerVideoCents: rules.minDealCents,
    platformMinimums: rules.minRates,
    typicalRateCents: rules.typicalRateCents ?? null,
    maxSponsoredPostsPerMonth: rules.maxDealsPerMonth,
    categoriesWillDo: rules.acceptedCategories ?? [],
    categoriesWontDo: rules.blockedCategories,
    acceptGifted: Boolean(rules.acceptGifted),
    acceptCommissionOnly: Boolean(rules.acceptCommissionOnly),
    blockedBrands: rules.blockedBrands,
    turnaround: rules.turnaround,
  };
}

export async function bestPastCents(db: PortalDb, creatorId: string, kinds: DeliverableId[]) {
  const history = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  let best = 0;
  for (const deal of history) {
    const stage = getDealStage(deal.workflowStage);
    if ((stage?.order ?? 0) < 3 || deal.workflowStage === "creator_declined" || !deal.rateCents) continue;
    let parsed: string[] = [];
    try {
      const value = JSON.parse(deal.deliverablesJson) as unknown;
      parsed = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch {
      parsed = [];
    }
    const dealKinds = kindsIn(parsed);
    if (kinds.length && !kinds.some((kind) => dealKinds.includes(kind))) continue;
    best = Math.max(best, deal.rateCents);
  }
  return best || null;
}

export async function screeningForDeal(db: PortalDb, viewer: Viewer, dealId: string) {
  if (viewer.role === "creator") return null;
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = rows[0];
  if (!deal) return null;
  if (!(await canViewRules(db, viewer, deal.creatorId))) return null;
  if (deal.workflowStage !== "offer_received" && deal.workflowStage !== "offer_shared") return null;
  const rules = await rulesFor(db, deal.creatorId);
  let deliverables: string[] = [];
  try {
    const value = JSON.parse(deal.deliverablesJson) as unknown;
    deliverables = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    deliverables = [];
  }
  const kinds = kindsIn([...deliverables, deal.subtitle ?? ""]);
  const quiz = await questionnaireFor(db, deal.creatorId);
  const subtitle = (deal.subtitle ?? "").toLowerCase();
  const nicheHit = quiz.answers.niches.some((niche) => subtitle.includes(niche.toLowerCase()));
  const openDeals = (await db.select().from(deals).where(eq(deals.creatorId, deal.creatorId)))
    .filter((row) => row.id !== deal.id && row.status !== "paid" && row.workflowStage !== "creator_declined").length;
  const usage = deal.usageRights ?? "";
  const full = screenOffer({
    rules,
    offer: {
      brand: deal.brand,
      subtitle: deal.subtitle,
      amountCents: deal.rateCents,
      deliverables,
      usageText: usage,
      exclusivityDays: /exclusiv/i.test(usage) ? 30 : null,
      rush: /rush|asap/i.test(`${deal.subtitle ?? ""} ${usage}`),
      kidsOnCamera: /kid|child/i.test(`${deal.subtitle ?? ""} ${deliverables.join(" ")}`),
    },
    categoryOverride: await categoryOverrideFor(db, deal.id),
    bestPastCents: await bestPastCents(db, deal.creatorId, kinds),
    nicheHit,
    openDeals,
    minProfitCents: await pricingFloor(db),
  });
  return presentScreening(viewer, full);
}
