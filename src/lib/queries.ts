import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  analyticsDaily,
  analyticsPosts,
  creators,
  contractChecks,
  contractSignatures,
  contracts,
  dealStageEvents,
  brandReplyDrafts,
  deals,
  drafts,
  inboxItems,
  livePosts,
  payments,
  revisions,
  shipments,
} from "@/db/schema";
import { AGENCY_MAILBOX_ID } from "./agency-mailbox";
import { adminDisplayName, adminEmails, canSeeDeal } from "./authz";
import { findManagerByEmail } from "./managers";
import { CONTRACT_CHECKS, signingFormatLabel } from "./contract-shared";
import { firstEmail, interestContextForDeal } from "./creator-interest";
import { safetyForDeal } from "./safety";
import { reviewsForDeal } from "./video-review";
import { shipmentStatusLabel, trackingUrl } from "./fulfillment";
import { deadlineFlag, uploadDueDate } from "./deadlines";
import { formatMoney, normalizeEmail, nowIso, parseJson } from "./format";
import { getDealStage } from "./stages";
import type {
  Chip,
  CreatorProfile,
  DailyMetric,
  DealDetail,
  DealSummary,
  DraftView,
  InboxItem,
  PaymentView,
  PostMetric,
  RevisionView,
  Viewer,
} from "./types";

function chipsFrom(json: string): Chip[] {
  const parsed = parseJson<[string, string][]>(json, []);
  return parsed.map(([text, tone]) => ({ text, tone }));
}

function toCreator(row: typeof creators.$inferSelect): CreatorProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    handles: row.handles,
    kidsAges: row.kidsAges,
    payoutMethod: row.payoutMethod,
    splitPercent: row.splitPercent,
    monthlyGoalCents: row.monthlyGoalCents,
    driveFolderId: row.driveFolderId,
    initials: row.initials,
    listNote: row.listNote,
    signerIsMinor: row.signerIsMinor,
    primaryManagerId: row.primaryManagerId,
    backupManagerId: row.backupManagerId,
    isSeed: row.isSeed,
    accounts: {
      tiktok: { status: row.tiktokStatus, connectUrl: row.tiktokConnectUrl },
      instagram: { status: row.instagramStatus, connectUrl: row.instagramConnectUrl },
      facebook: { status: row.facebookStatus, connectUrl: row.facebookConnectUrl },
      youtube: { status: row.youtubeStatus, connectUrl: row.youtubeConnectUrl },
      email: { status: row.emailStatus, connectUrl: null },
    },
  };
}

function toSummary(row: typeof deals.$inferSelect, creatorName: string): DealSummary {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName,
    brand: row.brand,
    subtitle: row.subtitle,
    status: row.status,
    amountDisplay: row.amountDisplay,
    chips: chipsFrom(row.chipsJson),
    nextStep: row.nextStep,
    visibleToCreator: row.visibleToCreator,
    needsCreator: row.needsCreator,
    isSeed: row.isSeed,
    uploadEnabled: row.uploadEnabled,
    earningsChipText: row.earningsChipText,
    earningsChipTone: row.earningsChipTone,
    pipelineCents: row.pipelineCents,
    pipelineName: row.pipelineName,
    sortOrder: row.sortOrder,
    workflowStage: row.workflowStage,
    updatedAt: row.updatedAt,
    postDate: row.postDate,
    uploadDue: uploadDueDate(row.postDate),
    deadlineFlag: deadlineFlag(row.postDate, row.workflowStage),
    rushRevision: row.rushRevision,
  };
}

function toPayment(row: typeof payments.$inferSelect): PaymentView {
  return {
    id: row.id,
    dealId: row.dealId,
    amountOwedCents: row.amountOwedCents,
    amountLabel: row.amountLabel,
    dueDate: row.dueDate,
    dueLabel: row.dueLabel,
    landedDate: row.landedDate,
    landedAmountCents: row.landedAmountCents,
    creatorSplitPercent: row.creatorSplitPercent,
    agencySplitPercent: row.agencySplitPercent,
    creatorPayoutCents: row.creatorPayoutCents,
    payoutApprovedOn: row.payoutApprovedOn,
    paidOutDate: row.paidOutDate,
    paymentStatus: row.paymentStatus,
    isSeed: row.isSeed,
  };
}

function paymentForViewer(row: typeof payments.$inferSelect, viewer: Viewer): PaymentView | null {
  if (viewer.role === "manager") return null;
  return toPayment(row);
}

