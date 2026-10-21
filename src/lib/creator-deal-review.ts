import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, creatorOfferReviews, creators, deals } from "@/db/schema";
import { setDealStage } from "./deal-stage";
import { nowIso } from "./format";
import { notifyStaff } from "./managers";
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

export type OfferReviewStatus = "waiting" | "passed" | "declined" | "accepted" | "countered";

/** A stored answer, including a reply such as "passed on Oct 21", is not waiting. */
export function offerReviewStatus(decision: string | null | undefined): OfferReviewStatus {
  const value = (decision ?? "").trim().toLowerCase();
  if (!value) return "waiting";
  if (value === "accept" || value === "accepted") return "accepted";
  if (value === "counter" || value === "countered") return "countered";
  if (value.includes("declin")) return "declined";
  if (value.includes("pass")) return "passed";
  return "waiting";
}

export function dealReviewLabel(decision: string | null) {
  const status = offerReviewStatus(decision);
  if (status === "accepted") return "Accepted";
  if (status === "countered") return "Countered";
  if (status === "passed") return decision === "pass" ? "Passed to roster" : "Passed";
  if (status === "declined") return "Declined";
  return "Waiting for her answer";
}

/** What the creator is allowed to send. Passed, declined, counter-only, and info-only never include accept. */
export function reviewChoices(mode: string | null, decision: string | null): DealReviewDecision[] {
  const status = offerReviewStatus(decision);
  if (status === "passed" || status === "declined" || status === "accepted" || status === "countered") return [];
  if (decision) return [];
  if (mode === "info") return [];
  if (mode === "counter") return ["counter"];
  return ["accept", "counter", "pass"];
}

export const CREATOR_REVIEW_EMPTY = "Nothing needs you right now";

/** Status copy that means the creator has nothing to send, even if a button was left on the card. */
const CREATOR_RESTING_REVIEW = [
  /\bduplicate\b/i,
  /\bon hold\b/i,
  /waiting on the brand/i,
  /\bdeclin/i,
  /\bclosed\b/i,
  /\bpassed\b/i,
  /nothing to accept/i,
  /for your information/i,
  /nothing to (answer|decide)/i,
  /nothing for you to answer/i,
];

/**
 * Creator home only. A card stays when the creator can still accept, pass, or counter.
 * Owner, manager, and bot lists keep every card, including closed and info-only ones.
 */
export function creatorReviewNeedsAction(offer: Pick<CreatorDealReview, "offerLabel" | "summary" | "reviewMode" | "decision">) {
  if (reviewChoices(offer.reviewMode, offer.decision).length === 0) return false;
  const text = `${offer.offerLabel}\n${offer.summary}`;
  return !CREATOR_RESTING_REVIEW.some((pattern) => pattern.test(text));
}

/** Bot-settable card status. A reply like "passed on Oct 21" counts as passed, not waiting. */
export function normalizeOfferStatus(value: unknown): "passed" | "declined" | "waiting" | "invalid" | "absent" {
  if (value == null) return "absent";
  if (typeof value !== "string") return "invalid";
  const status = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!status) return "absent";
  if (status.includes("declin")) return "declined";
  if (status.includes("pass")) return "passed";
  if (status === "waiting" || status === "pending" || status === "open") return "waiting";
  return "invalid";
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
        status: offerReviewStatus(offer.decision),
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
  if (input.decision === "accept") {
    const placed = await placeAcceptedReview(db, offer, input.creatorId);
    if (!placed.ok) return placed;
  }
  await db.update(creatorOfferReviews).set({
    decision: input.decision,
    counterNote: note,
    decidedAt: timestamp,
  }).where(eq(creatorOfferReviews.id, offer.id));
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { ok: false, status: 500, error: "That answer was not saved." };
  const people = await db.select({ name: creators.name }).from(creators).where(eq(creators.id, input.creatorId));
  const name = people[0]?.name ?? "A creator";
  const message = input.decision === "accept"
    ? `${name} accepted ${offer.brand}. It's on Brand deals.`
    : input.decision === "pass"
      ? `${name} passed on ${offer.brand}.`
      : `${name} suggested a counter on ${offer.brand}.${note ? ` ${note}` : ""}`;
  await notifyStaff(db, { kind: "offer_review", creatorId: input.creatorId, message });
  return { ok: true, decision: input.decision };
}

/** Turns an accepted offer into a Brand deal. The creator's private minimum is not read or stored. */
async function placeAcceptedReview(
  db: PortalDb,
  offer: { id: string; brand: string; contactEmail: string; offerLabel: string; summary: string },
  creatorId: string,
): Promise<Result<Record<string, never>>> {
  const id = `accepted-${offer.id}`;
  const existing = await db.select().from(deals).where(eq(deals.id, id));
  if (existing[0]) return { ok: true };
  const rows = await db.select({ sortOrder: deals.sortOrder }).from(deals).where(eq(deals.creatorId, creatorId));
  const sort = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const timestamp = nowIso();
  const label = offer.offerLabel.trim();
  await db.insert(deals).values({
    id,
    creatorId,
    brand: offer.brand,
    subtitle: offer.summary.slice(0, 180),
    contact: offer.contactEmail,
    status: "pitch",
    deliverablesJson: "[]",
    chipsJson: "[]",
    visibleToCreator: true,
    reviewStatus: "published",
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: sort,
    isSeed: false,
    amountDisplay: label.startsWith("$") ? label : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const moved = await setDealStage(db, {
    dealId: id,
    toStage: "creator_interested",
    actorEmail: "portal",
    actorRole: "system",
    creatorId,
    note: "Creator accepted the offer.",
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  await db.update(deals).set({ visibleToCreator: true, reviewStatus: "published" }).where(eq(deals.id, id));
  return { ok: true };
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
  const fromStatus = "status" in body ? normalizeOfferStatus(body.status) : "absent";
  if (fromStatus === "invalid") {
    return { status: 400, body: { error: "status must be passed, declined, or waiting." } };
  }
  let offerStatus = fromStatus;
  if (offerStatus === "absent" && "decision" in body) {
    const parsed = normalizeOfferStatus(body.decision);
    if (parsed === "passed" || parsed === "declined" || parsed === "waiting") offerStatus = parsed;
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
        status: offerReviewStatus(current.decision),
        choices: reviewChoices(current.reviewMode, current.decision),
        reviewMode: current.reviewMode ?? null,
      },
    };
  }
  const closed = offerStatus === "passed" || offerStatus === "declined";
  const decision = closed ? offerStatus : null;
  const before = (await db.select().from(approvalEmails)).length;
  const row = {
    creatorId: creator.id,
    brand,
    contactEmail,
    offerLabel,
    summary,
    reviewMode,
    decision,
    decidedAt: decision ? nowIso() : null,
  };
  if (current) {
    await db.update(creatorOfferReviews).set(row).where(eq(creatorOfferReviews.id, id));
  } else {
    await db.insert(creatorOfferReviews).values({
      ...row,
      id,
      counterNote: null,
      createdAt: nowIso(),
    });
  }
  const after = (await db.select().from(approvalEmails)).length;
  if (after !== before) return { status: 500, body: { error: "Offer reviews do not send mail." } };
  return {
    status: current ? 200 : 201,
    body: {
      id,
      created: !current,
      kept: false,
      creatorId: creator.id,
      reviewMode,
      decision,
      status: offerReviewStatus(decision),
      choices: reviewChoices(reviewMode, decision),
    },
  };
}
