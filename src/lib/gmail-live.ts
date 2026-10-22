import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandReplyDrafts, gmailPortalDrafts } from "@/db/schema";
import { nowIso } from "./format";

/** Gmail labels the hourly inbox sort already uses. Adding a label does not send or delete mail. */
export const MM_LABEL = {
  deal: "MM/Deal",
  needsReply: "MM/Needs reply",
  waiting: "MM/Waiting",
  notDeal: "MM/Not a deal",
} as const;

export const GMAIL_DRAFT_AUTHOR = "gmail-push";

export type MailSort = "needs_reply" | "waiting" | "not_deal" | "skip";

export function labelsForSort(sort: MailSort) {
  if (sort === "needs_reply") return [MM_LABEL.deal, MM_LABEL.needsReply];
  if (sort === "waiting") return [MM_LABEL.deal, MM_LABEL.waiting];
  if (sort === "not_deal") return [MM_LABEL.notDeal];
  return [];
}

/** Sintra's Gmail drafts stay where they are. We do not edit or delete them. */
export function isSintraDraft(text: string | null | undefined) {
  return /\bsintra\b/i.test(text ?? "");
}

/** Free inboxes. A custom domain can still be a brand. These are personal unless the note is a brand pitch. */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "aol.com",
]);

/** Words that mark a brand pitch. Personal mail without one of these is not a deal. */
export const BRAND_INQUIRY = /\b(collab|collaboration|partnership|sponsor|sponsored|campaign|ugc|ambassador|gifted|paid post|brand deal|rate card|media kit)\b/i;

const AUTOMATED_LOCAL = /(?:^|[._+-])(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?|notify|automated|mailer-daemon|postmaster)(?:[._+-]|$)/i;
const AUTOMATED_ADDRESS = /(?:^|[^\w])(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?|notify|automated|mailer-daemon|postmaster)@/i;
const NOREPLY_DOMAIN = /@(?:[a-z0-9.-]+\.)?noreply\./i;

