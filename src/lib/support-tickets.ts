import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, supportTicketReplies, supportTickets } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";
import type { Viewer } from "./types";

export const TICKET_CATEGORIES = ["Portal", "Deal", "Payment", "Something else"] as const;
export const TICKET_PRIORITIES = ["Low", "Normal", "High"] as const;
export const TICKET_STATUSES = ["open", "waiting", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_ERRORS = {
  own: "That ticket is not on your list.",
  name: "Add your name.",
  email: "Enter an email address.",
  subject: "Add a subject.",
  body: "Write a message.",
  category: "Choose a category.",
  priority: "Choose a priority.",
  status: "Choose open, waiting, or resolved.",
  limit: "That was already saved today. Nothing else was stored.",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_LIMIT = 3;

export type TicketInput = {
  name: string;
  email: string;
  category: string;
  priority: string;
  subject: string;
  body: string;
  honeypot: string;
  creatorId?: string | null;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function repliesFor(db: PortalDb, ticketId: string) {
  const rows = await db.select().from(supportTicketReplies).where(eq(supportTicketReplies.ticketId, ticketId));
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/** Opens a ticket and its first reply. A filled honeypot is dropped. Nothing is emailed. */
export async function openSupportTicket(db: PortalDb, input: TicketInput) {
  if (input.honeypot.trim()) return { ok: true as const, stored: false as const };
  const name = input.name.trim().slice(0, 120);
  const email = normalizeEmail(input.email);
  const subject = input.subject.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 4000);
  if (!name) return { ok: false as const, error: TICKET_ERRORS.name };
  if (!validEmail(email) || email.length > 160) return { ok: false as const, error: TICKET_ERRORS.email };
  if (!(TICKET_CATEGORIES as readonly string[]).includes(input.category)) {
    return { ok: false as const, error: TICKET_ERRORS.category };
  }
  if (!(TICKET_PRIORITIES as readonly string[]).includes(input.priority)) {
    return { ok: false as const, error: TICKET_ERRORS.priority };
  }
  if (!subject) return { ok: false as const, error: TICKET_ERRORS.subject };
  if (!body) return { ok: false as const, error: TICKET_ERRORS.body };
  const existing = await db.select().from(supportTickets).where(eq(supportTickets.requesterEmail, email));
  const cutoff = Date.now() - DAY_MS;
  if (existing.filter((row) => Date.parse(row.createdAt) >= cutoff).length >= EMAIL_LIMIT) {
    return { ok: false as const, error: TICKET_ERRORS.limit };
  }
  const before = (await db.select().from(approvalEmails)).length;
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(supportTickets).values({
    id,
    requesterEmail: email,
    requesterName: name,
    creatorId: input.creatorId ?? null,
    category: input.category,
    priority: input.priority,
    status: "open",
    subject,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(supportTicketReplies).values({
    id: crypto.randomUUID(),
    ticketId: id,
    authorEmail: email,
    authorName: name,
    body,
    createdAt: timestamp,
  });
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false as const, error: TICKET_ERRORS.limit };
  return { ok: true as const, stored: true as const, id };
}

export async function listSupportTickets(db: PortalDb, viewer: Viewer | null) {
  if (!viewer) return [];
  const rows = await db.select().from(supportTickets);
  const email = normalizeEmail(viewer.email);
  const visible = viewer.role === "admin" ? rows : rows.filter((row) => row.requesterEmail === email);
  const withReplies = [];
  for (const row of visible.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))) {
    withReplies.push({ ...row, replies: await repliesFor(db, row.id) });
  }
  return withReplies;
}

export async function replyToSupportTicket(
  db: PortalDb,
  viewer: Viewer | null,
  input: { ticketId: string; body: string; status?: string },
) {
  if (!viewer) return { ok: false as const, error: TICKET_ERRORS.own };
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId));
  const ticket = rows[0];
  if (!ticket) return { ok: false as const, error: TICKET_ERRORS.own };
  const email = normalizeEmail(viewer.email);
  const owner = viewer.role === "admin";
  if (!owner && ticket.requesterEmail !== email) return { ok: false as const, error: TICKET_ERRORS.own };
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { ok: false as const, error: TICKET_ERRORS.body };
  let status = ticket.status;
  if (owner && input.status) {
    if (!(TICKET_STATUSES as readonly string[]).includes(input.status)) {
      return { ok: false as const, error: TICKET_ERRORS.status };
    }
    status = input.status;
  } else if (!owner && ticket.status === "waiting") {
    status = "open";
  }
  const timestamp = nowIso();
  const before = (await db.select().from(approvalEmails)).length;
  await db.insert(supportTicketReplies).values({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    authorEmail: email,
    authorName: viewer.name,
    body,
    createdAt: timestamp,
  });
  await db.update(supportTickets).set({ status, updatedAt: timestamp }).where(eq(supportTickets.id, ticket.id));
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false as const, error: TICKET_ERRORS.limit };
  return { ok: true as const, id: ticket.id, status };
}
