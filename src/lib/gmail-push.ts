import { asc, eq, gt } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { deals, gmailSeenMessages, gmailWatches, inboxEvents } from "@/db/schema";
import { setDealStage } from "./deal-stage";
import { normalizeEmail, nowIso, safeEqual } from "./format";
import { gmailConnectionState } from "./onboarding";
import { getDealStage } from "./stages";
import { decryptToken } from "./token-crypto";

export const WATCH_MAILBOXES = [
  { email: "mmaclamroc@gmail.com", creatorId: "mariclare", label: "MariClare" },
  { email: "authentickambiz@gmail.com", creatorId: "authentickam", label: "AuthenticKam" },
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
    messages: { id: string; threadId: string }[];
  }>;
  getMessage: (id: string) => Promise<GmailHistoryMessage>;
};

export function mailboxForCreator(creatorId: string) {
  return WATCH_MAILBOXES.find((box) => box.creatorId === creatorId) ?? null;
}

export function creatorForMailbox(email: string) {
  const normalized = normalizeEmail(email);
  return WATCH_MAILBOXES.find((box) => box.email === normalized) ?? null;
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

function brandFromSender(from: string) {
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  const name = named?.[1]?.trim() ?? "";
  if (name && !name.includes("@")) return name;
  const domain = senderDomain(from);
  const label = domain.split(".")[0] ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Brand";
}

function laterHistory(left: string, right: string) {
  try {
    return BigInt(left) >= BigInt(right) ? left : right;
  } catch {
    return right || left;
  }
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
    topic: process.env.GMAIL_WATCH_TOPIC ?? null,
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

async function dealByThread(db: PortalDb, threadId: string) {
  if (!threadId) return null;
  const rows = await db.select().from(deals).where(eq(deals.gmailThreadId, threadId));
  return rows[0] ?? null;
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

export async function ingestGmailPush(
  db: PortalDb,
  note: { emailAddress: string; historyId: string },
  options?: { client?: GmailHistoryClient },
) {
  const mailbox = normalizeEmail(note.emailAddress);
  const mapped = creatorForMailbox(mailbox);
  if (!mapped) return { status: 200, body: { ok: true, ignored: true } };
  const stored = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox));
  const start = stored[0]?.historyId ?? "";
  if (!start) {
    await saveHistory(db, mailbox, mapped.creatorId, note.historyId);
    return { status: 200, body: { ok: true, primed: true, createdDealIds: [] as string[], matchedDealIds: [] as string[], stageMoves: [] as string[] } };
  }
  let client = options?.client;
  if (!client) {
    const connected = await gmailConnectionState(db, mapped.creatorId);
    if (!connected.cipher || normalizeEmail(connected.gmailEmail ?? "") !== mailbox) {
      return { status: 503, body: { error: "Mailbox is not connected." } };
    }
    try {
      client = await gmailReadClient(await decryptToken(connected.cipher));
    } catch {
      return { status: 503, body: { error: "Mailbox is not connected." } };
    }
  }
  const listed = await client.listAdded(start);
  if (listed.expired) {
    await saveHistory(db, mailbox, mapped.creatorId, note.historyId);
    return { status: 200, body: { ok: true, expired: true, createdDealIds: [] as string[], matchedDealIds: [] as string[], stageMoves: [] as string[] } };
  }
  const createdDealIds: string[] = [];
  const matchedDealIds: string[] = [];
  const stageMoves: string[] = [];
  let skippedSpam = 0;
  let skippedDuplicate = 0;
  for (const ref of listed.messages) {
    const seen = await db.select().from(gmailSeenMessages).where(eq(gmailSeenMessages.messageId, ref.id));
    if (seen[0]) {
      skippedDuplicate += 1;
      continue;
    }
    const message = await client.getMessage(ref.id);
    if (isSpamSender(message.from)) {
      await markSeen(db, mailbox, message);
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
      await markSeen(db, mailbox, message);
      continue;
    }
    if (!senderEmail(message.from)) {
      await markSeen(db, mailbox, message);
      continue;
    }
    if (threaded) {
      await db.update(deals).set({ updatedAt: nowIso() }).where(eq(deals.id, threaded.id));
      await addInboxEvent(db, { mailbox, messageId: message.id, threadId: message.threadId, dealId: threaded.id });
      matchedDealIds.push(threaded.id);
      await markSeen(db, mailbox, message);
      continue;
    }
    const dealId = await createHiddenOffer(db, { creatorId: mapped.creatorId, message });
    await addInboxEvent(db, { mailbox, messageId: message.id, threadId: message.threadId, dealId });
    createdDealIds.push(dealId);
    await markSeen(db, mailbox, message);
  }
  await saveHistory(db, mailbox, mapped.creatorId, laterHistory(listed.latestHistoryId || start, note.historyId));
  return {
    status: 200,
    body: { ok: true, mailbox, createdDealIds, matchedDealIds, stageMoves, skippedSpam, skippedDuplicate },
  };
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
  const results: { mailbox: string; ok: boolean; expiration?: string; error?: string }[] = [];
  for (const box of WATCH_MAILBOXES) {
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
      const timestamp = nowIso();
      const existing = await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, box.email));
      const values = {
        creatorId: box.creatorId,
        historyId: watched.historyId,
        expiration: watched.expiration,
        topic: process.env.GMAIL_WATCH_TOPIC ?? null,
        updatedAt: timestamp,
      };
      if (existing[0]) await db.update(gmailWatches).set(values).where(eq(gmailWatches.mailbox, box.email));
      else await db.insert(gmailWatches).values({ mailbox: box.email, ...values });
      results.push({ mailbox: box.email, ok: true, expiration: watched.expiration });
    } catch {
      results.push({ mailbox: box.email, ok: false, error: "Watch was not renewed." });
    }
  }
  return results;
}

