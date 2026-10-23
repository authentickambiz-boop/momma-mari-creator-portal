import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  approvalEvents,
  brandBillingTerms,
  creators,
  dealDepositEvents,
  dealDeposits,
  dealPaymentTiming,
  deals,
  payments,
} from "@/db/schema";
import { canSeeDeal, isOwner } from "./authz";
import { BRAND_EMAIL_SENDER } from "./approvals";
import { brandKey } from "./brand-crm";
import { isFakeCalendarDay } from "./deadlines";
import { agencyTimeZone, nowIso } from "./format";
import { getDealStage } from "./stages";
import type { Viewer } from "./types";

/**
 * Kamron's Oct 21, 2026 rule.
 * A first-time brand pays 50% by manual invoice before the creator films, and the rest on posting.
 * One paid-on-time deal lets the owner move that brand to Net 30.
 * A Net 30 brand that pays more than 10 days late is flagged. Nothing switches on its own.
 * Gifted and unpaid deals are left out. Invoices stay manual.
 */

export const FILMING_LOCK_MESSAGE = "Waiting on the brand's deposit; you'll get a go-ahead once it lands";

/** First content stage. Draft due is where filming starts. */
const FILMING_ORDER = 15;
/** Waiting on product is the step just before filming. */
const PRODUCT_WAIT_ORDER = 13;

export const DEPOSIT_STATUSES = ["not_requested", "invoiced", "received", "not_required"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const BILLING_TERMS = ["deposit_first", "net_30"] as const;
export type BillingTerms = (typeof BILLING_TERMS)[number];

const OWNER_STATUSES = ["not_requested", "invoiced", "received"] as const;

const STATUS_LABELS: Record<DepositStatus, string> = {
  not_requested: "Not requested",
  invoiced: "Invoiced",
  received: "Received",
  not_required: "Not required",
};

const GIFT = /\bgift(?:ed)?\b|\bunpaid\b|\baffiliate\b|\bproduct only\b/i;

export const DEPOSIT_ERRORS = {
  forbidden: "Only the owner can update a deposit.",
  missing: "Deal not found.",
  status: "Choose not requested, invoiced, or received.",
  date: "Use a real date like 2026-10-21.",
  reason: "Add the reason for the override.",
  gifted: "This deal does not need a deposit.",
  ineligible: "This brand needs one paid-on-time deal before Net 30.",
  terms: "Choose deposit first or Net 30.",
  timing: "Enter the due date and the date the brand paid.",
  brand: "Name the brand.",
} as const;

type DepositCode = keyof typeof DEPOSIT_ERRORS;
type Fail = { ok: false; status: number; error: string; code: DepositCode };

export type DealDepositView = {
  status: DepositStatus;
  statusLabel: string;
  /** Null for creators and managers. The amount is half the brand total. */
  amountCents: number | null;
  invoicedOn: string | null;
  receivedOn: string | null;
  filmingLocked: boolean;
  lockMessage: string | null;
  overrideReason: string | null;
};

export type DepositWaiting = {
  dealId: string;
  brand: string;
  dealLabel: string;
  amountCents: number | null;
  invoicedOn: string | null;
  daysSinceInvoiced: number | null;
};

export type BrandBilling = {
  key: string;
  brand: string;
  terms: BillingTerms;
  eligible: boolean;
  lateFlag: boolean;
  paidOnTimeCount: number;
  lateCount: number;
};

type DealMoney = {
  id: string;
  creatorId: string;
  brand: string;
  subtitle?: string | null;
  visibleToCreator: boolean;
  workflowStage?: string | null;
  rateCents?: number | null;
  pipelineCents?: number | null;
  paymentTerms?: string | null;
  rateLabel?: string | null;
  amountDisplay?: string | null;
};

function fail(status: number, code: DepositCode): Fail {
  return { ok: false, status, error: DEPOSIT_ERRORS[code], code };
}

export function depositHalfCents(totalCents: number) {
  return Math.round(totalCents / 2);
}

export function brandDealTotalCents(deal: { rateCents?: number | null; pipelineCents?: number | null }, owedCents?: number | null) {
  if (deal.rateCents != null && deal.rateCents > 0) return deal.rateCents;
  if (deal.pipelineCents != null && deal.pipelineCents > 0) return deal.pipelineCents;
  if (owedCents != null && owedCents > 0) return owedCents;
  return null;
}

export function isGiftedOrUnpaidDeal(
  deal: { rateCents?: number | null; pipelineCents?: number | null; paymentTerms?: string | null; rateLabel?: string | null; amountDisplay?: string | null },
  owedCents?: number | null,
) {
  const text = `${deal.paymentTerms ?? ""} ${deal.rateLabel ?? ""} ${deal.amountDisplay ?? ""}`;
  if (GIFT.test(text)) return true;
  return brandDealTotalCents(deal, owedCents) == null;
}

export function depositToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: agencyTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function calendarDaysBetween(earlier: string, later: string) {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function cleanDay(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || isFakeCalendarDay(trimmed)) return null;
  return trimmed;
}

export function effectiveDepositStatus(input: { gifted: boolean; terms: BillingTerms; stored: string | null }): DepositStatus {
  if (input.gifted || input.terms === "net_30") return "not_required";
  if (input.stored === "received" || input.stored === "invoiced" || input.stored === "not_requested") return input.stored;
  return "not_requested";
}

export function depositLocksFilming(input: { status: DepositStatus; tracked: boolean; overrideReason: string | null }) {
  if (!input.tracked) return false;
  if (input.status === "not_required" || input.status === "received") return false;
  if (input.overrideReason?.trim()) return false;
  return input.status === "not_requested" || input.status === "invoiced";
}

function isBillingTerms(value: string): value is BillingTerms {
  return (BILLING_TERMS as readonly string[]).includes(value);
}

async function loadDeal(db: PortalDb, dealId: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  return rows[0] ?? null;
}

async function owedCents(db: PortalDb, dealId: string) {
  const rows = await db.select({ amountOwedCents: payments.amountOwedCents }).from(payments).where(eq(payments.dealId, dealId));
  return rows[0]?.amountOwedCents ?? null;
}

async function storedTerms(db: PortalDb, key: string): Promise<BillingTerms> {
  const rows = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, key));
  const terms = rows[0]?.terms;
  return terms === "net_30" ? "net_30" : "deposit_first";
}

