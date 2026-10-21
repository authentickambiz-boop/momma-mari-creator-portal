import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandContacts, brandCrmEntries, brandPipelineCards, creators, deals, gmailBridgeThreads } from "@/db/schema";
import { isOwner } from "./authz";
import { nowIso } from "./format";
import type { Viewer } from "./types";

export const PIPELINE_STAGES = [
  {
    id: "lead",
    label: "Lead",
    blurb: "A brand has shown up. Nobody has answered yet.",
    forward: "It moves on when you send the first hello or log the contact.",
    nextAction: "Say hello",
  },
  {
    id: "intake",
    label: "Intake",
    blurb: "The offer is in the door and needs a look.",
    forward: "It moves on when you share it with the creator.",
    nextAction: "Share it with the creator",
  },
  {
    id: "brief",
    label: "Brief",
    blurb: "You know what the brand wants.",
    forward: "It moves on when the brief is clear enough to price.",
    nextAction: "Lock the brief",
  },
  {
    id: "negotiating",
    label: "Negotiating",
    blurb: "Money, usage, and terms are still open.",
    forward: "It moves on when both sides agree and a contract is out.",
    nextAction: "Agree on terms",
  },
  {
    id: "contracted",
    label: "Contracted",
    blurb: "The deal is signed.",
    forward: "It moves on when the work actually starts.",
    nextAction: "Start the work",
  },
  {
    id: "in_production",
    label: "In production",
    blurb: "The creator is making the post.",
    forward: "It moves on when the post goes live.",
    nextAction: "Get the post live",
  },
  {
    id: "posted",
    label: "Posted",
    blurb: "The post is up.",
    forward: "It moves on when the invoice goes to the brand.",
    nextAction: "Send the invoice",
  },
  {
    id: "invoiced",
    label: "Invoiced",
    blurb: "The brand has the bill.",
    forward: "It moves on when the money lands.",
    nextAction: "Collect payment",
  },
  {
    id: "paid",
    label: "Paid",
    blurb: "The brand paid.",
    forward: "It moves on when you are ready to ask them back.",
    nextAction: "Ask them back",
  },
  {
    id: "rebook",
    label: "Rebook",
    blurb: "This brand is worth another round.",
    forward: "This is the last column. It stays here until you open the next conversation.",
    nextAction: "Open the next conversation",
  },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

const NEGOTIATING = new Set(["contract_received", "contract_review", "revisions_requested", "revised_contract", "approved_by_agency", "awaiting_signature"]);
const PRODUCTION = new Set(["waiting_for_product", "product_received", "draft_due", "draft_submitted", "manager_review", "sent_to_brand", "brand_revisions", "brand_approved"]);
const QUIET = new Set(["paid", "rebook"]);

type Fail = { ok: false; status: number; error: string; code: string };

export type PipelineCard = {
  id: string;
  sourceKey: string;
  brand: string;
  creatorId: string | null;
  creatorName: string | null;
  contactEmail: string | null;
  stage: PipelineStageId;
  stageLabel: string;
  valueCents: number | null;
  nextFollowUp: string | null;
  note: string | null;
};

export type PipelineReminder = {
  id: string;
  brand: string;
  stageLabel: string;
  nextFollowUp: string | null;
  reason: string;
};

export function isPipelineStage(value: string): value is PipelineStageId {
  return PIPELINE_STAGES.some((stage) => stage.id === value);
}

export function pipelineStageLabel(stage: string) {
  return PIPELINE_STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export function pipelineStage(stage: string) {
  return PIPELINE_STAGES.find((item) => item.id === stage) ?? null;
}

export function nextPipelineStage(stage: PipelineStageId): PipelineStageId | null {
  const index = PIPELINE_STAGES.findIndex((item) => item.id === stage);
  return PIPELINE_STAGES[index + 1]?.id ?? null;
}

export type FollowUpStatus = "none" | "upcoming" | "today" | "overdue";

export function followUpStatus(nextFollowUp: string | null, today: string): FollowUpStatus {
  if (!nextFollowUp) return "none";
  if (nextFollowUp < today) return "overdue";
  if (nextFollowUp === today) return "today";
  return "upcoming";
}

export function shortFollowUp(iso: string | null) {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function followUpLabel(status: FollowUpStatus, iso: string | null) {
  if (status === "none") return "No follow-up date";
  const day = shortFollowUp(iso);
  if (status === "overdue") return `Overdue · ${day}`;
  if (status === "today") return `Due today · ${day}`;
  return `Follow up ${day}`;
}

export function pipelineCardNextLine(note: string | null, nextAction: string) {
  const trimmed = note?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return nextAction;
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
}

export function pipelineDollarsInput(cents: number | null) {
  if (cents == null) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export function pipelineSumLabel(count: number, valueCents: number, unknownValues: number, format: (cents: number) => string) {
  if (count === 0) return "—";
  if (count - unknownValues <= 0) return "TBD";
  if (unknownValues > 0) return `${format(valueCents)} + TBD`;
  return format(valueCents);
}

export function filterPipelineColumns<T extends { cards: { creatorId: string | null }[] }>(columns: T[], creatorId: string | "all"): T[] {
  if (creatorId === "all") return columns;
  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => card.creatorId === creatorId),
  }));
}

