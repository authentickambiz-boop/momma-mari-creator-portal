import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandReplyDrafts, gmailPortalDrafts } from "@/db/schema";
import { nowIso } from "./format";

/** Gmail labels the hourly inbox sort already uses. Adding a label does not send or delete mail. */
export const MM_LABEL = {
  deal: "MM/Deal",
  needsReply: "MM/Needs reply",
  waiting: "MM/Waiting",
  notDeal: "MM/Not a deal",
} as const;

export const GMAIL_DRAFT_AUTHOR = "gmail-push";

export type MailSort = "needs_reply" | "waiting" | "not_deal" | "skip";

export function labelsForSort(sort: MailSort) {
  if (sort === "needs_reply") return [MM_LABEL.deal, MM_LABEL.needsReply];
  if (sort === "waiting") return [MM_LABEL.deal, MM_LABEL.waiting];
  if (sort === "not_deal") return [MM_LABEL.notDeal];
  return [];
}

/** Sintra's Gmail drafts stay where they are. We do not edit or delete them. */
export function isSintraDraft(text: string | null | undefined) {
  return /\bsintra\b/i.test(text ?? "");
}

/** Prices and calendar dates in a draft are placeholders until a person confirms them. */
export function scrubPricesAndDates(text: string) {
  return text
    .replace(/\$\s?\d[\d,]*(?:\.\d{2})?/g, "[CONFIRM]")
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?\b/gi, "[CONFIRM]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[CONFIRM]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[CONFIRM]");
}

export function confirmDraftBody(input: { creatorLabel: string; brand: string }) {
  const brand = scrubPricesAndDates(input.brand).replace(/\s+/g, " ").trim() || "there";
  const creator = scrubPricesAndDates(input.creatorLabel).replace(/\s+/g, " ").trim() || "the creator";
  return [
    `Hi ${brand},`,
    "",
    `Thanks for writing about ${creator}.`,
    "",
    "Rate: [CONFIRM]",
    "Date: [CONFIRM]",
    "",
    "This is a draft. Nothing has been sent.",
    "",
    "Kamron",
    "Momma Mari",
  ].join("\n");
}

/** Send, trash, and delete are refused before a request is built. Drafts and label adds stay allowed. */
export function gmailMutationAllowed(path: string) {
  return !/\/(send|trash|delete)(?:\?|$|\/)/i.test(path);
}

export type LiveDraft = { id: string; snippet: string };

export type LiveLabelClient = {
  applyLabels?: (messageId: string, labelNames: string[]) => Promise<void>;
  listThreadDrafts?: (threadId: string) => Promise<LiveDraft[]>;
  createDraft?: (input: { threadId: string; to: string; subject: string; body: string }) => Promise<{ id: string } | null>;
};

export async function prepareReplyAndLabels(
  db: PortalDb,
  client: LiveLabelClient,
  input: {
    mailbox: string;
    creatorLabel: string;
    message: { id: string; threadId: string; subject: string; labelIds: string[] };
    sort: MailSort;
    dealId: string | null;
    brand: string;
    replyTo: string;
  },
) {
  const draftMessage = input.message.labelIds.includes("DRAFT");
  if (input.sort === "skip" || draftMessage) {
    return { drafted: false, labeled: [] as string[], skippedDraft: "none" as const };
  }
  let drafted = false;
  let skippedDraft: "sintra" | "existing" | "kept" | "none" = "none";
  if (input.sort === "needs_reply" && input.dealId && input.replyTo.includes("@")) {
    const portal = await saveConfirmPortalDraft(db, input.dealId, confirmDraftBody({
      creatorLabel: input.creatorLabel,
      brand: input.brand,
    }));
    if (portal !== "created") skippedDraft = portal;
    drafted = portal === "created";
    const gmail = await createGmailDraftIfEmpty(db, client, input);
    if (gmail === "sintra") skippedDraft = "sintra";
    if (gmail === "created") drafted = true;
  }
  const labeled = labelsForSort(input.sort);
  if (labeled.length > 0 && client.applyLabels) await client.applyLabels(input.message.id, labeled);
  return { drafted, labeled, skippedDraft };
}

async function saveConfirmPortalDraft(db: PortalDb, dealId: string, body: string) {
  const existing = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, dealId));
  const row = existing[0];
  if (row) {
    if (isSintraDraft(row.body) || isSintraDraft(row.updatedBy)) return "sintra" as const;
    if (row.updatedBy !== GMAIL_DRAFT_AUTHOR) return "kept" as const;
    return "existing" as const;
  }
  await db.insert(brandReplyDrafts).values({
    dealId,
    body,
    updatedBy: GMAIL_DRAFT_AUTHOR,
    updatedAt: nowIso(),
  });
  return "created" as const;
}

async function createGmailDraftIfEmpty(
  db: PortalDb,
  client: LiveLabelClient,
  input: {
    mailbox: string;
    creatorLabel: string;
    message: { id: string; threadId: string; subject: string };
    brand: string;
    replyTo: string;
    dealId: string | null;
  },
) {
  if (!client.listThreadDrafts || !client.createDraft || !input.dealId) return "none" as const;
  const drafts = await client.listThreadDrafts(input.message.threadId);
  if (drafts.some((draft) => isSintraDraft(draft.snippet) || isSintraDraft(draft.id))) return "sintra" as const;
  if (drafts.length > 0) return "existing" as const;
  const recorded = await db.select().from(gmailPortalDrafts).where(and(
    eq(gmailPortalDrafts.mailbox, input.mailbox),
    eq(gmailPortalDrafts.threadId, input.message.threadId),
  ));
  if (recorded[0]) return "existing" as const;
  const body = confirmDraftBody({ creatorLabel: input.creatorLabel, brand: input.brand });
  const created = await client.createDraft({
    threadId: input.message.threadId,
    to: input.replyTo,
    subject: scrubPricesAndDates(input.message.subject),
    body,
  });
  if (!created?.id) return "none" as const;
  await db.insert(gmailPortalDrafts).values({
    id: crypto.randomUUID(),
    mailbox: input.mailbox,
    threadId: input.message.threadId,
    gmailDraftId: created.id,
    dealId: input.dealId,
    createdAt: nowIso(),
  });
  return "created" as const;
}
