import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { analyticsDaily, creators, deals, drafts, payments, revisions } from "@/db/schema";
import { DEAL_STATUSES, DRAFT_STATUSES, type DealStatus, type DraftStatus } from "./types";
import { AGENCY_COMMISSION_PERCENT, CREATOR_PAYOUT_PERCENT, feeAndPayout, normalizeEmail, nowIso, safeEqual } from "./format";
import { createApprovalEmail, listSendableApprovals, markApprovalSent } from "./approvals";
import { isFakeCalendarDay } from "./deadlines";
import { setDealStage } from "./deal-stage";
import { isPaymentStatus } from "./fulfillment";
import { findCreatorByEmail, findCreatorById } from "./queries";
import { holdForOwnerReview } from "./deal-review";
import { isDealStage, workflowStageForLegacy, workflowStageForVideoStep } from "./stages";

export function authorizeBot(header: string | null) {
  const expected = process.env.BOT_API_TOKEN;
  if (!expected) {
    return { ok: false as const, status: 503, body: { error: "Bot API token is not configured." } };
  }
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match || !safeEqual(match[1], expected)) {
    return { ok: false as const, status: 401, body: { error: "Missing or invalid bearer token." } };
  }
  return { ok: true as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function addFeedback(db: PortalDb, dealId: string, body: unknown) {
  if (!isRecord(body) || typeof body.summary !== "string" || !body.summary.trim()) {
    return { status: 400, body: { error: "summary is required." } };
  }
  const source = typeof body.source === "string" ? body.source : "bot";
  if (!["brand", "us", "bot"].includes(source)) {
    return { status: 400, body: { error: "source must be brand, us, or bot." } };
  }
  if (typeof body.draftStatus === "string" && !DRAFT_STATUSES.includes(body.draftStatus as DraftStatus)) {
    return { status: 400, body: { error: "draftStatus is not a known draft status." } };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!dealRows[0]) return { status: 404, body: { error: "Deal not found." } };
  const existing = await db.select().from(revisions).where(eq(revisions.dealId, dealId));
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt : nowIso();
  const occurredLabel = typeof body.occurredLabel === "string" && body.occurredLabel.trim()
    ? body.occurredLabel.trim()
    : occurredAt.slice(0, 16).replace("T", " ");
  const id = crypto.randomUUID();
  await db.insert(revisions).values({
    id,
    dealId,
    draftId: typeof body.draftId === "string" ? body.draftId : null,
    occurredLabel,
    occurredAt,
    source,
    summary: body.summary.trim(),
    emailUrl: typeof body.emailUrl === "string" ? body.emailUrl : null,
    sortOrder,
    isSeed: false,
    createdAt: nowIso(),
  });
  if (typeof body.draftStatus === "string" && typeof body.draftId === "string") {
    await db.update(drafts).set({ status: body.draftStatus }).where(eq(drafts.id, body.draftId));
  }
  return { status: 201, body: { id, dealId, sortOrder, source, summary: body.summary.trim() } };
}

export async function updateDeal(db: PortalDb, dealId: string, body: unknown) {
  if (!isRecord(body)) return { status: 400, body: { error: "Expected a JSON object." } };
  const existing = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!existing[0]) return { status: 404, body: { error: "Deal not found." } };
  const patch: Partial<typeof deals.$inferInsert> = { updatedAt: nowIso() };
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !DEAL_STATUSES.includes(body.status as DealStatus)) {
      return { status: 400, body: { error: `status must be one of ${DEAL_STATUSES.join(", ")}.` } };
    }
    patch.status = body.status;
  }
  if (typeof body.visibleToCreator === "boolean") patch.visibleToCreator = body.visibleToCreator;
  if (typeof body.nextStep === "string") patch.nextStep = body.nextStep;
  if (typeof body.botMessage === "string") patch.botMessage = body.botMessage;
  if (body.stage === null) patch.stage = null;
  if (typeof body.stage === "number") patch.stage = body.stage;
  if (typeof body.uploadEnabled === "boolean") patch.uploadEnabled = body.uploadEnabled;
  if (typeof body.gmailThreadId === "string") patch.gmailThreadId = body.gmailThreadId;
  if (typeof body.kamronNotes === "string") patch.kamronNotes = body.kamronNotes;

  const requestedStage = typeof body.workflowStage === "string"
    ? body.workflowStage
    : typeof body.stage === "number"
      ? workflowStageForVideoStep(body.stage)
      : null;
  if (typeof body.workflowStage === "string" && !isDealStage(body.workflowStage)) {
    return { status: 400, body: { error: "workflowStage is not a known deal stage." } };
  }
  if (requestedStage) {
    const moved = await setDealStage(db, {
      dealId,
      toStage: requestedStage,
      actorEmail: "bot",
      actorRole: "bot",
      note: typeof body.stageNote === "string" ? body.stageNote : null,
    });
    if (!moved.ok) return { status: moved.status, body: { error: moved.error } };
  }

  await db.update(deals).set(patch).where(eq(deals.id, dealId));
  const updated = await db.select().from(deals).where(eq(deals.id, dealId));
  return {
    status: 200,
    body: {
      id: dealId,
      status: updated[0]?.status,
      visibleToCreator: updated[0]?.visibleToCreator,
      workflowStage: updated[0]?.workflowStage,
    },
  };
}