/** Terms a public inquiry will use. A missing row means deposit first. This does not write. */
export async function inquiryBillingTerms(db: PortalDb, brand: string): Promise<BillingTerms> {
  return storedTerms(db, brandKey(brand));
}

/**
 * Stores deposit-first terms when the brand has no billing row yet.
 * Deposit first means 50% before filming and 50% when the content posts.
 * #192 does not mark a returning brand as Net 30 on its own. An owner-set row is left as stored.
 */
export async function storeInquiryBillingTerms(db: PortalDb, brand: string): Promise<BillingTerms> {
  const key = brandKey(brand);
  if (!key) return "deposit_first";
  const rows = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, key));
  if (rows[0]) return rows[0].terms === "net_30" ? "net_30" : "deposit_first";
  await db.insert(brandBillingTerms).values({
    brandKey: key,
    terms: "deposit_first",
    updatedBy: "inquiry",
    updatedAt: nowIso(),
  });
  return "deposit_first";
}

async function depositRow(db: PortalDb, dealId: string) {
  const rows = await db.select().from(dealDeposits).where(eq(dealDeposits.dealId, dealId));
  return rows[0] ?? null;
}

async function logEvent(
  db: PortalDb,
  input: { dealId: string; action: string; fromStatus?: string | null; toStatus?: string | null; reason?: string | null; actorEmail: string },
) {
  await db.insert(dealDepositEvents).values({
    id: crypto.randomUUID(),
    dealId: input.dealId,
    action: input.action,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    reason: input.reason?.trim() ? input.reason.trim().slice(0, 500) : null,
    actorEmail: input.actorEmail,
    createdAt: nowIso(),
  });
}

function showsMoney(viewer: Viewer) {
  return viewer.role === "admin";
}

