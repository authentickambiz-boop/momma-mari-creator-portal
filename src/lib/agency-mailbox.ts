import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { agencyMailboxes } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";
import { encryptToken } from "./token-crypto";

/** Kamron's agency inbox is watched, and it is not a roster creator. */
export const AGENCY_MAILBOX_ID = "agency";
export const KAMRON_AGENCY_EMAIL = "kamron@mommamari.com";

export async function readAgencyMailbox(db: PortalDb) {
  const rows = await db.select().from(agencyMailboxes).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
  const row = rows[0];
  const reconnectReason = row?.reconnectReason === "unauthorized_client" || row?.reconnectReason === "invalid_grant"
    ? row.reconnectReason
    : null;
  return {
    connected: Boolean(row?.refreshToken),
    gmailEmail: row?.refreshToken ? KAMRON_AGENCY_EMAIL : null,
    connectedAt: row?.connectedAt ?? null,
    cipher: row?.refreshToken ?? null,
    needsReconnect: Boolean(row?.refreshToken && reconnectReason),
    reconnectReason,
  };
}

export async function saveAgencyMailbox(db: PortalDb, input: { refreshToken: string; gmailEmail: string }) {
  const refreshToken = input.refreshToken.trim();
  const gmailEmail = normalizeEmail(input.gmailEmail);
  if (!refreshToken || gmailEmail !== KAMRON_AGENCY_EMAIL) {
    return { ok: false as const, status: 400, error: "Google did not return Kamron's mailbox." };
  }
  let cipher: string;
  try {
    cipher = await encryptToken(refreshToken);
  } catch {
    return { ok: false as const, status: 503, error: "Email connection is not set up yet." };
  }
  if (cipher.includes(refreshToken)) {
    return { ok: false as const, status: 500, error: "Refusing to store a readable token." };
  }
  const timestamp = nowIso();
  const existing = await db.select().from(agencyMailboxes).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
  const values = {
    label: "Kamron",
    refreshToken: cipher,
    connectedAt: timestamp,
    reconnectReason: null,
  };
  if (existing[0]) await db.update(agencyMailboxes).set(values).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
  else await db.insert(agencyMailboxes).values({ mailbox: KAMRON_AGENCY_EMAIL, ...values });
  return { ok: true as const, gmailEmail };
}

export async function setAgencyReconnect(db: PortalDb, reason: "unauthorized_client" | "invalid_grant" | null) {
  const existing = await db.select().from(agencyMailboxes).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
  if (!existing[0]) return;
  await db.update(agencyMailboxes).set({ reconnectReason: reason }).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
}

export async function clearAgencyMailboxToken(db: PortalDb) {
  await db.update(agencyMailboxes).set({
    refreshToken: null,
    connectedAt: null,
    reconnectReason: null,
  }).where(eq(agencyMailboxes.mailbox, KAMRON_AGENCY_EMAIL));
}
