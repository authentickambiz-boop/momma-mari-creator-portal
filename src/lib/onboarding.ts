import { and, asc, eq, isNull } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { adminNotifications, creatorOnboarding, creators } from "@/db/schema";
import {
  hostedEmailAddOn,
  hostedEmailPreview,
  hostedEmailRequestMessage,
  isEmailSetup,
  type EmailSetup,
} from "./email-setup";
import { normalizeEmail, nowIso } from "./format";
import { assignedManagersByCreator, notifyStaff } from "./managers";
import { ONBOARDING_PLATFORMS, type OnboardingPlatform } from "./onboarding-fields";
import { AGENCY_MAILBOX_ID, readAgencyMailbox, setAgencyReconnect } from "./agency-mailbox";
import { encryptToken } from "./token-crypto";
import { noteAccountConnected } from "./worlds/game-wallet-store";

export const CREATOR_READY_MESSAGE = "New creator ready for bot";
export const HOSTED_EMAIL_KIND = "hosted_email";
export { ONBOARDING_PLATFORMS, onboardingPlatformLabel } from "./onboarding-fields";
export { emailSetupLabel, hostedEmailAddOn, hostedEmailPreview, hostedEmailRequestMessage } from "./email-setup";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export async function saveGmailConnection(
  db: PortalDb,
  creatorId: string,
  input: { refreshToken: string; gmailEmail: string },
) {
  const refreshToken = input.refreshToken.trim();
  const gmailEmail = normalizeEmail(input.gmailEmail);
  if (!refreshToken || !gmailEmail.includes("@")) {
    return { ok: false as const, status: 400, error: "Google did not return a mailbox." };
  }
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, status: 404, error: "Creator not found." };
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
  await db.update(creators).set({
    gmailRefreshToken: cipher,
    gmailEmail,
    gmailConnectedAt: timestamp,
    gmailReconnectReason: null,
    emailStatus: "connected",
  }).where(eq(creators.id, creatorId));
  await noteAccountConnected(db, creatorId, "gmail");
  return { ok: true as const, gmailEmail };
}

export type MailboxReconnectReason = "unauthorized_client" | "invalid_grant";

export function mailboxReconnectReason(message: string): MailboxReconnectReason | null {
  if (message.includes("unauthorized_client")) return "unauthorized_client";
  if (message.includes("invalid_grant")) return "invalid_grant";
  return null;
}

export async function markMailboxNeedsReconnect(db: PortalDb, creatorId: string, reason: MailboxReconnectReason) {
  if (creatorId === AGENCY_MAILBOX_ID) {
    await setAgencyReconnect(db, reason);
    return;
  }
  await db.update(creators).set({ gmailReconnectReason: reason }).where(eq(creators.id, creatorId));
}

export async function clearMailboxReconnect(db: PortalDb, creatorId: string) {
  if (creatorId === AGENCY_MAILBOX_ID) {
    await setAgencyReconnect(db, null);
    return;
  }
  await db.update(creators).set({ gmailReconnectReason: null }).where(eq(creators.id, creatorId));
}

export async function gmailConnectionState(db: PortalDb, creatorId: string) {
  if (creatorId === AGENCY_MAILBOX_ID) return readAgencyMailbox(db);
  const rows = await db.select({
    cipher: creators.gmailRefreshToken,
    gmailEmail: creators.gmailEmail,
    connectedAt: creators.gmailConnectedAt,
    reconnectReason: creators.gmailReconnectReason,
  }).from(creators).where(eq(creators.id, creatorId));
  const row = rows[0];
  const reconnectReason = row?.reconnectReason === "unauthorized_client" || row?.reconnectReason === "invalid_grant"
    ? row.reconnectReason
    : null;
  return {
    connected: Boolean(row?.cipher),
    gmailEmail: row?.gmailEmail ?? null,
    connectedAt: row?.connectedAt ?? null,
    cipher: row?.cipher ?? null,
    needsReconnect: Boolean(row?.cipher && reconnectReason),
    reconnectReason,
  };
}

export type OnboardingInput = {
  botName?: string | null;
  niche?: string | null;
  kidsAges?: string | null;
  contentStyle?: string | null;
  rates?: string | null;
  favoriteBrands?: string | null;
  platforms?: string[] | null;
};

export async function emailSetupFor(db: PortalDb, creatorId: string) {
  const rows = await db.select({
    choice: creators.emailSetup,
    hostedEmailAddress: creators.hostedEmailAddress,
  }).from(creators).where(eq(creators.id, creatorId));
  const choice = rows[0]?.choice;
  return {
    choice: isEmailSetup(choice) ? choice : null,
    hostedEmailAddress: rows[0]?.hostedEmailAddress ?? null,
  };
}