function viewFrom(viewer: Viewer, input: {
  status: DepositStatus;
  amountCents: number | null;
  invoicedOn: string | null;
  receivedOn: string | null;
  locked: boolean;
  overrideReason: string | null;
}): DealDepositView {
  const owner = showsMoney(viewer);
  return {
    status: input.status,
    statusLabel: STATUS_LABELS[input.status],
    amountCents: owner ? input.amountCents : null,
    invoicedOn: owner ? input.invoicedOn : null,
    receivedOn: owner ? input.receivedOn : null,
    filmingLocked: input.locked,
    lockMessage: input.locked ? FILMING_LOCK_MESSAGE : null,
    overrideReason: owner ? input.overrideReason : null,
  };
}

export async function depositViewForDeal(db: PortalDb, viewer: Viewer, deal: DealMoney, owed?: number | null): Promise<DealDepositView | null> {
  if (!canSeeDeal(viewer, deal)) return null;
  const gifted = isGiftedOrUnpaidDeal(deal, owed);
  const terms = await storedTerms(db, brandKey(deal.brand));
  const row = await depositRow(db, deal.id);
  const total = brandDealTotalCents(deal, owed);
  const status = effectiveDepositStatus({ gifted, terms, stored: row?.status ?? null });
  const locked = depositLocksFilming({
    status,
    tracked: Boolean(row) && !gifted && terms !== "net_30",
    overrideReason: row?.overrideReason ?? null,
  });
  return viewFrom(viewer, {
    status,
    amountCents: status === "not_required" ? null : (total == null ? null : depositHalfCents(total)),
    invoicedOn: row?.invoicedOn ?? null,
    receivedOn: row?.receivedOn ?? null,
    locked,
    overrideReason: row?.overrideReason ?? null,
  });
}

export async function filmingLockForDeal(db: PortalDb, dealId: string) {
  const deal = await loadDeal(db, dealId);
  if (!deal) return { locked: false, message: null as string | null };
  const owed = await owedCents(db, deal.id);
  const gifted = isGiftedOrUnpaidDeal(deal, owed);
  const terms = await storedTerms(db, brandKey(deal.brand));
  const row = await depositRow(db, deal.id);
  const status = effectiveDepositStatus({ gifted, terms, stored: row?.status ?? null });
  const locked = depositLocksFilming({
    status,
    tracked: Boolean(row) && !gifted && terms !== "net_30",
    overrideReason: row?.overrideReason ?? null,
  });
  return { locked, message: locked ? FILMING_LOCK_MESSAGE : null };
}

/** Creators cannot start filming while a tracked deposit is still out. Staff are not blocked here. */
export async function creatorFilmingBlocked(db: PortalDb, dealId: string, actorRole: string) {
  if (actorRole !== "creator") return null;
  const lock = await filmingLockForDeal(db, dealId);
  if (!lock.locked) return null;
  return { ok: false as const, status: 403, error: FILMING_LOCK_MESSAGE };
}