export function summarizePipeline(
  columns: { id: PipelineStageId; label: string; cards: { valueCents: number | null; nextFollowUp: string | null }[] }[],
  today: string,
) {
  let overdue = 0;
  let dueToday = 0;
  const stages = columns.map((column) => {
    let valueCents = 0;
    let unknownValues = 0;
    for (const card of column.cards) {
      if (card.valueCents == null) unknownValues += 1;
      else valueCents += card.valueCents;
      const status = followUpStatus(card.nextFollowUp, today);
      if (status === "overdue") overdue += 1;
      if (status === "today") dueToday += 1;
    }
    return { id: column.id, label: column.label, count: column.cards.length, valueCents, unknownValues };
  });
  return { stages, overdue, dueToday };
}

const PIPELINE_NOTE_LIMIT = 500;
const PIPELINE_VALUE_LIMIT = 1_000_000_000;

export function parsePipelineFollowUp(raw: string): string | null | "bad" {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!trimmed) return null;
  if (!match) return "bad";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "bad";
  return trimmed;
}

export function parsePipelineDollars(raw: string): number | null | "bad" {
  const trimmed = raw.trim();
  if (!trimmed || /^tbd$/i.test(trimmed)) return null;
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "bad";
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > PIPELINE_VALUE_LIMIT) return "bad";
  return cents;
}

export function stageFromWorkflow(workflow: string | null) {
  if (!workflow || workflow === "offer_received" || workflow === "brand_quiet" || workflow === "on_hold" || workflow === "creator_declined" || workflow === "cancelled") {
    return "lead" as const;
  }
  if (workflow === "offer_shared") return "intake" as const;
  if (workflow === "creator_interested" || workflow === "interest_sent") return "brief" as const;
  if (NEGOTIATING.has(workflow)) return "negotiating" as const;
  if (workflow === "signed_by_creator" || workflow === "signed_sent") return "contracted" as const;
  if (PRODUCTION.has(workflow)) return "in_production" as const;
  if (workflow === "scheduled_posted") return "posted" as const;
  if (workflow === "payment_pending") return "invoiced" as const;
  if (workflow === "paid") return "paid" as const;
  return "lead" as const;
}