export async function saveEmailSetup(
  db: PortalDb,
  creatorId: string,
  choice: EmailSetup | "reset",
  hostedAddress?: string | null,
) {
  const creator = await db.select().from(creators).where(eq(creators.id, creatorId));
  if (!creator[0]) return { ok: false as const, status: 404, error: "Creator not found." };
  if (choice === "reset") {
    await db.update(creators).set({ emailSetup: null }).where(eq(creators.id, creatorId));
    return { ok: true as const, choice: null, hostedEmailAddress: creator[0].hostedEmailAddress, notified: false };
  }
  let hostedEmailAddress = creator[0].hostedEmailAddress;
  let notified = false;
  if (choice === "hosted") {
    const address = hostedEmailPreview(hostedAddress ?? "");
    if (!address) {
      return { ok: false as const, status: 400, error: "Enter the name you want before @mommamari.com." };
    }
    hostedEmailAddress = address;
    const message = hostedEmailRequestMessage(address);
    const sent = await notifyStaff(db, {
      kind: HOSTED_EMAIL_KIND,
      creatorId,
      message,
      upsert: true,
    });
    notified = sent.notified;
  }
  await db.update(creators).set({
    emailSetup: choice,
    hostedEmailAddress,
  }).where(eq(creators.id, creatorId));
  return { ok: true as const, choice, hostedEmailAddress, notified };
}

export async function finishOnboarding(db: PortalDb, creatorId: string, input: OnboardingInput) {
  const setup = await emailSetupFor(db, creatorId);
  const connection = await gmailConnectionState(db, creatorId);
  const hostedReady = setup.choice === "hosted" && Boolean(setup.hostedEmailAddress);
  const connectReady = (setup.choice === "business" || setup.choice === "personal") && connection.connected;
  if (!hostedReady && !connectReady) {
    return {
      ok: false as const,
      status: 400,
      error: setup.choice === "hosted"
        ? "Enter the address you want Momma Mari to host."
        : "Choose how brand email should work, then connect it.",
    };
  }
  const botName = clean(input.botName);
  const niche = clean(input.niche);
  const contentStyle = clean(input.contentStyle);
  const rates = clean(input.rates);
  const existing = await db.select().from(creatorOnboarding).where(eq(creatorOnboarding.creatorId, creatorId));
  const favoriteBrands = input.favoriteBrands === undefined ? (existing[0]?.favoriteBrands ?? null) : clean(input.favoriteBrands);
  const kidsAges = input.kidsAges === undefined ? (existing[0]?.kidsAges ?? null) : clean(input.kidsAges);
  const platforms = [...new Set((input.platforms ?? []).map((item) => item.trim()).filter((item): item is OnboardingPlatform => (
    (ONBOARDING_PLATFORMS as readonly string[]).includes(item)
  )))];
  if (!botName || !niche || !contentStyle || !rates || platforms.length === 0) {
    return { ok: false as const, status: 400, error: "Name your bot, and add a niche, content style, rates, and at least one platform." };
  }
  const timestamp = nowIso();
  const values = {
    botName,
    niche,
    kidsAges,
    contentStyle,
    rates,
    favoriteBrands,
    platformsJson: JSON.stringify(platforms),
    finishedAt: timestamp,
    updatedAt: timestamp,
  };
  if (existing[0]) {
    await db.update(creatorOnboarding).set(values).where(eq(creatorOnboarding.creatorId, creatorId));
  } else {
    await db.insert(creatorOnboarding).values({
      creatorId,
      ...values,
      createdAt: timestamp,
    });
  }
  if (kidsAges) {
    await db.update(creators).set({ kidsAges }).where(eq(creators.id, creatorId));
  }
  const alreadyTold = existing[0]?.finishedAt
    ? true
    : (await db.select().from(adminNotifications).where(and(
      eq(adminNotifications.creatorId, creatorId),
      eq(adminNotifications.kind, "creator_ready"),
    )))[0];
  let notified = false;
  if (!alreadyTold) {
    const sent = await notifyStaff(db, {
      kind: "creator_ready",
      creatorId,
      message: CREATOR_READY_MESSAGE,
    });
    notified = sent.notified;
  }
  return { ok: true as const, finishedAt: timestamp, notified };
}

