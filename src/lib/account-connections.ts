import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators } from "@/db/schema";
import {
  canManageCreatorAccounts,
  isConnectPlatform,
  type ConnectPlatform,
} from "./account-connection-status";
import { withBasePath } from "./format";
import { AGENCY_MAILBOX_ID } from "./agency-mailbox";
import { clearCreatorGmail, mailboxForCreator } from "./gmail-push";
import { revokeGoogleToken, type GoogleTokenRevoker } from "./google-oauth";
import { encryptToken, decryptToken } from "./token-crypto";
import type { Viewer } from "./types";
import { noteAccountConnected } from "./worlds/game-wallet-store";

export async function driveConnectionState(db: PortalDb, creatorId: string) {
  const rows = await db.select({
    cipher: creators.driveRefreshToken,
    reconnectReason: creators.driveReconnectReason,
  }).from(creators).where(eq(creators.id, creatorId));
  const row = rows[0];
  const reconnectReason = row?.reconnectReason?.trim() ? row.reconnectReason : null;
  return {
    connected: Boolean(row?.cipher),
    cipher: row?.cipher ?? null,
    needsReconnect: Boolean(row?.cipher && reconnectReason),
    reconnectReason,
  };
}

export async function saveDriveConnection(db: PortalDb, creatorId: string, refreshToken: string) {
  const token = refreshToken.trim();
  if (!token) return { ok: false as const, status: 400, error: "Google did not return a Drive connection." };
  const creator = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, status: 404, error: "Creator not found." };
  let cipher: string;
  try {
    cipher = await encryptToken(token);
  } catch {
    return { ok: false as const, status: 503, error: "Drive connection is not set up yet." };
  }
  if (cipher.includes(token)) return { ok: false as const, status: 500, error: "Refusing to store a readable token." };
  await db.update(creators).set({
    driveRefreshToken: cipher,
    driveReconnectReason: null,
  }).where(eq(creators.id, creatorId));
  await noteAccountConnected(db, creatorId, "drive");
  return { ok: true as const };
}

export function gmailConnectHref(viewer: Viewer, creatorId: string) {
  const watched = mailboxForCreator(creatorId);
  const self = viewer.role === "creator" && viewer.creatorId === creatorId;
  if (watched && (viewer.role === "admin" || self)) {
    return withBasePath(`/api/auth/gmail/watch?creator=${encodeURIComponent(creatorId)}`);
  }
  if (self) return withBasePath("/api/auth/gmail");
  return null;
}

export function driveConnectHref(viewer: Viewer, creatorId: string) {
  if (viewer.role === "creator" && viewer.creatorId === creatorId) return withBasePath("/api/auth/drive");
  return null;
}

async function revokeStoredDriveToken(cipher: string | null, revoke: GoogleTokenRevoker) {
  if (!cipher) return;
  try {
    await revoke(await decryptToken(cipher));
  } catch {
    // An unreadable ciphertext or a failed revoke still clears the local copy.
  }
}

function socialDisconnectPatch(platform: "tiktok" | "instagram" | "facebook" | "youtube") {
  if (platform === "tiktok") return { tiktokStatus: "disconnected" };
  if (platform === "instagram") return { instagramStatus: "disconnected" };
  if (platform === "facebook") return { facebookStatus: "disconnected" };
  return { youtubeStatus: "disconnected" };
}

/** Disconnect one account for a creator. Does not sign anyone out of the portal. */
export async function disconnectCreatorAccount(
  db: PortalDb,
  viewer: Viewer,
  creatorId: string,
  platform: string,
  options?: { revoke?: GoogleTokenRevoker },
) {
  if (!isConnectPlatform(platform)) return { status: 400 as const, body: { error: "Unknown account." } };
  if (!canManageCreatorAccounts(viewer, creatorId)) {
    return { status: 403 as const, body: { error: "You can only change your own accounts." } };
  }
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  const revoke = options?.revoke ?? revokeGoogleToken;
  if (!creator[0]) {
    if (creatorId === AGENCY_MAILBOX_ID && platform === "gmail" && viewer.role === "admin") {
      const cleared = await clearCreatorGmail(db, creatorId, { revoke });
      if (cleared.status !== 200) return { status: 404 as const, body: { error: "Creator not found." } };
      return { status: 200 as const, body: { ok: true as const, platform, creatorId, cleared: true as const } };
    }
    return { status: 404 as const, body: { error: "Creator not found." } };
  }
  if (platform === "gmail") {
    const cleared = await clearCreatorGmail(db, creatorId, { revoke });
    if (cleared.status !== 200) return { status: 404 as const, body: { error: "Creator not found." } };
    return { status: 200 as const, body: { ok: true as const, platform, creatorId, cleared: true as const } };
  }
  if (platform === "drive") {
    await revokeStoredDriveToken(creator[0].driveRefreshToken, revoke);
    await db.update(creators).set({
      driveRefreshToken: null,
      driveReconnectReason: null,
    }).where(eq(creators.id, creatorId));
    return { status: 200 as const, body: { ok: true as const, platform, creatorId, cleared: true as const } };
  }
  await db.update(creators).set(socialDisconnectPatch(platform)).where(eq(creators.id, creatorId));
  return { status: 200 as const, body: { ok: true as const, platform: platform as ConnectPlatform, creatorId, cleared: true as const } };
}
