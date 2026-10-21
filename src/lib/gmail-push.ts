import { asc, eq, gt } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, deals, gmailSeenMessages, gmailWatches, inboxEvents } from "@/db/schema";
import { setDealStage } from "./deal-stage";
import { normalizeEmail, nowIso, safeEqual } from "./format";
import { clearMailboxReconnect, gmailConnectionState, mailboxReconnectReason, markMailboxNeedsReconnect } from "./onboarding";
import { getDealStage } from "./stages";
import { AGENCY_MAILBOX_ID, KAMRON_AGENCY_EMAIL, clearAgencyMailboxToken } from "./agency-mailbox";
import { gmailSyncEnabled } from "./gmail-sync-flag";
import { gmailMutationAllowed, prepareReplyAndLabels, type MailSort } from "./gmail-live";
import { revokeGoogleToken, type GoogleTokenRevoker } from "./google-oauth";
import { decryptToken } from "./token-crypto";

export const WATCH_MAILBOXES = [
  { email: "mmaclamroc@gmail.com", creatorId: "mariclare", label: "MariClare" },
  { email: "authentickambiz@gmail.com", creatorId: "authentickam", label: "AuthenticKam" },
  { email: KAMRON_AGENCY_EMAIL, creatorId: AGENCY_MAILBOX_ID, label: "Kamron" },
] as const;

const BLOCKED_DOMAINS = ["forceawakens.net", "qq.com", "foxmail.com", "163.com", "mail.ru"];
const BLOCKED_TLDS = new Set(["live", "xyz", "mobi", "online", "cc", "shop", "work", "cloud"]);

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type PubSubClaims = {
  iss?: string;
  aud?: string | string[];
  email?: string;
  exp?: number;
  email_verified?: boolean;
};

export type GmailHistoryMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  labelIds: string[];
};

export type GmailHistoryClient = {
  listAdded: (startHistoryId: string) => Promise<{
    latestHistoryId: string;
    expired?: boolean;
    /** More history.list pages remain. The cursor is only the last record read. */
    partial?: boolean;
    messages: { id: string; threadId: string }[];
  }>;
  getMessage: (id: string) => Promise<GmailHistoryMessage>;
  /** Recent inbox messages used only when history.list says the cursor expired. */
  listRecent?: () => Promise<{ id: string; threadId: string }[]>;
  /** Add MM/ labels. Never removes a label, and never trashes the message. */
  applyLabels?: (messageId: string, labelNames: string[]) => Promise<void>;
  /** Drafts already on the thread, including Sintra's. The portal does not change them. */
  listThreadDrafts?: (threadId: string) => Promise<{ id: string; snippet: string }[]>;
  /** Create one draft. This is not a send. */
  createDraft?: (input: { threadId: string; to: string; subject: string; body: string }) => Promise<{ id: string } | null>;
};

export function mailboxForCreator(creatorId: string) {
  return WATCH_MAILBOXES.find((box) => box.creatorId === creatorId) ?? null;
}

export function creatorForMailbox(email: string) {
  const normalized = normalizeEmail(email);
  return WATCH_MAILBOXES.find((box) => box.email === normalized) ?? null;
}

async function mailboxForIngest(db: PortalDb, mailbox: string) {
  const watched = creatorForMailbox(mailbox);
  if (watched) return { ...watched, strict: false };
  if (!gmailSyncEnabled()) return null;
  const rows = await db.select().from(creators).where(eq(creators.gmailEmail, mailbox));
  const row = rows.find((item) => item.gmailRefreshToken);
  if (!row) return null;
  return { email: mailbox, creatorId: row.id, label: row.name, strict: true };
}

