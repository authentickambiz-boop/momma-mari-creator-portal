import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, approvalEvents, brandContacts, campaigns, creators, deals, emailCopies, outsideOffers, prospects } from "@/db/schema";
import { EMAIL_APPROVER_ROLES } from "./authz";
import { archiveApprovalCopy } from "./email-archive";
import { assertStaffAccess } from "./managers";
import { normalizeEmail, nowIso } from "./format";

/** Brand and recruiting mail goes out from this mailbox only. */
export const BRAND_EMAIL_SENDER = "authentickambiz@gmail.com";

export const APPROVAL_GATES = [
  { id: "interest", label: "Interest email" },
  { id: "revision", label: "Contract changes" },
  { id: "signed_contract", label: "Signed contract" },
  { id: "video", label: "Video for the brand" },
  { id: "decline", label: "Polite decline" },
  { id: "post_link", label: "Post link to brand" },
  { id: "reminder", label: "Due date reminder" },
  { id: "report", label: "Monthly report" },
] as const;

export type ApprovalGate = (typeof APPROVAL_GATES)[number]["id"];
export type ApprovalStatus = "pending" | "approved" | "rejected" | "sent";

const GATE_IDS = new Set<string>(APPROVAL_GATES.map((gate) => gate.id));

export function isApprovalGate(value: string): value is ApprovalGate {
  return GATE_IDS.has(value);
}

export function approvalGateLabel(id: string) {
  if (id === "brand_reply") return "Brand reply";
  return APPROVAL_GATES.find((gate) => gate.id === id)?.label ?? id;
}