async function refreshGmailAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Gmail token refresh failed.");
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error("Gmail token refresh failed.");
  return json.access_token;
}

async function gmailGet(accessToken: string, path: string) {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return { missing: true as const, json: null };
  if (!response.ok) throw new Error("Gmail read failed.");
  return { missing: false as const, json: await response.json() };
}

/** History and message reads only. This client never calls send. */
export async function gmailReadClient(refreshToken: string): Promise<GmailHistoryClient> {
  const accessToken = await refreshGmailAccessToken(refreshToken);
  return {
    async listAdded(startHistoryId: string) {
      const listed = await gmailGet(accessToken, `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded`);
      if (listed.missing) return { latestHistoryId: startHistoryId, expired: true, messages: [] };
      const json = listed.json as {
        historyId?: string;
        history?: { messagesAdded?: { message?: { id?: string; threadId?: string } }[] }[];
      };
      const messages: { id: string; threadId: string }[] = [];
      for (const entry of json.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          if (added.message?.id && added.message.threadId) messages.push({ id: added.message.id, threadId: added.message.threadId });
        }
      }
      return { latestHistoryId: json.historyId ?? startHistoryId, messages };
    },
    async getMessage(id: string) {
      const loaded = await gmailGet(
        accessToken,
        `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      );
      if (loaded.missing || !loaded.json) throw new Error("Gmail message failed.");
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
  };
}

export async function renewMailboxWatch(refreshToken: string) {
  const accessToken = await refreshGmailAccessToken(refreshToken);
  const topic = process.env.GMAIL_WATCH_TOPIC?.trim();
  if (!topic) throw new Error("GMAIL_WATCH_TOPIC is not set.");
  const response = await fetch(`${GMAIL_API}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicName: topic, labelIds: ["INBOX", "SENT"] }),
  });
  if (!response.ok) throw new Error("Gmail watch failed.");
  const json = await response.json() as { historyId?: string; expiration?: string };
  if (!json.historyId) throw new Error("Gmail watch failed.");
  return { historyId: String(json.historyId), expiration: json.expiration ? String(json.expiration) : "" };
}