export function senderEmail(from: string) {
  const match = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

export function senderDomain(from: string) {
  const email = senderEmail(from);
  const domain = email.split("@")[1] ?? "";
  return domain.toLowerCase();
}

export function isSpamSender(from: string) {
  const domain = senderDomain(from);
  if (!domain) return false;
  if (domain.includes("foxmail")) return true;
  if (BLOCKED_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) return true;
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  return BLOCKED_TLDS.has(tld);
}

const BULK_LABELS = new Set(["SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"]);

/** Gmail already filed this as spam, trash, or a newsletter. A reply on a deal we already have is still kept. */
export function isBulkMail(labelIds: string[] | undefined) {
  return (labelIds ?? []).some((label) => BULK_LABELS.has(label));
}

/** A draft has not been sent. It does not open a brand deal. */
export function isDraftMail(labelIds: string[] | undefined) {
  return (labelIds ?? []).includes("DRAFT");
}

/** Mail from one watched Momma Mari inbox to the other is not a brand offer. */
export function isWatchedMailboxSender(from: string) {
  const email = senderEmail(from);
  return WATCH_MAILBOXES.some((box) => box.email === email);
}

/** messages.get 404. The rest of the batch can still be filed. */
export function messageGone(id: string): GmailHistoryMessage {
  return { id, threadId: "", from: "", to: "", subject: "", labelIds: [] };
}

function brandFromSender(from: string) {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  const name = named?.[1]?.trim() ?? "";
  if (name && !name.includes("@")) return name;
  const domain = senderDomain(from);
  const label = domain.split(".")[0] ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Brand";
}

export function historyIdIsNumeric(value: string) {
  return /^\d+$/.test(value);
}

/** Keep the further numeric history id. A bad id never replaces a real cursor. */
export function laterHistoryId(left: string, right: string) {
  const safeLeft = historyIdIsNumeric(left) ? left : "";
  const safeRight = historyIdIsNumeric(right) ? right : "";
  if (!safeLeft) return safeRight;
  if (!safeRight) return safeLeft;
  return BigInt(safeLeft) >= BigInt(safeRight) ? safeLeft : safeRight;
}

function historyMovesForward(start: string, next: string) {
  try {
    return BigInt(next) > BigInt(start);
  } catch {
    return Boolean(next) && next !== start;
  }
}

/** How many history.list pages one push will read. A longer gap continues on the next retry. */
export const HISTORY_PAGE_LIMIT = 5;

const INBOX_LABELS = new Set(["INBOX", "SENT"]);

export type GmailHistoryPage = {
  missing?: boolean;
  historyId?: string;
  nextPageToken?: string;
  history?: {
    id?: string;
    messagesAdded?: { message?: { id?: string; threadId?: string } }[];
    labelsAdded?: { message?: { id?: string; threadId?: string }; labelIds?: string[] }[];
  }[];
};

/** A Pub/Sub note at or behind the stored cursor was already read. */
export function notificationAlreadyRead(storedHistoryId: string, noteHistoryId: string) {
  return !historyMovesForward(storedHistoryId, noteHistoryId);
}

/** Gmail watch expirations are milliseconds. A missing or past value is not a renewal. */
export function watchExpirationIsFuture(expiration: string, nowMs = Date.now()) {
  if (!/^\d+$/.test(expiration)) return false;
  try {
    return BigInt(expiration) > BigInt(nowMs);
  } catch {
    return false;
  }
}

/** Fold history.list pages into the messages to file. A leftover page token does not jump to the mailbox tip. */
export function addedFromHistoryPages(startHistoryId: string, pages: GmailHistoryPage[]) {
  const first = pages[0];
  if (!first || first.missing) {
    return { latestHistoryId: startHistoryId, expired: true as const, partial: false, messages: [] as { id: string; threadId: string }[] };
  }
  const messages: { id: string; threadId: string }[] = [];
  const seenIds = new Set<string>();
  let lastRecordId = "";
  const pushMessage = (id?: string, threadId?: string) => {
    if (!id || !threadId || seenIds.has(id)) return;
    seenIds.add(id);
    messages.push({ id, threadId });
  };
  for (const page of pages) {
    for (const entry of page.history ?? []) {
      if (entry.id) lastRecordId = entry.id;
      for (const added of entry.messagesAdded ?? []) pushMessage(added.message?.id, added.message?.threadId);
      for (const labeled of entry.labelsAdded ?? []) {
        const gained = (labeled.labelIds ?? []).some((label) => INBOX_LABELS.has(label));
        if (gained) pushMessage(labeled.message?.id, labeled.message?.threadId);
      }
    }
  }
  const last = pages[pages.length - 1];
  const partial = Boolean(last?.nextPageToken);
  const latestHistoryId = partial
    ? (lastRecordId || startHistoryId)
    : (last?.historyId || lastRecordId || startHistoryId);
  return { latestHistoryId, expired: false as const, partial, messages };
}

export function decodePushMessage(body: unknown): { emailAddress: string; historyId: string } | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: { data?: unknown } }).message;
  if (!message || typeof message.data !== "string" || !message.data) return null;
  try {
    const padded = message.data.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (message.data.length % 4)) % 4);
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))) as {
      emailAddress?: unknown;
      historyId?: unknown;
    };
    if (typeof json.emailAddress !== "string") return null;
    if (typeof json.historyId !== "string" && typeof json.historyId !== "number") return null;
    return { emailAddress: json.emailAddress, historyId: String(json.historyId) };
  } catch {
    return null;
  }
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function verifyGoogleJwt(token: string): Promise<PubSubClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]))) as { alg?: string; kid?: string };
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) return null;
  const certs = await response.json() as { keys?: Array<{ kid?: string } & JsonWebKey> };
  const jwk = certs.keys?.find((key) => key.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]))) as PubSubClaims;
  } catch {
    return null;
  }
}

export async function verifyPubSubOidc(
  authorization: string | null,
  options?: {
    audience?: string;
    serviceAccount?: string;
    now?: number;
    verifyToken?: (token: string) => Promise<PubSubClaims | null>;
  },
) {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return { ok: false as const, status: 401, error: "Missing Pub/Sub token." };
  const audience = options?.audience ?? process.env.GMAIL_PUSH_AUDIENCE?.trim() ?? "";
  const serviceAccount = options?.serviceAccount ?? process.env.GMAIL_PUSH_SERVICE_ACCOUNT?.trim() ?? "";
  if (!audience || !serviceAccount) {
    return { ok: false as const, status: 503, error: "Gmail push authentication is not configured." };
  }
  const claims = await (options?.verifyToken ?? verifyGoogleJwt)(match[1]);
  if (!claims) return { ok: false as const, status: 401, error: "Pub/Sub token was rejected." };
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now) return { ok: false as const, status: 401, error: "Pub/Sub token expired." };
  const issuer = claims.iss ?? "";
  if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") {
    return { ok: false as const, status: 401, error: "Pub/Sub token issuer was rejected." };
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!audiences.includes(audience)) return { ok: false as const, status: 401, error: "Pub/Sub token audience was rejected." };
  if (!claims.email || normalizeEmail(claims.email) !== normalizeEmail(serviceAccount) || claims.email_verified === false) {
    return { ok: false as const, status: 401, error: "Pub/Sub token identity was rejected." };
  }
  return { ok: true as const, email: normalizeEmail(claims.email) };
}

