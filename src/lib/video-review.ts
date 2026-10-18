import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorNotifications, creators, deals, draftReviews, drafts } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { firstEmail } from "./creator-interest";
import { setDealStage } from "./deal-stage";
import { nowIso } from "./format";
import { assertStaffAccess, assignedManagersByCreator, staffHistoryRole } from "./managers";

const WAITING_FOR_DRAFT = new Set(["draft_due", "product_received", "brand_revisions", "manager_review"]);

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type DraftReviewDecision = "approved" | "changes";

export type DraftReviewRow = {
  id: string;
  draftId: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  manager: { id: string; name: string; email: string } | null;
  version: number;
  filename: string | null;
  decision: string;
  note: string | null;
  actorEmail: string;
  approvalId: string | null;
  driveFileId: string | null;
  driveFileUrl: string | null;
  draftStatus: string;
  workflowStage: string | null;
  createdAt: string;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function isDecision(value: string): value is DraftReviewDecision {
  return value === "approved" || value === "changes";
}

async function latestReview(db: PortalDb, draftId: string) {
  const rows = await db
    .select()
    .from(draftReviews)
    .where(eq(draftReviews.draftId, draftId))
    .orderBy(asc(draftReviews.createdAt));
  return rows.at(-1) ?? null;
}

export async function reviewsForDeal(db: PortalDb, dealId: string) {
  const rows = await db
    .select()
    .from(draftReviews)
    .where(eq(draftReviews.dealId, dealId))
    .orderBy(asc(draftReviews.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) latest.set(row.draftId, row);
  return latest;
}

/** When a video finishes uploading, move the deal to Draft submitted. Seed rows and KOSBLING are left alone. */
export async function onDraftSubmitted(
  db: PortalDb,
  dealId: string,
  actor: { email: string },
): Promise<Result<{ changed: boolean; workflowStage: string | null }>> {
  const dealRows = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const uploaded = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.dealId, deal.id), eq(drafts.isSeed, false), eq(drafts.status, "new")));
  if (uploaded.length === 0) return { ok: true, changed: false, workflowStage: deal.workflowStage };
  if (!deal.workflowStage || !WAITING_FOR_DRAFT.has(deal.workflowStage)) {
    return { ok: true, changed: false, workflowStage: deal.workflowStage };
  }
  const version = uploaded.reduce((max, row) => Math.max(max, row.version), 1);
  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "draft_submitted",
    actorEmail: actor.email,
    actorRole: "system",
    note: `Draft v${version} uploaded.`,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  return { ok: true, changed: moved.changed, workflowStage: moved.workflowStage };
}

function videoEmail(input: { creatorName: string; brand: string; version: number; filename: string | null; driveFileUrl: string | null }) {
  const linkLine = input.driveFileUrl
    ? `Drive link: ${input.driveFileUrl}`
    : "The video is in the Brand Drafts folder for this deal.";
  return {
    subject: `${input.creatorName}'s video for ${input.brand}`,
    body: [
      "Hi,",
      "",
      `${input.creatorName}'s video for ${input.brand} is ready for you (draft v${input.version}${input.filename ? `, ${input.filename}` : ""}).`,
      "",
      linkLine,
      "",
      "Thanks,",
      "Kamron",
      "Momma Mari",
    ].join("\n"),
    attachmentUrl: input.driveFileUrl,
    attachmentNote: `Draft v${input.version}${input.filename ? ` · ${input.filename}` : ""}`,
  };
}