export function approvalStatusLabel(status: string) {
  if (status === "pending") return "Waiting for your OK";
  if (status === "approved") return "Approved, waiting to be sent";
  if (status === "rejected") return "Rejected, not sent";
  if (status === "sent") return "Sent";
  return status;
}

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type ApprovalDraftInput = {
  dealId: string;
  gate: string;
  to: string;
  subject: string;
  body: string;
  attachmentNote?: string | null;
  attachmentUrl?: string | null;
  gmailThreadId?: string | null;
  from?: string | null;
  status?: string | null;
  brandContactName?: string | null;
  brandContactEmail?: string | null;
  brandContactCompany?: string | null;
  suggestedCreatorId?: string | null;
  suggestedPlan?: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

async function logEvent(
  db: PortalDb,
  input: {
    approvalId: string;
    action: string;
    actorEmail: string;
    actorRole: string;
    subject: string | null;
    body: string | null;
    note: string | null;
    createdAt: string;
  },
) {
  await db.insert(approvalEvents).values({
    id: crypto.randomUUID(),
    approvalId: input.approvalId,
    action: input.action,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    subject: input.subject,
    body: input.body,
    note: input.note,
    createdAt: input.createdAt,
  });
}

export async function createApprovalEmail(
  db: PortalDb,
  input: ApprovalDraftInput,
  actor: { email: string; role: string },
): Promise<Result<{ id: string; status: "pending"; from: string }>> {
  const creatorDraft = actor.role === "creator" && (input.gate === "interest" || input.gate === "decline");
  const adminDraft = actor.role === "admin" && (input.gate === "video" || input.gate === "revision" || input.gate === "post_link" || input.gate === "report");
  const managerDraft = actor.role === "manager" && (input.gate === "video" || input.gate === "revision" || input.gate === "post_link");
  if (actor.role !== "bot" && !creatorDraft && !adminDraft && !managerDraft) {
    return { ok: false, status: 403, error: "Only the bot can draft an email. An admin approves it in the portal." };
  }
  if (input.status && input.status !== "pending") {
    return { ok: false, status: 403, error: "Only an admin can approve an email. New drafts stay pending." };
  }
  if (input.from && normalizeEmail(input.from) !== BRAND_EMAIL_SENDER) {
    return { ok: false, status: 400, error: `Brand email has to go out from ${BRAND_EMAIL_SENDER}.` };
  }
  if (!isApprovalGate(input.gate)) {
    return { ok: false, status: 400, error: "gate must be interest, revision, signed_contract, video, decline, post_link, reminder, or report." };
  }
  const to = clean(input.to);
  const subject = clean(input.subject);
  const body = clean(input.body);
  if (!to || !to.includes("@")) return { ok: false, status: 400, error: "to must be an email address." };
  if (!subject) return { ok: false, status: 400, error: "subject is required." };
  if (!body) return { ok: false, status: 400, error: "body is required." };

  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (actor.role === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: actor.email,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: input.gate === "video" ? "video" : input.gate === "post_link" ? "email" : "contract",
    });
    if (!allowed.ok) return allowed;
  }

  let brandContactName: string | null = null;
  let brandContactEmail: string | null = null;
  let brandContactCompany: string | null = null;
  let suggestedCreatorId: string | null = null;
  let suggestedPlan: string | null = null;
  if (input.gate === "decline") {
    brandContactName = clean(input.brandContactName);
    brandContactEmail = clean(input.brandContactEmail);
    brandContactCompany = clean(input.brandContactCompany) ?? deal.brand;
    suggestedCreatorId = clean(input.suggestedCreatorId);
    suggestedPlan = clean(input.suggestedPlan);
    if (!brandContactEmail && !clean(input.brandContactCompany) && !brandContactName) {
      return { ok: false, status: 400, error: "A polite decline needs the brand contact's name, email, or company so we can save them." };
    }
    if (!suggestedCreatorId && !suggestedPlan) {
      return { ok: false, status: 400, error: "A polite decline needs a smaller roster creator or another plan." };
    }
    if (suggestedCreatorId) {
      const suggested = await db.select().from(creators).where(eq(creators.id, suggestedCreatorId));
      if (!suggested[0]) return { ok: false, status: 400, error: "That suggested creator is not on the roster." };
      if (suggestedCreatorId === deal.creatorId) {
        return { ok: false, status: 400, error: "Suggest a different creator than the one passing on this deal." };
      }
    }
  }

  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(approvalEmails).values({
    id,
    dealId: deal.id,
    gate: input.gate,
    status: "pending",
    toEmail: to,
    subject,
    body,
    attachmentNote: clean(input.attachmentNote),
    attachmentUrl: clean(input.attachmentUrl),
    fromEmail: BRAND_EMAIL_SENDER,
    gmailThreadId: clean(input.gmailThreadId) ?? deal.gmailThreadId,
    gmailMessageId: null,
    sentAt: null,
    brandContactName,
    brandContactEmail,
    brandContactCompany,
    suggestedCreatorId,
    suggestedPlan,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await logEvent(db, {
    approvalId: id,
    action: "created",
    actorEmail: actor.email,
    actorRole: actor.role,
    subject,
    body,
    note: null,
    createdAt: timestamp,
  });
  return { ok: true, id, status: "pending", from: BRAND_EMAIL_SENDER };
}

async function loadApproval(db: PortalDb, approvalId: string) {
  const rows = await db.select().from(approvalEmails).where(eq(approvalEmails.id, approvalId));
  return rows[0] ?? null;
}

function approverOrReject(role: string) {
  if (!(EMAIL_APPROVER_ROLES as readonly string[]).includes(role)) {
    return { ok: false as const, status: 403, error: "Only an approver can change an email. Approvers are the admin addresses." };
  }
  return null;
}

export async function reviewApproval(
  db: PortalDb,
  input: {
    approvalId: string;
    intent: string;
    subject?: string | null;
    body?: string | null;
    note?: string | null;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ id: string; status: ApprovalStatus }>> {
  if (input.actorRole !== "manager") {
    const denied = approverOrReject(input.actorRole);
    if (denied) return denied;
  }
  if (input.intent !== "edit" && input.intent !== "approve" && input.intent !== "reject") {
    return { ok: false, status: 400, error: "intent must be edit, approve, or reject." };
  }
  const row = await loadApproval(db, input.approvalId);
  if (!row) return { ok: false, status: 404, error: "Email not found." };
  if (row.gate === "brand_reply" && input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only the owner can approve a brand reply. Nothing was sent." };
  }
  if (input.actorRole === "manager") {
    const dealRows = await db.select().from(deals).where(eq(deals.id, row.dealId));
    const deal = dealRows[0];
    if (!deal) return { ok: false, status: 404, error: "Deal not found." };
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "email",
    });
    if (!allowed.ok) return allowed;
  }
  if (row.status === "sent") return { ok: false, status: 409, error: "This email was already sent." };

  const timestamp = nowIso();
  const note = clean(input.note);

  if (input.intent === "reject") {
    if (row.status === "rejected") return { ok: true, id: row.id, status: "rejected" };
    await db.update(approvalEmails).set({ status: "rejected", updatedAt: timestamp }).where(eq(approvalEmails.id, row.id));
    await logEvent(db, {
      approvalId: row.id,
      action: "rejected",
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      subject: row.subject,
      body: row.body,
      note,
      createdAt: timestamp,
    });
    return { ok: true, id: row.id, status: "rejected" };
  }

  if (row.status !== "pending") {
    return { ok: false, status: 409, error: "Only a waiting email can be edited or approved." };
  }
  const subject = clean(input.subject) ?? row.subject;
  const body = clean(input.body) ?? row.body;
  if (!subject || !body) return { ok: false, status: 400, error: "subject and body are required." };

  if (input.intent === "edit") {
    await db.update(approvalEmails).set({ subject, body, updatedAt: timestamp }).where(eq(approvalEmails.id, row.id));
    await logEvent(db, {
      approvalId: row.id,
      action: "edited",
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      subject,
      body,
      note,
      createdAt: timestamp,
    });
    return { ok: true, id: row.id, status: "pending" };
  }

  await db.update(approvalEmails).set({ subject, body, status: "approved", updatedAt: timestamp }).where(eq(approvalEmails.id, row.id));
  await logEvent(db, {
    approvalId: row.id,
    action: "approved",
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    subject,
    body,
    note,
    createdAt: timestamp,
  });
  if (row.gate === "decline") await saveBrandContact(db, { ...row, subject, body }, input.actorEmail, timestamp);
  await archiveApprovalCopy(db, { ...row, subject, body }, "approved");
  return { ok: true, id: row.id, status: "approved" };
}