export async function upsertDeal(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.id !== "string" || typeof body.brand !== "string") {
    return { status: 400, body: { error: "id and brand are required." } };
  }
  const creator = typeof body.creatorEmail === "string"
    ? await findCreatorByEmail(db, body.creatorEmail)
    : typeof body.creatorId === "string"
      ? await findCreatorById(db, body.creatorId)
      : null;
  if (!creator) return { status: 404, body: { error: "Creator not found. Upsert the creator first." } };
  const existing = await db.select().from(deals).where(eq(deals.id, body.id));
  const timestamp = nowIso();
  const base = {
    creatorId: creator.id,
    brand: body.brand,
    updatedAt: timestamp,
  };
  const optional: Partial<typeof deals.$inferInsert> = {};
  const textFields = [
    "subtitle",
    "contact",
    "gmailThreadId",
    "amountDisplay",
    "rateLabel",
    "pipelineName",
    "usageRights",
    "brief",
    "briefUrl",
    "draftDue",
    "postDate",
    "paymentTerms",
    "kamronNotes",
    "nextStep",
    "botMessage",
    "uploadLabel",
    "earningsChipText",
    "earningsChipTone",
  ] as const;
  const columnMap: Record<(typeof textFields)[number], keyof typeof deals.$inferInsert> = {
    subtitle: "subtitle",
    contact: "contact",
    gmailThreadId: "gmailThreadId",
    amountDisplay: "amountDisplay",
    rateLabel: "rateLabel",
    pipelineName: "pipelineName",
    usageRights: "usageRights",
    brief: "brief",
    briefUrl: "briefUrl",
    draftDue: "draftDue",
    postDate: "postDate",
    paymentTerms: "paymentTerms",
    kamronNotes: "kamronNotes",
    nextStep: "nextStep",
    botMessage: "botMessage",
    uploadLabel: "uploadLabel",
    earningsChipText: "earningsChipText",
    earningsChipTone: "earningsChipTone",
  };
  for (const field of ["draftDue", "postDate"] as const) {
    const value = body[field];
    if (typeof value === "string" && isFakeCalendarDay(value.trim())) {
      return { status: 400, body: { error: `${field} must be a real day like 2026-11-20.` } };
    }
  }
  for (const field of textFields) {
    if (typeof body[field] === "string") optional[columnMap[field]] = body[field] as never;
  }
  if (typeof body.status === "string") {
    if (!DEAL_STATUSES.includes(body.status as DealStatus)) {
      return { status: 400, body: { error: `status must be one of ${DEAL_STATUSES.join(", ")}.` } };
    }
    optional.status = body.status;
  }
  if (typeof body.rateCents === "number") optional.rateCents = body.rateCents;
  if (typeof body.pipelineCents === "number") optional.pipelineCents = body.pipelineCents;
  if (Array.isArray(body.deliverables)) optional.deliverablesJson = JSON.stringify(body.deliverables);
  if (Array.isArray(body.chips)) optional.chipsJson = JSON.stringify(body.chips);
  if (typeof body.visibleToCreator === "boolean") optional.visibleToCreator = body.visibleToCreator;
  if (typeof body.uploadEnabled === "boolean") optional.uploadEnabled = body.uploadEnabled;
  if (typeof body.needsCreator === "boolean") optional.needsCreator = body.needsCreator;
  if (typeof body.stage === "number") optional.stage = body.stage;
  if (typeof body.workflowStage === "string" && !isDealStage(body.workflowStage)) {
    return { status: 400, body: { error: "workflowStage is not a known deal stage." } };
  }
  if (existing[0]) {
    await db.update(deals).set({ ...base, ...optional }).where(eq(deals.id, body.id));
    if (typeof body.workflowStage === "string") {
      const moved = await setDealStage(db, {
        dealId: body.id,
        toStage: body.workflowStage,
        actorEmail: "bot",
        actorRole: "bot",
      });
      if (!moved.ok) return { status: moved.status, body: { error: moved.error } };
      await reapplyExplicitDealFlags(db, body.id, optional);
    }
    return { status: 200, body: { id: body.id, created: false } };
  }
  const maxSort = await db.select({ sortOrder: deals.sortOrder }).from(deals).orderBy(asc(deals.sortOrder));
  const sortOrder = (maxSort.at(-1)?.sortOrder ?? 0) + 1;
  await db.insert(deals).values({
    id: body.id,
    creatorId: creator.id,
    brand: body.brand,
    status: optional.status ?? "pitch",
    deliverablesJson: optional.deliverablesJson ?? "[]",
    chipsJson: optional.chipsJson ?? "[]",
    visibleToCreator: optional.visibleToCreator ?? false,
    uploadEnabled: optional.uploadEnabled ?? false,
    needsCreator: optional.needsCreator ?? false,
    sortOrder,
    isSeed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...optional,
  });
  const openingStage = typeof body.workflowStage === "string"
    ? body.workflowStage
    : workflowStageForLegacy(optional.status ?? "pitch", typeof optional.stage === "number" ? optional.stage : null);
  const moved = await setDealStage(db, {
    dealId: body.id,
    toStage: openingStage,
    actorEmail: "bot",
    actorRole: "bot",
  });
  if (!moved.ok) return { status: moved.status, body: { error: moved.error } };
  if (typeof body.workflowStage === "string") await reapplyExplicitDealFlags(db, body.id, optional);
  else if (typeof optional.visibleToCreator === "boolean") {
    await db.update(deals).set({ visibleToCreator: optional.visibleToCreator }).where(eq(deals.id, body.id));
  }
  const created = await db.select().from(deals).where(eq(deals.id, body.id));
  return {
    status: 201,
    body: {
      id: body.id,
      created: true,
      visibleToCreator: created[0]?.visibleToCreator ?? false,
      workflowStage: created[0]?.workflowStage ?? moved.workflowStage,
    },
  };
}

