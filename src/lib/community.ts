import { eq } from "drizzle-orm";
import { getCommunityBucket, getKv } from "@/db";
import type { PortalDb } from "@/db";
import {
  communityAudit,
  communityChannels,
  communityFilterHits,
  communityMembers,
  communityMessages,
  communityPhotos,
  communityReactions,
  communityReports,
  communitySettings,
  communityState,
  creators,
  managers,
} from "@/db/schema";
import { COMMUNITY_EMOJIS, privateKinds } from "./community-shared";
import { normalizeEmail, nowIso, withBasePath } from "./format";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const PHOTO_TTL_SECONDS = 120;

export type CommunityActor = {
  email: string;
  name: string;
  role: string;
  creatorId?: string | null;
};

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string; kinds?: string[] };

type Member = typeof communityMembers.$inferSelect;

let queryTap: ((table: string) => void) | null = null;

export const PHOTOS_OFF = "Photos are off until photo storage is connected.";

export type CommunityPhotoStore = {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};

let photoStoreOverride: { value: CommunityPhotoStore | null } | undefined;

export function setCommunityPhotoStoreForTests(store: CommunityPhotoStore | null | undefined) {
  photoStoreOverride = store === undefined ? undefined : { value: store };
}

async function photoStore(): Promise<CommunityPhotoStore | null> {
  if (photoStoreOverride) return photoStoreOverride.value;
  try {
    return await getCommunityBucket();
  } catch {
    return null;
  }
}

export function setCommunityQueryTap(tap: ((table: string) => void) | null) {
  queryTap = tap;
}

