import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorAccounts, creatorPurchases, stripeWebhookEvents } from "@/db/schema";
import { blankCreatorAccount } from "./creator-home";
import { appBaseUrl, formatMoney, nowIso, publicBasePath } from "./format";
import { queueFulfillmentOrder } from "./fulfillment-orders";
import {
  BILLING_PORTAL_FALLBACK_URL,
  findOfferPrice,
  isSubscriptionPlan,
  memberCouponId,
  memberOneTimePercent,
  memberPriceCents,
  memberServiceIncluded,
  offerForPriceId,
  paymentsEnabled,
  type BillingInterval,
  type SubscriptionPlanId,
} from "./payments-config";
import { findCreatorByEmail, findCreatorById } from "./queries";

export { paymentsEnabled };

const SIGNATURE_TOLERANCE_SECONDS = 300;

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export type CheckoutResult =
  | { ok: true; url: string; calledStripe: boolean }
  | { ok: false; status: number; error: string; calledStripe: boolean };

export type PortalSessionResult = { url: string; calledStripe: boolean };

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  object: Record<string, unknown>;
};

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function redact(message: string, secret: string) {
  const cleaned = secret ? message.split(secret).join("[redacted]") : message;
  return cleaned.slice(0, 200);
}

/** Public portal root. Production APP_BASE_URL is https://mommamari.com/portal. */
export function portalRoot(base = appBaseUrl()) {
  const url = new URL(base.replace(/\/$/, ""));
  const path = url.pathname.replace(/\/$/, "");
  if (path && path !== "/") return `${url.origin}${path}`;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    const mount = publicBasePath();
    return mount ? `${url.origin}${mount}` : url.origin;
  }
  return `${url.origin}/portal`;
}