export function authorizeCron(authorization: string | null) {
  const expected = process.env.GMAIL_WATCH_CRON_SECRET;
  if (!expected) return { ok: false as const, status: 503, error: "Gmail watch renewal is not configured." };
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match || !safeEqual(match[1], expected)) {
    return { ok: false as const, status: 401, error: "Missing or invalid cron token." };
  }
  return { ok: true as const };
}

export function parseSince(since: string | null) {
  if (since && Number.isNaN(Date.parse(since))) return { ok: false as const, error: "since must be an ISO timestamp." };
  return { ok: true as const, since };
}

function unwrapEnv(value: string | undefined) {
  let text = value?.trim() ?? "";
  if (text.length >= 2) {
    const quote = text[0];
    if ((quote === "\"" || quote === "'") && text.endsWith(quote)) text = text.slice(1, -1).trim();
  }
  return text;
}

function configuredTopic() {
  return unwrapEnv(process.env.GMAIL_WATCH_TOPIC);
}

/** Pub/Sub topic names are project id plus topic id. Anything else is refused before it can be echoed. */
function watchTopic() {
  const topic = configuredTopic();
  if (!topic) throw new Error("GMAIL_WATCH_TOPIC is not set.");
  if (!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/[A-Za-z][A-Za-z0-9_.~+%-]{2,254}$/.test(topic)) {
    throw new Error("GMAIL_WATCH_TOPIC is not a Pub/Sub topic name. It must look like projects/project-id/topics/topic-id.");
  }
  return topic;
}

function googleErrorDetail(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const record = body as { error?: unknown; error_description?: unknown };
  if (typeof record.error === "string") {
    const description = typeof record.error_description === "string" ? record.error_description.trim() : "";
    return description ? `${record.error}: ${description}` : record.error;
  }
  if (record.error && typeof record.error === "object") {
    const nested = record.error as { message?: unknown; errors?: { message?: unknown }[] };
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message.trim();
    const nestedMessage = nested.errors?.find((item) => typeof item?.message === "string")?.message;
    if (typeof nestedMessage === "string") return nestedMessage.trim();
  }
  return "";
}

function redactSecrets(text: string, secrets: string[]) {
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

/** Google's error text for a cron row. Tokens, ciphers, and client secrets are removed. */
function safeGoogleMessage(fallback: string, status: number | null, body: unknown, secrets: string[]) {
  const detail = redactSecrets(googleErrorDetail(body), secrets).slice(0, 300);
  const readable = detail.replaceAll("[redacted]", "").replace(/[^A-Za-z0-9]+/g, "");
  if (!detail || !readable) return status ? `${fallback} (${status}).` : `${fallback}.`;
  return status ? `${fallback} (${status}): ${detail}` : `${fallback}: ${detail}`;
}

function describeWatchFailure(error: unknown, secrets: string[]) {
  const message = error instanceof Error ? redactSecrets(error.message, secrets).slice(0, 300) : "";
  const readable = message.replaceAll("[redacted]", "").replace(/[^A-Za-z0-9]+/g, "");
  return message && readable ? message : "Watch was not renewed.";
}

async function saveHistory(db: PortalDb, mailbox: string, creatorId: string, historyId: string) {
  const timestamp = nowIso();
  const existing = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox));
  if (existing[0]) {
    await db.update(gmailWatches).set({ historyId, creatorId, updatedAt: timestamp }).where(eq(gmailWatches.mailbox, mailbox));
    return;
  }
  await db.insert(gmailWatches).values({
    mailbox,
    creatorId,
    historyId,
    expiration: null,
    topic: configuredTopic() || null,
    updatedAt: timestamp,
  });
}

async function markSeen(db: PortalDb, mailbox: string, message: { id: string; threadId: string }) {
  await db.insert(gmailSeenMessages).values({
    messageId: message.id,
    mailbox,
    threadId: message.threadId,
    createdAt: nowIso(),
  });
}

async function addInboxEvent(db: PortalDb, input: { mailbox: string; messageId: string; threadId: string; dealId: string }) {
  const existing = await db.select().from(inboxEvents).where(eq(inboxEvents.messageId, input.messageId));
  if (existing[0]) return;
  await db.insert(inboxEvents).values({
    id: crypto.randomUUID(),
    mailbox: input.mailbox,
    messageId: input.messageId,
    threadId: input.threadId,
    dealId: input.dealId,
    kind: "new_mail",
    createdAt: nowIso(),
  });
}

function canMarkInterestSent(stageId: string | null) {
  const order = getDealStage(stageId)?.order;
  return order != null && order < 4;
}

/** A dead refresh token will not start working if Pub/Sub retries it. */
function permanentMailboxFailure(message: string) {
  return message.includes("unauthorized_client") || message.includes("invalid_grant");
}

function pushReadFailure(error: unknown, secrets: string[]) {
  const message = describeWatchFailure(error, secrets);
  if (permanentMailboxFailure(message)) {
    return { status: 200 as const, body: { ok: false as const, permanent: true as const, error: message } };
  }
  return { status: 503 as const, body: { ok: false as const, error: message } };
}

/** A dead token is acknowledged and the Connect page shows needs-reconnect. The cursor is not moved. */
async function finishReadFailure(db: PortalDb, creatorId: string, error: unknown, secrets: string[]) {
  const failure = pushReadFailure(error, secrets);
  if ("permanent" in failure.body && failure.body.permanent) {
    const reason = mailboxReconnectReason(failure.body.error);
    if (reason) await markMailboxNeedsReconnect(db, creatorId, reason);
  }
  return failure;
}