function touch(table: string) {
  queryTap?.(table);
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

async function hmac(value: string) {
  const secret = process.env.SESSION_SECRET || "community-photo-link";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stripJpegMetadata(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      chunks.push(bytes.subarray(offset));
      break;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.subarray(offset));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.length) break;
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const drop = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!drop) chunks.push(bytes.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

export async function signPhotoUrl(id: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + PHOTO_TTL_SECONDS;
  const sig = await hmac(`${id}.${exp}`);
  return withBasePath(`/api/community/photos/${id}?exp=${exp}&sig=${sig}`);
}

export async function photoLinkValid(id: string, exp: string | null, sig: string | null, now = Date.now()) {
  const expNum = Number(exp);
  if (!exp || !sig || !Number.isFinite(expNum) || expNum * 1000 < now) return false;
  const expected = await hmac(`${id}.${expNum}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ sig.charCodeAt(index);
  return diff === 0;
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function bumpCursor(db: PortalDb) {
  const cursor = String(Date.now());
  touch("community_state");
  await db.update(communityState).set({ cursor }).where(eq(communityState.id, "last"));
  try {
    const kv = await getKv();
    if (kv) await kv.put("community:last", cursor);
  } catch {
    // Text chat stays on D1 when the KV binding is missing.
  }
  return cursor;
}

async function currentCursor(db: PortalDb) {
  try {
    const kv = await getKv();
    if (kv) {
      const stored = await kv.get("community:last");
      if (stored) return stored;
    }
  } catch {
    // Fall through to the database cursor.
  }
  touch("community_state");
  const rows = await db.select().from(communityState).where(eq(communityState.id, "last"));
  return rows[0]?.cursor ?? "0";
}

async function audit(db: PortalDb, actorName: string, action: string, targetName: string | null, messageId: string | null) {
  touch("community_audit");
  await db.insert(communityAudit).values({
    id: crypto.randomUUID(),
    actorName,
    action,
    targetName,
    messageId,
    createdAt: nowIso(),
  });
}

async function recordHits(db: PortalDb, kinds: string[]) {
  if (kinds.length === 0) return;
  touch("community_filter_hits");
  await db.insert(communityFilterHits).values(kinds.map((kind) => ({
    id: crypto.randomUUID(),
    kind,
    createdAt: nowIso(),
  })));
}

export async function loadCommunityMember(db: PortalDb, actor: CommunityActor): Promise<Result<{ member: Member; communityRole: "admin" | "moderator" | "member" }>> {
  if (actor.role === "bot") return { ok: false, status: 403, error: "The bot does not post in community chat." };
  const email = normalizeEmail(actor.email || "");
  if (!email) return { ok: false, status: 401, error: "Sign in required." };

  touch("creators");
  const creatorRows = await db.select().from(creators);
  touch("managers");
  const managerRows = await db.select().from(managers);
  const creator = creatorRows.find((row) => normalizeEmail(row.email) === email);
  const manager = managerRows.find((row) => normalizeEmail(row.email) === email && row.active);
  const owner = actor.role === "admin";
  if (!owner && !creator && !manager) return { ok: false, status: 403, error: "You are not on the roster." };

  touch("community_members");
  const existing = await db.select().from(communityMembers).where(eq(communityMembers.email, email));
  const timestamp = nowIso();
  const displayName = owner ? "Kamron" : creator?.name || manager?.name || actor.name || "Member";
  let member = existing[0];
  if (!member) {
    member = {
      id: crypto.randomUUID(),
      email,
      creatorId: creator?.id ?? actor.creatorId ?? null,
      displayName,
      role: manager ? "moderator" : "member",
      status: "active",
      mutedUntil: null,
      guidelinesAt: null,
      lastSeenAt: null,
      lastPostAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(communityMembers).values(member);
  } else if (member.displayName !== displayName && (owner || creator || manager)) {
    member = { ...member, displayName };
    await db.update(communityMembers).set({ displayName, updatedAt: timestamp }).where(eq(communityMembers.id, member.id));
  }
  if (member.status === "removed" && !owner) return { ok: false, status: 403, error: "You were removed from community chat." };
  const communityRole = owner ? "admin" : member.role === "moderator" ? "moderator" : "member";
  return { ok: true, member, communityRole };
}

function muted(member: Member) {
  return Boolean(member.mutedUntil && member.mutedUntil > nowIso());
}

async function settingsOf(db: PortalDb) {
  touch("community_settings");
  const rows = await db.select().from(communitySettings).where(eq(communitySettings.id, "default"));
  return rows[0] ?? { id: "default", readOnly: false, slowSeconds: 0 };
}

async function purgeDeleted(db: PortalDb) {
  const cutoff = new Date(Date.now() - MONTH_MS).toISOString();
  touch("community_messages");
  const rows = await db.select().from(communityMessages);
  for (const row of rows) {
    if (!row.deletedAt || row.deletedAt >= cutoff) continue;
    touch("community_reactions");
    await db.delete(communityReactions).where(eq(communityReactions.messageId, row.id));
    touch("community_reports");
    await db.delete(communityReports).where(eq(communityReports.messageId, row.id));
    await db.delete(communityMessages).where(eq(communityMessages.id, row.id));
  }
}

export async function acceptCommunityGuidelines(db: PortalDb, actor: CommunityActor): Promise<Result<{ accepted: true }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  const timestamp = nowIso();
  touch("community_members");
  await db.update(communityMembers).set({ guidelinesAt: timestamp, updatedAt: timestamp }).where(eq(communityMembers.id, access.member.id));
  return { ok: true, accepted: true };
}

export async function touchCommunityPresence(db: PortalDb, actor: CommunityActor): Promise<Result<{ seen: true }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  const last = access.member.lastSeenAt ? Date.parse(access.member.lastSeenAt) : 0;
  if (Date.now() - last < 60_000) return { ok: true, seen: true };
  touch("community_members");
  await db.update(communityMembers).set({ lastSeenAt: nowIso(), updatedAt: nowIso() }).where(eq(communityMembers.id, access.member.id));
  return { ok: true, seen: true };
}

export async function saveCommunityPhoto(
  db: PortalDb,
  actor: CommunityActor,
  input: { bytes: Uint8Array; contentType: string; childFace: boolean },
): Promise<Result<{ id: string; held: boolean }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  if (!access.member.guidelinesAt) {
    return { ok: false, status: 403, error: "Agree to the community guidelines before posting." };
  }
  if (input.contentType !== "image/jpeg" && input.contentType !== "image/png") {
    return { ok: false, status: 400, error: "Upload a JPEG or PNG." };
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > 2_000_000) {
    return { ok: false, status: 400, error: "That photo is too large." };
  }
  const stripped = input.contentType === "image/jpeg" ? stripJpegMetadata(input.bytes) : input.bytes;
  const id = crypto.randomUUID();
  const held = Boolean(input.childFace);
  const bucket = await photoStore();
  if (!bucket) return { ok: false, status: 503, error: PHOTOS_OFF };
  const r2Key = `community/${id}`;
  try {
    await bucket.put(r2Key, stripped, { httpMetadata: { contentType: input.contentType } });
  } catch {
    return { ok: false, status: 503, error: PHOTOS_OFF };
  }
  const bytesBase64: string | null = null;
  touch("community_photos");
  await db.insert(communityPhotos).values({
    id,
    sha256: await sha256Hex(stripped),
    contentType: input.contentType,
    bytesBase64,
    r2Key,
    held,
    approved: held ? null : true,
    createdAt: nowIso(),
  });
  return { ok: true, id, held };
}

export async function openCommunityPhoto(
  db: PortalDb,
  actor: CommunityActor,
  input: { id: string; exp: string | null; sig: string | null },
  now = Date.now(),
): Promise<Result<{ bytes: Uint8Array; contentType: string }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  if (!(await photoLinkValid(input.id, input.exp, input.sig, now))) {
    return { ok: false, status: 403, error: "This photo link has expired." };
  }
  touch("community_photos");
  const rows = await db.select().from(communityPhotos).where(eq(communityPhotos.id, input.id));
  const photo = rows[0];
  if (!photo) return { ok: false, status: 404, error: "Photo not found." };
  if (photo.held && photo.approved !== true && access.communityRole !== "admin") {
    return { ok: false, status: 404, error: "Photo not found." };
  }
  if (photo.r2Key) {
    const bucket = await photoStore();
    if (!bucket) return { ok: false, status: 404, error: "Photo not found." };
    try {
      const object = await bucket.get(photo.r2Key);
      if (!object) return { ok: false, status: 404, error: "Photo not found." };
      const bytes = new Uint8Array(await object.arrayBuffer());
      return { ok: true, bytes, contentType: photo.contentType };
    } catch {
      return { ok: false, status: 404, error: "Photo not found." };
    }
  }
  if (!photo.bytesBase64) return { ok: false, status: 404, error: "Photo not found." };
  return { ok: true, bytes: Buffer.from(photo.bytesBase64, "base64"), contentType: photo.contentType };
}

export async function postCommunityMessage(
  db: PortalDb,
  actor: CommunityActor,
  input: { channelId: string; body?: string | null; photoId?: string | null; acknowledgePrivate?: boolean },
): Promise<Result<{ id: string }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  if (muted(access.member)) return { ok: false, status: 403, error: "You are muted." };
  if (!access.member.guidelinesAt) return { ok: false, status: 403, error: "Agree to the community guidelines before posting." };
  const settings = await settingsOf(db);
  if (settings.readOnly && access.communityRole !== "admin") return { ok: false, status: 403, error: "Community chat is read-only." };
  touch("community_channels");
  const channels = await db.select().from(communityChannels).where(eq(communityChannels.id, input.channelId));
  const channel = channels[0];
  if (!channel) return { ok: false, status: 404, error: "That channel does not exist." };
  if (channel.kind === "announcements" && access.communityRole !== "admin") {
    return { ok: false, status: 403, error: "Only an admin can post in Announcements." };
  }
  if (settings.slowSeconds > 0 && access.member.lastPostAt) {
    const elapsed = Date.now() - Date.parse(access.member.lastPostAt);
    if (elapsed < settings.slowSeconds * 1000) return { ok: false, status: 429, error: "Slow mode is on. Wait a moment before posting again." };
  }
  const body = clean(input.body);
  const photoId = clean(input.photoId);
  if (!body && !photoId) return { ok: false, status: 400, error: "Write a message or attach a photo." };
  if (body && body.length > 2000) return { ok: false, status: 400, error: "That message is too long." };
  const kinds = body ? privateKinds(body) : [];
  if (kinds.length && !input.acknowledgePrivate) {
    await recordHits(db, kinds);
    return { ok: false, status: 409, error: "This looks private. Post anyway?", kinds };
  }
  if (kinds.length) await recordHits(db, kinds);
  let held = false;
  if (photoId) {
    touch("community_photos");
    const photos = await db.select().from(communityPhotos).where(eq(communityPhotos.id, photoId));
    const photo = photos[0];
    if (!photo) return { ok: false, status: 404, error: "Photo not found." };
    held = Boolean(photo.held && photo.approved !== true);
  }
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  touch("community_messages");
  await db.insert(communityMessages).values({
    id,
    channelId: channel.id,
    authorMemberId: access.member.id,
    authorName: access.member.displayName,
    body,
    photoId,
    pinned: false,
    held,
    createdAt: timestamp,
    deletedAt: null,
  });
  touch("community_members");
  await db.update(communityMembers).set({ lastPostAt: timestamp, updatedAt: timestamp }).where(eq(communityMembers.id, access.member.id));
  await bumpCursor(db);
  return { ok: true, id };
}

export async function reactToCommunityMessage(
  db: PortalDb,
  actor: CommunityActor,
  input: { messageId: string; emoji: string },
): Promise<Result<{ on: boolean }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  if (muted(access.member)) return { ok: false, status: 403, error: "You are muted." };
  if (!(COMMUNITY_EMOJIS as readonly string[]).includes(input.emoji)) return { ok: false, status: 400, error: "That reaction is not available." };
  touch("community_reactions");
  const rows = await db.select().from(communityReactions);
  const existing = rows.find((row) => row.messageId === input.messageId && row.memberId === access.member.id && row.emoji === input.emoji);
  if (existing) {
    await db.delete(communityReactions).where(eq(communityReactions.id, existing.id));
    await bumpCursor(db);
    return { ok: true, on: false };
  }
  await db.insert(communityReactions).values({
    id: crypto.randomUUID(),
    messageId: input.messageId,
    memberId: access.member.id,
    emoji: input.emoji,
    createdAt: nowIso(),
  });
  await bumpCursor(db);
  return { ok: true, on: true };
}

export async function reportCommunityMessage(db: PortalDb, actor: CommunityActor, messageId: string): Promise<Result<{ id: string }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  touch("community_messages");
  const messages = await db.select().from(communityMessages).where(eq(communityMessages.id, messageId));
  if (!messages[0] || messages[0].deletedAt) return { ok: false, status: 404, error: "Message not found." };
  const id = crypto.randomUUID();
  touch("community_reports");
  await db.insert(communityReports).values({
    id,
    messageId,
    reporterMemberId: access.member.id,
    status: "open",
    createdAt: nowIso(),
    resolvedAt: null,
    resolvedBy: null,
  });
  await bumpCursor(db);
  return { ok: true, id };
}

async function memberById(db: PortalDb, id: string) {
  touch("community_members");
  const rows = await db.select().from(communityMembers).where(eq(communityMembers.id, id));
  return rows[0] ?? null;
}

export async function moderateCommunity(
  db: PortalDb,
  actor: CommunityActor,
  input: {
    action: string;
    messageId?: string | null;
    memberId?: string | null;
    reportId?: string | null;
    photoId?: string | null;
    role?: string | null;
    readOnly?: boolean;
    slowSeconds?: number;
  },
): Promise<Result<{ done: true }>> {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  const staff = access.communityRole === "admin" || access.communityRole === "moderator";
  const timestamp = nowIso();

  if (input.action === "delete") {
    const messageId = clean(input.messageId);
    if (!messageId) return { ok: false, status: 400, error: "messageId is required." };
    touch("community_messages");
    const rows = await db.select().from(communityMessages).where(eq(communityMessages.id, messageId));
    const message = rows[0];
    if (!message) return { ok: false, status: 404, error: "Message not found." };
    const mine = message.authorMemberId === access.member.id;
    if (!mine && !staff) return { ok: false, status: 403, error: "You can't delete that message." };
    await db.update(communityMessages).set({ deletedAt: timestamp }).where(eq(communityMessages.id, message.id));
    if (!mine) await audit(db, access.member.displayName, "delete", message.authorName, message.id);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (!staff && input.action !== "delete") return { ok: false, status: 403, error: "Only a moderator can do that." };

  if (input.action === "pin" || input.action === "unpin") {
    if (access.communityRole !== "admin") return { ok: false, status: 403, error: "Only an admin can pin a message." };
    const messageId = clean(input.messageId);
    if (!messageId) return { ok: false, status: 400, error: "messageId is required." };
    touch("community_messages");
    const rows = await db.select().from(communityMessages).where(eq(communityMessages.id, messageId));
    const message = rows[0];
    if (!message) return { ok: false, status: 404, error: "Message not found." };
    if (input.action === "pin") {
      const all = await db.select().from(communityMessages);
      for (const row of all) {
        if (row.channelId === message.channelId && row.pinned) {
          await db.update(communityMessages).set({ pinned: false }).where(eq(communityMessages.id, row.id));
        }
      }
    }
    await db.update(communityMessages).set({ pinned: input.action === "pin" }).where(eq(communityMessages.id, message.id));
    await audit(db, access.member.displayName, input.action, message.authorName, message.id);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (input.action === "mute" || input.action === "remove" || input.action === "set_role") {
    const messageId = clean(input.messageId);
    const memberId = clean(input.memberId);
    let target: Member | null = null;
    if (memberId) target = await memberById(db, memberId);
    if (!target && messageId) {
      touch("community_messages");
      const rows = await db.select().from(communityMessages).where(eq(communityMessages.id, messageId));
      if (rows[0]) target = await memberById(db, rows[0].authorMemberId);
    }
    if (!target) return { ok: false, status: 404, error: "Member not found." };
    if (normalizeEmail(target.email) === normalizeEmail(actor.email) && actor.role === "admin") {
      return { ok: false, status: 403, error: "You can't change the owner's community access." };
    }
    if (input.action === "remove" || input.action === "set_role") {
      if (access.communityRole !== "admin") return { ok: false, status: 403, error: "Only an admin can remove a member or change roles." };
    }
    if (input.action === "mute") {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await db.update(communityMembers).set({ mutedUntil: until, updatedAt: timestamp }).where(eq(communityMembers.id, target.id));
      await audit(db, access.member.displayName, "mute", target.displayName, messageId);
    } else if (input.action === "remove") {
      await db.update(communityMembers).set({ status: "removed", updatedAt: timestamp }).where(eq(communityMembers.id, target.id));
      await audit(db, access.member.displayName, "remove", target.displayName, messageId);
    } else {
      const role = input.role === "moderator" ? "moderator" : "member";
      await db.update(communityMembers).set({ role, updatedAt: timestamp }).where(eq(communityMembers.id, target.id));
      await audit(db, access.member.displayName, "set_role", target.displayName, null);
    }
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (input.action === "dismiss") {
    const reportId = clean(input.reportId);
    if (!reportId) return { ok: false, status: 400, error: "reportId is required." };
    touch("community_reports");
    await db.update(communityReports).set({ status: "dismissed", resolvedAt: timestamp, resolvedBy: access.member.displayName }).where(eq(communityReports.id, reportId));
    await audit(db, access.member.displayName, "dismiss", null, null);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (input.action === "read_only") {
    if (access.communityRole !== "admin") return { ok: false, status: 403, error: "Only an admin can change read-only mode." };
    touch("community_settings");
    await db.update(communitySettings).set({ readOnly: Boolean(input.readOnly) }).where(eq(communitySettings.id, "default"));
    await audit(db, access.member.displayName, "read_only", null, null);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (input.action === "slow") {
    if (access.communityRole !== "admin") return { ok: false, status: 403, error: "Only an admin can change slow mode." };
    const slowSeconds = Math.max(0, Math.min(3600, Number(input.slowSeconds) || 0));
    touch("community_settings");
    await db.update(communitySettings).set({ slowSeconds }).where(eq(communitySettings.id, "default"));
    await audit(db, access.member.displayName, "slow", null, null);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  if (input.action === "approve_photo" || input.action === "reject_photo") {
    if (access.communityRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can approve a held photo." };
    const photoId = clean(input.photoId);
    if (!photoId) return { ok: false, status: 400, error: "photoId is required." };
    touch("community_photos");
    await db.update(communityPhotos).set({ approved: input.action === "approve_photo", held: input.action !== "approve_photo" }).where(eq(communityPhotos.id, photoId));
    touch("community_messages");
    const messages = await db.select().from(communityMessages);
    for (const message of messages) {
      if (message.photoId === photoId) {
        await db.update(communityMessages).set({ held: input.action !== "approve_photo" }).where(eq(communityMessages.id, message.id));
      }
    }
    await audit(db, access.member.displayName, input.action, null, null);
    await bumpCursor(db);
    return { ok: true, done: true };
  }

  return { ok: false, status: 400, error: "Unknown community action." };
}

function assertCommunityPayload<T>(value: T): T {
  const packed = JSON.stringify(value);
  if (/full access|full_access|\bCore\b/i.test(packed)) {
    throw new Error("Community payload included an access level.");
  }
  return value;
}

export async function listCommunity(db: PortalDb, actor: CommunityActor, after: string | null) {
  const access = await loadCommunityMember(db, actor);
  if (!access.ok) return access;
  await purgeDeleted(db);
  const cursor = await currentCursor(db);
  if (after && after === cursor) return { ok: true as const, unchanged: true as const };
  const yearAgo = new Date(Date.now() - YEAR_MS).toISOString();
  touch("community_channels");
  const channels = await db.select().from(communityChannels);
  touch("community_members");
  const members = await db.select().from(communityMembers);
  const removed = new Set(members.filter((member) => member.status === "removed").map((member) => member.id));
  touch("community_messages");
  const messages = await db.select().from(communityMessages);
  touch("community_reactions");
  const reactions = await db.select().from(communityReactions);
  touch("community_photos");
  const photos = await db.select({
    id: communityPhotos.id,
    held: communityPhotos.held,
    approved: communityPhotos.approved,
  }).from(communityPhotos);
  const photosEnabled = Boolean(await photoStore());
  const visible = messages
    .filter((message) => !message.deletedAt && message.createdAt >= yearAgo)
    .filter((message) => !message.held || access.communityRole === "admin")
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const listed = [];
  for (const message of visible) {
    const counts = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const reaction of reactions) {
      if (reaction.messageId !== message.id) continue;
      const current = counts.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
      current.count += 1;
      if (reaction.memberId === access.member.id) current.mine = true;
      counts.set(reaction.emoji, current);
    }
    let photoUrl: string | null = null;
    if (message.photoId) {
      const photo = photoById.get(message.photoId);
      if (photo && (!photo.held || photo.approved === true || access.communityRole === "admin")) {
        photoUrl = await signPhotoUrl(message.photoId);
      }
    }
    listed.push({
      id: message.id,
      channelId: message.channelId,
      authorName: removed.has(message.authorMemberId) ? "former member" : message.authorName,
      authorMemberId: message.authorMemberId,
      mine: message.authorMemberId === access.member.id,
      body: message.body,
      pinned: message.pinned,
      held: message.held,
      createdAt: message.createdAt,
      photoUrl,
      reactions: [...counts.values()],
    });
  }
  const settings = await settingsOf(db);
  let reports: { id: string; messageId: string; excerpt: string }[] = [];
  let auditRows: { id: string; actorName: string; action: string; targetName: string | null; createdAt: string }[] = [];
  if (access.communityRole === "admin" || access.communityRole === "moderator") {
    touch("community_reports");
    const openReports = await db.select().from(communityReports);
    reports = openReports.filter((report) => report.status === "open").map((report) => {
      const message = messages.find((row) => row.id === report.messageId);
      return { id: report.id, messageId: report.messageId, excerpt: (message?.body ?? "Photo").slice(0, 80) };
    });
  }
  if (access.communityRole === "admin") {
    touch("community_audit");
    const rows = await db.select().from(communityAudit);
    auditRows = rows.slice(-20).map((row) => ({
      id: row.id,
      actorName: row.actorName,
      action: row.action,
      targetName: row.targetName,
      createdAt: row.createdAt,
    }));
  }
  const heldPhotos = access.communityRole === "admin"
    ? photos.filter((photo) => photo.held && photo.approved == null).map((photo) => ({ id: photo.id }))
    : [];
  return assertCommunityPayload({
    ok: true as const,
    unchanged: false as const,
    cursor,
    me: {
      name: access.member.displayName,
      communityRole: access.communityRole,
      guidelines: Boolean(access.member.guidelinesAt),
      muted: muted(access.member),
    },
    channels: channels.map((channel) => ({ id: channel.id, name: channel.name, kind: channel.kind })),
    messages: listed,
    reports,
    audit: auditRows,
    settings: { readOnly: settings.readOnly, slowSeconds: settings.slowSeconds },
    held: heldPhotos,
    photosEnabled,
  });
}

export async function listFilterHitKinds(db: PortalDb) {
  touch("community_filter_hits");
  const rows = await db.select().from(communityFilterHits);
  return rows.map((row) => row.kind);
}
