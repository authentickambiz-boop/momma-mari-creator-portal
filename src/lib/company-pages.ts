import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, supportMessages } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";

export const ABOUT_STORY = "Momma Mari started with MariClare, a parent creator with about 2.3 million followers. Kamron Santo wanted a place where every creator has access to all of their own deals, with a manager to take the weight off.";

export const PUBLIC_CONTACT_EMAIL = "Kamron@mommamari.com";
export const PUBLIC_CONTACT_PHONE = "980-358-0759";

export const COMPANY_NOTE_ERRORS = {
  name: "Add your name.",
  email: "Enter an email address.",
  message: "Write a message.",
  limit: "That was already sent today. Nothing else was saved.",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_LIMIT = 3;

export type PublicNoteInput = {
  name: string;
  email: string;
  message: string;
  subject: "Contact" | "Talent network";
  honeypot: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Stores a public note in the portal. A filled honeypot is dropped. Nothing is emailed. */
export async function savePublicNote(db: PortalDb, input: PublicNoteInput) {
  if (input.honeypot.trim()) return { ok: true as const, stored: false as const };
  const name = input.name.trim().slice(0, 120);
  const email = normalizeEmail(input.email);
  const message = input.message.trim().slice(0, 4000);
  if (!name) return { ok: false as const, error: COMPANY_NOTE_ERRORS.name };
  if (!validEmail(email) || email.length > 160) return { ok: false as const, error: COMPANY_NOTE_ERRORS.email };
  if (!message) return { ok: false as const, error: COMPANY_NOTE_ERRORS.message };
  const rows = await db.select().from(supportMessages).where(eq(supportMessages.authorEmail, email));
  const cutoff = Date.now() - DAY_MS;
  const recent = rows.filter((row) => Date.parse(row.createdAt) >= cutoff);
  if (recent.length >= EMAIL_LIMIT) return { ok: false as const, error: COMPANY_NOTE_ERRORS.limit };
  const before = (await db.select().from(approvalEmails)).length;
  const id = crypto.randomUUID();
  await db.insert(supportMessages).values({
    id,
    authorEmail: email,
    authorName: name,
    creatorId: null,
    subject: input.subject,
    body: message,
    createdAt: nowIso(),
  });
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false as const, error: COMPANY_NOTE_ERRORS.limit };
  return { ok: true as const, stored: true as const, id };
}