export function checkoutReturnUrls(base = appBaseUrl()) {
  const root = portalRoot(base);
  return {
    successUrl: `${root}?checkout=success`,
    cancelUrl: root,
  };
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

export function subscriptionSummary(input: { plan: string | null; interval: string | null; status: string | null }) {
  if (!input.plan && !input.status) return null;
  const matched = input.plan ? findOfferPrice(input.plan, input.interval === "year" ? "year" : "month") : null;
  const name = matched?.offer.name ?? (input.plan ? input.plan : "Plan");
  const period = input.interval === "year" ? "Yearly" : input.interval === "month" ? "Monthly" : null;
  const status = input.status ? STATUS_LABELS[input.status] ?? input.status : "Waiting for Stripe";
  return [name, period, status].filter(Boolean).join(" · ");
}

export function oneTimePriceNote(label: string, amountCents: number, percentOff: number) {
  if (memberServiceIncluded(percentOff)) return "Included with your plan. Nothing is charged.";
  if (percentOff > 0) return `${label} list. You pay ${formatMoney(memberPriceCents(amountCents, percentOff))}.`;
  return label;
}

export function checkoutStatusNote(code: string | undefined) {
  if (code === "success") return "Checkout finished. Your plan updates when Stripe confirms it. Nothing was emailed.";
  if (code === "included") return "Included with your plan. It is in the fulfillment queue. Nothing was charged.";
  if (code === "off") return "Payments are off. Nothing was charged.";
  if (code === "error") return "Checkout did not start. Nothing was charged.";
  if (code === "creator_only") return "Checkout starts from the creator's own sign-in.";
  return null;
}

type StripeJson = { id?: string; url?: string | null; error?: { message?: string; code?: string } };

async function stripeForm(path: string, params: URLSearchParams, fetchImpl: FetchLike): Promise<
  { ok: true; json: StripeJson; calledStripe: true } | { ok: false; status: number; error: string; json: StripeJson | null; calledStripe: boolean }
> {
  const secret = stripeSecret();
  if (!paymentsEnabled() || !secret) {
    return { ok: false, status: 503, error: "Payments are off. Nothing was charged.", json: null, calledStripe: false };
  }
  let response: Response;
  try {
    response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch {
    return { ok: false, status: 502, error: "Stripe did not respond. Nothing was charged.", json: null, calledStripe: true };
  }
  const json = await response.json().catch(() => null) as StripeJson | null;
  if (!response.ok || !json?.id) {
    const detail = json?.error?.message?.trim() || "Stripe did not accept that request.";
    return { ok: false, status: response.ok ? 502 : response.status, error: redact(detail, secret), json, calledStripe: true };
  }
  return { ok: true, json, calledStripe: true };
}

async function stripePost(path: string, params: URLSearchParams, fetchImpl: FetchLike): Promise<CheckoutResult> {
  const result = await stripeForm(path, params, fetchImpl);
  if (!result.ok) return { ok: false, status: result.status, error: result.error, calledStripe: result.calledStripe };
  if (!result.json.url) return { ok: false, status: 502, error: "Stripe did not start that session.", calledStripe: true };
  return { ok: true, url: result.json.url, calledStripe: true };
}

async function ensureMemberCoupon(plan: SubscriptionPlanId, percentOff: number, fetchImpl: FetchLike) {
  const name = findOfferPrice(plan, "month")?.offer.name ?? plan;
  const params = new URLSearchParams();
  params.set("id", memberCouponId(plan, percentOff));
  params.set("percent_off", String(percentOff));
  params.set("duration", "forever");
  params.set("name", `${name} member ${percentOff} percent off one-time services`);
  const result = await stripeForm("coupons", params, fetchImpl);
  if (result.ok) return { ok: true as const, calledStripe: true as const };
  const code = result.json?.error?.code ?? "";
  if (code === "resource_already_exists" || /already exists/i.test(result.error)) {
    return { ok: true as const, calledStripe: true as const };
  }
  return { ok: false as const, status: result.status, error: result.error, calledStripe: result.calledStripe };
}

const PAYMENTS_OFF = { ok: false as const, status: 503, error: "Payments are off. Nothing was charged.", calledStripe: false as const };

export async function createCheckoutSession(
  input: {
    offerId: string;
    interval: string;
    email: string;
    creatorId: string;
    customerId?: string | null;
    memberPlan?: string | null;
    memberStatus?: string | null;
  },
  fetchImpl: FetchLike = fetch,
): Promise<CheckoutResult> {
  if (!paymentsEnabled() || !stripeSecret()) return PAYMENTS_OFF;
  const selected = findOfferPrice(input.offerId, input.interval);
  const email = input.email.trim();
  const creatorId = input.creatorId.trim();
  if (!selected || !creatorId) {
    return { ok: false, status: 400, error: "That plan is not available.", calledStripe: false };
  }
  if (!email.includes("@")) {
    return { ok: false, status: 400, error: "A creator email is required.", calledStripe: false };
  }
  const { offer, price } = selected;
  const percentOff = offer.kind === "one_time" ? memberOneTimePercent(input.memberPlan, input.memberStatus) : 0;
  if (offer.kind === "one_time" && memberServiceIncluded(percentOff)) {
    return { ok: false, status: 400, error: "That service is included with the plan. It does not go through Checkout.", calledStripe: false };
  }
  const urls = checkoutReturnUrls();
  const customerId = input.customerId?.trim() ?? "";
  const params = new URLSearchParams();
  params.set("mode", offer.kind === "subscription" ? "subscription" : "payment");
  params.set("success_url", urls.successUrl);
  params.set("cancel_url", urls.cancelUrl);
  params.set("client_reference_id", creatorId);
  params.set("line_items[0][price]", price.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[creator_id]", creatorId);
  params.set("metadata[offer]", offer.id);
  params.set("metadata[interval]", price.interval);
  params.set("metadata[price_id]", price.priceId);
  if (percentOff > 0 && isSubscriptionPlan(input.memberPlan)) {
    const coupon = await ensureMemberCoupon(input.memberPlan, percentOff, fetchImpl);
    if (!coupon.ok) return { ok: false, status: coupon.status, error: coupon.error, calledStripe: coupon.calledStripe };
    params.set("discounts[0][coupon]", memberCouponId(input.memberPlan, percentOff));
    params.set("metadata[member_percent]", String(percentOff));
  }
  if (offer.kind === "subscription" && isSubscriptionPlan(offer.id)) {
    params.set("metadata[plan]", offer.id);
    params.set("subscription_data[metadata][creator_id]", creatorId);
    params.set("subscription_data[metadata][plan]", offer.id);
    params.set("subscription_data[metadata][interval]", price.interval);
    params.set("subscription_data[metadata][offer]", offer.id);
    params.set("subscription_data[metadata][price_id]", price.priceId);
  }
  if (customerId) {
    params.set("customer", customerId);
  } else {
    params.set("customer_email", email);
    if (offer.kind === "one_time") params.set("customer_creation", "always");
  }
  return stripePost("checkout/sessions", params, fetchImpl);
}

async function grantIncludedService(
  db: PortalDb,
  input: { offerId: string; priceId: string; creatorId: string },
): Promise<CheckoutResult> {
  if (!paymentsEnabled()) return PAYMENTS_OFF;
  const purchaseId = `included_${crypto.randomUUID()}`;
  await db.insert(creatorPurchases).values({
    id: purchaseId,
    creatorId: input.creatorId,
    offerId: input.offerId,
    priceId: input.priceId,
    amountCents: 0,
    createdAt: nowIso(),
  });
  const queued = await queueFulfillmentOrder(db, {
    purchaseId,
    creatorId: input.creatorId,
    product: input.offerId,
  });
  if (!queued.queued) return PAYMENTS_OFF;
  return { ok: true, url: "/billing?checkout=included", calledStripe: false };
}

export async function beginCreatorCheckout(
  db: PortalDb,
  input: {
    offerId: string;
    interval: string;
    email: string;
    creatorId: string;
    customerId?: string | null;
    memberPlan?: string | null;
    memberStatus?: string | null;
  },
  fetchImpl: FetchLike = fetch,
): Promise<CheckoutResult> {
  if (!paymentsEnabled()) return PAYMENTS_OFF;
  const selected = findOfferPrice(input.offerId, input.interval);
  if (!selected || !input.creatorId.trim()) return { ok: false, status: 400, error: "That plan is not available.", calledStripe: false };
  const percentOff = selected.offer.kind === "one_time" ? memberOneTimePercent(input.memberPlan, input.memberStatus) : 0;
  if (selected.offer.kind === "one_time" && memberServiceIncluded(percentOff)) {
    return grantIncludedService(db, {
      offerId: selected.offer.id,
      priceId: selected.price.priceId,
      creatorId: input.creatorId.trim(),
    });
  }
  return createCheckoutSession(input, fetchImpl);
}

export async function createBillingPortalSession(
  input: { customerId: string | null | undefined },
  fetchImpl: FetchLike = fetch,
): Promise<PortalSessionResult> {
  const customerId = input.customerId?.trim() ?? "";
  if (!paymentsEnabled() || !stripeSecret() || !customerId) {
    return { url: BILLING_PORTAL_FALLBACK_URL, calledStripe: false };
  }
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", `${portalRoot()}/billing`);
  const result = await stripePost("billing_portal/sessions", params, fetchImpl);
  if (!result.ok) return { url: BILLING_PORTAL_FALLBACK_URL, calledStripe: result.calledStripe };
  return { url: result.url, calledStripe: true };
}

export function signStripePayload(payload: string, secret: string, timestamp: number) {
  const hex = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${hex}`;
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const key = secret.trim();
  if (!key || !header) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eqAt = part.indexOf("=");
    if (eqAt === -1) continue;
    const name = part.slice(0, eqAt).trim();
    const value = part.slice(eqAt + 1).trim();
    if (name === "t") {
      const parsed = Number(value);
      timestamp = Number.isFinite(parsed) ? parsed : null;
    }
    if (name === "v1" && value) signatures.push(value);
  }
  if (timestamp == null || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", key).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const actual = Buffer.from(signature, "utf8");
    if (actual.length !== expectedBuf.length) return false;
    return timingSafeEqual(actual, expectedBuf);
  });
}

function stripeId(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function metadataString(object: Record<string, unknown>, key: string) {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseStripeEvent(raw: unknown): StripeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as { id?: unknown; type?: unknown; created?: unknown; data?: { object?: unknown } };
  if (typeof event.id !== "string" || !event.id.trim()) return null;
  if (typeof event.type !== "string" || !event.type.trim()) return null;
  if (typeof event.created !== "number" || !Number.isFinite(event.created)) return null;
  if (!event.data?.object || typeof event.data.object !== "object") return null;
  return {
    id: event.id.trim(),
    type: event.type.trim(),
    created: event.created,
    object: event.data.object as Record<string, unknown>,
  };
}

function isUniqueError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

async function ensureAccount(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, creatorId));
  if (rows[0]) return rows[0];
  const created = blankCreatorAccount(creatorId);
  try {
    await db.insert(creatorAccounts).values(created);
    return created;
  } catch (error) {
    const again = await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, creatorId));
    if (again[0]) return again[0];
    throw error;
  }
}

async function resolveCreator(db: PortalDb, input: { explicit: string | null; customerId: string | null; email: string | null }) {
  if (input.explicit) {
    const creator = await findCreatorById(db, input.explicit);
    return creator?.id ?? null;
  }
  if (input.customerId) {
    const rows = await db.select({ creatorId: creatorAccounts.creatorId }).from(creatorAccounts).where(eq(creatorAccounts.stripeCustomerId, input.customerId));
    if (rows[0]) return rows[0].creatorId;
  }
  if (input.email) {
    const creator = await findCreatorByEmail(db, input.email);
    return creator?.id ?? null;
  }
  return null;
}

function priceIdFromSubscription(object: Record<string, unknown>) {
  const items = object.items;
  if (!items || typeof items !== "object") return null;
  const data = (items as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return null;
  const price = (data[0] as { price?: unknown }).price;
  return stripeId(price);
}

function asPlan(value: string | null): SubscriptionPlanId | null {
  return isSubscriptionPlan(value) ? value : null;
}

function asInterval(value: string | null): BillingInterval | null {
  return value === "month" || value === "year" ? value : null;
}

async function applySubscription(db: PortalDb, event: StripeEvent) {
  const customerId = stripeId(event.object.customer);
  const subscriptionId = stripeId(event.object.id);
  const explicit = metadataString(event.object, "creator_id");
  const creatorId = await resolveCreator(db, { explicit, customerId, email: null });
  if (!creatorId) return;
  const row = await ensureAccount(db, creatorId);
  const matched = offerForPriceId(priceIdFromSubscription(event.object) ?? "");
  const plan = matched?.offer.kind === "subscription" ? asPlan(matched.offer.id) : asPlan(metadataString(event.object, "plan"));
  const interval = matched?.price.interval === "month" || matched?.price.interval === "year"
    ? matched.price.interval
    : asInterval(metadataString(event.object, "interval"));
  const reported = typeof event.object.status === "string" ? event.object.status : null;
  const status = event.type === "customer.subscription.deleted" ? (reported || "canceled") : reported;
  const patch: Partial<typeof creatorAccounts.$inferInsert> = { updatedAt: nowIso() };
  if (customerId && !row.stripeCustomerId) patch.stripeCustomerId = customerId;
  const newer = row.subscriptionEventAt == null || event.created >= row.subscriptionEventAt;
  if (newer) {
    if (status) patch.subscriptionStatus = status;
    if (plan) patch.subscriptionPlan = plan;
    if (interval) patch.subscriptionInterval = interval;
    if (subscriptionId) patch.stripeSubscriptionId = subscriptionId;
    patch.subscriptionEventAt = event.created;
  }
  await db.update(creatorAccounts).set(patch).where(eq(creatorAccounts.creatorId, creatorId));
}

async function applyCheckout(db: PortalDb, event: StripeEvent) {
  const mode = event.object.mode === "subscription" || event.object.mode === "payment" ? event.object.mode : null;
  const customerId = stripeId(event.object.customer);
  const subscriptionId = stripeId(event.object.subscription);
  const email = typeof event.object.customer_email === "string"
    ? event.object.customer_email
    : typeof (event.object.customer_details as { email?: unknown } | undefined)?.email === "string"
      ? (event.object.customer_details as { email: string }).email
      : null;
  const explicit = metadataString(event.object, "creator_id")
    ?? (typeof event.object.client_reference_id === "string" ? event.object.client_reference_id : null);
  const creatorId = await resolveCreator(db, { explicit, customerId, email });
  if (!creatorId) return;
  const row = await ensureAccount(db, creatorId);
  const patch: Partial<typeof creatorAccounts.$inferInsert> = { updatedAt: nowIso() };
  if (customerId && !row.stripeCustomerId) patch.stripeCustomerId = customerId;
  if (mode === "subscription" && row.subscriptionEventAt == null) {
    if (subscriptionId && !row.stripeSubscriptionId) patch.stripeSubscriptionId = subscriptionId;
    const plan = asPlan(metadataString(event.object, "plan"));
    const interval = asInterval(metadataString(event.object, "interval"));
    if (!row.subscriptionPlan && plan) patch.subscriptionPlan = plan;
    if (!row.subscriptionInterval && interval) patch.subscriptionInterval = interval;
  }
  if (Object.keys(patch).length > 1) {
    await db.update(creatorAccounts).set(patch).where(eq(creatorAccounts.creatorId, creatorId));
  }
  if (mode !== "payment") return;
  const sessionId = stripeId(event.object.id);
  if (!sessionId) return;
  const priceId = metadataString(event.object, "price_id") ?? "";
  const matched = priceId ? offerForPriceId(priceId) : null;
  const offerId = matched?.offer.id ?? metadataString(event.object, "offer") ?? "unknown";
  const reportedTotal = event.object.amount_total;
  const amountCents = typeof reportedTotal === "number" && Number.isInteger(reportedTotal) && reportedTotal >= 0
    ? reportedTotal
    : matched?.price.amountCents ?? 0;
  const existing = await db.select().from(creatorPurchases).where(eq(creatorPurchases.id, sessionId));
  if (!existing[0]) {
    try {
      await db.insert(creatorPurchases).values({
        id: sessionId,
        creatorId,
        offerId,
        priceId,
        amountCents,
        createdAt: nowIso(),
      });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
    }
  }
  const paid = event.type === "checkout.session.async_payment_succeeded" || event.object.payment_status === "paid";
  if (!paid) return;
  await queueFulfillmentOrder(db, {
    purchaseId: sessionId,
    creatorId,
    product: offerId,
    createdAt: new Date(event.created * 1000).toISOString(),
  });
}

export async function recordStripeEvent(db: PortalDb, raw: unknown) {
  const event = parseStripeEvent(raw);
  if (!event) return { ok: false as const, status: 400, error: "That Stripe event was not accepted." };
  const seen = await db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, event.id));
  if (seen[0]) return { ok: true as const, duplicate: true };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await applyCheckout(db, event);
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await applySubscription(db, event);
  }
  try {
    await db.insert(stripeWebhookEvents).values({ id: event.id, type: event.type, createdAt: nowIso() });
  } catch (error) {
    if (isUniqueError(error)) return { ok: true as const, duplicate: true };
    throw error;
  }
  return { ok: true as const, duplicate: false };
}

export async function handleStripeWebhook(request: Request, db: PortalDb, nowSeconds = Math.floor(Date.now() / 1000)) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return { status: 503, body: { error: "Stripe webhooks are not configured." } };
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret, nowSeconds)) {
    return { status: 400, body: { error: "That Stripe signature was not accepted." } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { status: 400, body: { error: "Expected JSON." } };
  }
  const result = await recordStripeEvent(db, parsed);
  if (!result.ok) return { status: result.status, body: { error: result.error } };
  return { status: 200, body: { received: true, duplicate: result.duplicate } };
}

export async function readCreatorBilling(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, creatorId));
  const row = rows[0];
  const purchases = await db.select().from(creatorPurchases).where(eq(creatorPurchases.creatorId, creatorId));
  return {
    stripeCustomerId: row?.stripeCustomerId ?? null,
    subscriptionPlan: row?.subscriptionPlan ?? null,
    subscriptionInterval: row?.subscriptionInterval ?? null,
    subscriptionStatus: row?.subscriptionStatus ?? null,
    summary: subscriptionSummary({
      plan: row?.subscriptionPlan ?? null,
      interval: row?.subscriptionInterval ?? null,
      status: row?.subscriptionStatus ?? null,
    }),
    purchases: purchases.map((purchase) => ({
      id: purchase.id,
      name: findOfferPrice(purchase.offerId, "one_time")?.offer.name ?? purchase.offerId,
    })),
  };
}