async function saveBrandContact(
  db: PortalDb,
  row: typeof approvalEmails.$inferSelect,
  savedBy: string,
  timestamp: string,
) {
  const existing = await db.select().from(brandContacts).where(eq(brandContacts.approvalId, row.id));
  if (existing[0]) return;
  const dealRows = await db.select().from(deals).where(eq(deals.id, row.dealId));
  await db.insert(brandContacts).values({
    id: crypto.randomUUID(),
    dealId: row.dealId,
    approvalId: row.id,
    company: row.brandContactCompany || dealRows[0]?.brand || "Unknown brand",
    contactName: row.brandContactName,
    contactEmail: row.brandContactEmail,
    note: "Saved when the polite decline was approved.",
    suggestedCreatorId: row.suggestedCreatorId,
    suggestedPlan: row.suggestedPlan,
    savedBy,
    createdAt: timestamp,
  });
}

export async function markApprovalSent(
  db: PortalDb,
  approvalId: string,
  input: { messageId: string; threadId?: string | null },
  actor: { email: string; role: string },
): Promise<Result<{ id: string; status: "sent"; messageId: string }>> {
  if (actor.role !== "bot") {
    return { ok: false, status: 403, error: "Only the bot can mark an approved email as sent." };
  }
  const messageId = clean(input.messageId);
  if (!messageId) return { ok: false, status: 400, error: "messageId is required." };
  const row = await loadApproval(db, approvalId);
  if (!row) return { ok: false, status: 404, error: "Email not found." };
  if (row.gate === "brand_reply") {
    return { ok: false, status: 409, error: "This reply stays a draft. The portal does not send it." };
  }
  if (row.status !== "approved") {
    return { ok: false, status: 409, error: "This email is not approved to send." };
  }
  const timestamp = nowIso();
  const threadId = clean(input.threadId) ?? row.gmailThreadId;
  await db.update(approvalEmails).set({
    status: "sent",
    gmailMessageId: messageId,
    gmailThreadId: threadId,
    sentAt: timestamp,
    updatedAt: timestamp,
  }).where(eq(approvalEmails.id, row.id));
  await logEvent(db, {
    approvalId: row.id,
    action: "sent",
    actorEmail: actor.email,
    actorRole: actor.role,
    subject: row.subject,
    body: row.body,
    note: messageId,
    createdAt: timestamp,
  });
  await archiveApprovalCopy(db, row, "sent");
  return { ok: true, id: row.id, status: "sent", messageId };
}