export async function reviewDraft(
  db: PortalDb,
  input: {
    draftId: string;
    decision: string;
    note?: string | null;
    brandEmail?: string | null;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ decision: DraftReviewDecision; approvalId: string | null; workflowStage: string }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "manager") {
    return { ok: false, status: 403, error: "You can't approve your own video." };
  }
  if (!isDecision(input.decision)) {
    return { ok: false, status: 400, error: "Choose Approve or Request changes." };
  }
  const draftRows = await db.select().from(drafts).where(eq(drafts.id, input.draftId));
  const draft = draftRows[0];
  if (!draft) return { ok: false, status: 404, error: "Draft not found." };
  if (draft.isSeed) return { ok: false, status: 409, error: "Seed drafts stay as they are. Nothing was changed." };
  if (draft.status === "uploading") return { ok: false, status: 409, error: "This upload is still in progress." };
  if (draft.status !== "new") return { ok: false, status: 409, error: "This version was already reviewed." };
  const prior = await latestReview(db, draft.id);
  if (prior) return { ok: false, status: 409, error: "This version was already reviewed." };

  const dealRows = await db.select().from(deals).where(eq(deals.id, draft.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (input.actorRole === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "video",
    });
    if (!allowed.ok) return allowed;
  }
  const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
  const creator = creatorRows[0];
  const creatorName = creator?.name ?? "Creator";
  const note = clean(input.note);
  if (input.decision === "changes" && !note) {
    return { ok: false, status: 400, error: "Tell her what to fix." };
  }

  const brandEmail = firstEmail(input.brandEmail) ?? firstEmail(deal.contact);
  if (input.decision === "approved" && !brandEmail) {
    return { ok: false, status: 400, error: "This deal has no brand email yet." };
  }

  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: input.decision === "approved" ? "manager_review" : "draft_due",
    actorEmail: input.actorEmail,
    actorRole: staffHistoryRole(input.actorRole),
    note: note ?? (input.decision === "approved" ? "Approved to send to the brand." : null),
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };

  const timestamp = nowIso();
  await db.update(drafts).set({
    status: input.decision === "approved" ? "email_awaiting_ok" : "revisions",
  }).where(eq(drafts.id, draft.id));
  await db.update(deals).set({
    uploadEnabled: input.decision === "changes",
    needsCreator: input.decision === "changes",
    uploadLabel: input.decision === "changes" ? "Upload the next version" : deal.uploadLabel,
    contact: deal.contact ?? (input.decision === "approved" ? brandEmail : deal.contact),
    updatedAt: timestamp,
  }).where(eq(deals.id, deal.id));

  let approvalId: string | null = null;
  if (input.decision === "approved" && brandEmail) {
    const email = videoEmail({
      creatorName,
      brand: deal.brand,
      version: draft.version,
      filename: draft.filename,
      driveFileUrl: draft.driveFileUrl,
    });
    const drafted = await createApprovalEmail(db, {
      dealId: deal.id,
      gate: "video",
      to: brandEmail,
      subject: email.subject,
      body: email.body,
      attachmentUrl: email.attachmentUrl,
      attachmentNote: email.attachmentNote,
    }, { email: input.actorEmail, role: input.actorRole });
    if (!drafted.ok) return { ok: false, status: drafted.status, error: drafted.error };
    approvalId = drafted.id;
  }

  await db.insert(draftReviews).values({
    id: crypto.randomUUID(),
    draftId: draft.id,
    dealId: deal.id,
    decision: input.decision,
    note,
    actorEmail: input.actorEmail,
    approvalId,
    createdAt: timestamp,
  });
  const message = input.decision === "approved"
    ? `Your manager approved v${draft.version} for ${deal.brand}. We're sending it to the brand after Kamron approves the email.`
    : `Your manager asked for changes on ${deal.brand} v${draft.version}. ${note}`;
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: input.decision === "approved" ? "video_approved" : "video_changes",
    message,
    createdAt: timestamp,
    readAt: null,
  });
  return { ok: true, decision: input.decision, approvalId, workflowStage: moved.workflowStage };
}

export async function listDraftReviews(db: PortalDb, since: string | null): Promise<DraftReviewRow[]> {
  const reviewRows = since
    ? await db.select().from(draftReviews).where(gt(draftReviews.createdAt, since)).orderBy(asc(draftReviews.createdAt))
    : await db.select().from(draftReviews).orderBy(asc(draftReviews.createdAt));
  return shapeReviews(db, reviewRows);
}

async function shapeReviews(db: PortalDb, reviewRows: Array<typeof draftReviews.$inferSelect>): Promise<DraftReviewRow[]> {
  const [draftRows, dealRows, creatorRows, managerByCreator] = await Promise.all([
    db.select({
      id: drafts.id,
      version: drafts.version,
      filename: drafts.filename,
      status: drafts.status,
      driveFileId: drafts.driveFileId,
      driveFileUrl: drafts.driveFileUrl,
    }).from(drafts),
    db.select({ id: deals.id, brand: deals.brand, creatorId: deals.creatorId, workflowStage: deals.workflowStage }).from(deals),
    db.select({ id: creators.id, name: creators.name }).from(creators),
    assignedManagersByCreator(db),
  ]);
  const draftById = new Map(draftRows.map((row) => [row.id, row]));
  const dealById = new Map(dealRows.map((row) => [row.id, row]));
  const nameById = new Map(creatorRows.map((row) => [row.id, row.name]));
  return reviewRows.flatMap((row) => {
    const draft = draftById.get(row.draftId);
    const deal = dealById.get(row.dealId);
    if (!draft || !deal) return [];
    return [{
      id: row.id,
      draftId: row.draftId,
      dealId: row.dealId,
      brand: deal.brand,
      creatorId: deal.creatorId,
      creatorName: nameById.get(deal.creatorId) ?? "Creator",
      manager: managerByCreator.get(deal.creatorId) ?? null,
      version: draft.version,
      filename: draft.filename,
      decision: row.decision,
      note: row.note,
      actorEmail: row.actorEmail,
      approvalId: row.approvalId,
      driveFileId: draft.driveFileId,
      driveFileUrl: draft.driveFileUrl,
      draftStatus: draft.status,
      workflowStage: deal.workflowStage,
      createdAt: row.createdAt,
    }];
  });
}

export async function listUnreadCreatorNotices(db: PortalDb, creatorId: string) {
  const notes = await db
    .select()
    .from(creatorNotifications)
    .where(and(eq(creatorNotifications.creatorId, creatorId), isNull(creatorNotifications.readAt)))
    .orderBy(asc(creatorNotifications.createdAt));
  return notes.map((note) => ({
    id: note.id,
    dealId: note.dealId,
    kind: note.kind,
    message: note.message,
    createdAt: note.createdAt,
  }));
}

export async function dismissCreatorNotice(db: PortalDb, creatorId: string, noticeId: string) {
  const rows = await db.select().from(creatorNotifications).where(eq(creatorNotifications.id, noticeId));
  const note = rows[0];
  if (!note || note.creatorId !== creatorId || note.readAt) return;
  await db.update(creatorNotifications).set({ readAt: nowIso() }).where(eq(creatorNotifications.id, note.id));
}