async function dealByThread(db: PortalDb, threadId: string) {
  if (!threadId) return null;
  const rows = await db.select().from(deals).where(eq(deals.gmailThreadId, threadId));
  return rows[0] ?? null;
}

/** Match a thread the portal already has, or open one hidden offer. Callers filter personal mail first. */
export async function openOrMatchBrandDeal(db: PortalDb, creatorId: string, message: GmailHistoryMessage) {
  const existing = await dealByThread(db, message.threadId);
  if (existing) return { dealId: existing.id, created: false as const };
  const dealId = await createHiddenOffer(db, { creatorId, message });
  return { dealId, created: true as const };
}

async function rememberBrandThread(
  db: PortalDb,
  input: { mailbox: string; creatorId: string; message: GmailHistoryMessage; dealId: string; classification: "deal" | "inquiry" },
) {
  if (!gmailSyncEnabled()) return;
  const { recordBrandMessage } = await import("./gmail-bridge");
  await recordBrandMessage(db, input);
}

async function createHiddenOffer(db: PortalDb, input: { creatorId: string; message: GmailHistoryMessage }) {
  const timestamp = nowIso();
  const existing = await db.select({ sortOrder: deals.sortOrder }).from(deals);
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const id = `mail-${input.message.id}`;
  const already = await db.select().from(deals).where(eq(deals.id, id));
  if (already[0]) return already[0].id;
  await db.insert(deals).values({
    id,
    creatorId: input.creatorId,
    brand: brandFromSender(input.message.from),
    subtitle: "New brand email",
    contact: senderEmail(input.message.from) || null,
    gmailThreadId: input.message.threadId,
    status: "pitch",
    deliverablesJson: "[]",
    chipsJson: "[]",
    visibleToCreator: false,
    reviewStatus: "pending",
    kamronNotes: input.message.subject.trim() || null,
    uploadEnabled: false,
    needsCreator: false,
    sortOrder,
    isSeed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const moved = await setDealStage(db, {
    dealId: id,
    toStage: "offer_received",
    actorEmail: "gmail",
    actorRole: "system",
    note: "New brand email.",
  });
  if (!moved.ok) throw new Error(moved.error);
  await db.update(deals).set({ visibleToCreator: false }).where(eq(deals.id, id));
  return id;
}

const RECENT_INBOX_LIMIT = 20;
export const RECENT_PAGE_LIMIT = 2;

export function recentInboxMessages(pages: { messages?: { id?: string; threadId?: string }[] }[]) {
  const messages: { id: string; threadId: string }[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const message of page.messages ?? []) {
      if (!message.id || !message.threadId || seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push({ id: message.id, threadId: message.threadId });
    }
  }
  return messages;
}

async function settleMail(
  db: PortalDb,
  mailbox: string,
  creatorId: string,
  creatorLabel: string,
  client: GmailHistoryClient,
  secrets: string[],
  message: GmailHistoryMessage,
  sort: MailSort,
  dealId: string | null,
  brand: string,
) {
  try {
    await prepareReplyAndLabels(db, client, {
      mailbox,
      creatorLabel,
      message,
      sort,
      dealId,
      brand,
      replyTo: senderEmail(message.from),
    });
  } catch (error) {
    return { ok: false as const, failure: await finishReadFailure(db, creatorId, error, secrets) };
  }
  await markSeen(db, mailbox, message);
  return { ok: true as const };
}

async function applyAddedMessages(
  db: PortalDb,
  mailbox: string,
  creatorId: string,
  creatorLabel: string,
  refs: { id: string; threadId: string }[],
  client: GmailHistoryClient,
  secrets: string[],
  keep?: (message: GmailHistoryMessage) => Promise<boolean>,
) {
  const createdDealIds: string[] = [];
  const matchedDealIds: string[] = [];
  const stageMoves: string[] = [];
  let skippedSpam = 0;
  let skippedDuplicate = 0;
  for (const ref of refs) {
    const seen = await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, ref.id));
    if (seen[0]) {
      skippedDuplicate += 1;
      continue;
    }
    let message: GmailHistoryMessage;
    try {
      message = await client.getMessage(ref.id);
    } catch (error) {
      return { ok: false as const, failure: await finishReadFailure(db, creatorId, error, secrets) };
    }
    if (!message.threadId) {
      await markSeen(db, mailbox, message);
      continue;
    }
    const brand = brandFromSender(message.from);
    if (isDraftMail(message.labelIds)) {
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "skip", null, brand);
      if (!settled.ok) return settled;
      continue;
    }
    if (isSpamSender(message.from)) {
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "not_deal", null, brand);
      if (!settled.ok) return settled;
      skippedSpam += 1;
      continue;
    }
    const fromUs = senderEmail(message.from) === mailbox;
    const threaded = await dealByThread(db, message.threadId);
    if (fromUs) {
      if (threaded && canMarkInterestSent(threaded.workflowStage)) {
        const moved = await setDealStage(db, {
          dealId: threaded.id,
          toStage: "interest_sent",
          actorEmail: mailbox,
          actorRole: "system",
          note: "We replied to the brand.",
        });
        if (moved.ok && moved.changed) stageMoves.push(threaded.id);
      }
      if (threaded) await rememberBrandThread(db, { mailbox, creatorId, message, dealId: threaded.id, classification: "deal" });
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, threaded ? "waiting" : "not_deal", threaded?.id ?? null, brand);
      if (!settled.ok) return settled;
      continue;
    }
    if (!senderEmail(message.from)) {
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "not_deal", null, brand);
      if (!settled.ok) return settled;
      continue;
    }
    if (threaded) {
      await db.update(deals).set({ updatedAt: nowIso() }).where(eq(deals.id, threaded.id));
      await addInboxEvent(db, { mailbox, messageId: message.id, threadId: message.threadId, dealId: threaded.id });
      matchedDealIds.push(threaded.id);
      await rememberBrandThread(db, { mailbox, creatorId, message, dealId: threaded.id, classification: "deal" });
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "needs_reply", threaded.id, threaded.brand || brand);
      if (!settled.ok) return settled;
      continue;
    }
    if (isWatchedMailboxSender(message.from) || isBulkMail(message.labelIds)) {
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "not_deal", null, brand);
      if (!settled.ok) return settled;
      skippedSpam += 1;
      continue;
    }
    if (keep && !(await keep(message))) {
      const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "not_deal", null, brand);
      if (!settled.ok) return settled;
      continue;
    }
    const dealId = await createHiddenOffer(db, { creatorId, message });
    await addInboxEvent(db, { mailbox, messageId: message.id, threadId: message.threadId, dealId });
    await rememberBrandThread(db, { mailbox, creatorId, message, dealId, classification: "inquiry" });
    createdDealIds.push(dealId);
    const settled = await settleMail(db, mailbox, creatorId, creatorLabel, client, secrets, message, "needs_reply", dealId, brand);
    if (!settled.ok) return settled;
  }
  return { ok: true as const, createdDealIds, matchedDealIds, stageMoves, skippedSpam, skippedDuplicate };
}

