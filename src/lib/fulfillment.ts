import { and, asc, eq, gt } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorNotifications, dealStageEvents, deals, livePosts, offerScreenings, payments, revisions, shipments } from "@/db/schema";
import { createApprovalEmail, BRAND_EMAIL_SENDER } from "./approvals";
import { creatorFilmingBlocked } from "./brand-deposits";
import { upsertBrandCrm } from "./brand-crm";
import { setDealStage } from "./deal-stage";
import { AGENCY_COMMISSION_PERCENT, CREATOR_PAYOUT_PERCENT, commissionLabel, feeAndPayout, nowIso } from "./format";
import { firstEmail } from "./creator-interest";
import { assertStaffAccess, assignedManagersByCreator, notifyStaff, staffHistoryRole } from "./managers";
import { getDealStage } from "./stages";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const POST_PLATFORMS = ["tiktok", "instagram", "facebook", "youtube"] as const;
export type PostPlatform = (typeof POST_PLATFORMS)[number];

export const PAYMENT_STATUSES = ["brand_invoiced", "brand_paid", "creator_payout_pending", "creator_paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_ORDER: PaymentStatus[] = ["brand_invoiced", "brand_paid", "creator_payout_pending", "creator_paid"];

const SKIP_MESSAGE: Record<Exclude<PaymentStatus, "brand_invoiced">, string> = {
  brand_paid: "Mark the brand invoice before marking the brand paid.",
  creator_payout_pending: "Mark the brand paid before marking the creator payout pending.",
  creator_paid: "Mark the creator payout pending before marking the creator paid.",
};

const PAYMENT_ERROR_TEXT = {
  early: "Post the video before invoicing the brand. Nothing was changed.",
  paid: "This deal is already paid. Nothing was changed.",
  marked: "That payment step is already marked.",
  invoice: "Mark the brand invoice before marking the brand paid.",
  brand: "Mark the brand paid before marking the creator payout pending.",
  payout: "Mark the creator payout pending before marking the creator paid.",
  step: "That is not a payment step.",
} as const;

/** A short code for the payment form. Unknown wording stays the fixed fallback. */
export function paymentErrorCode(error: string) {
  const match = (Object.keys(PAYMENT_ERROR_TEXT) as (keyof typeof PAYMENT_ERROR_TEXT)[])
    .find((code) => PAYMENT_ERROR_TEXT[code] === error);
  return match ?? "1";
}

const POST_ERROR_TEXT = {
  link: "Add at least one live post link.",
  platform: "Platform must be TikTok, Instagram, Facebook, or YouTube.",
  url: "Each post link has to start with http:// or https://.",
  early: "This video isn't approved for posting yet. Nothing was changed.",
  email: "Add the brand email before the post links can be queued.",
  missing: "Deal not found.",
  gone: "Post not found.",
  own: "You can't update this deal.",
} as const;

/** A short code for a live post. Unknown wording stays the fixed fallback. */
export function postErrorCode(error: string) {
  const match = (Object.keys(POST_ERROR_TEXT) as (keyof typeof POST_ERROR_TEXT)[])
    .find((code) => POST_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** The sentence for a known post code. Unknown codes and "1" stay null so the page keeps its own fallback. */
export function postErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  if (code in POST_ERROR_TEXT) return POST_ERROR_TEXT[code as keyof typeof POST_ERROR_TEXT];
  return null;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isPostPlatform(value: string): value is PostPlatform {
  return (POST_PLATFORMS as readonly string[]).includes(value);
}

export function trackingUrl(carrier: string, trackingNumber: string) {
  const key = carrier.trim().toLowerCase();
  const number = encodeURIComponent(trackingNumber.trim());
  if (key.includes("ups")) return `https://www.ups.com/track?tracknum=${number}`;
  if (key.includes("usps") || key.includes("postal")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
  if (key.includes("fedex") || key.includes("fed ex")) return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
  if (key.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${number}`;
  return null;
}

export function shipmentStatusLabel(status: string) {
  return status === "delivered" ? "Received" : "On the way";
}

function today() {
  return nowIso().slice(0, 10);
}

async function recordTouch(
  db: PortalDb,
  deal: { id: string; workflowStage: string | null; brand: string },
  actor: { email: string; role: string },
  note: string,
  summary: string,
) {
  const timestamp = nowIso();
  await db.insert(dealStageEvents).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    fromStage: deal.workflowStage,
    toStage: deal.workflowStage ?? "",
    actorEmail: actor.email,
    actorRole: actor.role,
    note,
    createdAt: timestamp,
  });
  const prior = await db.select().from(revisions).where(eq(revisions.dealId, deal.id));
  const sortOrder = prior.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    draftId: null,
    occurredLabel: timestamp.slice(0, 16).replace("T", " "),
    occurredAt: timestamp,
    source: "us",
    summary,
    emailUrl: null,
    sortOrder,
    isSeed: false,
    createdAt: timestamp,
  });
}

async function notifyCreator(db: PortalDb, input: { creatorId: string; dealId: string; kind: string; message: string }) {
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: input.creatorId,
    dealId: input.dealId,
    kind: input.kind,
    message: input.message,
    createdAt: nowIso(),
    readAt: null,
  });
}

async function staffOrBot(
  db: PortalDb,
  dealCreatorId: string,
  actor: { email: string; role: string },
) {
  if (actor.role === "admin" || actor.role === "bot" || actor.role === "system") return { ok: true as const };
  if (actor.role === "manager") {
    return assertStaffAccess(db, {
      actorEmail: actor.email,
      actorRole: "manager",
      creatorId: dealCreatorId,
      permission: "stage",
    });
  }
  return { ok: false as const, status: 403, error: "You can't update this deal." };
}

export async function saveShipment(
  db: PortalDb,
  input: { dealId: string; carrier: string; trackingNumber: string; actorEmail: string; actorRole: string },
): Promise<Result<{ id: string; workflowStage: string | null }>> {
  const carrier = clean(input.carrier);
  const trackingNumber = clean(input.trackingNumber);
  if (!carrier || !trackingNumber) return { ok: false, status: 400, error: "Carrier and tracking number are required." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (input.actorRole === "creator") return { ok: false, status: 403, error: "You can't add tracking." };
  const allowed = await staffOrBot(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
  if (!allowed.ok) return allowed;

  const timestamp = nowIso();
  const existing = await db.select().from(shipments).where(eq(shipments.dealId, deal.id));
  const id = existing[0]?.id ?? crypto.randomUUID();
  const stageOrder = getDealStage(deal.workflowStage)?.order ?? null;
  const keepDelivered = existing[0]?.status === "delivered" && stageOrder != null && stageOrder > 13;
  const status = keepDelivered ? "delivered" : "in_transit";
  if (existing[0]) {
    await db.update(shipments).set({
      carrier,
      trackingNumber,
      status,
      updatedAt: timestamp,
    }).where(eq(shipments.id, existing[0].id));
  } else {
    await db.insert(shipments).values({
      id,
      dealId: deal.id,
      carrier,
      trackingNumber,
      status: "in_transit",
      createdAt: timestamp,
      updatedAt: timestamp,
      receivedAt: null,
    });
  }

  const stage = getDealStage(deal.workflowStage);
  const order = stage?.order ?? null;
  let workflowStage = deal.workflowStage;
  if (order != null && order < 13) {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "waiting_for_product",
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      note: `Tracking: ${carrier} ${trackingNumber}`,
    });
    if (!moved.ok) return moved;
    workflowStage = moved.workflowStage;
  } else {
    await recordTouch(
      db,
      deal,
      { email: input.actorEmail, role: input.actorRole },
      `Tracking: ${carrier} ${trackingNumber}`,
      `Tracking updated for ${deal.brand}.`,
    );
  }

  await notifyCreator(db, {
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "product_shipped",
    message: `Your product from ${deal.brand} is on the way.`,
  });
  await notifyStaff(db, {
    kind: "product_shipped",
    creatorId: deal.creatorId,
    message: `Product tracking for ${deal.brand}: ${carrier} ${trackingNumber}.`,
  });
  return { ok: true, id, workflowStage };
}

export async function confirmProductReceived(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; actorRole: string; creatorId?: string | null },
): Promise<Result<{ workflowStage: string }>> {
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const owns = input.actorRole === "creator" && input.creatorId === deal.creatorId;
  if (!owns) {
    const allowed = await staffOrBot(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
    if (!allowed.ok) return allowed;
  }
  const filming = await creatorFilmingBlocked(db, deal.id, input.actorRole);
  if (filming) return filming;
  if (deal.workflowStage !== "waiting_for_product") {
    return { ok: false, status: 409, error: "This deal is already past the product. Nothing was changed." };
  }

  const received = await setDealStage(db, {
    dealId: deal.id,
    toStage: "product_received",
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    creatorId: input.creatorId,
    note: "Product received.",
  });
  if (!received.ok) return received;
  const due = await setDealStage(db, {
    dealId: deal.id,
    toStage: "draft_due",
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    creatorId: input.creatorId,
    note: "Draft is due.",
  });
  if (!due.ok) return due;

  const timestamp = nowIso();
  await db.update(deals).set({
    uploadEnabled: true,
    uploadLabel: deal.uploadLabel?.trim() ? deal.uploadLabel : "Upload your draft",
    needsCreator: true,
    updatedAt: timestamp,
  }).where(eq(deals.id, deal.id));
  const shipment = await db.select().from(shipments).where(eq(shipments.dealId, deal.id));
  if (shipment[0]) {
    await db.update(shipments).set({ status: "delivered", receivedAt: timestamp, updatedAt: timestamp }).where(eq(shipments.id, shipment[0].id));
  }
  await notifyCreator(db, {
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "draft_due",
    message: `Got the product from ${deal.brand}. Your draft is due.`,
  });
  await notifyStaff(db, {
    kind: "product_received",
    creatorId: deal.creatorId,
    message: `Product received for ${deal.brand}. The draft is due.`,
  });
  return { ok: true, workflowStage: "draft_due" };
}

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function submitLivePosts(
  db: PortalDb,
  input: {
    dealId: string;
    links: { platform: string; url: string }[];
    actorEmail: string;
    actorRole: string;
    creatorId?: string | null;
  },
): Promise<Result<{ workflowStage: string | null }>> {
  const links = input.links
    .map((link) => ({ platform: link.platform.trim().toLowerCase(), url: link.url.trim() }))
    .filter((link) => link.platform || link.url);
  if (links.length === 0) return { ok: false, status: 400, error: "Add at least one live post link." };
  for (const link of links) {
    if (!isPostPlatform(link.platform)) return { ok: false, status: 400, error: "Platform must be TikTok, Instagram, Facebook, or YouTube." };
    if (!validUrl(link.url)) return { ok: false, status: 400, error: "Each post link has to start with http:// or https://." };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const owns = input.actorRole === "creator" && input.creatorId === deal.creatorId;
  if (!owns) {
    const allowed = await staffOrBot(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
    if (!allowed.ok) return allowed;
  }
  const order = getDealStage(deal.workflowStage)?.order ?? null;
  if (order == null || order < 20) {
    return { ok: false, status: 409, error: "This video isn't approved for posting yet. Nothing was changed." };
  }

  const timestamp = nowIso();
  const existing = await db.select().from(livePosts).where(eq(livePosts.dealId, deal.id));
  for (const link of links) {
    const current = existing.find((row) => row.platform === link.platform);
    if (current) {
      const same = current.url === link.url;
      await db.update(livePosts).set({
        url: link.url,
        meetsBrief: same ? current.meetsBrief : null,
        confirmedAt: same ? current.confirmedAt : null,
        confirmedBy: same ? current.confirmedBy : null,
        updatedAt: timestamp,
      }).where(eq(livePosts.id, current.id));
    } else {
      await db.insert(livePosts).values({
        id: crypto.randomUUID(),
        dealId: deal.id,
        platform: link.platform,
        url: link.url,
        meetsBrief: null,
        confirmedAt: null,
        confirmedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  let workflowStage = deal.workflowStage;
  if (deal.workflowStage === "brand_approved") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "scheduled_posted",
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      creatorId: input.creatorId,
      note: "Live post links submitted.",
    });
    if (!moved.ok) return moved;
    workflowStage = moved.workflowStage;
  } else {
    await recordTouch(
      db,
      deal,
      { email: input.actorEmail, role: input.actorRole },
      "Live post links updated.",
      `Live post links updated for ${deal.brand}.`,
    );
  }
  await notifyStaff(db, {
    kind: "live_post",
    creatorId: deal.creatorId,
    message: `Live post links are in for ${deal.brand}.`,
  });
  return { ok: true, workflowStage };
}

async function brandEmailFor(db: PortalDb, deal: { id: string; contact: string | null }) {
  const rows = await db.select().from(offerScreenings).where(eq(offerScreenings.dealId, deal.id));
  const saved = rows.map((row) => row.brandEmail).find((email) => Boolean(email));
  return firstEmail(saved) ?? firstEmail(deal.contact);
}

export async function confirmLivePost(
  db: PortalDb,
  input: {
    postId: string;
    meetsBrief: boolean;
    queueEmail: boolean;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ id: string; approvalId: string | null }>> {
  const rows = await db.select().from(livePosts).where(eq(livePosts.id, input.postId));
  const post = rows[0];
  if (!post) return { ok: false, status: 404, error: "Post not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, post.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const allowed = await staffOrBot(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
  if (!allowed.ok) return allowed;

  const timestamp = nowIso();
  await db.update(livePosts).set({
    meetsBrief: input.meetsBrief,
    confirmedAt: timestamp,
    confirmedBy: input.actorEmail,
    updatedAt: timestamp,
  }).where(eq(livePosts.id, post.id));
  await recordTouch(
    db,
    deal,
    { email: input.actorEmail, role: staffHistoryRole(input.actorRole) },
    input.meetsBrief ? "Live post matches the brief." : "Live post does not match the brief.",
    input.meetsBrief ? `The live post for ${deal.brand} matches the brief.` : `The live post for ${deal.brand} needs another look.`,
  );
  await notifyCreator(db, {
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "post_confirmed",
    message: input.meetsBrief
      ? `Your post for ${deal.brand} matches the brief.`
      : `Your post for ${deal.brand} needs another look.`,
  });

  if (!input.queueEmail || !input.meetsBrief) return { ok: true, id: post.id, approvalId: null };
  if (input.actorRole === "manager") {
    const emailOk = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "email",
    });
    if (!emailOk.ok) return emailOk;
  }
  const brandEmail = await brandEmailFor(db, deal);
  if (!brandEmail) return { ok: false, status: 400, error: "Add the brand email before the post links can be queued." };
  const siblings = await db.select().from(livePosts).where(eq(livePosts.dealId, deal.id));
  const lines = siblings.map((row) => `${row.platform}: ${row.id === post.id ? post.url : row.url}`);
  const queued = await createApprovalEmail(db, {
    dealId: deal.id,
    gate: "post_link",
    to: brandEmail,
    subject: `${deal.brand} is live`,
    body: `The post is live.\n\n${lines.join("\n")}`,
    from: BRAND_EMAIL_SENDER,
  }, { email: input.actorEmail, role: input.actorRole });
  if (!queued.ok) return queued;
  return { ok: true, id: post.id, approvalId: queued.id };
}

function nextPaymentStatus(current: string | null): PaymentStatus | null {
  if (!current) return "brand_invoiced";
  const index = PAYMENT_ORDER.indexOf(current as PaymentStatus);
  if (index < 0 || index === PAYMENT_ORDER.length - 1) return null;
  return PAYMENT_ORDER[index + 1];
}

export async function markPayment(
  db: PortalDb,
  input: { dealId: string; paymentStatus: string; actorEmail: string; actorRole: string },
): Promise<Result<{ paymentStatus: PaymentStatus; workflowStage: string | null }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can update payment." };
  if (!isPaymentStatus(input.paymentStatus)) {
    return { ok: false, status: 400, error: "That is not a payment step." };
  }
  const requested = input.paymentStatus;
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (deal.workflowStage === "paid") return { ok: false, status: 409, error: "This deal is already paid. Nothing was changed." };
  const order = getDealStage(deal.workflowStage)?.order ?? null;
  if (order == null || order < 21) {
    return { ok: false, status: 409, error: "Post the video before invoicing the brand. Nothing was changed." };
  }

  const existing = await db.select().from(payments).where(eq(payments.dealId, deal.id));
  const current = existing[0];
  const currentStatus = current?.paymentStatus ?? null;
  if (currentStatus === "creator_paid") return { ok: false, status: 409, error: "This deal is already paid. Nothing was changed." };
  const expected = nextPaymentStatus(currentStatus);
  if (requested === currentStatus || (currentStatus && PAYMENT_ORDER.indexOf(requested) < PAYMENT_ORDER.indexOf(currentStatus as PaymentStatus))) {
    return { ok: false, status: 400, error: "That payment step is already marked." };
  }
  if (requested !== expected) {
    return { ok: false, status: 400, error: SKIP_MESSAGE[requested as Exclude<PaymentStatus, "brand_invoiced">] };
  }

  const timestamp = nowIso();
  const date = today();
  const amountOwedCents = current?.amountOwedCents ?? deal.rateCents ?? null;
  let landedAmountCents = current?.landedAmountCents ?? null;
  let landedDate = current?.landedDate ?? null;
  let payoutApprovedOn = current?.payoutApprovedOn ?? null;
  let paidOutDate = current?.paidOutDate ?? null;
  if (requested === "brand_paid") {
    landedDate = date;
    if (landedAmountCents == null && amountOwedCents != null) landedAmountCents = amountOwedCents;
  }
  if (requested === "creator_payout_pending") payoutApprovedOn = date;
  if (requested === "creator_paid") paidOutDate = date;
  const basis = landedAmountCents ?? amountOwedCents;
  const share = feeAndPayout(basis);
  const creatorPayoutCents = share.payoutCents ?? current?.creatorPayoutCents ?? null;
  const row = {
    dealId: deal.id,
    amountOwedCents,
    amountLabel: current?.amountLabel ?? null,
    dueDate: current?.dueDate ?? null,
    dueLabel: current?.dueLabel ?? null,
    landedDate,
    landedAmountCents,
    creatorSplitPercent: CREATOR_PAYOUT_PERCENT,
    agencySplitPercent: AGENCY_COMMISSION_PERCENT,
    creatorPayoutCents,
    payoutApprovedOn,
    paidOutDate,
    paymentStatus: requested,
    updatedAt: timestamp,
  };
  if (current) await db.update(payments).set(row).where(eq(payments.id, current.id));
  else {
    await db.insert(payments).values({
      ...row,
      id: `pay-${deal.id}`,
      isSeed: false,
      createdAt: timestamp,
    });
  }

  let workflowStage = deal.workflowStage;
  if (requested === "brand_invoiced" && deal.workflowStage !== "payment_pending") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "payment_pending",
      actorEmail: input.actorEmail,
      actorRole: "admin",
      note: "Brand invoiced.",
    });
    if (!moved.ok) return moved;
    workflowStage = moved.workflowStage;
  } else if (requested === "creator_paid") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "paid",
      actorEmail: input.actorEmail,
      actorRole: "admin",
      note: "Creator paid.",
    });
    if (!moved.ok) return moved;
    workflowStage = moved.workflowStage;
  } else if (requested !== "brand_invoiced") {
    const fresh = await db.select().from(deals).where(eq(deals.id, deal.id));
    await recordTouch(db, fresh[0] ?? deal, { email: input.actorEmail, role: "admin" }, `Payment: ${requested}.`, `Payment updated for ${deal.brand}.`);
  }

  const creatorMessage: Record<PaymentStatus, string> = {
    brand_invoiced: `The brand was invoiced for ${deal.brand}.`,
    brand_paid: `The brand paid Momma Mari for ${deal.brand}.`,
    creator_payout_pending: `Your payout for ${deal.brand} is pending.`,
    creator_paid: `You were paid for ${deal.brand}.`,
  };
  const staffMessage: Record<PaymentStatus, string> = {
    brand_invoiced: `Brand invoiced for ${deal.brand}.`,
    brand_paid: `Brand paid for ${deal.brand}.`,
    creator_payout_pending: `Creator payout pending for ${deal.brand}.`,
    creator_paid: `Creator paid for ${deal.brand}.`,
  };
  await notifyCreator(db, { creatorId: deal.creatorId, dealId: deal.id, kind: "payment", message: creatorMessage[requested] });
  await notifyStaff(db, { kind: "payment", creatorId: deal.creatorId, message: staffMessage[requested] });
  if (requested === "creator_paid") {
    await upsertBrandCrm(db, {
      brand: deal.brand,
      creatorId: deal.creatorId,
      ratePaidCents: landedAmountCents ?? deal.rateCents,
      outcome: "closed",
      nextFollowUp: null,
      actorName: input.actorEmail,
      note: "Closed deal.",
    });
  }
  return { ok: true, paymentStatus: requested, workflowStage };
}

type ManagerRef = { id: string; name: string; email: string } | null;

async function dealContext(db: PortalDb, dealIds: string[]) {
  if (dealIds.length === 0) return { deals: new Map<string, { brand: string; creatorId: string }>(), managers: new Map<string, ManagerRef>() };
  const [dealRows, managers] = await Promise.all([
    db.select({ id: deals.id, brand: deals.brand, creatorId: deals.creatorId }).from(deals),
    assignedManagersByCreator(db),
  ]);
  return {
    deals: new Map(dealRows.map((row) => [row.id, { brand: row.brand, creatorId: row.creatorId }])),
    managers,
  };
}

export async function listShipmentsSince(db: PortalDb, since: string | null) {
  const filters = since ? [gt(shipments.updatedAt, since)] : [];
  const rows = await db.select().from(shipments).where(filters.length ? and(...filters) : undefined).orderBy(asc(shipments.updatedAt));
  const context = await dealContext(db, rows.map((row) => row.dealId));
  return rows.map((row) => {
    const deal = context.deals.get(row.dealId);
    return {
      id: row.id,
      dealId: row.dealId,
      brand: deal?.brand ?? null,
      creatorId: deal?.creatorId ?? null,
      carrier: row.carrier,
      trackingNumber: row.trackingNumber,
      trackingUrl: trackingUrl(row.carrier, row.trackingNumber),
      status: row.status,
      updatedAt: row.updatedAt,
      manager: deal ? context.managers.get(deal.creatorId) ?? null : null,
    };
  });
}

export async function listLivePostsSince(db: PortalDb, since: string | null) {
  const filters = since ? [gt(livePosts.updatedAt, since)] : [];
  const rows = await db.select().from(livePosts).where(filters.length ? and(...filters) : undefined).orderBy(asc(livePosts.updatedAt));
  const context = await dealContext(db, rows.map((row) => row.dealId));
  return rows.map((row) => {
    const deal = context.deals.get(row.dealId);
    return {
      id: row.id,
      dealId: row.dealId,
      brand: deal?.brand ?? null,
      creatorId: deal?.creatorId ?? null,
      platform: row.platform,
      url: row.url,
      meetsBrief: row.meetsBrief,
      confirmedAt: row.confirmedAt,
      confirmedBy: row.confirmedBy,
      updatedAt: row.updatedAt,
      manager: deal ? context.managers.get(deal.creatorId) ?? null : null,
    };
  });
}

export async function listPaymentsSince(db: PortalDb, since: string | null) {
  const filters = since ? [gt(payments.updatedAt, since)] : [];
  const rows = await db.select().from(payments).where(filters.length ? and(...filters) : undefined).orderBy(asc(payments.updatedAt));
  const context = await dealContext(db, rows.map((row) => row.dealId));
  return rows.map((row) => {
    const deal = context.deals.get(row.dealId);
    const basis = row.landedAmountCents ?? row.amountOwedCents;
    const share = feeAndPayout(basis);
    return {
      id: row.id,
      dealId: row.dealId,
      brand: deal?.brand ?? null,
      creatorId: deal?.creatorId ?? null,
      paymentStatus: row.paymentStatus,
      amountOwedCents: row.amountOwedCents,
      landedAmountCents: row.landedAmountCents,
      creatorPayoutCents: share.payoutCents ?? row.creatorPayoutCents,
      commissionPercent: AGENCY_COMMISSION_PERCENT,
      commissionCents: share.feeCents,
      commissionLabel: commissionLabel(basis),
      payoutApprovedOn: row.payoutApprovedOn,
      paidOutDate: row.paidOutDate,
      updatedAt: row.updatedAt,
      manager: deal ? context.managers.get(deal.creatorId) ?? null : null,
    };
  });
}
