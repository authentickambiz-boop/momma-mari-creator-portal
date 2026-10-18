import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandContacts, brandCrmEntries, creatorInterest, creators, deals, offerScreenings } from "@/db/schema";
import { canSeeDeal, isOwner } from "./authz";
import { nowIso } from "./format";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

const RESPONSES = ["interested", "declined", "no_reply", "negotiating"] as const;
export type BrandResponse = (typeof RESPONSES)[number];

export function brandKey(brand: string) {
  return brand.trim().toLowerCase();
}

export function isBrandResponse(value: string): value is BrandResponse {
  return (RESPONSES as readonly string[]).includes(value);
}

export function responseLabel(value: string) {
  if (value === "interested") return "Interested";
  if (value === "declined") return "Declined";
  if (value === "no_reply") return "No reply";
  if (value === "negotiating") return "Negotiating";
  return value;
}

type Contact = { name: string | null; email: string | null; source: string };
type DealLine = {
  id: string;
  brand: string;
  creatorName: string;
  status: string;
  workflowStage: string | null;
  rateCents: number | null;
  amountDisplay: string | null;
};
type LogLine = { decision: string; note: string | null; createdAt: string };

export type BrandCard = {
  key: string;
  brand: string;
  contacts: Contact[];
  deals: DealLine[];
  screenings: LogLine[];
  responses: LogLine[];
};

function firstEmail(value: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

export async function listBrandCrm(db: PortalDb, viewer: Viewer): Promise<Result<{ brands: BrandCard[] }>> {
  if (viewer.role === "creator") return { ok: false, status: 403, error: "The brand list is for the team." };
  const owner = isOwner(viewer);
  const [dealRows, people, screenings, interest, saved, extra] = await Promise.all([
    db.select().from(deals),
    db.select().from(creators),
    db.select().from(offerScreenings),
    db.select().from(creatorInterest),
    db.select().from(brandContacts),
    db.select().from(brandCrmEntries),
  ]);
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  const visible = dealRows.filter((deal) => canSeeDeal(viewer, deal));
  const groups = new Map<string, BrandCard>();
  for (const deal of visible) {
    const key = brandKey(deal.brand);
    const card = groups.get(key) ?? {
      key,
      brand: deal.brand,
      contacts: [],
      deals: [],
      screenings: [],
      responses: [],
    };
    card.deals.push({
      id: deal.id,
      brand: deal.brand,
      creatorName: names.get(deal.creatorId) ?? "Creator",
      status: deal.status,
      workflowStage: deal.workflowStage,
      rateCents: owner ? deal.rateCents : null,
      amountDisplay: owner ? deal.amountDisplay : null,
    });
    const email = firstEmail(deal.contact);
    if (deal.contact || email) {
      card.contacts.push({ name: deal.contact, email, source: "deal" });
    }
    groups.set(key, card);
  }
  const dealKey = new Map(visible.map((deal) => [deal.id, brandKey(deal.brand)]));
  for (const row of screenings) {
    const key = dealKey.get(row.dealId);
    const card = key ? groups.get(key) : undefined;
    if (!card) continue;
    card.screenings.push({ decision: row.decision, note: row.note, createdAt: row.createdAt });
  }
  for (const row of interest) {
    const key = dealKey.get(row.dealId);
    const card = key ? groups.get(key) : undefined;
    if (!card) continue;
    card.responses.push({ decision: row.decision, note: row.note, createdAt: row.createdAt });
  }
  for (const row of saved) {
    const key = row.dealId ? dealKey.get(row.dealId) : brandKey(row.company);
    const card = key ? groups.get(key) : undefined;
    if (!card) continue;
    card.contacts.push({ name: row.contactName, email: row.contactEmail, source: "decline" });
    card.responses.push({ decision: "declined", note: row.note, createdAt: row.createdAt });
  }
  for (const row of extra) {
    const card = groups.get(row.brandKey);
    if (!card) continue;
    if (row.kind === "contact") {
      card.contacts.push({ name: row.contactName, email: row.contactEmail, source: "added" });
    }
    if (row.response) card.responses.push({ decision: row.response, note: row.note, createdAt: row.createdAt });
  }
  const brands = [...groups.values()].sort((left, right) => left.brand.localeCompare(right.brand));
  return { ok: true, brands };
}

export async function addBrandCrmEntry(
  db: PortalDb,
  input: {
    brand: string;
    kind: string;
    contactName?: string | null;
    contactEmail?: string | null;
    response?: string | null;
    note?: string | null;
    actorRole: string;
    actorName: string;
  },
): Promise<Result<{ id: string }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can update the brand list." };
  const key = brandKey(input.brand);
  if (!key) return { ok: false, status: 400, error: "Name the brand." };
  if (input.kind !== "contact" && input.kind !== "response") {
    return { ok: false, status: 400, error: "Add a contact or a response." };
  }
  if (input.kind === "response" && !isBrandResponse(input.response ?? "")) {
    return { ok: false, status: 400, error: "Choose interested, declined, no reply, or negotiating." };
  }
  const known = await db.select({ brand: deals.brand }).from(deals);
  if (!known.some((deal) => brandKey(deal.brand) === key)) {
    return { ok: false, status: 404, error: "That brand is not on a deal yet." };
  }
  const id = crypto.randomUUID();
  await db.insert(brandCrmEntries).values({
    id,
    brandKey: key,
    kind: input.kind,
    contactName: input.contactName?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    response: input.kind === "response" ? input.response ?? null : null,
    note: input.note?.trim() || null,
    actorName: input.actorName,
    createdAt: nowIso(),
  });
  return { ok: true, id };
}

export async function brandCrmFor(db: PortalDb, viewer: Viewer, brand: string) {
  const list = await listBrandCrm(db, viewer);
  if (!list.ok) return list;
  const card = list.brands.find((item) => item.key === brandKey(brand)) ?? null;
  return { ok: true as const, brand: card };
}
