import { and, desc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  approvalEvents,
  brandCrmEntries,
  brandReplyDrafts,
  creators,
  deals,
  gmailBridgeAudit,
  gmailBridgeMessages,
  gmailBridgeThreads,
  gmailSeenMessages,
} from "@/db/schema";
import { BRAND_EMAIL_SENDER } from "./approvals";
import { normalizeEmail, nowIso, withBasePath } from "./format";
import { gmailSyncEnabled } from "./gmail-sync-flag";
import { BRAND_INQUIRY, FREE_MAIL_DOMAINS, isAutomatedSender } from "./gmail-live";
import {
  gmailReadClient,
  isBulkMail,
  isDraftMail,
  isSpamSender,
  creatorForMailbox,
  isWatchedMailboxSender,
  openOrMatchBrandDeal,
  senderDomain,
  senderEmail,
  type GmailHistoryMessage,
} from "./gmail-push";
import {
  createGmailBridgeOAuthState,
  googleConfigured,
  googleGmailBridgeAuthUrl,
} from "./google-oauth";
import { assignedCreatorIds, findManagerByEmail } from "./managers";
import { tokenEncryptionConfigured } from "./token-crypto";
import type { Viewer } from "./types";

export { gmailSyncEnabled } from "./gmail-sync-flag";

export type BridgeAttachment = { id: string; filename: string; mimeType: string };

export type BridgeMessage = GmailHistoryMessage & {
  snippet?: string;
  attachments?: BridgeAttachment[];
};

export type DealInboxThread = {
  id: string;
  creatorId: string;
  creatorName: string;
  brand: string;
  subject: string;
  snippet: string;
  fromEmail: string;
  classification: string;
  private: boolean;
  dealId: string | null;
  updatedAt: string;
  messages: { id: string; fromEmail: string; subject: string; snippet: string; attachments: BridgeAttachment[] }[];
};

function clip(value: string, max = 500) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function brandLabel(from: string, subject: string) {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  const name = named?.[1]?.trim() ?? "";
  if (name && !name.includes("@")) return clip(name, 80);
  const domain = senderDomain(from);
  const label = domain.split(".")[0] ?? "";
  if (label && !FREE_MAIL_DOMAINS.has(domain)) return label.charAt(0).toUpperCase() + label.slice(1);
  return clip(subject, 80) || "Brand";
}

function redact(text: string, secrets: string[]) {
  let out = text;
  const unique = [...new Set(secrets.filter((secret) => secret.length >= 6))].sort((left, right) => right.length - left.length);
  for (const secret of unique) out = out.split(secret).join("[redacted]");
  return out
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/1\/\/[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/v1:[A-Za-z0-9+/=]{16,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttachments(raw: string): BridgeAttachment[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { id?: unknown; filename?: unknown; mimeType?: unknown };
      if (typeof row.id !== "string" || typeof row.filename !== "string") return [];
      return [{ id: row.id, filename: row.filename, mimeType: typeof row.mimeType === "string" ? row.mimeType : "application/octet-stream" }];
    });
  } catch {
    return [];
  }
}

export function gmailSyncStatusLine(role: Viewer["role"]) {
  if (gmailSyncEnabled()) {
    return "Brand mail from the connected inbox shows up here. The portal only reads it. A reply stays a draft until Kamron approves it. Nothing is sent on its own.";
  }
  if (role === "admin") {
    return "Live sync is off. Set GMAIL_SYNC_ENABLED to true after the Google Cloud watch is in place. Connecting still saves an encrypted token. Nothing is read or sent while the switch is off.";
  }
  return "Live sync is off. Your connection can be saved, and mail is not read yet. Nothing is sent.";
}

export function gmailBridgeConnectHref(viewer: Viewer, creatorId: string) {
  const self = viewer.role === "creator" && viewer.creatorId === creatorId;
  if (viewer.role !== "admin" && !self) return null;
  return withBasePath(`/api/auth/gmail/bridge?creator=${encodeURIComponent(creatorId)}`);
}