async function draftGoAhead(db: PortalDb, deal: { id: string; creatorId: string; brand: string }, actorEmail: string) {
  const existing = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, deal.id));
  const pending = existing.find((row) => row.gate === "deposit_go_ahead" && row.status === "pending" && !row.sentAt);
  if (pending) return pending.id;
  const people = await db.select({ email: creators.email }).from(creators).where(eq(creators.id, deal.creatorId));
  const to = people[0]?.email?.trim();
  if (!to) return null;
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const subject = `You can start filming for ${deal.brand}`.slice(0, 180);
  const body = `You can start filming for ${deal.brand}. The deposit landed, and this is your go-ahead.`;
  await db.insert(approvalEmails).values({
    id,
    dealId: deal.id,
    gate: "deposit_go_ahead",
    status: "pending",
    toEmail: to,
    subject,
    body,
    attachmentNote: null,
    attachmentUrl: null,
    fromEmail: BRAND_EMAIL_SENDER,
    gmailThreadId: null,
    gmailMessageId: null,
    sentAt: null,
    brandContactName: null,
    brandContactEmail: null,
    brandContactCompany: deal.brand,
    suggestedCreatorId: null,
    suggestedPlan: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(approvalEvents).values({
    id: crypto.randomUUID(),
    approvalId: id,
    action: "created",
    actorEmail,
    actorRole: "admin",
    subject,
    body,
    note: "Draft only. Nothing was sent.",
    createdAt: timestamp,
  });
  return id;
}

/** Opens deposit tracking for a paid, deposit-first deal that has not started filming. */
export async function ensureDealDeposit(db: PortalDb, dealId: string) {
  const deal = await loadDeal(db, dealId);
  if (!deal) return;
  if (await depositRow(db, deal.id)) return;
  const owed = await owedCents(db, deal.id);
  if (isGiftedOrUnpaidDeal(deal, owed)) return;
  const terms = await storedTerms(db, brandKey(deal.brand));
  if (terms === "net_30") return;
  const order = getDealStage(deal.workflowStage)?.order ?? null;
  if (order == null || order >= FILMING_ORDER) return;
  const timestamp = nowIso();
  const total = brandDealTotalCents(deal, owed);
  await db.insert(dealDeposits).values({
    dealId: deal.id,
    status: "not_requested",
    amountCents: total == null ? null : depositHalfCents(total),
    invoicedOn: null,
    receivedOn: null,
    overrideReason: null,
    overrideBy: null,
    overrideAt: null,
    updatedBy: "portal",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function ensureCreatorDeposits(db: PortalDb, creatorId: string) {
  const rows = await db.select({ id: deals.id }).from(deals).where(eq(deals.creatorId, creatorId));
  for (const row of rows) await ensureDealDeposit(db, row.id);
}

export async function ensureOpenDeposits(db: PortalDb) {
  const rows = await db.select({ id: deals.id }).from(deals);
  for (const row of rows) await ensureDealDeposit(db, row.id);
}

export async function setDealDepositStatus(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; status: string; invoicedOn?: string | null; receivedOn?: string | null; today?: string },
): Promise<{ ok: true; status: DepositStatus; approvalId: string | null } | Fail> {
  if (!isOwner(viewer)) return fail(403, "forbidden");
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return fail(404, "missing");
  const owed = await owedCents(db, deal.id);
  if (isGiftedOrUnpaidDeal(deal, owed)) return fail(400, "gifted");
  const terms = await storedTerms(db, brandKey(deal.brand));
  if (terms === "net_30") return fail(400, "gifted");
  if (!(OWNER_STATUSES as readonly string[]).includes(input.status)) return fail(400, "status");
  const status = input.status as (typeof OWNER_STATUSES)[number];
  const today = input.today ?? depositToday();
  const invoicedGiven = cleanDay(input.invoicedOn);
  const receivedGiven = cleanDay(input.receivedOn);
  if (invoicedGiven === null || receivedGiven === null) return fail(400, "date");
  const current = await depositRow(db, deal.id);
  let invoicedOn = current?.invoicedOn ?? null;
  let receivedOn = current?.receivedOn ?? null;
  if (status === "not_requested") {
    invoicedOn = null;
    receivedOn = null;
  } else if (status === "invoiced") {
    invoicedOn = invoicedGiven || today;
    receivedOn = null;
  } else {
    receivedOn = receivedGiven || today;
    if (invoicedGiven) invoicedOn = invoicedGiven;
  }
  const timestamp = nowIso();
  const total = brandDealTotalCents(deal, owed);
  const amountCents = total == null ? null : depositHalfCents(total);
  const next = {
    status,
    amountCents,
    invoicedOn,
    receivedOn,
    overrideReason: null,
    overrideBy: null,
    overrideAt: null,
    updatedBy: viewer.email,
    updatedAt: timestamp,
  };
  if (current) await db.update(dealDeposits).set(next).where(eq(dealDeposits.dealId, deal.id));
  else {
    await db.insert(dealDeposits).values({
      ...next,
      dealId: deal.id,
      createdAt: timestamp,
    });
  }
  await logEvent(db, {
    dealId: deal.id,
    action: "status",
    fromStatus: current?.status ?? null,
    toStatus: status,
    actorEmail: viewer.email,
  });
  let approvalId: string | null = null;
  if (status === "received" && current?.status !== "received") {
    approvalId = await draftGoAhead(db, deal, viewer.email);
  }
  return { ok: true, status, approvalId };
}

export async function overrideDepositLock(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; reason: string },
): Promise<{ ok: true } | Fail> {
  if (!isOwner(viewer)) return fail(403, "forbidden");
  const reason = input.reason.trim();
  if (!reason) return fail(400, "reason");
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return fail(404, "missing");
  const owed = await owedCents(db, deal.id);
  if (isGiftedOrUnpaidDeal(deal, owed)) return fail(400, "gifted");
  const terms = await storedTerms(db, brandKey(deal.brand));
  if (terms === "net_30") return fail(400, "gifted");
  await ensureDealDeposit(db, deal.id);
  const current = await depositRow(db, deal.id);
  if (!current) return fail(400, "gifted");
  if (current.status === "received") return { ok: true };
  const timestamp = nowIso();
  await db.update(dealDeposits).set({
    overrideReason: reason.slice(0, 500),
    overrideBy: viewer.email,
    overrideAt: timestamp,
    updatedBy: viewer.email,
    updatedAt: timestamp,
  }).where(eq(dealDeposits.dealId, deal.id));
  await logEvent(db, {
    dealId: deal.id,
    action: "override",
    fromStatus: current.status,
    toStatus: current.status,
    reason,
    actorEmail: viewer.email,
  });
  return { ok: true };
}

export async function listDepositEvents(db: PortalDb, viewer: Viewer, dealId: string) {
  if (!isOwner(viewer)) return [];
  const rows = await db.select().from(dealDepositEvents).where(eq(dealDepositEvents.dealId, dealId));
  return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function timingRows(db: PortalDb) {
  return db.select().from(dealPaymentTiming);
}

async function dealsByBrand(db: PortalDb, key: string) {
  const rows = await db.select().from(deals);
  return rows.filter((deal) => brandKey(deal.brand) === key);
}

export async function brandBillingSummary(db: PortalDb, brand: string): Promise<BrandBilling> {
  const key = brandKey(brand);
  const terms = await storedTerms(db, key);
  const brandDeals = await dealsByBrand(db, key);
  const ids = new Set(brandDeals.map((deal) => deal.id));
  const timing = (await timingRows(db)).filter((row) => ids.has(row.dealId));
  const paidOnTimeCount = timing.filter((row) => row.paidOnTime).length;
  const lateCount = timing.filter((row) => row.daysLate > 10).length;
  return {
    key,
    brand: brandDeals[0]?.brand ?? brand,
    terms,
    eligible: paidOnTimeCount > 0,
    lateFlag: lateCount > 0,
    paidOnTimeCount,
    lateCount,
  };
}

export async function listBrandBilling(db: PortalDb, viewer: Viewer, brands: string[]) {
  if (!isOwner(viewer)) return [];
  const seen = new Set<string>();
  const cards: BrandBilling[] = [];
  for (const brand of brands) {
    const key = brandKey(brand);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cards.push(await brandBillingSummary(db, brand));
  }
  return cards;
}

export async function setBrandBillingTerms(
  db: PortalDb,
  viewer: Viewer,
  input: { brand: string; terms: string },
): Promise<{ ok: true; terms: BillingTerms } | Fail> {
  if (!isOwner(viewer)) return fail(403, "forbidden");
  const brand = input.brand.trim();
  if (!brand) return fail(400, "brand");
  if (!isBillingTerms(input.terms)) return fail(400, "terms");
  const key = brandKey(brand);
  const brandDeals = await dealsByBrand(db, key);
  if (brandDeals.length === 0) return fail(404, "missing");
  if (input.terms === "net_30") {
    const summary = await brandBillingSummary(db, brand);
    if (!summary.eligible) return fail(400, "ineligible");
  }
  const timestamp = nowIso();
  const existing = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, key));
  if (existing[0]) {
    await db.update(brandBillingTerms).set({
      terms: input.terms,
      updatedBy: viewer.email,
      updatedAt: timestamp,
    }).where(eq(brandBillingTerms.brandKey, key));
  } else {
    await db.insert(brandBillingTerms).values({
      brandKey: key,
      terms: input.terms,
      updatedBy: viewer.email,
      updatedAt: timestamp,
    });
  }
  return { ok: true, terms: input.terms };
}

export async function markDealPaymentTiming(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; dueOn: string; paidOn: string },
): Promise<{ ok: true; paidOnTime: boolean; daysLate: number } | Fail> {
  if (!isOwner(viewer)) return fail(403, "forbidden");
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return fail(404, "missing");
  const owed = await owedCents(db, deal.id);
  if (isGiftedOrUnpaidDeal(deal, owed)) return fail(400, "gifted");
  const dueOn = cleanDay(input.dueOn);
  const paidOn = cleanDay(input.paidOn);
  if (!dueOn || !paidOn) return fail(400, "timing");
  const span = calendarDaysBetween(dueOn, paidOn);
  if (span == null) return fail(400, "timing");
  const daysLate = Math.max(0, span);
  const paidOnTime = daysLate === 0;
  const timestamp = nowIso();
  const existing = await db.select().from(dealPaymentTiming).where(eq(dealPaymentTiming.dealId, deal.id));
  const next = {
    dueOn,
    paidOn,
    paidOnTime,
    daysLate,
    markedBy: viewer.email,
    updatedAt: timestamp,
  };
  if (existing[0]) await db.update(dealPaymentTiming).set(next).where(eq(dealPaymentTiming.dealId, deal.id));
  else await db.insert(dealPaymentTiming).values({ ...next, dealId: deal.id, createdAt: timestamp });
  return { ok: true, paidOnTime, daysLate };
}