async function reapplyExplicitDealFlags(
  db: PortalDb,
  dealId: string,
  optional: Partial<typeof deals.$inferInsert>,
) {
  const followUp: Partial<typeof deals.$inferInsert> = {};
  if (typeof optional.visibleToCreator === "boolean") followUp.visibleToCreator = optional.visibleToCreator;
  if (typeof optional.status === "string") followUp.status = optional.status;
  if (Object.keys(followUp).length === 0) return;
  await db.update(deals).set(followUp).where(eq(deals.id, dealId));
}

export async function upsertPayment(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.dealId !== "string") {
    return { status: 400, body: { error: "dealId is required." } };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, body.dealId));
  const deal = dealRows[0];
  if (!deal) return { status: 404, body: { error: "Deal not found." } };
  if ("creatorSplitPercent" in body && body.creatorSplitPercent !== null && typeof body.creatorSplitPercent !== "number") {
    return { status: 400, body: { error: "creatorSplitPercent must be a number or null." } };
  }
  const existing = typeof body.id === "string"
    ? await db.select().from(payments).where(eq(payments.id, body.id))
    : await db.select().from(payments).where(eq(payments.dealId, body.dealId));
  const current = existing[0];
  const timestamp = nowIso();
  const amountOwedCents = typeof body.amountOwedCents === "number" ? body.amountOwedCents : current?.amountOwedCents ?? null;
  const landedAmountCents = body.landedAmountCents === null
    ? null
    : typeof body.landedAmountCents === "number"
      ? body.landedAmountCents
      : current?.landedAmountCents ?? null;
  if ("paymentStatus" in body && body.paymentStatus !== null && (typeof body.paymentStatus !== "string" || !isPaymentStatus(body.paymentStatus))) {
    return { status: 400, body: { error: "paymentStatus must be brand_invoiced, brand_paid, creator_payout_pending, creator_paid, or null." } };
  }
  const paymentStatus = "paymentStatus" in body
    ? (body.paymentStatus === null ? null : String(body.paymentStatus))
    : current?.paymentStatus ?? null;
  for (const name of ["dueDate", "landedDate", "payoutApprovedOn", "paidOutDate"] as const) {
    const value = body[name];
    if (typeof value === "string" && isFakeCalendarDay(value)) {
      return { status: 400, body: { error: `${name} must be a real day like 2026-11-20.` } };
    }
  }
  const basis = landedAmountCents ?? amountOwedCents;
  const share = feeAndPayout(basis);
  const creatorPayoutCents = share.payoutCents;
  const id = current?.id ?? (typeof body.id === "string" ? body.id : `pay-${body.dealId}`);
  const row = {
    dealId: body.dealId,
    amountOwedCents,
    amountLabel: typeof body.amountLabel === "string" ? body.amountLabel : current?.amountLabel ?? null,
    dueDate: body.dueDate === null ? null : typeof body.dueDate === "string" ? body.dueDate : current?.dueDate ?? null,
    dueLabel: typeof body.dueLabel === "string" ? body.dueLabel : current?.dueLabel ?? null,
    landedDate: body.landedDate === null ? null : typeof body.landedDate === "string" ? body.landedDate : current?.landedDate ?? null,
    landedAmountCents,
    creatorSplitPercent: CREATOR_PAYOUT_PERCENT,
    agencySplitPercent: AGENCY_COMMISSION_PERCENT,
    creatorPayoutCents,
    payoutApprovedOn: body.payoutApprovedOn === null
      ? null
      : typeof body.payoutApprovedOn === "string"
        ? body.payoutApprovedOn
        : current?.payoutApprovedOn ?? null,
    paidOutDate: body.paidOutDate === null
      ? null
      : typeof body.paidOutDate === "string"
        ? body.paidOutDate
        : current?.paidOutDate ?? null,
    paymentStatus,
    updatedAt: timestamp,
  };
  if (current) {
    await db.update(payments).set(row).where(eq(payments.id, current.id));
    return { status: 200, body: { id: current.id, creatorSplitPercent: CREATOR_PAYOUT_PERCENT, creatorPayoutCents, paymentStatus } };
  }
  await db.insert(payments).values({ ...row, id, isSeed: false, createdAt: timestamp });
  return { status: 201, body: { id, creatorSplitPercent: CREATOR_PAYOUT_PERCENT, creatorPayoutCents, paymentStatus } };
}