export function addCalendarDays(isoDate: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function civilToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function emailIn(value: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

type SeedRow = {
  sourceKey: string;
  brand: string;
  creatorId: string | null;
  contactEmail: string | null;
  stage: PipelineStageId;
  valueCents: number | null;
  nextFollowUp: string | null;
  note: string | null;
};

export async function seedBrandPipeline(db: PortalDb, viewer: Viewer): Promise<{ ok: true; created: number } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  const [dealRows, contactRows, crmRows, threads, existing] = await Promise.all([
    db.select().from(deals),
    db.select().from(brandContacts),
    db.select().from(brandCrmEntries),
    db.select().from(gmailBridgeThreads),
    db.select().from(brandPipelineCards),
  ]);
  const have = new Set(existing.map((card) => card.sourceKey));
  const wanted: SeedRow[] = [];
  for (const deal of dealRows) {
    const stage = stageFromWorkflow(deal.workflowStage);
    const follow = QUIET.has(stage) ? null : addCalendarDays(deal.updatedAt, 5);
    wanted.push({
      sourceKey: `deal:${deal.id}`,
      brand: deal.brand,
      creatorId: deal.creatorId,
      contactEmail: emailIn(deal.contact),
      stage,
      valueCents: deal.pipelineCents ?? deal.rateCents,
      nextFollowUp: follow,
      note: null,
    });
  }
  for (const contact of contactRows) {
    if (contact.dealId) continue;
    wanted.push({
      sourceKey: `contact:${contact.id}`,
      brand: contact.company,
      creatorId: contact.suggestedCreatorId,
      contactEmail: emailIn(contact.contactEmail),
      stage: "intake",
      valueCents: null,
      nextFollowUp: addCalendarDays(contact.createdAt, 5),
      note: contact.note,
    });
  }
  for (const entry of crmRows) {
    wanted.push({
      sourceKey: `crm:${entry.id}`,
      brand: entry.brandKey,
      creatorId: entry.creatorId,
      contactEmail: emailIn(entry.contactEmail),
      stage: "lead",
      valueCents: entry.ratePaidCents,
      nextFollowUp: entry.nextFollowUp ?? addCalendarDays(entry.createdAt, 5),
      note: entry.outcome,
    });
  }
  for (const thread of threads) {
    if (thread.dealId || thread.classification === "not_deal") continue;
    wanted.push({
      sourceKey: `inbox:${thread.id}`,
      brand: thread.brand,
      creatorId: thread.creatorId,
      contactEmail: emailIn(thread.fromEmail),
      stage: "lead",
      valueCents: null,
      nextFollowUp: addCalendarDays(thread.updatedAt, 5),
      note: thread.subject,
    });
  }
  const timestamp = nowIso();
  let created = 0;
  for (const row of wanted) {
    if (have.has(row.sourceKey) || !row.brand.trim()) continue;
    await db.insert(brandPipelineCards).values({
      id: crypto.randomUUID(),
      sourceKey: row.sourceKey,
      brand: row.brand.trim(),
      creatorId: row.creatorId,
      contactEmail: row.contactEmail,
      stage: row.stage,
      valueCents: row.valueCents,
      nextFollowUp: row.nextFollowUp,
      note: row.note,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    have.add(row.sourceKey);
    created += 1;
  }
  return { ok: true, created };
}

function toCard(row: typeof brandPipelineCards.$inferSelect, names: Map<string, string>): PipelineCard {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    brand: row.brand,
    creatorId: row.creatorId,
    creatorName: row.creatorId ? names.get(row.creatorId) ?? null : null,
    contactEmail: row.contactEmail,
    stage: isPipelineStage(row.stage) ? row.stage : "lead",
    stageLabel: pipelineStageLabel(row.stage),
    valueCents: row.valueCents,
    nextFollowUp: row.nextFollowUp,
    note: row.note,
  };
}

export async function listPipeline(db: PortalDb, viewer: Viewer): Promise<{ ok: true; columns: { id: PipelineStageId; label: string; cards: PipelineCard[] }[] } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  const [rows, people] = await Promise.all([db.select().from(brandPipelineCards), db.select().from(creators)]);
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  const cards = rows.map((row) => toCard(row, names));
  return {
    ok: true,
    columns: PIPELINE_STAGES.map((stage) => ({
      id: stage.id,
      label: stage.label,
      cards: cards.filter((card) => card.stage === stage.id).sort((left, right) => left.brand.localeCompare(right.brand)),
    })),
  };
}

export async function movePipelineCard(
  db: PortalDb,
  viewer: Viewer,
  cardId: string,
  stage: string,
): Promise<{ ok: true } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  if (!isPipelineStage(stage)) return { ok: false, status: 400, error: "That is not a pipeline stage.", code: "stage" };
  const rows = await db.select().from(brandPipelineCards).where(eq(brandPipelineCards.id, cardId));
  const card = rows[0];
  if (!card) return { ok: false, status: 404, error: "That card was not found.", code: "missing" };
  if (card.stage !== stage) {
    await db.update(brandPipelineCards).set({ stage, updatedAt: nowIso() }).where(eq(brandPipelineCards.id, card.id));
  }
  return { ok: true };
}

