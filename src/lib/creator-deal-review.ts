import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, creatorOfferReviews, creators } from "@/db/schema";
import { nowIso } from "./format";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const DEAL_REVIEW_DECISIONS = ["accept", "counter", "pass"] as const;
export type DealReviewDecision = (typeof DEAL_REVIEW_DECISIONS)[number];

export type CreatorDealReview = {
  id: string;
  creatorId: string;
  brand: string;
  contactEmail: string;
  offerLabel: string;
  summary: string;
  decision: string | null;
  counterNote: string | null;
  decidedAt: string | null;
};

export function isDealReviewDecision(value: string): value is DealReviewDecision {
  return (DEAL_REVIEW_DECISIONS as readonly string[]).includes(value);
}

export function dealReviewLabel(decision: string | null) {
  if (decision === "accept") return "Accepted";
  if (decision === "counter") return "Countered";
  if (decision === "pass") return "Passed to roster";
  return "Waiting for her answer";
}

function toReview(row: typeof creatorOfferReviews.$inferSelect): CreatorDealReview {
  return {
    id: row.id,
    creatorId: row.creatorId,
    brand: row.brand,
    contactEmail: row.contactEmail,
    offerLabel: row.offerLabel,
    summary: row.summary,
    decision: row.decision,
    counterNote: row.counterNote,
    decidedAt: row.decidedAt,
  };
}

export async function listCreatorDealReviews(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorOfferReviews).where(eq(creatorOfferReviews.creatorId, creatorId)).orderBy(asc(creatorOfferReviews.createdAt));
  return rows.map(toReview);
}

export async function listOwnerDealReviews(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return { ok: false as const, status: 403, error: "Only the owner can see these answers." };
  const [rows, people] = await Promise.all([
    db.select().from(creatorOfferReviews).orderBy(asc(creatorOfferReviews.createdAt)),
    db.select({ id: creators.id, name: creators.name }).from(creators),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return {
    ok: true as const,
    reviews: rows.map((row) => ({ ...toReview(row), creatorName: names.get(row.creatorId) ?? "Creator" })),
  };
}

/** Records the creator's answer. Nothing is emailed, and creator minimums are not read. */
export async function decideCreatorDealReview(
  db: PortalDb,
  input: { offerId: string; creatorId: string | null; actorRole: string; decision: string; note?: string | null },
): Promise<Result<{ decision: DealReviewDecision }>> {
  if (input.actorRole !== "creator" || !input.creatorId) {
    return { ok: false, status: 403, error: "Only the creator can answer this offer." };
  }
  if (!isDealReviewDecision(input.decision)) {
    return { ok: false, status: 400, error: "Choose accept, counter, or pass." };
  }
  const rows = await db.select().from(creatorOfferReviews).where(eq(creatorOfferReviews.id, input.offerId));
  const offer = rows[0];
  if (!offer) return { ok: false, status: 404, error: "That offer is not on your list." };
  if (offer.creatorId !== input.creatorId) {
    return { ok: false, status: 403, error: "You can only answer your own offers." };
  }
  if (offer.decision) return { ok: false, status: 409, error: "You already answered this offer." };
  const before = (await db.select().from(approvalEmails)).length;
  const timestamp = nowIso();
  const note = input.decision === "counter" ? input.note?.trim().slice(0, 500) || null : null;
  await db.update(creatorOfferReviews).set({
    decision: input.decision,
    counterNote: note,
    decidedAt: timestamp,
  }).where(eq(creatorOfferReviews.id, offer.id));
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false, status: 500, error: "That answer was not saved." };
  return { ok: true, decision: input.decision };
}