/** A real calendar day. 2026-02-31 matches the shape and is still refused. */
function isCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function writeDailyAnalytics(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.date !== "string" || typeof body.platform !== "string") {
    return { status: 400, body: { error: "date (YYYY-MM-DD) and platform are required." } };
  }
  if (!isCalendarDay(body.date)) {
    return { status: 400, body: { error: "date must be YYYY-MM-DD." } };
  }
  const creator = typeof body.creatorEmail === "string"
    ? await findCreatorByEmail(db, body.creatorEmail)
    : typeof body.creatorId === "string"
      ? await findCreatorById(db, body.creatorId)
      : null;
  if (!creator) return { status: 404, body: { error: "Creator not found." } };
  const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);
  const id = `ad-${creator.id}-${body.platform}-${body.date}`;
  const row = {
    id,
    creatorId: creator.id,
    platform: body.platform,
    metricDate: body.date,
    followers: numberOrNull(body.followers),
    newFollowers: numberOrNull(body.newFollowers),
    views: numberOrNull(body.views),
    engagementRate: numberOrNull(body.engagementRate),
    saves: numberOrNull(body.saves),
    isExample: body.example === true,
    createdAt: nowIso(),
  };
  await db
    .insert(analyticsDaily)
    .values(row)
    .onConflictDoUpdate({
      target: [analyticsDaily.creatorId, analyticsDaily.platform, analyticsDaily.metricDate],
      set: {
        followers: row.followers,
        newFollowers: row.newFollowers,
        views: row.views,
        engagementRate: row.engagementRate,
        saves: row.saves,
        isExample: row.isExample,
      },
    });
  return { status: 200, body: { id, creatorId: creator.id, date: body.date, platform: body.platform, example: row.isExample } };
}

