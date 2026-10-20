import { eq, sql } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { benchCreators, brandCrmEntries, creators, giftedApplications, giftedOffers } from "@/db/schema";
import { GIFTED_FINDERS_FEE_CENTS, GIFTED_TERMS_VERSION } from "@/config/gifted-terms";
import { brandKey } from "./brand-crm";
import { agencyTimeZone, normalizeEmail, nowIso } from "./format";
import type { Viewer } from "./types";

export const GIFTED_STATUSES = ["applied", "approved", "shipped", "delivered", "posted", "overdue", "charged"] as const;
export type GiftedStatus = (typeof GIFTED_STATUSES)[number];

export const GIFTED_STATUS_LABELS: Record<GiftedStatus, string> = {
  applied: "Applied",
  approved: "Approved",
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  overdue: "Overdue",
  charged: "Amount owed",
};

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export function giftedAmountOwed(retailValueCents: number) {
  return retailValueCents + GIFTED_FINDERS_FEE_CENTS;
}

function easternDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: agencyTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isStatus(value: string): value is GiftedStatus {
  return (GIFTED_STATUSES as readonly string[]).includes(value);
}

export function parseGiftPhotos(value: string) {
  const photos = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (photos.length === 0) return { ok: false as const, error: "Add at least one photo link." };
  if (photos.length > 6) return { ok: false as const, error: "Use up to six photo links." };
  if (photos.some((photo) => !/^https?:\/\//i.test(photo))) {
    return { ok: false as const, error: "Photo links have to start with http:// or https://." };
  }
  return { ok: true as const, photos };
}

function canMove(from: GiftedStatus, to: GiftedStatus) {
  if (to === "approved" && from === "applied") return true;
  if (to === "shipped" && from === "approved") return true;
  if (to === "delivered" && from === "shipped") return true;
  if (to === "posted" && (from === "delivered" || from === "overdue")) return true;
  if (to === "overdue" && (from === "approved" || from === "shipped" || from === "delivered")) return true;
  if (to === "charged" && from === "overdue") return true;
  return false;
}

async function tagFuturePaidProspect(db: PortalDb, brand: string, actorName: string) {
  const key = brandKey(brand);
  const rows = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, key));
  if (rows.some((row) => row.outcome === "future paid prospect")) return;
  await db.insert(brandCrmEntries).values({
    id: crypto.randomUUID(),
    brandKey: key,
    kind: "offer",
    contactName: null,
    contactEmail: null,
    response: null,
    note: "Gifted product. Future paid prospect.",
    actorName,
    createdAt: nowIso(),
    ratePaidCents: null,
    outcome: "future paid prospect",
    nextFollowUp: null,
    creatorId: null,
    domain: null,
  });
}

export async function createGiftedOffer(
  db: PortalDb,
  input: {
    actorRole: string;
    actorName: string;
    brand: string;
    product: string;
    photos: string;
    deliverable: string;
    dueOn: string;
    retailValueCents: number | null;
  },
): Promise<Result<{ id: string }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can post a free product." };
  const brand = input.brand.trim();
  const product = input.product.trim();
  const deliverable = input.deliverable.trim();
  const dueOn = input.dueOn.trim();
  if (!brand) return { ok: false, status: 400, error: "Name the brand." };
  if (!product) return { ok: false, status: 400, error: "Name the product." };
  if (!deliverable) return { ok: false, status: 400, error: "Say what video they owe, such as 1 TikTok." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, status: 400, error: "Use a due date like 2026-11-20." };
  if (input.retailValueCents == null || !Number.isInteger(input.retailValueCents) || input.retailValueCents <= 0) {
    return { ok: false, status: 400, error: "Enter the product's retail value." };
  }
  const photos = parseGiftPhotos(input.photos);
  if (!photos.ok) return { ok: false, status: 400, error: photos.error };
  const id = crypto.randomUUID();
  await db.insert(giftedOffers).values({
    id,
    brand,
    product,
    photosJson: JSON.stringify(photos.photos),
    deliverable,
    dueOn,
    retailValueCents: input.retailValueCents,
    createdBy: input.actorName,
    createdAt: nowIso(),
  });
  await tagFuturePaidProspect(db, brand, input.actorName);
  return { ok: true, id };
}

async function offerById(db: PortalDb, offerId: string) {
  const rows = await db.select().from(giftedOffers).where(eq(giftedOffers.id, offerId));
  return rows[0] ?? null;
}

