import { and, asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, fulfillmentOrders } from "@/db/schema";
import { brandedDelivery, brandingFooter, deliveryCarriesBranding, stampBranding } from "./branding";
import { nowIso } from "./format";
import { findOfferPrice, oneTimeOffers, paymentsEnabled } from "./payments-config";
import { findCreatorById } from "./queries";
import type { Viewer } from "./types";

export const FULFILLMENT_DUE_DAYS = 5;
const FILE_LIMIT = 200_000;

export type FulfillmentStatus = "queued" | "in_progress" | "delivered";

const OFF = { ok: false as const, status: 503, error: "Payments are off." };

export function fulfillmentStatusLabel(status: string) {
  if (status === "queued") return "Queued";
  if (status === "in_progress") return "In progress";
  if (status === "delivered") return "Delivered";
  return status;
}

export function fulfillmentDueOn(createdAt: string) {
  const start = new Date(createdAt);
  const later = new Date(start.getTime() + FULFILLMENT_DUE_DAYS * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(later);
}

function productName(product: string) {
  return findOfferPrice(product, "one_time")?.offer.name ?? product;
}

function isFulfillableProduct(product: string) {
  return oneTimeOffers().some((offer) => offer.id === product);
}

async function creatorNames(db: PortalDb) {
  const people = await db.select({ id: creators.id, name: creators.name }).from(creators);
  return new Map(people.map((person) => [person.id, person.name]));
}

function toView(row: typeof fulfillmentOrders.$inferSelect, names: Map<string, string>) {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    creatorId: row.creatorId,
    creatorName: names.get(row.creatorId) ?? row.creatorId,
    product: row.product,
    productName: productName(row.product),
    status: row.status,
    statusLabel: fulfillmentStatusLabel(row.status),
    createdAt: row.createdAt,
    dueOn: row.dueOn,
    claimedAt: row.claimedAt,
    deliveredAt: row.deliveredAt,
    deliveryUrl: row.deliveryUrl,
    deliveryFilename: row.deliveryFilename,
    deliveryBody: row.deliveryBody,
    branding: brandingFooter(),
  };
}

export async function queueFulfillmentOrder(
  db: PortalDb,
  input: { purchaseId: string; creatorId: string; product: string; createdAt?: string },
) {
  if (!paymentsEnabled()) return { queued: false as const };
  const product = input.product.trim();
  if (!isFulfillableProduct(product)) return { queued: false as const };
  const existing = await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.purchaseId, input.purchaseId));
  if (existing[0]) return { queued: true as const, duplicate: true, id: existing[0].id };
  const createdAt = input.createdAt ?? nowIso();
  const id = crypto.randomUUID();
  try {
    await db.insert(fulfillmentOrders).values({
      id,
      purchaseId: input.purchaseId,
      creatorId: input.creatorId,
      product,
      status: "queued",
      createdAt,
      dueOn: fulfillmentDueOn(createdAt),
      claimedAt: null,
      deliveredAt: null,
      deliveryUrl: null,
      deliveryFilename: null,
      deliveryBody: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/unique|constraint/i.test(message)) throw error;
    const again = await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.purchaseId, input.purchaseId));
    if (again[0]) return { queued: true as const, duplicate: true, id: again[0].id };
    throw error;
  }
  return { queued: true as const, duplicate: false, id };
}

export async function listFulfillmentOrders(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const rows = await db.select().from(fulfillmentOrders).orderBy(asc(fulfillmentOrders.createdAt));
  const names = await creatorNames(db);
  return rows.map((row) => toView(row, names));
}

export async function listQueuedOrders(db: PortalDb) {
  if (!paymentsEnabled()) return OFF;
  const rows = await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.status, "queued")).orderBy(asc(fulfillmentOrders.createdAt));
  const names = await creatorNames(db);
  return { ok: true as const, orders: rows.map((row) => toView(row, names)) };
}

export async function claimFulfillmentOrder(db: PortalDb, requestedId?: string | null) {
  if (!paymentsEnabled()) return OFF;
  const queued = await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.status, "queued")).orderBy(asc(fulfillmentOrders.createdAt));
  const row = requestedId ? queued.find((item) => item.id === requestedId) : queued[0];
  if (!row) {
    if (requestedId) {
      const any = await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.id, requestedId));
      if (!any[0]) return { ok: false as const, status: 404, error: "That order was not found." };
      return { ok: false as const, status: 409, error: "That order is no longer queued." };
    }
    return { ok: false as const, status: 404, error: "No queued orders." };
  }
  const claimedAt = nowIso();
  await db.update(fulfillmentOrders).set({ status: "in_progress", claimedAt }).where(and(eq(fulfillmentOrders.id, row.id), eq(fulfillmentOrders.status, "queued")));
  const after = (await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.id, row.id)))[0];
  if (!after || after.status !== "in_progress" || after.claimedAt !== claimedAt) {
    return { ok: false as const, status: 409, error: "That order is no longer queued." };
  }
  const names = await creatorNames(db);
  return { ok: true as const, order: toView(after, names) };
}

function deliveryLink(value: unknown) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > 2000) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function deliveryFile(filename: unknown, body: unknown) {
  if (typeof filename !== "string" || typeof body !== "string") return null;
  const name = filename.trim().replace(/[/\\]/g, "");
  if (!name || name.length > 120 || !body.trim()) return null;
  if (body.length > FILE_LIMIT) return { error: "That file is too large." as const };
  return { filename: name, body };
}

export async function deliverFulfillmentOrder(db: PortalDb, id: string, input: { url?: unknown; filename?: unknown; body?: unknown }) {
  if (!paymentsEnabled()) return OFF;
  const row = (await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.id, id)))[0];
  if (!row) return { ok: false as const, status: 404, error: "That order was not found." };
  const names = await creatorNames(db);
  if (row.status === "delivered") return { ok: true as const, duplicate: true, order: toView(row, names) };
  if (row.status !== "in_progress") return { ok: false as const, status: 409, error: "Claim the order before delivering it." };
  const link = deliveryLink(input.url);
  const file = deliveryFile(input.filename, input.body);
  if (file && "error" in file) return { ok: false as const, status: 400, error: file.error };
  if (!link && !file) return { ok: false as const, status: 400, error: "Add a file or a link." };
  const creator = await findCreatorById(db, row.creatorId);
  const creatorName = creator?.name ?? names.get(row.creatorId) ?? row.creatorId;
  const deliveredBody = file
    ? brandedDelivery(row.product, { creatorName, body: file.body })
    : stampBranding("");
  if (!deliveryCarriesBranding(deliveredBody)) {
    return { ok: false as const, status: 500, error: "The delivery is missing Momma Mari branding." };
  }
  const deliveredAt = nowIso();
  await db.update(fulfillmentOrders).set({
    status: "delivered",
    deliveredAt,
    deliveryUrl: link,
    deliveryFilename: file ? file.filename : null,
    deliveryBody: deliveredBody,
  }).where(and(eq(fulfillmentOrders.id, row.id), eq(fulfillmentOrders.status, "in_progress")));
  const after = (await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.id, row.id)))[0];
  if (!after || after.status !== "delivered" || after.deliveredAt !== deliveredAt) {
    return { ok: false as const, status: 409, error: "That order was already delivered." };
  }
  return { ok: true as const, duplicate: false, order: toView(after, names) };
}
