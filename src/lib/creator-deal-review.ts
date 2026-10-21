import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, creatorOfferReviews, creators } from "@/db/schema";
import { nowIso } from "./format";
import { findCreatorByEmail, findCreatorById } from "./queries";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const DEAL_REVIEW_DECISIONS = ["accept", "counter", "pass"] as const;
export type DealReviewDecision = (typeof DEAL_REVIEW_DECISIONS)[number];

export type ReviewMode = "counter" | "info";

export type CreatorDealReview = {
  id: string;
  creatorId: string;
  brand: string;
  contactEmail: string;
  offerLabel: string;
  summary: string;
  reviewMode: ReviewMode | null;
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

/** What the creator is allowed to send. Counter-only and info-only never include accept. */
export function reviewChoices(mode: string | null, decision: string | null): DealReviewDecision[] {
  if (decision) return [];
  if (mode === "info") return [];
  if (mode === "counter") return ["counter"];
  return ["accept", "counter", "pass"];
}

export function normalizeReviewMode(value: unknown): ReviewMode | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const mode = value.trim().toLowerCase().replace(/_/g, "-");
  if (mode === "respond" || mode === "full" || mode === "answer") return null;
  if (mode === "counter" || mode === "counter-only") return "counter";
  if (mode === "info" || mode === "info-only") return "info";
  return "invalid";
}

function toReview(row: typeof creatorOfferReviews.$inferSelect): CreatorDealReview {
  return {
    id: row.id,
    creatorId: row.creatorId,
    brand: row.brand,
    contactEmail: row.contactEmail,
    offerLabel: row.offerLabel,
    summary: row.summary,
    reviewMode: row.reviewMode === "counter" || row.reviewMode === "info" ? row.reviewMode : null,
    decision: row.decision,
    counterNote: row.counterNote,
    decidedAt: row.decidedAt,
  };
}

export async function listCreatorDealReviews(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorOfferReviews).where(eq(creatorOfferReviews.creatorId, creatorId)).orderBy(asc(creatorOfferReviews.createdAt));
  return rows.map(toReview);
}

/** Bot read of the cards on a creator's home. Rates and staff notes are not on these rows. */
export async function listBotOfferReviews(db: PortalDb, creatorKey: string | null) {
  const key = creatorKey?.trim() ?? "";
  if (!key) return { status: 400, body: { error: "creator is required." } };
  const creator = key.includes("@") ? await findCreatorByEmail(db, key) : await findCreatorById(db, key);
  if (!creator) return { status: 404, body: { error: "Creator not found." } };
  const reviews = await listCreatorDealReviews(db, creator.id);
  return {
    status: 200,
    body: {
      creatorId: creator.id,
      reviews: reviews.map((offer) => ({
        id: offer.id,
        brand: offer.brand,
        contactEmail: offer.contactEmail,
        offerLabel: offer.offerLabel,
        summary: offer.summary,
        reviewMode: offer.reviewMode,
        decision: offer.decision,
        counterNote: offer.counterNote,
        decidedAt: offer.decidedAt,
        choices: reviewChoices(offer.reviewMode, offer.decision),
        answerLabel: dealReviewLabel(offer.decision),
      })),
    },
  };
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
  const allowed = reviewChoices(offer.reviewMode, null);
  if (!allowed.includes(input.decision)) {
    return {
      ok: false,
      status: 403,
      error: offer.reviewMode === "info" ? "This offer is for your information." : "You can't accept this offer.",
    };
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Upserts an offer card. A row the creator already answered is left as it is. */
export async function upsertOfferReview(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.id !== "string" || !body.id.trim()) {
    return { status: 400, body: { error: "id is required." } };
  }
  const creator = typeof body.creatorEmail === "string"
    ? await findCreatorByEmail(db, body.creatorEmail)
    : typeof body.creatorId === "string"
      ? await findCreatorById(db, body.creatorId)
      : null;
  if (!creator) return { status: 404, body: { error: "Creator not found. Upsert the creator first." } };
  const brand = textField(body, "brand");
  const contactEmail = textField(body, "contactEmail");
  const offerLabel = textField(body, "offerLabel");
  const summary = textField(body, "summary");
  if (!brand || !contactEmail || !offerLabel || !summary) {
    return { status: 400, body: { error: "brand, contactEmail, offerLabel, and summary are required." } };
  }
  const reviewMode = normalizeReviewMode(body.reviewMode);
  if (reviewMode === "invalid") {
    return { status: 400, body: { error: "reviewMode must be counter, info, or omitted." } };
  }
  const id = body.id.trim();
  const existing = await db.select().from(creatorOfferReviews).where(eq(creatorOfferReviews.id, id));
  const current = existing[0];
  if (current?.decision) {
    return {
      status: 200,
      body: {
        id,
        created: false,
        kept: true,
        creatorId: current.creatorId,
        brand: current.brand,
        decision: current.decision,
        reviewMode: current.reviewMode ?? null,
      },
    };
  }
  const before = (await db.select().from(approvalEmails)).length;
  const row = {
    creatorId: creator.id,
    brand,
    contactEmail,
    offerLabel,
    summary,
    reviewMode,
  };
  if (current) {
    await db.update(creatorOfferReviews).set(row).where(eq(creatorOfferReviews.id, id));
  } else {
    await db.insert(creatorOfferReviews).values({
      ...row,
      id,
      decision: null,
      counterNote: null,
      decidedAt: null,
      createdAt: nowIso(),
    });
  }
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { status: 500, body: { error: "Offer reviews do not send mail." } };
  return {
    status: current ? 200 : 201,
    body: { id, created: !current, kept: false, creatorId: creator.id, reviewMode },
  };
}