export async function ingestGmailPush(
  db: PortalDb,
  note: { emailAddress: string; historyId: string },
  options?: { client?: GmailHistoryClient; catchUp?: boolean },
) {
  const mailbox = normalizeEmail(note.emailAddress);
  const mapped = await mailboxForIngest(db, mailbox);
  if (!mapped) return { status: 200, body: { ok: true, ignored: true } };
  const keep = mapped.strict
    ? async (message: GmailHistoryMessage) => {
      const { isBrandInquiry } = await import("./gmail-bridge");
      const decision = await isBrandInquiry(db, mapped.creatorId, message, mailbox);
      return decision.keep && decision.classification !== "not_deal";
    }
    : undefined;
  const stored = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox));
  const start = stored[0]?.historyId ?? "";
  if (!start) {
    if (!historyIdIsNumeric(note.historyId)) {
      return { status: 200, body: { ok: false as const, acknowledged: true as const, error: "Gmail history id was not a number." } };
    }
    await saveHistory(db, mailbox, mapped.creatorId, note.historyId);
    return { status: 200, body: { ok: true, primed: true, createdDealIds: [] as string[], matchedDealIds: [] as string[], stageMoves: [] as string[] } };
  }
  if (!options?.catchUp && notificationAlreadyRead(start, note.historyId)) {
    return { status: 200, body: { ok: true, duplicate: true as const, mailbox } };
  }
  let client = options?.client;
  const secrets: string[] = [];
  if (!client) {
    const connected = await gmailConnectionState(db, mapped.creatorId);
    if (connected.cipher) secrets.push(connected.cipher);
    if (!connected.cipher || normalizeEmail(connected.gmailEmail ?? "") !== mailbox) {
      return { status: 200, body: { ok: false as const, acknowledged: true as const, error: "Mailbox is not connected." } };
    }
    try {
      const refreshToken = await decryptToken(connected.cipher);
      secrets.push(refreshToken);
      client = await gmailReadClient(refreshToken);
    } catch (error) {
      return finishReadFailure(db, mapped.creatorId, error, secrets);
    }
  }
  let listed: Awaited<ReturnType<GmailHistoryClient["listAdded"]>>;
  try {
    listed = await client.listAdded(start);
  } catch (error) {
    return finishReadFailure(db, mapped.creatorId, error, secrets);
  }
  if (listed.expired) {
    if (!client.listRecent) {
      await saveHistory(db, mailbox, mapped.creatorId, note.historyId);
      return { status: 200, body: { ok: true, expired: true, backfilled: false, createdDealIds: [] as string[], matchedDealIds: [] as string[], stageMoves: [] as string[] } };
    }
    let recent: { id: string; threadId: string }[];
    try {
      recent = await client.listRecent();
    } catch (error) {
      return finishReadFailure(db, mapped.creatorId, error, secrets);
    }
    const applied = await applyAddedMessages(db, mailbox, mapped.creatorId, mapped.label, recent.slice(0, RECENT_INBOX_LIMIT * RECENT_PAGE_LIMIT), client, secrets, keep);
    if (!applied.ok) return applied.failure;
    await saveHistory(db, mailbox, mapped.creatorId, note.historyId);
    return {
      status: 200,
      body: {
        ok: true,
        expired: true,
        backfilled: true,
        createdDealIds: applied.createdDealIds,
        matchedDealIds: applied.matchedDealIds,
        stageMoves: applied.stageMoves,
        skippedSpam: applied.skippedSpam,
        skippedDuplicate: applied.skippedDuplicate,
      },
    };
  }
  const applied = await applyAddedMessages(db, mailbox, mapped.creatorId, mapped.label, listed.messages, client, secrets, keep);
  if (!applied.ok) return applied.failure;
  const cursor = listed.partial
    ? laterHistoryId(start, listed.latestHistoryId)
    : laterHistoryId(listed.latestHistoryId || start, note.historyId);
  if (listed.partial && !historyMovesForward(start, cursor)) {
    return { status: 503, body: { ok: false as const, error: "Gmail history has more pages, and the cursor did not move." } };
  }
  await saveHistory(db, mailbox, mapped.creatorId, cursor);
  if (listed.partial) {
    return {
      status: 503,
      body: {
        ok: false as const,
        partial: true as const,
        error: "Gmail history has more pages. The cursor moved through the pages already read.",
        createdDealIds: applied.createdDealIds,
        matchedDealIds: applied.matchedDealIds,
        stageMoves: applied.stageMoves,
        skippedSpam: applied.skippedSpam,
        skippedDuplicate: applied.skippedDuplicate,
      },
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      mailbox,
      createdDealIds: applied.createdDealIds,
      matchedDealIds: applied.matchedDealIds,
      stageMoves: applied.stageMoves,
      skippedSpam: applied.skippedSpam,
      skippedDuplicate: applied.skippedDuplicate,
    },
  };
}