export type FinishedOnboarding = {
  creatorId: string;
  name: string;
  email: string;
  gmailEmail: string | null;
  gmailConnected: boolean;
  emailSetup: EmailSetup | null;
  hostedEmailAddress: string | null;
  hostedEmailAddOn: ReturnType<typeof hostedEmailAddOn> | null;
  botName: string;
  niche: string;
  kidsAges: string | null;
  contentStyle: string;
  rates: string;
  favoriteBrands: string | null;
  platforms: string[];
  finishedAt: string;
  message: string;
  manager: { id: string; name: string; email: string } | null;
};

export async function listFinishedOnboarding(db: PortalDb, since: string | null): Promise<FinishedOnboarding[]> {
  const [profiles, people, managerByCreator] = await Promise.all([
    db.select().from(creatorOnboarding),
    db.select().from(creators),
    assignedManagersByCreator(db),
  ]);
  const byId = new Map(people.map((creator) => [creator.id, creator]));
  return profiles
    .filter((profile) => profile.finishedAt && profile.botName && profile.niche && profile.contentStyle && profile.rates)
    .filter((profile) => !since || (profile.finishedAt ?? "") > since)
    .sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""))
    .flatMap((profile) => {
      const creator = byId.get(profile.creatorId);
      if (!creator) return [];
      return [{
        creatorId: profile.creatorId,
        name: creator.name,
        email: creator.email,
        gmailEmail: creator.gmailEmail,
        gmailConnected: Boolean(creator.gmailRefreshToken),
        emailSetup: isEmailSetup(creator.emailSetup) ? creator.emailSetup : null,
        hostedEmailAddress: creator.emailSetup === "hosted" ? creator.hostedEmailAddress : null,
        hostedEmailAddOn: creator.emailSetup === "hosted" ? hostedEmailAddOn() : null,
        botName: profile.botName ?? "",
        niche: profile.niche ?? "",
        kidsAges: profile.kidsAges,
        contentStyle: profile.contentStyle ?? "",
        rates: profile.rates ?? "",
        favoriteBrands: profile.favoriteBrands,
        platforms: JSON.parse(profile.platformsJson) as string[],
        finishedAt: profile.finishedAt ?? "",
        message: CREATOR_READY_MESSAGE,
        manager: managerByCreator.get(profile.creatorId) ?? null,
      }];
    });
}

async function unreadNotes(db: PortalDb, kind?: string) {
  const [notes, people] = await Promise.all([
    db.select().from(adminNotifications).where(kind
      ? and(eq(adminNotifications.kind, kind), isNull(adminNotifications.readAt), isNull(adminNotifications.managerId))
      : and(isNull(adminNotifications.readAt), isNull(adminNotifications.managerId)),
    ).orderBy(asc(adminNotifications.createdAt)),
    db.select().from(creators),
  ]);
  return { notes, people };
}

export async function listUnreadNotices(db: PortalDb) {
  const { notes, people } = await unreadNotes(db);
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  return notes.map((note) => ({
    id: note.id,
    kind: note.kind,
    creatorId: note.creatorId,
    creatorName: note.creatorId ? names.get(note.creatorId) ?? "Creator" : "Creator",
    message: note.message,
    createdAt: note.createdAt,
  }));
}

export async function listUnreadCreatorReady(db: PortalDb) {
  const { notes, people } = await unreadNotes(db, "creator_ready");
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  return notes.map((note) => ({
    id: note.id,
    creatorId: note.creatorId,
    creatorName: note.creatorId ? names.get(note.creatorId) ?? "Creator" : "Creator",
    message: note.message,
    createdAt: note.createdAt,
  }));
}

export async function dismissNotification(
  db: PortalDb,
  id: string,
  actor?: { role: string; managerId?: string | null },
) {
  const rows = await db.select().from(adminNotifications).where(eq(adminNotifications.id, id));
  if (!rows[0]) return { ok: false as const, status: 404, error: "Notification not found." };
  if (actor?.role === "manager" && rows[0].managerId !== actor.managerId) {
    return { ok: false as const, status: 403, error: "That notice isn't yours." };
  }
  await db.update(adminNotifications).set({ readAt: nowIso() }).where(eq(adminNotifications.id, id));
  return { ok: true as const };
}

export async function onboardingForCreator(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorOnboarding).where(eq(creatorOnboarding.creatorId, creatorId));
  const row = rows[0];
  if (!row) return null;
  return {
    botName: row.botName,
    niche: row.niche,
    kidsAges: row.kidsAges,
    contentStyle: row.contentStyle,
    rates: row.rates,
    favoriteBrands: row.favoriteBrands,
    platforms: JSON.parse(row.platformsJson) as string[],
    finishedAt: row.finishedAt,
  };
}