export async function applyForGiftedOffer(
  db: PortalDb,
  input: {
    offerId: string;
    creatorId?: string | null;
    benchId?: string | null;
    acceptTerms: boolean;
    termsVersion: string;
  },
): Promise<Result<{ id: string; status: "applied" }>> {
  const creatorId = input.creatorId ?? null;
  const benchId = input.benchId ?? null;
  if (Boolean(creatorId) === Boolean(benchId)) {
    return { ok: false, status: 400, error: "Apply as a creator or as someone on the bench." };
  }
  if (!input.acceptTerms || input.termsVersion !== GIFTED_TERMS_VERSION) {
    return { ok: false, status: 400, error: "Accept the current terms before you apply." };
  }
  const offer = await offerById(db, input.offerId);
  if (!offer) return { ok: false, status: 404, error: "That free product is not posted." };
  if (creatorId) {
    const person = await db.select().from(creators).where(eq(creators.id, creatorId));
    if (!person[0]) return { ok: false, status: 404, error: "That creator is not on the roster." };
  } else if (benchId) {
    const person = await db.select().from(benchCreators).where(eq(benchCreators.id, benchId));
    if (!person[0] || person[0].status !== "bench") {
      return { ok: false, status: 404, error: "That person is not on the free bench." };
    }
  }
  const existing = await db.select().from(giftedApplications).where(eq(giftedApplications.offerId, offer.id));
  if (existing.some((row) => (creatorId && row.creatorId === creatorId) || (benchId && row.benchId === benchId))) {
    return { ok: false, status: 409, error: "You already applied for this product." };
  }
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(giftedApplications).values({
    id,
    offerId: offer.id,
    creatorId,
    benchId,
    status: "applied",
    termsVersion: GIFTED_TERMS_VERSION,
    termsAcceptedAt: timestamp,
    postUrl: null,
    appliedAt: timestamp,
    approvedAt: null,
    shippedAt: null,
    deliveredAt: null,
    postedAt: null,
    overdueAt: null,
    chargedAt: null,
    amountOwedCents: null,
    findersFeeCents: null,
    updatedAt: timestamp,
  });
  return { ok: true, id, status: "applied" };
}

export async function applyForGiftedOfferByEmail(
  db: PortalDb,
  input: { offerId: string; email: string; acceptTerms: boolean; termsVersion: string },
) {
  const email = normalizeEmail(input.email);
  if (!email.includes("@") || email.endsWith(".invalid")) {
    return { ok: false as const, status: 400, error: "Enter the email you used for the bench." };
  }
  const creatorRows = await db.select().from(creators).where(sql`lower(${creators.email}) = ${email}`);
  if (creatorRows[0]) {
    return { ok: false as const, status: 403, error: "Sign in to apply. Free products are on your portal." };
  }
  const benchRows = await db.select().from(benchCreators).where(sql`lower(${benchCreators.email}) = ${email}`);
  const bench = benchRows[0];
  if (!bench || bench.status !== "bench") {
    return { ok: false as const, status: 404, error: "Join the bench or sign in first." };
  }
  return applyForGiftedOffer(db, {
    offerId: input.offerId,
    benchId: bench.id,
    acceptTerms: input.acceptTerms,
    termsVersion: input.termsVersion,
  });
}

export async function refreshGiftedOverdue(db: PortalDb, now = new Date()) {
  const today = easternDay(now);
  const [applications, offers] = await Promise.all([
    db.select().from(giftedApplications),
    db.select().from(giftedOffers),
  ]);
  const due = new Map(offers.map((offer) => [offer.id, offer.dueOn]));
  let changed = 0;
  for (const row of applications) {
    if (row.status !== "delivered") continue;
    const dueOn = due.get(row.offerId);
    if (!dueOn || today <= dueOn) continue;
    await db.update(giftedApplications).set({
      status: "overdue",
      overdueAt: row.overdueAt ?? nowIso(),
      updatedAt: nowIso(),
    }).where(eq(giftedApplications.id, row.id));
    changed += 1;
  }
  return changed;
}

async function moveApplication(
  db: PortalDb,
  input: { actorRole: string; applicationId: string; to: GiftedStatus; postUrl?: string | null },
): Promise<Result<{ status: GiftedStatus }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can update this." };
  const rows = await db.select().from(giftedApplications).where(eq(giftedApplications.id, input.applicationId));
  const row = rows[0];
  if (!row || !isStatus(row.status)) return { ok: false, status: 404, error: "That application is not here." };
  if (!canMove(row.status, input.to)) return { ok: false, status: 409, error: "That status can't be set from here." };
  if (input.to === "charged" && !row.deliveredAt) {
    return { ok: false, status: 409, error: "The product has not been marked delivered, so nothing is owed yet." };
  }
  const offer = await offerById(db, row.offerId);
  if (!offer) return { ok: false, status: 404, error: "That free product is not posted." };
  const timestamp = nowIso();
  const patch: Partial<typeof giftedApplications.$inferInsert> = { status: input.to, updatedAt: timestamp };
  if (input.to === "approved") patch.approvedAt = timestamp;
  if (input.to === "shipped") patch.shippedAt = timestamp;
  if (input.to === "delivered") patch.deliveredAt = timestamp;
  if (input.to === "posted") {
    const url = input.postUrl?.trim() ?? "";
    if (!/^https?:\/\//i.test(url)) return { ok: false, status: 400, error: "Add the link to the posted video." };
    patch.postUrl = url;
    patch.postedAt = timestamp;
  }
  if (input.to === "charged") {
    patch.chargedAt = timestamp;
    patch.amountOwedCents = giftedAmountOwed(offer.retailValueCents);
    patch.findersFeeCents = GIFTED_FINDERS_FEE_CENTS;
  }
  await db.update(giftedApplications).set(patch).where(eq(giftedApplications.id, row.id));
  return { ok: true, status: input.to };
}

