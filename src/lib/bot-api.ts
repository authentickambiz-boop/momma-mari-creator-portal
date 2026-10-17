import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { analyticsDaily, creators, deals, drafts, payments, revisions } from "@/db/schema";
import { DEAL_STATUSES, DRAFT_STATUSES, type DealStatus, type DraftStatus } from "./types";
import { normalizeEmail, nowIso, safeEqual } from "./format";
import { findCreatorByEmail, findCreatorById } from "./queries";

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
  await db.update(deals).set(patch).where(eq(deals.id, dealId));
  const updated = await db.select().from(deals).where(eq(deals.id, dealId));
  return { status: 200, body: { id: dealId, status: updated[0]?.status, visibleToCreator: updated[0]?.visibleToCreator } };
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
  if (existing[0]) {
    await db.update(deals).set({ ...base, ...optional }).where(eq(deals.id, body.id));
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
  return { status: 201, body: { id: body.id, created: true, visibleToCreator: optional.visibleToCreator ?? false } };
}

export async function upsertPayment(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.dealId !== "string") {
    return { status: 400, body: { error: "dealId is required." } };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, body.dealId));
  const deal = dealRows[0];
  if (!deal) return { status: 404, body: { error: "Deal not found." } };
  if ("creatorSplitPercent" in body) {
    const split = body.creatorSplitPercent;
    if (split !== null && typeof split !== "number") {
      return { status: 400, body: { error: "creatorSplitPercent must be a number or null." } };
    }
    await db.update(creators).set({ splitPercent: split as number | null }).where(eq(creators.id, deal.creatorId));
  }
  const creator = await findCreatorById(db, deal.creatorId);
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
  const split = creator?.splitPercent ?? null;
  const basis = landedAmountCents ?? amountOwedCents;
  const creatorPayoutCents = split != null && basis != null ? Math.round((basis * split) / 100) : null;
  const agencySplitPercent = split == null ? null : 100 - split;
  const id = current?.id ?? (typeof body.id === "string" ? body.id : `pay-${body.dealId}`);
  const row = {
    dealId: body.dealId,
    amountOwedCents,
    amountLabel: typeof body.amountLabel === "string" ? body.amountLabel : current?.amountLabel ?? null,
    dueDate: body.dueDate === null ? null : typeof body.dueDate === "string" ? body.dueDate : current?.dueDate ?? null,
    dueLabel: typeof body.dueLabel === "string" ? body.dueLabel : current?.dueLabel ?? null,
    landedDate: body.landedDate === null ? null : typeof body.landedDate === "string" ? body.landedDate : current?.landedDate ?? null,
    landedAmountCents,
    creatorSplitPercent: split,
    agencySplitPercent,
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
    updatedAt: timestamp,
  };
  if (current) {
    await db.update(payments).set(row).where(eq(payments.id, current.id));
    return { status: 200, body: { id: current.id, creatorSplitPercent: split, creatorPayoutCents } };
  }
  await db.insert(payments).values({ ...row, id, isSeed: false, createdAt: timestamp });
  return { status: 201, body: { id, creatorSplitPercent: split, creatorPayoutCents } };
}

export async function writeDailyAnalytics(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.date !== "string" || typeof body.platform !== "string") {
    return { status: 400, body: { error: "date (YYYY-MM-DD) and platform are required." } };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
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

export async function setDealFolder(db: PortalDb, dealId: string, folderId: string) {
  await db.update(deals).set({ driveFolderId: folderId, updatedAt: nowIso() }).where(eq(deals.id, dealId));
}