export async function upsertCreator(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.id !== "string" || typeof body.email !== "string" || typeof body.name !== "string") {
    return { status: 400, body: { error: "id, name, and email are required." } };
  }
  const email = normalizeEmail(body.email);
  const existing = await findCreatorById(db, body.id);
  const connect = isRecord(body.connect) ? body.connect : {};
  const split = "splitPercent" in body ? (body.splitPercent as number | null) : existing?.splitPercent ?? null;
  if (split !== null && typeof split !== "number") {
    return { status: 400, body: { error: "splitPercent must be a number or null." } };
  }
  const values = {
    name: body.name,
    email,
    handles: typeof body.handles === "string" ? body.handles : existing?.handles ?? null,
    kidsAges: typeof body.kidsAges === "string" ? body.kidsAges : existing?.kidsAges ?? null,
    payoutMethod: typeof body.payoutMethod === "string" ? body.payoutMethod : existing?.payoutMethod ?? null,
    splitPercent: split,
    monthlyGoalCents: typeof body.monthlyGoalCents === "number" ? body.monthlyGoalCents : existing?.monthlyGoalCents ?? null,
    driveFolderId: typeof body.driveFolderId === "string" ? body.driveFolderId : existing?.driveFolderId ?? null,
    initials: typeof body.initials === "string" ? body.initials : existing?.initials ?? body.name.slice(0, 2).toUpperCase(),
    tiktokStatus: typeof connect.tiktokStatus === "string" ? connect.tiktokStatus : existing?.accounts.tiktok.status ?? "disconnected",
    instagramStatus: typeof connect.instagramStatus === "string" ? connect.instagramStatus : existing?.accounts.instagram.status ?? "disconnected",
    facebookStatus: typeof connect.facebookStatus === "string" ? connect.facebookStatus : existing?.accounts.facebook.status ?? "disconnected",
    youtubeStatus: typeof connect.youtubeStatus === "string" ? connect.youtubeStatus : existing?.accounts.youtube.status ?? "disconnected",
    emailStatus: typeof connect.emailStatus === "string" ? connect.emailStatus : existing?.accounts.email.status ?? "disconnected",
    tiktokConnectUrl: typeof connect.tiktok === "string" ? connect.tiktok : existing?.accounts.tiktok.connectUrl ?? null,
    instagramConnectUrl: typeof connect.instagram === "string" ? connect.instagram : existing?.accounts.instagram.connectUrl ?? null,
    facebookConnectUrl: typeof connect.facebook === "string" ? connect.facebook : existing?.accounts.facebook.connectUrl ?? null,
    youtubeConnectUrl: typeof connect.youtube === "string" ? connect.youtube : existing?.accounts.youtube.connectUrl ?? null,
    listNote: typeof body.listNote === "string" ? body.listNote : existing?.listNote ?? null,
  };
  if (existing) {
    await db.update(creators).set(values).where(eq(creators.id, body.id));
    return { status: 200, body: { id: body.id, email, created: false } };
  }
  await db.insert(creators).values({ ...values, id: body.id, isSeed: false, createdAt: nowIso() });
  return { status: 201, body: { id: body.id, email, created: true } };
}

function contactField(body: Record<string, unknown>, key: "name" | "email" | "company") {
  if (!isRecord(body.brandContact)) return null;
  const value = body.brandContact[key];
  return typeof value === "string" ? value : null;
}