export async function beginGmailBridgeConnect(viewer: Viewer | null, creatorId: string, loginHint: string) {
  const self = viewer?.role === "creator" && viewer.creatorId === creatorId;
  const owner = viewer?.role === "admin";
  if (!self && !owner) return { ok: false as const, reason: "creator_only" as const };
  if (!googleConfigured() || !tokenEncryptionConfigured()) return { ok: false as const, reason: "not_configured" as const };
  const state = await createGmailBridgeOAuthState();
  return {
    ok: true as const,
    state,
    creatorId,
    url: googleGmailBridgeAuthUrl(state, loginHint),
  };
}

async function managerIds(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "manager") return new Set<string>();
  const manager = await findManagerByEmail(db, viewer.email);
  if (!manager?.active) return new Set<string>();
  return new Set(await assignedCreatorIds(db, manager.id));
}

/** A dismissed thread stays dismissed. A confirmed deal is not turned back into an inquiry by a later sync. */
export function keptInboxClassification(current: string, incoming: string) {
  if (current === "not_deal") return "not_deal";
  if (current === "deal" || incoming === "deal") return "deal";
  return current || incoming;
}

function canSee(viewer: Viewer, thread: { creatorId: string; classification: string; private: boolean }, allowed: Set<string>) {
  if (thread.classification === "not_deal") return false;
  if (viewer.role === "admin") return true;
  if (viewer.role === "creator") return viewer.creatorId === thread.creatorId && thread.classification !== "not_deal";
  if (viewer.role === "manager") {
    if (!allowed.has(thread.creatorId)) return false;
    if (thread.private || thread.classification === "not_deal") return false;
    return true;
  }
  return false;
}

async function audit(db: PortalDb, viewer: Viewer, threadRowId: string, action: string) {
  await db.insert(gmailBridgeAudit).values({
    id: crypto.randomUUID(),
    actorEmail: viewer.email,
    actorRole: viewer.role,
    threadRowId,
    action,
    createdAt: nowIso(),
  });
}

export async function isBrandInquiry(
  db: PortalDb,
  creatorId: string,
  message: BridgeMessage,
  mailbox: string,
): Promise<{ keep: boolean; classification: "deal" | "inquiry" | "not_deal" }> {
  const from = senderEmail(message.from);
  if (!message.threadId || isSpamSender(message.from) || isAutomatedSender(message.from) || isBulkMail(message.labelIds) || isDraftMail(message.labelIds) || isWatchedMailboxSender(message.from)) {
    return { keep: false, classification: "not_deal" };
  }
  const existing = await db
    .select()
    .from(gmailBridgeThreads)
    .where(and(eq(gmailBridgeThreads.creatorId, creatorId), eq(gmailBridgeThreads.threadId, message.threadId)));
  if (existing[0]?.classification === "not_deal") return { keep: true, classification: "not_deal" };
  if (existing[0]?.classification === "deal") return { keep: true, classification: "deal" };
  if (existing[0]?.classification === "inquiry") return { keep: true, classification: "inquiry" };

  const dealRows = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  const own = from === normalizeEmail(mailbox);
  const threadDeal = dealRows.find((deal) => deal.gmailThreadId === message.threadId);
  if (own) return threadDeal ? { keep: true, classification: "deal" } : { keep: false, classification: "not_deal" };
  if (!from) return { keep: false, classification: "not_deal" };
  if (threadDeal) return { keep: true, classification: "deal" };

  const domain = senderDomain(message.from);
  const free = FREE_MAIL_DOMAINS.has(domain);
  const subject = `${message.subject} ${message.snippet ?? ""}`;
  for (const deal of dealRows) {
    const contact = senderEmail(deal.contact ?? "");
    if (contact && contact === from) return { keep: true, classification: "deal" };
    if (!free && contact && senderDomain(contact) === domain && domain) return { keep: true, classification: "deal" };
    const brand = deal.brand.trim().toLowerCase();
    if (brand.length >= 3 && subject.toLowerCase().includes(brand)) return { keep: true, classification: "deal" };
  }
  const crm = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.creatorId, creatorId));
  for (const row of crm) {
    const contact = senderEmail(row.contactEmail ?? "");
    if (contact && contact === from) return { keep: true, classification: "inquiry" };
    const rowDomain = (row.domain ?? "").toLowerCase();
    if (!free && rowDomain && rowDomain === domain) return { keep: true, classification: "inquiry" };
  }
  if (BRAND_INQUIRY.test(subject)) return { keep: true, classification: "inquiry" };
  return { keep: false, classification: "not_deal" };
}