export function approveGiftedApplicant(db: PortalDb, input: { actorRole: string; applicationId: string }) {
  return moveApplication(db, { ...input, to: "approved" });
}

export function markGiftedShipped(db: PortalDb, input: { actorRole: string; applicationId: string }) {
  return moveApplication(db, { ...input, to: "shipped" });
}

export function markGiftedDelivered(db: PortalDb, input: { actorRole: string; applicationId: string }) {
  return moveApplication(db, { ...input, to: "delivered" });
}

export async function markGiftedPosted(
  db: PortalDb,
  input: { actorRole: string; actorCreatorId?: string | null; applicationId: string; postUrl: string },
) {
  const rows = await db.select().from(giftedApplications).where(eq(giftedApplications.id, input.applicationId));
  const row = rows[0];
  if (!row || !isStatus(row.status)) return { ok: false as const, status: 404, error: "That application is not here." };
  if (input.actorRole === "creator") {
    if (!input.actorCreatorId || row.creatorId !== input.actorCreatorId) {
      return { ok: false as const, status: 403, error: "You can only post your own video." };
    }
  } else if (input.actorRole !== "admin") {
    return { ok: false as const, status: 403, error: "Only Kamron can update this." };
  }
  if (row.status === "charged") {
    const url = input.postUrl.trim();
    if (!/^https?:\/\//i.test(url)) return { ok: false as const, status: 400, error: "Add the link to the posted video." };
    await db.update(giftedApplications).set({ postUrl: url, postedAt: nowIso(), updatedAt: nowIso() }).where(eq(giftedApplications.id, row.id));
    return { ok: true as const, status: "charged" as const };
  }
  return moveApplication(db, { actorRole: "admin", applicationId: row.id, to: "posted", postUrl: input.postUrl });
}

export function flagGiftedOwed(db: PortalDb, input: { actorRole: string; applicationId: string }) {
  return moveApplication(db, { ...input, to: "charged" });
}

function photosOf(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function listGiftedBoard(db: PortalDb, viewer: Viewer, now = new Date()) {
  await refreshGiftedOverdue(db, now);
  const [offers, applications, people, bench] = await Promise.all([
    db.select().from(giftedOffers),
    db.select().from(giftedApplications),
    db.select().from(creators),
    db.select().from(benchCreators),
  ]);
  const names = new Map<string, string>([
    ...people.map((person) => [person.id, person.name] as const),
    ...bench.map((person) => [person.id, person.name] as const),
  ]);
  const mine = viewer.role === "creator" ? viewer.creatorId : null;
  return offers
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((offer) => {
      const rows = applications.filter((row) => row.offerId === offer.id);
      const own = mine ? rows.find((row) => row.creatorId === mine) ?? null : null;
      return {
        id: offer.id,
        brand: offer.brand,
        product: offer.product,
        photos: photosOf(offer.photosJson),
        deliverable: offer.deliverable,
        dueOn: offer.dueOn,
        retailValueCents: offer.retailValueCents,
        amountOwedCents: giftedAmountOwed(offer.retailValueCents),
        mine: own && isStatus(own.status)
          ? { id: own.id, status: own.status, label: GIFTED_STATUS_LABELS[own.status], postUrl: own.postUrl }
          : null,
        applicants: viewer.role === "admin"
          ? rows.map((row) => ({
              id: row.id,
              name: (row.creatorId && names.get(row.creatorId)) || (row.benchId && names.get(row.benchId)) || "Applicant",
              creatorId: row.creatorId,
              benchId: row.benchId,
              status: isStatus(row.status) ? row.status : "applied",
              label: isStatus(row.status) ? GIFTED_STATUS_LABELS[row.status] : row.status,
              termsVersion: row.termsVersion,
              termsAcceptedAt: row.termsAcceptedAt,
              deliveredAt: row.deliveredAt,
              postUrl: row.postUrl,
              amountOwedCents: row.amountOwedCents,
              findersFeeCents: row.findersFeeCents,
            }))
          : [],
      };
    });
}

export async function listGiftedOverdue(db: PortalDb, viewer: Viewer, now = new Date()) {
  if (viewer.role !== "admin") return [];
  const today = easternDay(now);
  const board = await listGiftedBoard(db, viewer, now);
  return board.flatMap((offer) => offer.applicants
    .filter((row) => {
      if (row.status === "overdue" || row.status === "charged") return true;
      return (row.status === "approved" || row.status === "shipped") && today > offer.dueOn;
    })
    .map((row) => ({ ...row, brand: offer.brand, product: offer.product, dueOn: offer.dueOn, retailValueCents: offer.retailValueCents })));
}
