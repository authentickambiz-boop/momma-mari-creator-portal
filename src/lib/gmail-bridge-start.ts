import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorPortalLogins, gmailBridgeStarts } from "@/db/schema";
import { AGENCY_MAILBOX_ID } from "./agency-mailbox";
import { normalizeEmail, nowIso } from "./format";
import { gmailSyncEnabled } from "./gmail-sync-flag";
import { gmailConnectionState } from "./onboarding";
import type { Viewer } from "./types";

/** Shown while a creator is still on her first sign-in and Gmail is not connected. */
export const GMAIL_BRIDGE_CONNECT_PROMPT =
  "Connect Gmail if you want brand threads in your deal inbox. Google asks for read-only access, and that is the only access we use. We never send mail as you. Nothing from your inbox starts unless Gmail is connected.";

export type GmailBridgeSetup = (input: { creatorId: string; mailbox: string; startedAt: string }) => Promise<void> | void;

export type GmailBridgeStartReason = "started" | "already" | "gate" | "no_gmail" | "not_creator" | "not_signed_in";

export type GmailBridgeStartResult = {
  started: boolean;
  reason: GmailBridgeStartReason;
  startedAt: string | null;
};

function notStarted(reason: GmailBridgeStartReason, startedAt: string | null = null): GmailBridgeStartResult {
  return { started: false, reason, startedAt };
}

function isUnique(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const text = `${error instanceof Error ? error.message : String(error)} ${cause instanceof Error ? cause.message : String(cause ?? "")}`;
  return /unique/i.test(text);
}

export async function gmailBridgeStartFor(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(gmailBridgeStarts).where(eq(gmailBridgeStarts.creatorId, creatorId));
  return rows[0] ?? null;
}

async function portalLoginFor(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorPortalLogins).where(eq(creatorPortalLogins.creatorId, creatorId));
  return rows[0] ?? null;
}

async function recordCreatorPortalLogin(db: PortalDb, creatorId: string) {
  const existing = await portalLoginFor(db, creatorId);
  if (existing) {
    const loginCount = existing.loginCount + 1;
    await db.update(creatorPortalLogins).set({ loginCount }).where(eq(creatorPortalLogins.creatorId, creatorId));
    return { first: false, loginCount, firstLoginAt: existing.firstLoginAt };
  }
  const firstLoginAt = nowIso();
  try {
    await db.insert(creatorPortalLogins).values({ creatorId, firstLoginAt, loginCount: 1 });
    return { first: true, loginCount: 1, firstLoginAt };
  } catch (error) {
    if (!isUnique(error)) throw error;
    const again = await portalLoginFor(db, creatorId);
    return { first: false, loginCount: again?.loginCount ?? 1, firstLoginAt: again?.firstLoginAt ?? firstLoginAt };
  }
}

/**
 * Enroll one creator when the live-sync gate is on, Gmail consent is saved, and she has signed in.
 * A second call keeps the original start time and does not run setup again.
 * This does not read a mailbox and does not send mail.
 */
async function considerCreatorGmailBridge(db: PortalDb, creatorId: string, options?: { setup?: GmailBridgeSetup }): Promise<GmailBridgeStartResult> {
  if (!gmailSyncEnabled()) return notStarted("gate");
  const connection = await gmailConnectionState(db, creatorId);
  const mailbox = normalizeEmail(connection.gmailEmail ?? "");
  if (!connection.connected || !mailbox || connection.needsReconnect) return notStarted("no_gmail");
  const existing = await gmailBridgeStartFor(db, creatorId);
  if (existing) return notStarted("already", existing.startedAt);
  const startedAt = nowIso();
  try {
    await db.insert(gmailBridgeStarts).values({ creatorId, startedAt, mailbox });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const row = await gmailBridgeStartFor(db, creatorId);
    return notStarted("already", row?.startedAt ?? null);
  }
  await options?.setup?.({ creatorId, mailbox, startedAt });
  return { started: true, reason: "started", startedAt };
}

/** Record a creator sign-in, then start her bridge once if Gmail is already connected and the gate is on. */
export async function onCreatorPortalLogin(
  db: PortalDb,
  viewer: Viewer,
  options?: { setup?: GmailBridgeSetup },
): Promise<GmailBridgeStartResult> {
  if (viewer.role !== "creator" || !viewer.creatorId || viewer.creatorId === AGENCY_MAILBOX_ID) return notStarted("not_creator");
  await recordCreatorPortalLogin(db, viewer.creatorId);
  return considerCreatorGmailBridge(db, viewer.creatorId, options);
}

/**
 * Gmail consent finished. Starts the bridge only after this creator has signed in,
 * and only once. Connecting before her first sign-in does not start it.
 */
export async function onCreatorGmailConsent(
  db: PortalDb,
  creatorId: string,
  options?: { setup?: GmailBridgeSetup },
): Promise<GmailBridgeStartResult> {
  if (!creatorId || creatorId === AGENCY_MAILBOX_ID) return notStarted("not_creator");
  const visit = await portalLoginFor(db, creatorId);
  if (!visit) return notStarted("not_signed_in");
  return considerCreatorGmailBridge(db, creatorId, options);
}

/** First sign-in, Gmail not connected, bridge not started. Otherwise null. */
export async function gmailBridgeFirstLoginPrompt(db: PortalDb, creatorId: string) {
  const visit = await portalLoginFor(db, creatorId);
  if (!visit || visit.loginCount !== 1) return null;
  if (await gmailBridgeStartFor(db, creatorId)) return null;
  const connection = await gmailConnectionState(db, creatorId);
  if (connection.connected && !connection.needsReconnect) return null;
  return GMAIL_BRIDGE_CONNECT_PROMPT;
}

/** Sign-in should finish even if the bridge row cannot be written. */
export async function rememberCreatorLogin(db: PortalDb, viewer: Viewer) {
  try {
    await onCreatorPortalLogin(db, viewer);
  } catch {
    // The session is already saved. A later sign-in can start the bridge.
  }
}

/** Consent is already saved. A missed start can run on her next sign-in. */
export async function rememberGmailConsent(db: PortalDb, creatorId: string) {
  try {
    await onCreatorGmailConsent(db, creatorId);
  } catch {
    // The token is already saved. Nothing was sent.
  }
}