export async function listDepositsWaiting(db: PortalDb, viewer: Viewer, today = depositToday()): Promise<{ ok: true; deals: DepositWaiting[] } | Fail> {
  if (!isOwner(viewer)) return fail(403, "forbidden");
  const [depositRows, dealRows, paymentRows, termRows] = await Promise.all([
    db.select().from(dealDeposits),
    db.select().from(deals),
    db.select().from(payments),
    db.select().from(brandBillingTerms),
  ]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const owedById = new Map(paymentRows.map((row) => [row.dealId, row.amountOwedCents]));
  const termsByKey = new Map(termRows.map((row) => [row.brandKey, row.terms]));
  const waiting: DepositWaiting[] = [];
  for (const row of depositRows) {
    if (row.status !== "invoiced") continue;
    const deal = dealsById.get(row.dealId);
    if (!deal) continue;
    const owed = owedById.get(deal.id) ?? null;
    if (isGiftedOrUnpaidDeal(deal, owed)) continue;
    if (termsByKey.get(brandKey(deal.brand)) === "net_30") continue;
    const total = brandDealTotalCents(deal, owed);
    const days = row.invoicedOn ? calendarDaysBetween(row.invoicedOn, today) : null;
    waiting.push({
      dealId: deal.id,
      brand: deal.brand,
      dealLabel: deal.subtitle?.trim() || deal.id,
      amountCents: total == null ? null : depositHalfCents(total),
      invoicedOn: row.invoicedOn,
      daysSinceInvoiced: days,
    });
  }
  waiting.sort((left, right) => (right.daysSinceInvoiced ?? -1) - (left.daysSinceInvoiced ?? -1) || left.brand.localeCompare(right.brand));
  return { ok: true, deals: waiting };
}

export async function receivedDepositIds(db: PortalDb, dealIds: string[]) {
  const wanted = new Set(dealIds);
  if (wanted.size === 0) return new Set<string>();
  const [depositRows, dealRows, termRows] = await Promise.all([
    db.select().from(dealDeposits),
    db.select().from(deals),
    db.select().from(brandBillingTerms),
  ]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const termsByKey = new Map(termRows.map((row) => [row.brandKey, row.terms]));
  const cleared = new Set<string>();
  for (const row of depositRows) {
    if (!wanted.has(row.dealId) || row.status !== "received") continue;
    const deal = dealsById.get(row.dealId);
    if (!deal) continue;
    if (termsByKey.get(brandKey(deal.brand)) === "net_30") continue;
    cleared.add(row.dealId);
  }
  return cleared;
}

export async function depositLockTodos(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  const todos: { id: string; title: string; detail: string; dueDate: null; category: "content"; overdue: false; locked: true }[] = [];
  for (const deal of rows) {
    if (!deal.visibleToCreator) continue;
    const order = getDealStage(deal.workflowStage)?.order ?? null;
    if (order == null || order < PRODUCT_WAIT_ORDER) continue;
    const lock = await filmingLockForDeal(db, deal.id);
    if (!lock.locked || !lock.message) continue;
    todos.push({
      id: `deposit-lock-${deal.id}`,
      title: "Start filming",
      detail: lock.message,
      dueDate: null,
      category: "content",
      overdue: false,
      locked: true,
    });
  }
  return todos;
}