/** Read each watched inbox from the history cursor already on file. A missed push is filed once. */
export async function catchUpWatchedMailboxes(
  db: PortalDb,
  options?: { clients?: Record<string, GmailHistoryClient> },
) {
  const mailboxes: { mailbox: string; ok: boolean; caughtUp: boolean; error?: string }[] = [];
  for (const box of WATCH_MAILBOXES) {
    const stored = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, box.email));
    const cursor = stored[0]?.historyId ?? "";
    if (!cursor) {
      mailboxes.push({ mailbox: box.email, ok: true, caughtUp: false });
      continue;
    }
    const client = options?.clients?.[box.email];
    const result = await ingestGmailPush(db, { emailAddress: box.email, historyId: cursor }, { client, catchUp: true });
    const error = "error" in result.body && typeof result.body.error === "string" ? result.body.error : undefined;
    mailboxes.push({
      mailbox: box.email,
      ok: result.status === 200 && result.body.ok === true,
      caughtUp: result.status === 200 && result.body.ok === true && !("duplicate" in result.body && result.body.duplicate),
      error,
    });
  }
  return { mailboxes };
}

export async function listInboxEvents(db: PortalDb, since: string | null) {
  const rows = since
    ? await db.select().from(inboxEvents).where(gt(inboxEvents.createdAt, since)).orderBy(asc(inboxEvents.createdAt))
    : await db.select().from(inboxEvents).orderBy(asc(inboxEvents.createdAt));
  return rows
    .filter((row) => row.kind === "new_mail")
    .map((row) => ({
      id: row.id,
      mailbox: row.mailbox,
      messageId: row.messageId,
      threadId: row.threadId,
      dealId: row.dealId,
      kind: row.kind,
      createdAt: row.createdAt,
    }));
}

export async function renewGmailWatches(
  db: PortalDb,
  watch: (input: { mailbox: string; refreshToken: string }) => Promise<{ historyId: string; expiration: string }>,
) {
  const results: { mailbox: string; ok: boolean; expiration?: string; error?: string; needsReconnect?: boolean }[] = [];
  const boxes: { email: string; creatorId: string }[] = WATCH_MAILBOXES.map((box) => ({ email: box.email, creatorId: box.creatorId }));
  if (gmailSyncEnabled()) {
    const watched = new Set<string>(WATCH_MAILBOXES.map((box) => box.email));
    const rows = await db.select().from(creators);
    for (const row of rows) {
      const email = normalizeEmail(row.gmailEmail ?? "");
      if (!email || !row.gmailRefreshToken || watched.has(email)) continue;
      boxes.push({ email, creatorId: row.id });
    }
  }
  for (const box of boxes) {
    const state = await gmailConnectionState(db, box.creatorId);
    if (!state.cipher || normalizeEmail(state.gmailEmail ?? "") !== box.email) {
      results.push({ mailbox: box.email, ok: false, error: "Mailbox is not connected." });
      continue;
    }
    let refreshToken = "";
    try {
      refreshToken = await decryptToken(state.cipher);
    } catch {
      results.push({ mailbox: box.email, ok: false, error: "Could not read the saved token." });
      continue;
    }
    if (!refreshToken || state.cipher.includes(refreshToken)) {
      results.push({ mailbox: box.email, ok: false, error: "Could not read the saved token." });
      continue;
    }
    try {
      const watched = await watch({ mailbox: box.email, refreshToken });
      if (!watchExpirationIsFuture(watched.expiration)) {
        throw new Error("Gmail watch failed: the renewal did not include a future expiration.");
      }
      const timestamp = nowIso();
      const existing = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, box.email));
      const values = {
        creatorId: box.creatorId,
        historyId: existing[0]?.historyId || watched.historyId,
        expiration: watched.expiration,
        topic: configuredTopic() || null,
        updatedAt: timestamp,
      };
      if (existing[0]) await db.update(gmailWatches).set(values).where(eq(gmailWatches.mailbox, box.email));
      else await db.insert(gmailWatches).values({ mailbox: box.email, ...values });
      await clearMailboxReconnect(db, box.creatorId);
      results.push({ mailbox: box.email, ok: true, expiration: watched.expiration });
    } catch (error) {
      const message = describeWatchFailure(error, [refreshToken, unwrapEnv(process.env.GOOGLE_CLIENT_SECRET), unwrapEnv(process.env.TOKEN_ENCRYPTION_KEY), state.cipher]);
      const reason = mailboxReconnectReason(message);
      if (reason) await markMailboxNeedsReconnect(db, box.creatorId, reason);
      results.push({
        mailbox: box.email,
        ok: false,
        error: message,
        needsReconnect: Boolean(reason),
      });
    }
  }
  return results;
}