export async function createApprovalDraft(db: PortalDb, body: unknown) {
  if (!isRecord(body)) return { status: 400, body: { error: "Expected a JSON object." } };
  if (typeof body.dealId !== "string" || typeof body.gate !== "string" || typeof body.to !== "string" || typeof body.subject !== "string" || typeof body.body !== "string") {
    return { status: 400, body: { error: "dealId, gate, to, subject, and body are required." } };
  }
  const created = await createApprovalEmail(db, {
    dealId: body.dealId,
    gate: body.gate,
    to: body.to,
    subject: body.subject,
    body: body.body,
    attachmentNote: typeof body.attachmentNote === "string" ? body.attachmentNote : null,
    attachmentUrl: typeof body.attachmentUrl === "string" ? body.attachmentUrl : null,
    gmailThreadId: typeof body.gmailThreadId === "string" ? body.gmailThreadId : null,
    from: typeof body.from === "string" ? body.from : null,
    status: typeof body.status === "string" ? body.status : null,
    brandContactName: contactField(body, "name"),
    brandContactEmail: contactField(body, "email"),
    brandContactCompany: contactField(body, "company"),
    suggestedCreatorId: typeof body.suggestedCreatorId === "string" ? body.suggestedCreatorId : null,
    suggestedPlan: typeof body.suggestedPlan === "string" ? body.suggestedPlan : null,
  }, { email: "bot", role: "bot" });
  if (!created.ok) return { status: created.status, body: { error: created.error } };
  return { status: 201, body: { id: created.id, status: created.status, from: created.from, sendable: false } };
}

export async function listApprovedApprovals(db: PortalDb) {
  const approvals = await listSendableApprovals(db);
  return { status: 200, body: { approvals } };
}

export async function markApprovalDraftSent(db: PortalDb, approvalId: string, body: unknown) {
  if (!isRecord(body) || typeof body.messageId !== "string") {
    return { status: 400, body: { error: "messageId is required." } };
  }
  const sent = await markApprovalSent(db, approvalId, {
    messageId: body.messageId,
    threadId: typeof body.threadId === "string" ? body.threadId : null,
  }, { email: "bot", role: "bot" });
  if (!sent.ok) return { status: sent.status, body: { error: sent.error } };
  return { status: 200, body: { id: sent.id, status: sent.status, messageId: sent.messageId } };
}

const PRIVATE_SYNC_KEYS = [
  "minDealCents",
  "minimumPerVideoCents",
  "typicalRateCents",
  "typicalRate",
  "minRates",
  "targetRates",
  "platformMinimums",
  "internalQuoteCents",
  "internalQuote",
  "quoteCents",
  "quote",
];

/** Batch upsert. Per-item results never echo minimums, quotes, or private notes. */
export async function syncDeals(db: PortalDb, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.deals)) {
    return { status: 400, body: { error: "deals must be a list." } };
  }
  const results = [];
  for (const item of body.deals) {
    const source = isRecord(item) ? { ...item } : item;
    if (isRecord(source)) {
      delete source.visibleToCreator;
      for (const key of PRIVATE_SYNC_KEYS) delete source[key];
    }
    const result = await upsertDeal(db, source);
    const payload = result.body as {
      error?: string;
      created?: boolean;
      workflowStage?: string;
      visibleToCreator?: boolean;
    };
    const id = isRecord(item) && typeof item.id === "string" ? item.id : null;
    if (result.status < 300 && payload.created && id) await holdForOwnerReview(db, id);
    const stored = id ? (await db.select({ visibleToCreator: deals.visibleToCreator }).from(deals).where(eq(deals.id, id)))[0] : null;
    results.push({
      id,
      ok: result.status < 300,
      status: result.status,
      created: typeof payload.created === "boolean" ? payload.created : null,
      workflowStage: typeof payload.workflowStage === "string" ? payload.workflowStage : null,
      visibleToCreator: stored ? stored.visibleToCreator : typeof payload.visibleToCreator === "boolean" ? payload.visibleToCreator : null,
      error: typeof payload.error === "string" ? payload.error : null,
    });
  }
  return { status: 200, body: { results } };
}

export async function setDealFolder(db: PortalDb, dealId: string, folderId: string) {
  await db.update(deals).set({ driveFolderId: folderId, updatedAt: nowIso() }).where(eq(deals.id, dealId));
}
