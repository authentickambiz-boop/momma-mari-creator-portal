import type { PortalDb } from "@/db";
import { approvalEmails, feedbackNotes } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";
import type { Viewer } from "./types";

export const FEEDBACK_CATEGORIES = ["Portal", "Deals", "Payments", "Something else"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_ERRORS = {
  category: "Choose a category.",
  rating: "Choose a rating from 1 to 5.",
  message: "Write what happened.",
  email: "Add an email if we may follow up.",
  limit: "That was already saved today. Nothing else was stored.",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;
const IP_LIMIT = 8;

export type FeedbackInput = {
  category: string;
  rating: string;
  body: string;
  followUp: boolean;
  email: string;
  name: string;
  honeypot: string;
  ip: string;
};

export type FeedbackListItem = {
  id: string;
  authorEmail: string | null;
  authorName: string | null;
  audience: string;
  category: string;
  rating: number;
  body: string;
  followUp: boolean;
  createdAt: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Saves feedback in the portal. A filled honeypot is dropped. Nothing is emailed. */
export async function saveFeedback(db: PortalDb, viewer: Viewer | null, input: FeedbackInput) {
  if (input.honeypot.trim()) return { ok: true as const, stored: false as const };
  if (!(FEEDBACK_CATEGORIES as readonly string[]).includes(input.category)) {
    return { ok: false as const, error: FEEDBACK_ERRORS.category };
  }
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false as const, error: FEEDBACK_ERRORS.rating };
  }
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { ok: false as const, error: FEEDBACK_ERRORS.message };
  const emailRaw = input.email.trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  if (input.followUp && !validEmail(email)) return { ok: false as const, error: FEEDBACK_ERRORS.email };
  if (email && !validEmail(email)) return { ok: false as const, error: FEEDBACK_ERRORS.email };
  const name = input.name.trim().slice(0, 120);
  const ip = input.ip.trim().slice(0, 80) || "unknown";
  const rows = await db.select().from(feedbackNotes);
  const now = Date.now();
  if (email && rows.filter((row) => row.authorEmail === email && now - Date.parse(row.createdAt) < DAY_MS).length >= EMAIL_LIMIT) {
    return { ok: false as const, error: FEEDBACK_ERRORS.limit };
  }
  if (rows.filter((row) => row.ip === ip && now - Date.parse(row.createdAt) < HOUR_MS).length >= IP_LIMIT) {
    return { ok: false as const, error: FEEDBACK_ERRORS.limit };
  }
  const before = (await db.select().from(approvalEmails)).length;
  const id = crypto.randomUUID();
  await db.insert(feedbackNotes).values({
    id,
    authorEmail: email || null,
    authorName: name || viewer?.name || null,
    audience: viewer?.role ?? "public",
    category: input.category,
    rating,
    body,
    followUp: input.followUp,
    ip,
    createdAt: nowIso(),
  });
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false as const, error: FEEDBACK_ERRORS.limit };
  return { ok: true as const, stored: true as const, id };
}

export async function listFeedback(
  db: PortalDb,
  viewer: Viewer | null,
  filter: { category?: string; rating?: string },
): Promise<FeedbackListItem[]> {
  if (viewer?.role !== "admin") return [];
  const rows = await db.select().from(feedbackNotes);
  return rows
    .filter((row) => !filter.category || row.category === filter.category)
    .filter((row) => !filter.rating || String(row.rating) === filter.rating)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((row) => ({
      id: row.id,
      authorEmail: row.authorEmail,
      authorName: row.authorName,
      audience: row.audience,
      category: row.category,
      rating: row.rating,
      body: row.body,
      followUp: row.followUp,
      createdAt: row.createdAt,
    }));
}