export type SendableApproval = {
  id: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  gate: string;
  status: "approved";
  sendable: true;
  from: string;
  to: string;
  subject: string;
  body: string;
  attachmentNote: string | null;
  attachmentUrl: string | null;
  gmailThreadId: string | null;
};

export function approvalListAllowed(status: string | null) {
  if (status && status !== "approved") {
    return {
      ok: false as const,
      status: 403,
      error: "Only approved emails can be fetched. Pending drafts stay in the portal until an admin approves them.",
    };
  }
  return { ok: true as const };
}

export async function listSendableApprovals(db: PortalDb): Promise<SendableApproval[]> {
  const rows = await db.select().from(approvalEmails).where(eq(approvalEmails.status, "approved")).orderBy(asc(approvalEmails.createdAt));
  const dealRows = await db.select().from(deals);
  const creatorRows = await db.select().from(creators);
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  return rows.flatMap((row) => {
    if (row.gate === "brand_reply") return [];
    const deal = dealById.get(row.dealId);
    if (!deal) return [];
    const creator = creatorById.get(deal.creatorId);
    return [{
      id: row.id,
      dealId: row.dealId,
      brand: deal.brand,
      creatorId: deal.creatorId,
      creatorName: creator?.name ?? "Creator",
      creatorEmail: creator?.email ?? "",
      gate: row.gate,
      status: "approved" as const,
      sendable: true as const,
      from: row.fromEmail,
      to: row.toEmail,
      subject: row.subject,
      body: row.body,
      attachmentNote: row.attachmentNote,
      attachmentUrl: row.attachmentUrl,
      gmailThreadId: row.gmailThreadId,
    }];
  });
}

export async function listBrandContacts(db: PortalDb) {
  return db.select().from(brandContacts).orderBy(asc(brandContacts.createdAt));
}

export type ApprovalQueueItem = {
  id: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  gate: string;
  gateLabel: string;
  status: string;
  statusLabel: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  body: string;
  attachmentNote: string | null;
  attachmentUrl: string | null;
  gmailThreadId: string | null;
  gmailMessageId: string | null;
  sentAt: string | null;
  brandContactName: string | null;
  brandContactEmail: string | null;
  brandContactCompany: string | null;
  suggestedCreatorId: string | null;
  suggestedCreatorName: string | null;
  suggestedPlan: string | null;
  createdAt: string;
  updatedAt: string;
  events: {
    id: string;
    action: string;
    actorEmail: string;
    actorRole: string;
    subject: string | null;
    body: string | null;
    note: string | null;
    createdAt: string;
  }[];
  copies: {
    id: string;
    kind: string;
    filename: string;
    stored: string;
    driveFileUrl: string | null;
    createdAt: string;
  }[];
};

const STATUS_ORDER = ["pending", "approved", "rejected", "sent"];

