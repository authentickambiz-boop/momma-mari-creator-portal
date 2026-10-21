import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandReplyDrafts, creators, deals } from "@/db/schema";
import { setDealStage } from "./deal-stage";
import { isFakeCalendarDay } from "./deadlines";
import { nowIso } from "./format";

function ownerOnly() {
  return { ok: false as const, status: 403, error: "Only Kamron can review deals." };
}

async function loadDeal(db: PortalDb, dealId: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  return rows[0] ?? null;
}

/** New mail and bot sync stay off creator pages until Kamron publishes them. */
export async function holdForOwnerReview(db: PortalDb, dealId: string) {
  const deal = await loadDeal(db, dealId);
  if (!deal || deal.reviewStatus === "published") return;
  await db
    .update(deals)
    .set({
      visibleToCreator: false,
      reviewStatus: deal.reviewStatus === "rejected" ? "rejected" : "pending",
      updatedAt: nowIso(),
    })
    .where(eq(deals.id, dealId));
}

export async function listDealReviews(db: PortalDb) {
  const [rows, people] = await Promise.all([
    db.select().from(deals).where(eq(deals.reviewStatus, "pending")).orderBy(asc(deals.updatedAt)),
    db.select({ id: creators.id, name: creators.name }).from(creators),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return rows
    .filter((row) => !row.visibleToCreator)
    .map((row) => ({
      id: row.id,
      brand: row.brand,
      creatorId: row.creatorId,
      creatorName: names.get(row.creatorId) ?? "Creator",
      workflowStage: row.workflowStage,
      postDate: row.postDate,
      productRequired: row.productRequired,
      rushRevision: row.rushRevision,
      subtitle: row.subtitle,
      contact: row.contact,
    }));
}

export async function publishDealReview(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; actorRole: string },
) {
  if (input.actorRole !== "admin") return ownerOnly();
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  if (deal.reviewStatus === "rejected") {
    return { ok: false as const, status: 409, error: "This deal was rejected." };
  }
  if (deal.reviewStatus === "published" && deal.visibleToCreator) {
    return { ok: true as const, changed: false };
  }
  if (!deal.workflowStage || deal.workflowStage === "offer_received") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "offer_shared",
      actorEmail: input.actorEmail,
      actorRole: "admin",
      note: "Published to the creator.",
    });
    if (!moved.ok) return moved;
  }
  await db
    .update(deals)
    .set({ visibleToCreator: true, reviewStatus: "published", updatedAt: nowIso() })
    .where(eq(deals.id, deal.id));
  return { ok: true as const, changed: true };
}

export async function rejectDealReview(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; actorRole: string },
) {
  if (input.actorRole !== "admin") return ownerOnly();
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  if (deal.reviewStatus === "published") {
    return { ok: false as const, status: 409, error: "This deal is already on the creator's list." };
  }
  if (deal.reviewStatus === "rejected" && !deal.visibleToCreator) {
    return { ok: true as const, changed: false };
  }
  await db
    .update(deals)
    .set({ reviewStatus: "rejected", visibleToCreator: false, updatedAt: nowIso() })
    .where(eq(deals.id, deal.id));
  return { ok: true as const, changed: true };
}

export async function editDealReview(
  db: PortalDb,
  input: {
    dealId: string;
    actorRole: string;
    brand?: string | null;
    subtitle?: string | null;
    postDate?: string | null;
    kamronNotes?: string | null;
    productRequired?: boolean;
    rushRevision?: boolean;
    rateCents?: number | null;
  },
) {
  if (input.actorRole !== "admin") return ownerOnly();
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  const patch: Partial<typeof deals.$inferInsert> = { updatedAt: nowIso() };
  if (typeof input.brand === "string" && input.brand.trim()) patch.brand = input.brand.trim();
  if (typeof input.subtitle === "string") patch.subtitle = input.subtitle.trim() || null;
  if (typeof input.postDate === "string") {
    const postDate = input.postDate.trim();
    if (isFakeCalendarDay(postDate)) return { ok: false as const, status: 400, error: "Use a date like 2026-11-20." };
    patch.postDate = postDate || null;
  }
  if (typeof input.kamronNotes === "string") patch.kamronNotes = input.kamronNotes.trim() || null;
  if (typeof input.productRequired === "boolean") patch.productRequired = input.productRequired;
  if (typeof input.rushRevision === "boolean") patch.rushRevision = input.rushRevision;
  if (typeof input.rateCents === "number") patch.rateCents = input.rateCents;
  await db.update(deals).set(patch).where(eq(deals.id, deal.id));
  return { ok: true as const };
}

export async function saveBrandReplyDraft(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; actorRole: string; body: string },
) {
  if (input.actorRole !== "admin") return ownerOnly();
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  const body = input.body.trim();
  if (!body) return { ok: false as const, status: 400, error: "Write the reply first." };
  if (/\[CONFIRM\]/i.test(body)) return { ok: false as const, status: 400, error: "Fill in the rate and date. A draft cannot contain [CONFIRM]." };
  const timestamp = nowIso();
  const existing = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, deal.id));
  if (existing[0]) {
    await db
      .update(brandReplyDrafts)
      .set({ body, updatedBy: input.actorEmail, updatedAt: timestamp })
      .where(eq(brandReplyDrafts.dealId, deal.id));
  } else {
    await db.insert(brandReplyDrafts).values({
      dealId: deal.id,
      body,
      updatedBy: input.actorEmail,
      updatedAt: timestamp,
    });
  }
  return { ok: true as const };
}

export async function askCreatorToConfirmRate(
  db: PortalDb,
  input: { dealId: string; actorRole: string },
) {
  if (input.actorRole !== "admin") return ownerOnly();
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  if (deal.rateCents == null) {
    return { ok: false as const, status: 400, error: "Set the agreed rate before asking the creator to confirm it." };
  }
  await db.update(deals).set({ rateReady: true, updatedAt: nowIso() }).where(eq(deals.id, deal.id));
  return { ok: true as const };
}

export async function confirmAgreedRate(
  db: PortalDb,
  input: { dealId: string; actorRole: string; creatorId: string | null },
) {
  if (input.actorRole !== "creator" || !input.creatorId) {
    return { ok: false as const, status: 403, error: "Only the creator can confirm this rate." };
  }
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  if (deal.creatorId !== input.creatorId) {
    return { ok: false as const, status: 403, error: "You can only confirm your own deal." };
  }
  if (!deal.visibleToCreator || !deal.rateReady || deal.rateCents == null) {
    return { ok: false as const, status: 403, error: "This rate is not ready for you yet." };
  }
  if (deal.rateConfirmedAt) return { ok: false as const, status: 409, error: "You already confirmed this rate." };
  const timestamp = nowIso();
  await db.update(deals).set({ rateConfirmedAt: timestamp, updatedAt: timestamp }).where(eq(deals.id, deal.id));
  return { ok: true as const, rateCents: deal.rateCents };
}

export function dealFlagQuery(input: {
  dealId: string;
  creator?: string | null;
  reply?: string | null;
  replyError?: string | null;
  rate?: string | null;
  rateError?: string | null;
  dates?: string | null;
  datesError?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.creator) params.set("creator", input.creator);
  const fields = [
    ["reply", input.reply],
    ["replyError", input.replyError],
    ["rate", input.rate],
    ["rateError", input.rateError],
    ["dates", input.dates],
    ["datesError", input.datesError],
  ] as const;
  for (const [key, value] of fields) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/deals/${encodeURIComponent(input.dealId)}${query ? `?${query}` : ""}`;
}