function toDraft(row: typeof drafts.$inferSelect): DraftView {
  return {
    id: row.id,
    version: row.version,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    bytesReceived: row.bytesReceived,
    driveFileId: row.driveFileId,
    driveFileUrl: row.driveFileUrl,
    status: row.status,
    gmailThreadId: row.gmailThreadId,
    uploadedAt: row.uploadedAt,
    isSeed: row.isSeed,
    review: null,
    safety: [],
  };
}

function toRevision(row: typeof revisions.$inferSelect): RevisionView {
  return {
    id: row.id,
    occurredLabel: row.occurredLabel,
    occurredAt: row.occurredAt,
    source: row.source,
    summary: row.summary,
    emailUrl: row.emailUrl,
    isSeed: row.isSeed,
  };
}

export async function listCreators(db: PortalDb) {
  const rows = await db.select().from(creators).orderBy(asc(creators.name));
  return rows.map(toCreator);
}

export async function findCreatorByEmail(db: PortalDb, email: string) {
  const normalized = normalizeEmail(email);
  const rows = await db.select().from(creators).where(sql`lower(${creators.email}) = ${normalized}`);
  return rows[0] ? toCreator(rows[0]) : null;
}

export async function findCreatorById(db: PortalDb, id: string) {
  const rows = await db.select().from(creators).where(eq(creators.id, id));
  return rows[0] ? toCreator(rows[0]) : null;
}

export async function resolveLogin(db: PortalDb, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return { ok: false as const, reason: "not_allowed" as const };
  // Placeholder creator emails use the reserved .invalid TLD and must never open a session.
  if (normalized.endsWith(".invalid")) return { ok: false as const, reason: "not_allowed" as const };
  if (adminEmails().includes(normalized)) {
    return {
      ok: true as const,
      viewer: {
        email: normalized,
        role: "admin" as const,
        creatorId: null,
        name: adminDisplayName(),
      },
    };
  }
  const manager = await findManagerByEmail(db, normalized);
  if (manager?.active) {
    return {
      ok: true as const,
      viewer: {
        email: manager.email,
        role: "manager" as const,
        creatorId: null,
        name: manager.name,
        managerId: manager.id,
        permissions: manager.permissions,
      },
    };
  }
  const creator = await findCreatorByEmail(db, normalized);
  if (!creator) return { ok: false as const, reason: "not_allowed" as const };
  return {
    ok: true as const,
    viewer: {
      email: creator.email,
      role: "creator" as const,
      creatorId: creator.id,
      name: creator.name,
    },
  };
}

async function creatorNameMap(db: PortalDb) {
  const rows = await listCreators(db);
  return new Map(rows.map((creator) => [creator.id, creator.name]));
}

export async function listDealsForViewer(db: PortalDb, viewer: Viewer, creatorId: string | "all") {
  const names = await creatorNameMap(db);
  const rows = await db.select().from(deals).orderBy(asc(deals.sortOrder), asc(deals.brand));
  return rows
    .filter((row) => {
      if (!canSeeDeal(viewer, row)) return false;
      if ((viewer.role === "admin" || viewer.role === "manager") && creatorId !== "all" && row.creatorId !== creatorId) return false;
      if (viewer.role === "creator" && row.creatorId !== viewer.creatorId) return false;
      return true;
    })
    .map((row) => hideMoney(toSummary(row, names.get(row.creatorId) ?? (row.creatorId === AGENCY_MAILBOX_ID ? "Kamron" : "Creator")), viewer));
}

function hideMoney<T extends DealSummary>(summary: T, viewer: Viewer): T {
  if (viewer.role !== "manager") return summary;
  return {
    ...summary,
    amountDisplay: null,
    earningsChipText: null,
    earningsChipTone: null,
    pipelineCents: null,
    pipelineName: null,
  };
}

function ownerAudit(viewer: Viewer) {
  return viewer.role === "admin";
}

function seesChecklist(viewer: Viewer) {
  return viewer.role === "admin" || (viewer.role === "manager" && Boolean(viewer.permissions?.approveContract));
}