export async function setPipelineFollowUp(db: PortalDb, viewer: Viewer, cardId: string, nextFollowUp: string): Promise<{ ok: true } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp)) return { ok: false, status: 400, error: "Use a YYYY-MM-DD date.", code: "date" };
  const rows = await db.select().from(brandPipelineCards).where(eq(brandPipelineCards.id, cardId));
  if (!rows[0]) return { ok: false, status: 404, error: "That card was not found.", code: "missing" };
  await db.update(brandPipelineCards).set({ nextFollowUp, updatedAt: nowIso() }).where(eq(brandPipelineCards.id, cardId));
  return { ok: true };
}

export async function pipelineReminders(db: PortalDb, viewer: Viewer, today = civilToday()): Promise<{ ok: true; reminders: PipelineReminder[] } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  const rows = await db.select().from(brandPipelineCards);
  const cutoff = addCalendarDays(today, -5);
  const reminders: PipelineReminder[] = [];
  for (const row of rows) {
    if (QUIET.has(row.stage)) continue;
    if (row.nextFollowUp && row.nextFollowUp <= today) {
      reminders.push({
        id: row.id,
        brand: row.brand,
        stageLabel: pipelineStageLabel(row.stage),
        nextFollowUp: row.nextFollowUp,
        reason: "Follow up",
      });
      continue;
    }
    if (!row.nextFollowUp && cutoff && row.updatedAt.slice(0, 10) <= cutoff) {
      reminders.push({
        id: row.id,
        brand: row.brand,
        stageLabel: pipelineStageLabel(row.stage),
        nextFollowUp: null,
        reason: "Quiet for 5 days",
      });
    }
  }
  reminders.sort((left, right) => (left.nextFollowUp ?? "").localeCompare(right.nextFollowUp ?? "") || left.brand.localeCompare(right.brand));
  return { ok: true, reminders };
}

export async function savePipelineCard(
  db: PortalDb,
  viewer: Viewer,
  cardId: string,
  input: { stage: string; nextFollowUp: string; note: string; value: string },
): Promise<{ ok: true } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The pipeline stays with the owner.", code: "forbidden" };
  if (!isPipelineStage(input.stage)) return { ok: false, status: 400, error: "That is not a pipeline stage.", code: "stage" };
  const follow = parsePipelineFollowUp(input.nextFollowUp);
  if (follow === "bad") return { ok: false, status: 400, error: "Use a YYYY-MM-DD date.", code: "date" };
  const value = parsePipelineDollars(input.value);
  if (value === "bad") return { ok: false, status: 400, error: "Use a dollar amount, or leave it blank for TBD.", code: "value" };
  const note = input.note.trim();
  if (note.length > PIPELINE_NOTE_LIMIT) return { ok: false, status: 400, error: "Keep the private note under 500 characters.", code: "note" };
  const rows = await db.select().from(brandPipelineCards).where(eq(brandPipelineCards.id, cardId));
  if (!rows[0]) return { ok: false, status: 404, error: "That card was not found.", code: "missing" };
  await db.update(brandPipelineCards).set({
    stage: input.stage,
    nextFollowUp: follow,
    note: note || null,
    valueCents: value,
    updatedAt: nowIso(),
  }).where(eq(brandPipelineCards.id, cardId));
  return { ok: true };
}