export async function listApprovalQueue(db: PortalDb, creatorId: string | "all", limitTo?: string[]): Promise<ApprovalQueueItem[]> {
  const [emailRows, eventRows, dealRows, creatorRows, copyRows, outsideRows, campaignRows, prospectRows] = await Promise.all([
    db.select().from(approvalEmails),
    db.select().from(approvalEvents).orderBy(asc(approvalEvents.createdAt)),
    db.select().from(deals),
    db.select().from(creators),
    db.select().from(emailCopies).orderBy(asc(emailCopies.createdAt)),
    db.select().from(outsideOffers),
    db.select().from(campaigns),
    db.select().from(prospects),
  ]);
  const outsideByApproval = new Map(outsideRows.filter((row) => row.approvalId).map((row) => [row.approvalId as string, row]));
  const campaignById = new Map(campaignRows.map((row) => [row.id, row]));
  const prospectById = new Map(prospectRows.map((row) => [row.id, row]));
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const eventsByApproval = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const list = eventsByApproval.get(event.approvalId) ?? [];
    list.push(event);
    eventsByApproval.set(event.approvalId, list);
  }
  const copiesByApproval = new Map<string, typeof copyRows>();
  for (const copy of copyRows) {
    const list = copiesByApproval.get(copy.approvalId) ?? [];
    list.push(copy);
    copiesByApproval.set(copy.approvalId, list);
  }
  return emailRows
    .flatMap((row) => {
      const deal = dealById.get(row.dealId);
      const outside = deal ? null : outsideByApproval.get(row.id);
      const outsideCampaign = outside ? campaignById.get(outside.campaignId) : null;
      const outsideProspect = outside ? prospectById.get(outside.prospectId) : null;
      if (!deal && (!outsideCampaign || !outsideProspect || creatorId !== "all" || limitTo)) return [];
      if (deal && limitTo && !limitTo.includes(deal.creatorId)) return [];
      if (deal && creatorId !== "all" && deal.creatorId !== creatorId) return [];
      const suggested = row.suggestedCreatorId ? creatorById.get(row.suggestedCreatorId) : null;
      return [{
        id: row.id,
        dealId: row.dealId,
        brand: deal?.brand ?? outsideCampaign?.brand ?? "Campaign",
        creatorId: deal?.creatorId ?? outsideProspect?.convertedCreatorId ?? "prospect",
        creatorName: deal ? (creatorById.get(deal.creatorId)?.name ?? "Creator") : (outsideProspect?.name ?? "Prospect"),
        gate: row.gate,
        gateLabel: approvalGateLabel(row.gate),
        status: row.status,
        statusLabel: approvalStatusLabel(row.status),
        toEmail: row.toEmail,
        fromEmail: row.fromEmail,
        subject: row.subject,
        body: row.body,
        attachmentNote: row.attachmentNote,
        attachmentUrl: row.attachmentUrl,
        gmailThreadId: row.gmailThreadId,
        gmailMessageId: row.gmailMessageId,
        sentAt: row.sentAt,
        brandContactName: row.brandContactName,
        brandContactEmail: row.brandContactEmail,
        brandContactCompany: row.brandContactCompany,
        suggestedCreatorId: row.suggestedCreatorId,
        suggestedCreatorName: suggested?.name ?? null,
        suggestedPlan: row.suggestedPlan,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        events: (eventsByApproval.get(row.id) ?? []).map((event) => ({
          id: event.id,
          action: event.action,
          actorEmail: event.actorEmail,
          actorRole: event.actorRole,
          subject: event.subject,
          body: event.body,
          note: event.note,
          createdAt: event.createdAt,
        })),
        copies: (copiesByApproval.get(row.id) ?? []).map((copy) => ({
          id: copy.id,
          kind: copy.kind,
          filename: copy.filename,
          stored: copy.stored,
          driveFileUrl: copy.driveFileUrl,
          createdAt: copy.createdAt,
        })),
      }];
    })
    .sort((a, b) => {
      const status = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (status !== 0) return status;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
}