async function markSeen(db: PortalDb, mailbox: string, message: { id: string; threadId: string }) {
  const existing = await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, message.id));
  if (existing[0]) return;
  await db.insert(gmailSeenMessages).values({
    messageId: message.id,
    mailbox,
    threadId: message.threadId,
    createdAt: nowIso(),
  });
}

export async function recordBrandMessage(
  db: PortalDb,
  input: {
    creatorId: string;
    mailbox: string;
    message: BridgeMessage;
    dealId: string | null;
    classification: "deal" | "inquiry" | "not_deal";
  },
) {
  if (!input.message.threadId || !input.message.id) return null;
  const timestamp = nowIso();
  const snippet = clip(input.message.snippet || input.message.subject || "New brand email");
  const subject = clip(input.message.subject || "New brand email", 200);
  const fromEmail = senderEmail(input.message.from);
  const existing = await db
    .select()
    .from(gmailBridgeThreads)
    .where(and(eq(gmailBridgeThreads.creatorId, input.creatorId), eq(gmailBridgeThreads.threadId, input.message.threadId)));
  let threadRowId = existing[0]?.id ?? "";
  if (!existing[0]) {
    if (input.classification === "not_deal") return null;
    threadRowId = crypto.randomUUID();
    await db.insert(gmailBridgeThreads).values({
      id: threadRowId,
      creatorId: input.creatorId,
      mailbox: normalizeEmail(input.mailbox),
      threadId: input.message.threadId,
      dealId: input.dealId,
      brand: brandLabel(input.message.from, subject),
      subject,
      snippet,
      fromEmail,
      classification: input.classification,
      private: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } else {
    threadRowId = existing[0].id;
    const classification = keptInboxClassification(existing[0].classification, input.classification);
    await db.update(gmailBridgeThreads).set({
      dealId: input.dealId ?? existing[0].dealId,
      subject,
      snippet,
      fromEmail: fromEmail || existing[0].fromEmail,
      classification,
      updatedAt: timestamp,
    }).where(eq(gmailBridgeThreads.id, threadRowId));
  }
  const seen = await db.select().from(gmailBridgeMessages).where(eq(gmailBridgeMessages.messageId, input.message.id));
  if (!seen[0]) {
    await db.insert(gmailBridgeMessages).values({
      messageId: input.message.id,
      threadRowId,
      fromEmail,
      subject,
      snippet,
      attachmentsJson: JSON.stringify(input.message.attachments ?? []),
      createdAt: timestamp,
    });
  }
  return threadRowId;
}

async function defaultRead(refreshToken: string): Promise<BridgeMessage[]> {
  const client = await gmailReadClient(refreshToken);
  const refs = client.listRecent ? await client.listRecent() : [];
  const messages: BridgeMessage[] = [];
  for (const ref of refs) {
    const message = await client.getMessage(ref.id);
    if (!message.threadId) continue;
    messages.push({ ...message, snippet: message.subject });
  }
  return messages;
}

export async function syncConnectedMailboxes(
  db: PortalDb,
  options?: {
    read?: (input: { creatorId: string; mailbox: string; refreshToken: string }) => Promise<BridgeMessage[]>;
  },
) {
  if (!gmailSyncEnabled()) return { enabled: false as const, mailboxes: [] as { mailbox: string; ok: boolean; filed?: number; error?: string }[] };
  const rows = await db.select().from(creators);
  const read = options?.read ?? (async ({ refreshToken }) => defaultRead(refreshToken));
  const mailboxes: { mailbox: string; ok: boolean; filed?: number; error?: string }[] = [];
  for (const row of rows) {
    const mailbox = normalizeEmail(row.gmailEmail ?? "");
    if (!mailbox || !row.gmailRefreshToken) continue;
    if (creatorForMailbox(mailbox)) continue;
    let refreshToken = "";
    try {
      const { decryptToken } = await import("./token-crypto");
      refreshToken = await decryptToken(row.gmailRefreshToken);
    } catch {
      mailboxes.push({ mailbox, ok: false, error: "Could not read the saved token." });
      continue;
    }
    if (!refreshToken || row.gmailRefreshToken.includes(refreshToken)) {
      mailboxes.push({ mailbox, ok: false, error: "Could not read the saved token." });
      continue;
    }
    try {
      const messages = await read({ creatorId: row.id, mailbox, refreshToken });
      let filed = 0;
      for (const message of messages) {
        const seen = await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, message.id));
        if (seen[0]) continue;
        const decision = await isBrandInquiry(db, row.id, message, mailbox);
        if (!decision.keep) {
          await markSeen(db, mailbox, message);
          continue;
        }
        let dealId: string | null = null;
        if (decision.classification !== "not_deal") {
          const opened = await openOrMatchBrandDeal(db, row.id, message);
          dealId = opened.dealId;
        }
        await recordBrandMessage(db, {
          creatorId: row.id,
          mailbox,
          message,
          dealId,
          classification: decision.classification,
        });
        await markSeen(db, mailbox, message);
        if (decision.classification !== "not_deal") filed += 1;
      }
      mailboxes.push({ mailbox, ok: true, filed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail sync failed.";
      mailboxes.push({ mailbox, ok: false, error: redact(message, [refreshToken, row.gmailRefreshToken]).slice(0, 300) || "Gmail sync failed." });
    }
  }
  return { enabled: true as const, mailboxes };
}

async function loadThreads(db: PortalDb) {
  const [threads, messages, people] = await Promise.all([
    db.select().from(gmailBridgeThreads).orderBy(desc(gmailBridgeThreads.updatedAt)),
    db.select().from(gmailBridgeMessages),
    db.select({ id: creators.id, name: creators.name }).from(creators),
  ]);
  const nameById = new Map(people.map((person) => [person.id, person.name]));
  return threads.map((thread) => ({
    ...thread,
    creatorName: nameById.get(thread.creatorId) ?? "Creator",
    messages: messages
      .filter((message) => message.threadRowId === thread.id)
      .map((message) => ({
        id: message.messageId,
        fromEmail: message.fromEmail,
        subject: message.subject,
        snippet: message.snippet,
        attachments: parseAttachments(message.attachmentsJson),
      })),
  }));
}

export async function listDealInbox(db: PortalDb, viewer: Viewer, creatorFilter?: string | null) {
  const allowed = await managerIds(db, viewer);
  const threads = (await loadThreads(db)).filter((thread) => {
    if (creatorFilter && creatorFilter !== "all" && thread.creatorId !== creatorFilter) return false;
    return canSee(viewer, thread, allowed);
  });
  for (const thread of threads) await audit(db, viewer, thread.id, "view");
  return threads.map((thread): DealInboxThread => ({
    id: thread.id,
    creatorId: thread.creatorId,
    creatorName: thread.creatorName,
    brand: thread.brand,
    subject: thread.subject,
    snippet: thread.snippet,
    fromEmail: thread.fromEmail,
    classification: thread.classification,
    private: thread.private,
    dealId: thread.dealId,
    updatedAt: thread.updatedAt,
    messages: thread.messages,
  }));
}

export async function listBotThreads(db: PortalDb) {
  const threads = await loadThreads(db);
  return threads
    .filter((thread) => !thread.private)
    .map((thread) => ({
      id: thread.id,
      creatorId: thread.creatorId,
      creatorName: thread.creatorName,
      threadId: thread.threadId,
      brand: thread.brand,
      subject: thread.private ? "Private" : thread.subject,
      snippet: thread.classification === "not_deal" ? "" : thread.snippet,
      fromEmail: thread.fromEmail,
      classification: thread.classification,
      dealId: thread.dealId,
      updatedAt: thread.updatedAt,
    }));
}

async function threadFor(db: PortalDb, viewer: Viewer, threadRowId: string) {
  const allowed = await managerIds(db, viewer);
  const threads = await loadThreads(db);
  const thread = threads.find((item) => item.id === threadRowId);
  if (!thread || !canSee(viewer, thread, allowed)) return null;
  return thread;
}

export async function queueBrandReply(db: PortalDb, viewer: Viewer, input: { threadId: string; body: string }) {
  const thread = await threadFor(db, viewer, input.threadId);
  if (!thread) return { ok: false as const, status: 404, error: "That thread is not on your list." };
  const body = input.body.trim();
  if (!body) return { ok: false as const, status: 400, error: "Write the reply first." };
  if (!thread.dealId) return { ok: false as const, status: 400, error: "This thread is not on a deal yet." };
  const to = thread.fromEmail;
  if (!to.includes("@")) return { ok: false as const, status: 400, error: "That thread has no brand address." };
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const subject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;
  await db.insert(approvalEmails).values({
    id,
    dealId: thread.dealId,
    gate: "brand_reply",
    status: "pending",
    toEmail: to,
    subject,
    body,
    attachmentNote: null,
    attachmentUrl: null,
    fromEmail: BRAND_EMAIL_SENDER,
    gmailThreadId: thread.threadId,
    gmailMessageId: null,
    sentAt: null,
    brandContactName: null,
    brandContactEmail: null,
    brandContactCompany: null,
    suggestedCreatorId: null,
    suggestedPlan: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(approvalEvents).values({
    id: crypto.randomUUID(),
    approvalId: id,
    action: "created",
    actorEmail: viewer.email,
    actorRole: viewer.role,
    subject,
    body,
    note: "Draft only. Nothing was sent.",
    createdAt: timestamp,
  });
  const existing = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, thread.dealId));
  if (existing[0]) {
    await db.update(brandReplyDrafts).set({ body, updatedBy: viewer.email, updatedAt: timestamp }).where(eq(brandReplyDrafts.dealId, thread.dealId));
  } else {
    await db.insert(brandReplyDrafts).values({ dealId: thread.dealId, body, updatedBy: viewer.email, updatedAt: timestamp });
  }
  await audit(db, viewer, thread.id, "draft");
  return { ok: true as const, approvalId: id, status: "pending" as const, sent: false as const };
}

export async function setThreadPrivate(db: PortalDb, viewer: Viewer, threadId: string, isPrivate: boolean) {
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return { ok: false as const, status: 403, error: "Only the creator can mark a thread private." };
  }
  const rows = await db.select().from(gmailBridgeThreads).where(eq(gmailBridgeThreads.id, threadId));
  const thread = rows[0];
  if (!thread || thread.creatorId !== viewer.creatorId) {
    return { ok: false as const, status: 404, error: "That thread is not on your list." };
  }
  await db.update(gmailBridgeThreads).set({ private: isPrivate, updatedAt: nowIso() }).where(eq(gmailBridgeThreads.id, threadId));
  await audit(db, viewer, threadId, isPrivate ? "private" : "unprivate");
  return { ok: true as const };
}

export async function classifyThread(db: PortalDb, viewer: Viewer, threadId: string, classification: string) {
  if (viewer.role !== "admin") return { ok: false as const, status: 403, error: "Only the owner can change this." };
  if (classification !== "deal" && classification !== "not_deal") {
    return { ok: false as const, status: 400, error: "Pick deal or not a deal." };
  }
  const rows = await db.select().from(gmailBridgeThreads).where(eq(gmailBridgeThreads.id, threadId));
  if (!rows[0]) return { ok: false as const, status: 404, error: "That thread is not on your list." };
  await db.update(gmailBridgeThreads).set({
    classification,
    updatedAt: nowIso(),
  }).where(eq(gmailBridgeThreads.id, threadId));
  await audit(db, viewer, threadId, classification);
  return { ok: true as const, private: rows[0].private };
}

export async function listBridgeAudit(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return { ok: false as const, status: 403, error: "Only the owner can read the mail log." };
  const rows = await db.select().from(gmailBridgeAudit).orderBy(desc(gmailBridgeAudit.createdAt));
  return {
    ok: true as const,
    entries: rows.map((row) => ({
      id: row.id,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      threadId: row.threadRowId,
      action: row.action,
      createdAt: row.createdAt,
    })),
  };
}

export async function removeBridgeAudit() {
  return { ok: false as const, status: 403, error: "The mail log cannot be deleted." };
}

export async function readThreadAttachment(
  db: PortalDb,
  viewer: Viewer,
  input: { threadId: string; messageId: string; attachmentId: string },
  loader: (input: { messageId: string; attachmentId: string; refreshToken: string }) => Promise<{ bytes: Uint8Array; mimeType: string } | null>,
) {
  if (input.attachmentId === "all" || input.attachmentId === "bulk" || input.attachmentId === "zip") {
    return { ok: false as const, status: 400, error: "One file at a time. The portal does not build a zip." };
  }
  const thread = await threadFor(db, viewer, input.threadId);
  if (!thread) return { ok: false as const, status: 404, error: "That thread is not on your list." };
  const message = thread.messages.find((item) => item.id === input.messageId);
  const attachment = message?.attachments.find((item) => item.id === input.attachmentId);
  if (!message || !attachment) return { ok: false as const, status: 404, error: "That file is not on this thread." };
  if (attachment.filename.toLowerCase().endsWith(".zip")) {
    return { ok: false as const, status: 400, error: "One file at a time. The portal does not build a zip." };
  }
  const stored = await db.select({ cipher: creators.gmailRefreshToken }).from(creators).where(eq(creators.id, thread.creatorId));
  const cipher = stored[0]?.cipher ?? "";
  if (!cipher) return { ok: false as const, status: 404, error: "That inbox is not connected." };
  let refreshToken = "";
  try {
    const { decryptToken } = await import("./token-crypto");
    refreshToken = await decryptToken(cipher);
  } catch {
    return { ok: false as const, status: 404, error: "That inbox is not connected." };
  }
  const file = await loader({ messageId: message.id, attachmentId: attachment.id, refreshToken });
  if (!file) return { ok: false as const, status: 404, error: "That file is not on this thread." };
  await audit(db, viewer, thread.id, "attachment");
  return {
    ok: true as const,
    filename: attachment.filename,
    mimeType: file.mimeType || attachment.mimeType,
    bytes: file.bytes,
  };
}

export async function deleteBridgeForCreator(db: PortalDb, creatorId: string) {
  const threads = await db.select({ id: gmailBridgeThreads.id }).from(gmailBridgeThreads).where(eq(gmailBridgeThreads.creatorId, creatorId));
  for (const thread of threads) {
    await db.delete(gmailBridgeMessages).where(eq(gmailBridgeMessages.threadRowId, thread.id));
  }
  await db.delete(gmailBridgeThreads).where(eq(gmailBridgeThreads.creatorId, creatorId));
}

export async function classifyBotThread(
  db: PortalDb,
  input: { creatorEmail: string; threadId: string; classification: string },
) {
  if (input.classification !== "deal" && input.classification !== "not_deal") {
    return { ok: false as const, status: 400, error: "Pick deal or not a deal." };
  }
  const email = normalizeEmail(input.creatorEmail);
  const people = await db.select().from(creators);
  const creator = people.find((row) => normalizeEmail(row.email) === email);
  if (!creator) return { ok: false as const, status: 404, error: "Creator not found." };
  const rows = await db.select().from(gmailBridgeThreads).where(and(
    eq(gmailBridgeThreads.creatorId, creator.id),
    eq(gmailBridgeThreads.threadId, input.threadId),
  ));
  const thread = rows[0];
  if (!thread) return { ok: false as const, status: 404, error: "That thread is not on your list." };
  await db.update(gmailBridgeThreads).set({
    classification: input.classification,
    updatedAt: nowIso(),
  }).where(eq(gmailBridgeThreads.id, thread.id));
  return { ok: true as const, id: thread.id, classification: input.classification, private: thread.private };
}