async function readJsonBody(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function refreshGmailAccessToken(refreshToken: string) {
  const clientId = unwrapEnv(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = unwrapEnv(process.env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error("Google client id or secret is not set.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await readJsonBody(response) as { access_token?: unknown } | null;
  const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
  if (!response.ok || !accessToken) {
    throw new Error(safeGoogleMessage("Gmail token refresh failed", response.ok ? null : response.status, json, [refreshToken, clientSecret, accessToken]));
  }
  return accessToken;
}

async function gmailFetch(accessToken: string, path: string, init?: { method?: string; body?: string }) {
  if (!gmailMutationAllowed(path)) throw new Error("This mailbox cannot send or delete mail.");
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return response;
}

async function gmailGet(accessToken: string, path: string) {
  const response = await gmailFetch(accessToken, path);
  if (response.status === 404) return { missing: true as const, json: null };
  if (!response.ok) {
    throw new Error(safeGoogleMessage("Gmail read failed", response.status, await readJsonBody(response), [accessToken]));
  }
  return { missing: false as const, json: await response.json() };
}

/** One attachment. This does not list a folder and it does not send mail. */
export async function downloadGmailAttachment(refreshToken: string, messageId: string, attachmentId: string) {
  const accessToken = await refreshGmailAccessToken(refreshToken);
  const response = await fetch(`${GMAIL_API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = await response.json() as { data?: string };
  if (!json.data) return null;
  const padded = json.data.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (json.data.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: "application/octet-stream" };
}

function draftRaw(input: { to: string; subject: string; body: string }) {
  const subject = input.subject.toLowerCase().startsWith("re:") ? input.subject : `Re: ${input.subject}`;
  const lines = [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

async function gmailJson(accessToken: string, path: string, body: unknown) {
  const response = await gmailFetch(accessToken, path, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) {
    throw new Error(safeGoogleMessage("Gmail write failed", response.status, await readJsonBody(response), [accessToken]));
  }
  return await response.json() as { id?: string };
}

/** History reads, MM/ label adds, and drafts. This client never calls send, trash, or delete. */
export async function gmailReadClient(refreshToken: string): Promise<GmailHistoryClient> {
  const accessToken = await refreshGmailAccessToken(refreshToken);
  const labelIds = new Map<string, string>();
  async function ensureLabel(name: string) {
    const cached = labelIds.get(name);
    if (cached) return cached;
    const listed = await gmailGet(accessToken, "/labels");
    const labels = ((listed.json ?? {}) as { labels?: { id?: string; name?: string }[] }).labels ?? [];
    for (const label of labels) {
      if (label.id && label.name) labelIds.set(label.name, label.id);
    }
    const found = labelIds.get(name);
    if (found) return found;
    const created = await gmailJson(accessToken, "/labels", {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    });
    if (!created.id) throw new Error("Gmail label was not created.");
    labelIds.set(name, created.id);
    return created.id;
  }
  return {
    async listAdded(startHistoryId: string) {
      const pages: GmailHistoryPage[] = [];
      let pageToken = "";
      for (let page = 0; page < HISTORY_PAGE_LIMIT; page += 1) {
        const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const listed = await gmailGet(accessToken, `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded&historyTypes=labelAdded${token}`);
        if (listed.missing) {
          if (pages.length === 0) return { latestHistoryId: startHistoryId, expired: true, messages: [] };
          throw new Error("Gmail history page failed.");
        }
        const json = (listed.json ?? {}) as GmailHistoryPage;
        pages.push(json);
        if (!json.nextPageToken) break;
        pageToken = json.nextPageToken;
      }
      return addedFromHistoryPages(startHistoryId, pages);
    },
    async listRecent() {
      const pages: { messages?: { id?: string; threadId?: string }[]; nextPageToken?: string }[] = [];
      let pageToken = "";
      for (let page = 0; page < RECENT_PAGE_LIMIT; page += 1) {
        const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const listed = await gmailGet(accessToken, `/messages?labelIds=INBOX&maxResults=${RECENT_INBOX_LIMIT}${token}`);
        if (listed.missing || !listed.json) {
          if (pages.length === 0) return [];
          throw new Error("Gmail inbox page failed.");
        }
        const json = listed.json as { messages?: { id?: string; threadId?: string }[]; nextPageToken?: string };
        pages.push(json);
        if (!json.nextPageToken) break;
        pageToken = json.nextPageToken;
      }
      return recentInboxMessages(pages);
    },
    async getMessage(id: string) {
      const loaded = await gmailGet(
        accessToken,
        `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      );
      if (loaded.missing) return messageGone(id);
      if (!loaded.json) throw new Error("Gmail message failed.");
      const json = loaded.json as {
        id?: string;
        threadId?: string;
        labelIds?: string[];
        payload?: { headers?: { name?: string; value?: string }[] };
      };
      const headers = json.payload?.headers ?? [];
      const header = (name: string) => headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: json.id ?? id,
        threadId: json.threadId ?? "",
        from: header("From"),
        to: header("To"),
        subject: header("Subject"),
        labelIds: json.labelIds ?? [],
      };
    },
    async applyLabels(messageId, names) {
      const addLabelIds: string[] = [];
      for (const name of names) addLabelIds.push(await ensureLabel(name));
      await gmailJson(accessToken, `/messages/${encodeURIComponent(messageId)}/modify`, { addLabelIds });
    },
    async listThreadDrafts(threadId) {
      const loaded = await gmailGet(accessToken, `/threads/${encodeURIComponent(threadId)}?format=metadata`);
      if (loaded.missing || !loaded.json) return [];
      const messages = (loaded.json as { messages?: { id?: string; snippet?: string; labelIds?: string[] }[] }).messages ?? [];
      return messages
        .filter((message) => (message.labelIds ?? []).includes("DRAFT") && message.id)
        .map((message) => ({ id: message.id ?? "", snippet: message.snippet ?? "" }));
    },
    async createDraft(input) {
      const created = await gmailJson(accessToken, "/drafts", {
        message: { raw: draftRaw(input), threadId: input.threadId },
      });
      return created.id ? { id: created.id } : null;
    },
  };
}

async function revokeStoredGoogleToken(cipher: string | null, revoke?: GoogleTokenRevoker) {
  if (!cipher) return;
  const run = revoke ?? revokeGoogleToken;
  try {
    await run(await decryptToken(cipher));
  } catch {
    // An unreadable ciphertext or a failed revoke still clears the local copy.
  }
}

/** Revoke the saved Gmail token, then drop it and the watch. Old mail stays marked seen. */
export async function clearCreatorGmail(
  db: PortalDb,
  creatorId: string,
  options?: { revoke?: GoogleTokenRevoker },
) {
  if (creatorId === AGENCY_MAILBOX_ID) {
    const agency = await gmailConnectionState(db, AGENCY_MAILBOX_ID);
    await revokeStoredGoogleToken(agency.cipher, options?.revoke);
    await clearAgencyMailboxToken(db);
    await db.delete(gmailWatches).where(eq(gmailWatches.mailbox, KAMRON_AGENCY_EMAIL));
    await db.delete(gmailWatches).where(eq(gmailWatches.creatorId, AGENCY_MAILBOX_ID));
    return { status: 200 as const, body: { ok: true as const, email: KAMRON_AGENCY_EMAIL, creatorId, cleared: true as const } };
  }
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { status: 404 as const, body: { error: "Creator not found." } };
  const storedEmail = creator[0].gmailEmail ? normalizeEmail(creator[0].gmailEmail) : null;
  await revokeStoredGoogleToken(creator[0].gmailRefreshToken, options?.revoke);
  await db.update(creators).set({
    gmailRefreshToken: null,
    gmailEmail: null,
    gmailConnectedAt: null,
    gmailReconnectReason: null,
    emailStatus: creator[0].emailStatus === "connected" ? "disconnected" : creator[0].emailStatus,
  }).where(eq(creators.id, creatorId));
  if (storedEmail) await db.delete(gmailWatches).where(eq(gmailWatches.mailbox, storedEmail));
  const watched = mailboxForCreator(creatorId);
  if (watched) await db.delete(gmailWatches).where(eq(gmailWatches.mailbox, watched.email));
  await db.delete(gmailWatches).where(eq(gmailWatches.creatorId, creatorId));
  const { deleteBridgeForCreator } = await import("./gmail-bridge");
  await deleteBridgeForCreator(db, creatorId);
  return { status: 200 as const, body: { ok: true as const, email: storedEmail, creatorId, cleared: true as const } };
}

/** Drop the saved Gmail token and watch so the inbox can be connected again. */
export async function disconnectMailbox(
  db: PortalDb,
  email: string,
  options?: { revoke?: GoogleTokenRevoker },
) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return { status: 400, body: { error: "email is required." } };
  const watched = creatorForMailbox(normalized);
  let creatorId: string | null = watched?.creatorId ?? null;
  if (!creatorId) {
    const rows = await db.select({ id: creators.id }).from(creators).where(eq(creators.gmailEmail, normalized));
    creatorId = rows[0]?.id ?? null;
  }
  if (!creatorId) return { status: 404, body: { error: "No watched inbox uses that email." } };
  const cleared = await clearCreatorGmail(db, creatorId, options);
  if (cleared.status !== 200) return { status: 404, body: { error: "No watched inbox uses that email." } };
  return { status: 200, body: { ok: true, email: normalized, creatorId, cleared: true } };
}

export async function renewMailboxWatch(refreshToken: string) {
  const topic = watchTopic();
  const accessToken = await refreshGmailAccessToken(refreshToken);
  const clientSecret = unwrapEnv(process.env.GOOGLE_CLIENT_SECRET);
  const response = await fetch(`${GMAIL_API}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicName: topic, labelIds: ["INBOX", "SENT"], labelFilterBehavior: "include" }),
  });
  const json = await readJsonBody(response) as { historyId?: unknown; expiration?: unknown } | null;
  const historyId = json?.historyId == null || json.historyId === "" ? "" : String(json.historyId);
  if (!response.ok || !historyId) {
    throw new Error(safeGoogleMessage("Gmail watch failed", response.ok ? null : response.status, json, [refreshToken, accessToken, clientSecret]));
  }
  return { historyId, expiration: json?.expiration == null ? "" : String(json.expiration) };
}