async function signaturesForViewer(db: PortalDb, viewer: Viewer, dealId: string) {
  const rows = await db.select().from(contractSignatures).where(eq(contractSignatures.dealId, dealId)).orderBy(asc(contractSignatures.createdAt));
  const visible = viewer.role === "creator" ? rows.filter((row) => row.status !== "void") : rows;
  const audit = ownerAudit(viewer);
  return visible.map((row) => ({
    id: row.id,
    contractId: row.contractId,
    version: row.version,
    role: row.role,
    status: row.status,
    signerName: row.signerName,
    signerEmail: audit ? row.signerEmail : null,
    signedAt: row.signedAt,
    documentSha256: audit ? row.documentSha256 : null,
    signedSha256: audit ? row.signedSha256 : null,
    signedFilename: row.signedFilename,
    driveFileUrl: row.driveFileUrl,
    guardian: row.guardian,
    ip: audit ? row.ip : null,
    userAgent: audit ? row.userAgent : null,
  }));
}

async function contractsForViewer(db: PortalDb, viewer: Viewer, dealId: string) {
  const contractRows = await db.select().from(contracts).where(eq(contracts.dealId, dealId)).orderBy(asc(contracts.version));
  const visible = viewer.role === "creator" ? contractRows.filter((row) => row.status === "approved") : contractRows;
  if (visible.length === 0) return [];
  const checklist = seesChecklist(viewer);
  const checkRows = checklist
    ? await db.select().from(contractChecks).where(inArray(contractChecks.contractId, visible.map((row) => row.id)))
    : [];
  return visible.map((row) => ({
    id: row.id,
    version: row.version,
    filename: row.filename,
    mimeType: row.mimeType,
    sha256: row.sha256,
    driveFileId: row.driveFileId,
    driveFileUrl: row.driveFileUrl,
    signingFormat: row.signingFormat,
    signingLabel: signingFormatLabel(row.signingFormat),
    countersign: row.countersign,
    status: row.status,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    approvalId: checklist ? row.approvalId : null,
    checks: checklist
      ? CONTRACT_CHECKS.map((item) => {
          const saved = checkRows.find((check) => check.contractId === row.id && check.item === item.id);
          return { item: item.id, label: item.label, status: saved?.status ?? "unchecked", note: saved?.note ?? null };
        })
      : null,
  }));
}