function addressIn(from: string) {
  const match = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

export function senderDisplayName(from: string) {
  const quoted = from.match(/^\s*"([^"]*)"\s*</);
  if (quoted) return quoted[1].trim();
  const bare = from.match(/^\s*([^"<]+?)\s*</);
  return bare?.[1]?.trim() ?? "";
}

/** GitHub and other bots sign the display name this way: cursor[bot]. */
export function isBotSenderName(from: string) {
  const name = senderDisplayName(from);
  return /\[bot\]/i.test(name) || /\[bot\]/i.test(from);
}

/** github.com and any subdomain, including notifications@ and reply.github.com. */
export function isGithubSender(from: string) {
  return /@(?:[a-z0-9.-]+\.)?github\.com(?=$|[\s>,;])/i.test(from);
}

export type MailHeaders = Record<string, string>;

/** List mail and auto-submitted notes. Precedence "list" is how GitHub marks notifications. */
export function isBulkHeader(headers: MailHeaders | null | undefined) {
  if (!headers) return false;
  const value = (name: string) => (headers[name.toLowerCase()] ?? headers[name] ?? "").trim();
  if (value("list-unsubscribe") || value("list-id")) return true;
  const precedence = value("precedence").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") return true;
  const auto = value("auto-submitted").toLowerCase();
  return Boolean(auto) && auto !== "no";
}

/** no-reply, notifications@, noreply domains, [bot] names, GitHub, and bulk headers. Never a deal. */
export function isAutomatedSender(from: string, headers?: MailHeaders | null) {
  if (isBotSenderName(from) || isGithubSender(from) || isBulkHeader(headers)) return true;
  if (AUTOMATED_ADDRESS.test(from) || NOREPLY_DOMAIN.test(from)) return true;
  const local = addressIn(from).split("@")[0] ?? "";
  if (!local) return false;
  return AUTOMATED_LOCAL.test(local);
}

/** A free-mail note with no brand pitch. Known brand contacts are decided by the caller. */
export function isPersonalMail(from: string, subject = "", snippet = "") {
  const domain = addressIn(from).split("@")[1] ?? "";
  if (!FREE_MAIL_DOMAINS.has(domain)) return false;
  if (isAutomatedSender(from)) return false;
  return !BRAND_INQUIRY.test(`${subject} ${snippet}`);
}

/** The auto template uses [CONFIRM] until a person fills the rate and date. */
export function hasUnfilledPlaceholder(text: string) {
  return /\[CONFIRM\]/i.test(text ?? "");
}

/** A Gmail draft has to be a reply someone already wrote, with nothing left to fill in. */
export function gmailDraftAllowed(body: string, subject = "") {
  const reply = body.trim();
  if (!reply) return false;
  if (hasUnfilledPlaceholder(reply) || hasUnfilledPlaceholder(subject)) return false;
  if (isSintraDraft(reply)) return false;
  return true;
}

/** Last check before drafts.create. A [CONFIRM] body or an automated recipient never leaves the portal. */
export function gmailDraftCreateAllowed(input: { to: string; subject?: string; body: string }) {
  if (!gmailDraftAllowed(input.body, input.subject ?? "")) return false;
  return !isAutomatedSender(input.to);
}

/** The HTTP body of drafts.create. Refuses the request when the raw message still has [CONFIRM] or an automated To. */
export function gmailDraftRequestAllowed(path: string, body: unknown) {
  if (!/^\/drafts(?:\?|$)/.test(path)) return true;
  if (!body || typeof body !== "object") return false;
  const raw = (body as { message?: { raw?: unknown } }).message?.raw;
  if (typeof raw !== "string" || raw.length === 0) return false;
  let text = "";
  try {
    text = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return false;
  }
  if (hasUnfilledPlaceholder(text)) return false;
  const to = text.match(/^To:\s*(.*)$/im)?.[1] ?? "";
  return !isAutomatedSender(to);
}

/** Prices and calendar dates in the portal starter stay blank until a person confirms them. */
export function scrubPricesAndDates(text: string) {
  return text
    .replace(/\$\s?\d[\d,]*(?:\.\d{2})?/g, "[CONFIRM]")
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?\b/gi, "[CONFIRM]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[CONFIRM]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[CONFIRM]");
}

/** Portal-only starter. It always contains [CONFIRM], so it is never copied into Gmail. */
export function confirmDraftBody(input: { creatorLabel: string; brand: string }) {
  const brand = scrubPricesAndDates(input.brand).replace(/\s+/g, " ").trim() || "there";
  const creator = scrubPricesAndDates(input.creatorLabel).replace(/\s+/g, " ").trim() || "the creator";
  return [
    `Hi ${brand},`,
    "",
    `Thanks for writing about ${creator}.`,
    "",
    "Rate: [CONFIRM]",
    "Date: [CONFIRM]",
    "",
    "This is a draft. Nothing has been sent.",
    "",
    "Kamron",
    "Momma Mari",
  ].join("\n");
}

/** Send, trash, and delete are refused before a request is built. Drafts and label adds stay allowed. */
export function gmailMutationAllowed(path: string) {
  return !/\/(send|trash|delete)(?:\?|$|\/)/i.test(path);
}

export type LiveDraft = { id: string; snippet: string };

export type LiveLabelClient = {
  applyLabels?: (messageId: string, labelNames: string[]) => Promise<void>;
  listThreadDrafts?: (threadId: string) => Promise<LiveDraft[]>;
  createDraft?: (input: { threadId: string; to: string; subject: string; body: string }) => Promise<{ id: string } | null>;
};

export async function prepareReplyAndLabels(
  db: PortalDb,
  client: LiveLabelClient,
  input: {
    mailbox: string;
    creatorLabel: string;
    message: { id: string; threadId: string; subject: string; labelIds: string[] };
    sort: MailSort;
    dealId: string | null;
    brand: string;
    replyTo: string;
    from?: string;
    headers?: MailHeaders | null;
  },
) {
  const draftMessage = input.message.labelIds.includes("DRAFT");
  if (input.sort === "skip" || draftMessage) {
    return { drafted: false, labeled: [] as string[], skippedDraft: "none" as const };
  }
  let drafted = false;
  let skippedDraft: "sintra" | "existing" | "kept" | "placeholder" | "none" = "none";
  const dealId = input.dealId;
  const from = input.from ?? input.replyTo;
  const automated = isAutomatedSender(from, input.headers) || isAutomatedSender(input.replyTo);
  const canDraft = input.sort === "needs_reply" && Boolean(dealId) && input.replyTo.includes("@") && !automated;
  if (canDraft && dealId) {
    const portal = await saveConfirmPortalDraft(db, dealId, confirmDraftBody({
      creatorLabel: input.creatorLabel,
      brand: input.brand,
    }));
    if (portal !== "created") skippedDraft = portal;
    drafted = portal === "created";
    const gmail = await createGmailDraftIfEmpty(db, client, input);
    if (gmail === "sintra") skippedDraft = "sintra";
    if (gmail === "placeholder" && skippedDraft === "none") skippedDraft = "placeholder";
    if (gmail === "created") drafted = true;
  }
  const labeled = labelsForSort(input.sort);
  if (labeled.length > 0 && client.applyLabels) await client.applyLabels(input.message.id, labeled);
  return { drafted, labeled, skippedDraft };
}

async function saveConfirmPortalDraft(db: PortalDb, dealId: string, body: string) {
  if (hasUnfilledPlaceholder(body)) return "placeholder" as const;
  const existing = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, dealId));
  const row = existing[0];
  if (row) {
    if (isSintraDraft(row.body) || isSintraDraft(row.updatedBy)) return "sintra" as const;
    if (row.updatedBy !== GMAIL_DRAFT_AUTHOR) return "kept" as const;
    return "existing" as const;
  }
  await db.insert(brandReplyDrafts).values({
    dealId,
    body,
    updatedBy: GMAIL_DRAFT_AUTHOR,
    updatedAt: nowIso(),
  });
  return "created" as const;
}

