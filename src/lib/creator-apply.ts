import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorApplications, creators } from "@/db/schema";
import { adminEmails } from "./authz";
import { normalizeEmail, nowIso } from "./format";
import { notifyStaff } from "./managers";
import type { Viewer } from "./types";

const APPLY_REVIEW_TEXT = {
  approved: "Approved. Her account is on the roster and she can sign in with that email. Nothing was emailed.",
  declined: "Declined. No account was created. Nothing was emailed.",
  taken: "That email is already on the roster. Nothing was changed.",
  closed: "That application is not waiting. Nothing was changed.",
  owner: "Only the owner can review applications. Nothing was changed.",
  "1": "That application was not saved. Nothing was changed.",
} as const;

export type CreatorApplicationView = {
  id: string;
  name: string;
  email: string;
  handles: string;
  followers: string;
  niche: string;
  rates: string | null;
  message: string;
  status: string;
  creatorId: string | null;
  invitedAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/**
 * Future Stripe paid-signup.
 * Stripe stays off. Do not call Stripe, do not read a secret, and do not charge.
 * A later paid signup should replace this hook and still refuse to approve until
 * a payment is recorded. Apply and approve must not turn Stripe on.
 */
export function futurePaidSignup(): { wired: boolean; charged: boolean } {
  return { wired: false, charged: false };
}

export function applyReviewNote(code: string | undefined) {
  if (!code) return null;
  if (code in APPLY_REVIEW_TEXT) return APPLY_REVIEW_TEXT[code as keyof typeof APPLY_REVIEW_TEXT];
  return APPLY_REVIEW_TEXT["1"];
}

export function applyReviewCode(error: string) {
  if (error === "That email is already on the roster. Nothing was changed.") return "taken";
  if (error === "That application is not waiting. Nothing was changed.") return "closed";
  if (error === "Only the owner can review applications. Nothing was changed.") return "owner";
  return "1";
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function blockedEmail(email: string) {
  return !email.includes("@") || email.endsWith(".invalid") || adminEmails().includes(email);
}

export async function submitCreatorApplication(
  db: PortalDb,
  input: {
    name: string;
    email: string;
    handles: string;
    followers: string;
    niche: string;
    rates: string;
    message: string;
  },
) {
  const paid = futurePaidSignup();
  if (paid.charged) return { ok: false as const, error: "Paid signup is not available. Nothing was charged." };
  const name = clip(input.name, 80);
  const email = normalizeEmail(input.email).slice(0, 120);
  const handles = clip(input.handles, 400);
  const followers = clip(input.followers, 200);
  const niche = clip(input.niche, 120);
  const rates = clip(input.rates, 200);
  const message = clip(input.message, 1000);
  if (!name || !handles || !followers || !niche || !message || blockedEmail(email)) {
    return { ok: false as const, error: "Add your name, a real email, your handles, follower counts, niche, and a short message." };
  }
  const people = await db.select().from(creators);
  if (people.some((row) => row.email.toLowerCase() === email)) {
    return { ok: false as const, error: "That email is already on the roster." };
  }
  const waiting = await db.select().from(creatorApplications).where(eq(creatorApplications.email, email));
  if (waiting.some((row) => row.status === "pending")) {
    return { ok: false as const, error: "That application is already waiting." };
  }
  const id = crypto.randomUUID();
  await db.insert(creatorApplications).values({
    id,
    name,
    email,
    handles,
    followers,
    niche,
    rates: rates || null,
    message,
    status: "pending",
    creatorId: null,
    invitedAt: null,
    createdAt: nowIso(),
    reviewedAt: null,
  });
  await notifyStaff(db, {
    kind: "creator_application",
    creatorId: null,
    message: `New application from ${name}. Open Applications on the dashboard. Nothing was emailed.`,
  });
  return { ok: true as const, id };
}

function toView(row: typeof creatorApplications.$inferSelect): CreatorApplicationView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    handles: row.handles,
    followers: row.followers,
    niche: row.niche,
    rates: row.rates,
    message: row.message,
    status: row.status,
    creatorId: row.creatorId,
    invitedAt: row.invitedAt,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

export async function listCreatorApplications(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const rows = await db.select().from(creatorApplications);
  return rows
    .map(toView)
    .sort((left, right) => {
      const pending = Number(right.status === "pending") - Number(left.status === "pending");
      if (pending !== 0) return pending;
      return right.createdAt.localeCompare(left.createdAt);
    });
}

export async function approveCreatorApplication(db: PortalDb, viewer: Viewer, id: string) {
  const paid = futurePaidSignup();
  if (paid.charged) return { ok: false as const, error: "Paid signup is not available. Nothing was charged." };
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can review applications. Nothing was changed." };
  const rows = await db.select().from(creatorApplications).where(eq(creatorApplications.id, id));
  const application = rows[0];
  if (!application || application.status !== "pending") {
    return { ok: false as const, error: "That application is not waiting. Nothing was changed." };
  }
  const people = await db.select().from(creators);
  if (people.some((row) => row.email.toLowerCase() === application.email) || blockedEmail(application.email)) {
    return { ok: false as const, error: "That email is already on the roster. Nothing was changed." };
  }
  const creatorId = crypto.randomUUID();
  const reviewedAt = nowIso();
  await db.insert(creators).values({
    id: creatorId,
    name: application.name,
    email: application.email,
    handles: application.handles,
    kidsAges: null,
    payoutMethod: null,
    splitPercent: null,
    monthlyGoalCents: null,
    driveFolderId: null,
    initials: application.name.slice(0, 2).toUpperCase(),
    tiktokStatus: "disconnected",
    instagramStatus: "disconnected",
    facebookStatus: "disconnected",
    youtubeStatus: "disconnected",
    emailStatus: "disconnected",
    signerIsMinor: false,
    isSeed: false,
    createdAt: reviewedAt,
  });
  await db.update(creatorApplications).set({
    status: "approved",
    creatorId,
    invitedAt: reviewedAt,
    reviewedAt,
  }).where(eq(creatorApplications.id, application.id));
  return { ok: true as const, creatorId, invitedAt: reviewedAt };
}

export async function declineCreatorApplication(db: PortalDb, viewer: Viewer, id: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can review applications. Nothing was changed." };
  const rows = await db.select().from(creatorApplications).where(eq(creatorApplications.id, id));
  const application = rows[0];
  if (!application || application.status !== "pending") {
    return { ok: false as const, error: "That application is not waiting. Nothing was changed." };
  }
  const reviewedAt = nowIso();
  await db.update(creatorApplications).set({
    status: "declined",
    creatorId: null,
    invitedAt: null,
    reviewedAt,
  }).where(eq(creatorApplications.id, application.id));
  return { ok: true as const };
}
