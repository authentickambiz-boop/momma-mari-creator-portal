import { asc, eq, isNull } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { briefNotices } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";

export const KAMRON_NOTIFY_EMAIL = "Kamron@mommamari.com";

export type BriefNoticeInput = {
  source: "inquire" | "gift-guide";
  sourceId: string;
  brand: string;
  contactName: string;
  contactEmail: string;
  program: string;
  budget: string;
};

export function briefEmailSetup() {
  const needed: string[] = [];
  if (!process.env.RESEND_API_KEY?.trim()) needed.push("RESEND_API_KEY");
  if (!process.env.NOTIFY_EMAIL_FROM?.trim()) needed.push("NOTIFY_EMAIL_FROM");
  const configured = needed.length === 0;
  const missing = needed.join(" and ");
  return {
    configured,
    needed,
    to: KAMRON_NOTIFY_EMAIL,
    note: configured
      ? "Notify mail is configured."
      : `Email is not configured. Set ${missing}. Gmail is not used to send. NOTIFY_EMAIL_FROM must be a sender verified in Resend.`,
  };
}

function noticeText(input: BriefNoticeInput) {
  return [
    `Brand: ${input.brand}`,
    `Contact: ${input.contactName} <${input.contactEmail}>`,
    `Program: ${input.program}`,
    `Budget: ${input.budget}`,
  ].join("\n");
}

async function deliverBriefEmail(input: BriefNoticeInput) {
  const setup = briefEmailSetup();
  if (!setup.configured) {
    return { emailStatus: "unconfigured" as const, emailDetail: setup.note };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM,
        to: [KAMRON_NOTIFY_EMAIL],
        subject: `New brief: ${input.brand.replace(/[\r\n]/g, " ").slice(0, 120)}`,
        text: noticeText(input),
      }),
    });
    if (!response.ok) {
      return { emailStatus: "failed" as const, emailDetail: `Resend returned ${response.status}` };
    }
    return { emailStatus: "sent" as const, emailDetail: null };
  } catch {
    return { emailStatus: "failed" as const, emailDetail: "The email request did not finish." };
  }
}

/** Stores a staff notice. A send failure stays on the row and does not throw. */
export async function recordBriefNotice(db: PortalDb, input: BriefNoticeInput) {
  try {
    const sent = await deliverBriefEmail(input);
    const id = crypto.randomUUID();
    await db.insert(briefNotices).values({
      id,
      source: input.source,
      sourceId: input.sourceId,
      brand: input.brand,
      contactName: input.contactName,
      contactEmail: normalizeEmail(input.contactEmail),
      program: input.program,
      budget: input.budget,
      emailStatus: sent.emailStatus,
      emailDetail: sent.emailDetail,
      createdAt: nowIso(),
      deliveredAt: null,
    });
    return { id, ...sent };
  } catch {
    return { id: null, emailStatus: "failed" as const, emailDetail: "The notice was not stored." };
  }
}

/** Unread notices, oldest first. A second read returns none. */
export async function listNewBriefs(db: PortalDb) {
  const rows = await db
    .select()
    .from(briefNotices)
    .where(isNull(briefNotices.deliveredAt))
    .orderBy(asc(briefNotices.createdAt));
  const stamped = nowIso();
  for (const row of rows) {
    await db.update(briefNotices).set({ deliveredAt: stamped }).where(eq(briefNotices.id, row.id));
  }
  const email = briefEmailSetup();
  return {
    briefs: rows.map((row) => ({
      id: row.id,
      source: row.source,
      sourceId: row.sourceId,
      brand: row.brand,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      program: row.program,
      budget: row.budget,
      emailStatus: row.emailStatus,
      createdAt: row.createdAt,
    })),
    email: {
      configured: email.configured,
      needed: email.needed,
      to: email.to,
      note: email.note,
    },
  };
}