export async function getDealForViewer(db: PortalDb, viewer: Viewer, dealId: string): Promise<DealDetail | null> {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  const row = rows[0];
  if (!row || !canSeeDeal(viewer, row)) return null;
  const creator = await findCreatorById(db, row.creatorId);
  const staff = viewer.role === "admin" || viewer.role === "manager";
  const [revisionRows, draftRows, paymentRows, stageRows, reviewByDraft, shipmentRows, postRows, safetyByDraft] = await Promise.all([
    db.select().from(revisions).where(eq(revisions.dealId, dealId)).orderBy(asc(revisions.sortOrder)),
    db.select().from(drafts).where(eq(drafts.dealId, dealId)).orderBy(asc(drafts.version)),
    db.select().from(payments).where(eq(payments.dealId, dealId)),
    staff
      ? db.select().from(dealStageEvents).where(eq(dealStageEvents.dealId, dealId)).orderBy(asc(dealStageEvents.createdAt))
      : Promise.resolve([]),
    reviewsForDeal(db, dealId),
    db.select().from(shipments).where(eq(shipments.dealId, dealId)),
    db.select().from(livePosts).where(eq(livePosts.dealId, dealId)).orderBy(asc(livePosts.createdAt)),
    safetyForDeal(db, dealId),
  ]);
  const summary = hideMoney(toSummary(row, creator?.name ?? (row.creatorId === AGENCY_MAILBOX_ID ? "Kamron" : "Creator")), viewer);
  const interestState = await interestContextForDeal(db, dealId);
  const brandEmail = interestState.brandEmail ?? firstEmail(row.contact);
  const offerOpen = !row.workflowStage || row.workflowStage === "offer_received" || row.workflowStage === "offer_shared";
  const managerView = viewer.role === "manager";
  return {
    ...summary,
    contact: row.contact,
    gmailThreadId: row.gmailThreadId,
    rateLabel: managerView ? null : row.rateLabel,
    rateCents: managerView ? null : row.rateCents,
    deliverables: parseJson<string[]>(row.deliverablesJson, []),
    usageRights: row.usageRights,
    brief: row.brief,
    briefUrl: row.briefUrl,
    draftDue: row.draftDue,
    postDate: row.postDate,
    paymentTerms: managerView ? null : row.paymentTerms,
    kamronNotes: staff ? row.kamronNotes : null,
    botMessage: row.botMessage,
    stage: row.stage,
    stageEvents: staff
      ? stageRows.map((event) => ({
          id: event.id,
          fromStage: event.fromStage,
          toStage: event.toStage,
          actorEmail: event.actorEmail,
          actorRole: event.actorRole,
          note: event.note,
          createdAt: event.createdAt,
        }))
      : null,
    uploadLabel: row.uploadLabel,
    driveFolderId: row.driveFolderId,
    revisions: revisionRows.map(toRevision),
    drafts: draftRows.map((row) => {
      const review = reviewByDraft.get(row.id);
      return {
        ...toDraft(row),
        review: review
          ? { decision: review.decision, note: review.note, actorEmail: review.actorEmail, createdAt: review.createdAt }
          : null,
        safety: safetyByDraft.get(row.id) ?? [],
      };
    }),
    payment: paymentRows[0] ? paymentForViewer(paymentRows[0], viewer) : null,
    interest: interestState.interest,
    offerReleased: interestState.offerReleased,
    brandEmail,
    contracts: await contractsForViewer(db, viewer, dealId),
    signatures: await signaturesForViewer(db, viewer, dealId),
    signerIsMinor: Boolean(creator?.signerIsMinor),
    canRespondToOffer:
      viewer.role === "creator" &&
      viewer.creatorId === row.creatorId &&
      row.visibleToCreator &&
      row.workflowStage === "offer_shared" &&
      interestState.offerReleased &&
      Boolean(brandEmail) &&
      !interestState.interest,
    canReleaseOffer: staff && offerOpen && !(interestState.offerReleased && brandEmail),
    shipment: shipmentRows[0]
      ? {
          id: shipmentRows[0].id,
          carrier: shipmentRows[0].carrier,
          trackingNumber: shipmentRows[0].trackingNumber,
          trackingUrl: trackingUrl(shipmentRows[0].carrier, shipmentRows[0].trackingNumber),
          status: shipmentRows[0].status,
          statusLabel: shipmentStatusLabel(shipmentRows[0].status),
          receivedAt: shipmentRows[0].receivedAt,
        }
      : null,
    livePosts: postRows.map((post) => ({
      id: post.id,
      platform: post.platform,
      url: post.url,
      meetsBrief: post.meetsBrief,
      confirmedAt: post.confirmedAt,
      confirmedBy: viewer.role === "creator" ? null : post.confirmedBy,
    })),
    canConfirmProduct: (viewer.role === "creator" ? viewer.creatorId === row.creatorId : staff) && row.workflowStage === "waiting_for_product",
    canSubmitPosts: (viewer.role === "creator" ? viewer.creatorId === row.creatorId : staff) && (getDealStage(row.workflowStage)?.order ?? 0) >= 20,
    canMarkPayment: viewer.role === "admin" && (getDealStage(row.workflowStage)?.order ?? 0) >= 21,
    productRequired: row.productRequired,
    rateReady: row.rateReady,
    rateConfirmedAt: row.rateConfirmedAt,
    canConfirmRate:
      viewer.role === "creator" &&
      viewer.creatorId === row.creatorId &&
      row.visibleToCreator &&
      row.rateReady &&
      row.rateCents != null &&
      !row.rateConfirmedAt,
    agreedRateLabel: row.rateReady && row.rateCents != null && !managerView ? formatMoney(row.rateCents) : null,
    brandReplyDraft: viewer.role === "admin"
      ? (await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, dealId)))[0]?.body ?? null
      : null,
    reviewStatus: staff ? row.reviewStatus : null,
  };
}

export async function getDealAccessRow(db: PortalDb, dealId: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  return rows[0] ?? null;
}

export async function listPaymentsForDeals(db: PortalDb, dealIds: string[]) {
  if (dealIds.length === 0) return [];
  const rows = await db.select().from(payments).where(inArray(payments.dealId, dealIds));
  return rows.map(toPayment);
}

export async function listInbox(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(inboxItems).where(eq(inboxItems.creatorId, creatorId));
  return rows.map(
    (row): InboxItem => ({
      id: row.id,
      occurredOn: row.occurredOn,
      source: row.source,
      amountLabel: row.amountLabel,
      isSeed: row.isSeed,
    }),
  );
}

export async function listDailyMetrics(db: PortalDb, creatorId: string) {
  const rows = await db
    .select()
    .from(analyticsDaily)
    .where(eq(analyticsDaily.creatorId, creatorId))
    .orderBy(asc(analyticsDaily.metricDate));
  return rows.map(
    (row): DailyMetric => ({
      id: row.id,
      creatorId: row.creatorId,
      platform: row.platform,
      metricDate: row.metricDate,
      followers: row.followers,
      newFollowers: row.newFollowers,
      views: row.views,
      engagementRate: row.engagementRate,
      saves: row.saves,
      isExample: row.isExample,
    }),
  );
}