function isUniqueDraftError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

/** The reply a person saved on the deal. The auto [CONFIRM] starter is not one of these. */
async function composedReply(db: PortalDb, dealId: string) {
  const rows = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, dealId));
  const row = rows[0];
  if (!row || row.updatedBy === GMAIL_DRAFT_AUTHOR) return null;
  if (isSintraDraft(row.updatedBy) || isSintraDraft(row.body)) return null;
  if (!gmailDraftAllowed(row.body)) return null;
  return row.body;
}

async function createGmailDraftIfEmpty(
  db: PortalDb,
  client: LiveLabelClient,
  input: {
    mailbox: string;
    creatorLabel: string;
    message: { id: string; threadId: string; subject: string };
    brand: string;
    replyTo: string;
    from?: string;
    headers?: MailHeaders | null;
    dealId: string | null;
  },
) {
  if (!client.listThreadDrafts || !client.createDraft || !input.dealId) return "none" as const;
  const from = input.from ?? input.replyTo;
  if (isAutomatedSender(from, input.headers) || isAutomatedSender(input.replyTo)) return "none" as const;
  const body = await composedReply(db, input.dealId);
  if (!body || !gmailDraftCreateAllowed({ to: input.replyTo, subject: input.message.subject, body })) return "placeholder" as const;
  const drafts = await client.listThreadDrafts(input.message.threadId);
  if (drafts.some((draft) => isSintraDraft(draft.snippet) || isSintraDraft(draft.id))) return "sintra" as const;
  if (drafts.length > 0) return "existing" as const;
  const recorded = await db.select().from(gmailPortalDrafts).where(and(
    eq(gmailPortalDrafts.mailbox, input.mailbox),
    eq(gmailPortalDrafts.threadId, input.message.threadId),
  ));
  if (recorded[0]) return "existing" as const;
  const id = crypto.randomUUID();
  try {
    await db.insert(gmailPortalDrafts).values({
      id,
      mailbox: input.mailbox,
      threadId: input.message.threadId,
      gmailDraftId: null,
      dealId: input.dealId,
      createdAt: nowIso(),
    });
  } catch (error) {
    if (isUniqueDraftError(error)) return "existing" as const;
    throw error;
  }
  try {
    const created = await client.createDraft({
      threadId: input.message.threadId,
      to: input.replyTo,
      subject: input.message.subject,
      body,
    });
    if (!created?.id) {
      await db.delete(gmailPortalDrafts).where(eq(gmailPortalDrafts.id, id));
      return "none" as const;
    }
    await db.update(gmailPortalDrafts).set({ gmailDraftId: created.id }).where(eq(gmailPortalDrafts.id, id));
    return "created" as const;
  } catch (error) {
    await db.delete(gmailPortalDrafts).where(eq(gmailPortalDrafts.id, id));
    throw error;
  }
}