export async function listPostMetrics(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(analyticsPosts).where(eq(analyticsPosts.creatorId, creatorId));
  return rows.map(
    (row): PostMetric => ({
      id: row.id,
      title: row.title,
      platform: row.platform,
      views: row.views,
      saves: row.saves,
      isExample: row.isExample,
    }),
  );
}

export function summarizeAnalytics(daily: DailyMetric[], posts: PostMetric[]) {
  const shown = daily.filter((row) => !row.isExample).slice().sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  const shownPosts = posts.filter((row) => !row.isExample);
  const withFollowers = shown.filter((row) => row.followers != null);
  const withEngagement = shown.filter((row) => row.engagementRate != null);
  const viewRows = shown.filter((row) => row.views != null);
  const counted = shown.slice(-7).filter((row) => row.newFollowers != null);
  return {
    daily: shown,
    posts: shownPosts,
    followers: withFollowers.at(-1)?.followers ?? null,
    newFollowers: counted.length ? counted.reduce((sum, row) => sum + (row.newFollowers ?? 0), 0) : null,
    averageViews: viewRows.length
      ? Math.round(viewRows.reduce((sum, row) => sum + (row.views ?? 0), 0) / viewRows.length)
      : null,
    engagementRate: withEngagement.at(-1)?.engagementRate ?? null,
  };
}

export async function listDraftsSince(db: PortalDb, since: string | null, includeSeed: boolean) {
  const filters = [ne(drafts.status, "uploading")];
  if (since) filters.push(gt(drafts.uploadedAt, since));
  if (!includeSeed) filters.push(eq(drafts.isSeed, false));
  const rows = await db
    .select()
    .from(drafts)
    .where(and(...filters))
    .orderBy(desc(drafts.uploadedAt));
  const dealRows = rows.length
    ? await db.select().from(deals).where(inArray(deals.id, rows.map((row) => row.dealId)))
    : [];
  const creatorRows = await listCreators(db);
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  return rows.map((row) => {
    const deal = dealById.get(row.dealId);
    const creator = deal ? creatorById.get(deal.creatorId) : undefined;
    return {
      id: row.id,
      dealId: row.dealId,
      brand: deal?.brand ?? null,
      creatorId: deal?.creatorId ?? null,
      creatorEmail: creator?.email ?? null,
      gmailThreadId: row.gmailThreadId ?? deal?.gmailThreadId ?? null,
      version: row.version,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      driveFileId: row.driveFileId,
      driveFileUrl: row.driveFileUrl,
      status: row.status,
      uploadedAt: row.uploadedAt,
      isSeed: row.isSeed,
    };
  });
}

export async function nextDraftVersion(db: PortalDb, dealId: string) {
  const rows = await db.select({ version: drafts.version }).from(drafts).where(eq(drafts.dealId, dealId));
  return rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
}

export async function getDraftRow(db: PortalDb, draftId: string) {
  const rows = await db.select().from(drafts).where(eq(drafts.id, draftId));
  return rows[0] ?? null;
}

export async function insertDraft(
  db: PortalDb,
  input: {
    id: string;
    dealId: string;
    version: number;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadSessionUrl: string | null;
    driveFolderId: string | null;
    gmailThreadId: string | null;
    status: string;
  },
) {
  const timestamp = nowIso();
  await db.insert(drafts).values({
    id: input.id,
    dealId: input.dealId,
    version: input.version,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    bytesReceived: 0,
    driveFileId: null,
    driveFileUrl: null,
    driveFolderId: input.driveFolderId,
    uploadSessionUrl: input.uploadSessionUrl,
    status: input.status,
    gmailThreadId: input.gmailThreadId,
    uploadedAt: null,
    isSeed: false,
    createdAt: timestamp,
  });
}

export async function markDraftProgress(
  db: PortalDb,
  draftId: string,
  input: { bytesReceived: number; status?: string; driveFileId?: string | null; driveFileUrl?: string | null },
) {
  const patch: Partial<typeof drafts.$inferInsert> = { bytesReceived: input.bytesReceived };
  if (input.status) {
    patch.status = input.status;
    if (input.status !== "uploading") patch.uploadedAt = nowIso();
  }
  if (input.driveFileId !== undefined) patch.driveFileId = input.driveFileId;
  if (input.driveFileUrl !== undefined) patch.driveFileUrl = input.driveFileUrl;
  await db.update(drafts).set(patch).where(eq(drafts.id, draftId));
}
