import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, brandCrmEntries, creators, deals, payments, usageRenewalDrafts, usageRenewalFees, usageRights } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { isOwner } from "./authz";
import { generateDealInvoice } from "./brand-invoices";
import { brandKey } from "./brand-crm";
import { upsertPayment } from "./bot-api";
import { feeAndPayout, formatMoney, nowIso } from "./format";
import { recordPayoutLine, splitAfterDeductions } from "./payout-ledger";
import type { Viewer } from "./types";
import {
  RENEWAL_OFFER_DAYS,
  usageChannelsLabel,
  usageWindowStatus,
} from "./usage";

type Fail = { ok: false; status: number; error: string };

const WINDOW_NOTE = "Usage window ending ";

function emailIn(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

export function renewalWindowNote(endsOn: string) {
  return `${WINDOW_NOTE}${endsOn}`;
}

/** Owner-approval copy. It offers 30, 60, or 90 more days and never quotes a rate or a floor. */
export function renewalOfferDraft(input: {
  brand: string;
  creatorName: string;
  endsOn: string;
  channelsLabel: string;
  daysLeft: number;
}) {
  const when = input.daysLeft < 0 ? `ended on ${input.endsOn}` : `ends on ${input.endsOn}`;
  const channels = input.channelsLabel === "Not set" ? "the channels on the current license" : input.channelsLabel;
  const subject = `Extend usage for ${input.brand}`;
  const body = [
    "Hi,",
    "",
    `${input.creatorName}'s usage window for ${input.brand} ${when}. The channels covered are ${channels}.`,
    "",
    `This draft offers to extend that usage by another ${RENEWAL_OFFER_DAYS.join(", ")} days. It is waiting for the owner to approve. It has not been sent.`,
    "",
    "Momma Mari",
  ].join("\n");
  return { subject, body };
}

function draftLeaksRate(subject: string, body: string) {
  return /minimum|floor/i.test(`${subject}\n${body}`) || body.includes("$") || subject.includes("$");
}

async function brandEmail(db: PortalDb, deal: { brand: string; contact: string | null }) {
  const direct = emailIn(deal.contact);
  if (direct) return direct;
  const rows = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, brandKey(deal.brand)));
  for (const row of rows) {
    const email = emailIn(row.contactEmail);
    if (email) return email;
  }
  return null;
}

/**
 * Writes one pending approval per deal window. Pending drafts are not sendable.
 * Calling this again for the same end date does not add another draft.
 */
export async function queueUsageRenewalDrafts(db: PortalDb, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { created: 0, skipped: 0 };

  const [rights, dealRows, creatorRows, draftRows, approvalRows] = await Promise.all([
    db.select().from(usageRights),
    db.select().from(deals),
    db.select().from(creators),
    db.select().from(usageRenewalDrafts),
    db.select().from(approvalEmails),
  ]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorsById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const seen = new Set(draftRows.map((row) => `${row.dealId}:${row.windowEndsOn}`));
  for (const approval of approvalRows) {
    if (approval.gate === "usage_renewal" && approval.attachmentNote?.startsWith(WINDOW_NOTE)) {
      seen.add(`${approval.dealId}:${approval.attachmentNote.slice(WINDOW_NOTE.length)}`);
    }
  }

  let created = 0;
  let skipped = 0;
  for (const right of rights) {
    const window = usageWindowStatus(right.endsOn, today);
    if (!window || !right.endsOn) {
      skipped += 1;
      continue;
    }
    const key = `${right.dealId}:${right.endsOn}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    const deal = dealsById.get(right.dealId);
    if (!deal) {
      skipped += 1;
      continue;
    }
    const to = await brandEmail(db, deal);
    if (!to) {
      skipped += 1;
      continue;
    }
    const creatorName = creatorsById.get(deal.creatorId)?.name ?? "The creator";
    const copy = renewalOfferDraft({
      brand: deal.brand,
      creatorName,
      endsOn: right.endsOn,
      channelsLabel: usageChannelsLabel(right.channelsJson),
      daysLeft: window.daysLeft,
    });
    if (draftLeaksRate(copy.subject, copy.body)) {
      skipped += 1;
      continue;
    }
    const approval = await createApprovalEmail(db, {
      dealId: deal.id,
      gate: "usage_renewal",
      to,
      subject: copy.subject,
      body: copy.body,
      attachmentNote: renewalWindowNote(right.endsOn),
    }, { email: "portal", role: "bot" });
    if (!approval.ok || approval.status !== "pending") {
      skipped += 1;
      continue;
    }
    try {
      await db.insert(usageRenewalDrafts).values({
        id: crypto.randomUUID(),
        dealId: deal.id,
        windowEndsOn: right.endsOn,
        approvalId: approval.id,
        createdAt: nowIso(),
      });
    } catch {
      skipped += 1;
      seen.add(key);
      continue;
    }
    seen.add(key);
    created += 1;
  }
  return { created, skipped };
}

/**
 * Records a renewal fee with the same 80/20 split as other deal revenue.
 * It writes a payout line and, when the deal has no invoice yet, a draft invoice.
 * It does not charge a card or send mail.
 */
export async function bookUsageRenewalFee(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; amountCents: number },
): Promise<{ ok: true; booked: boolean; creatorCents: number; agencyCents: number; invoiceId: string | null } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can record a renewal fee." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, status: 400, error: "Enter a dollar amount." };
  }
  const share = feeAndPayout(input.amountCents);
  const split = splitAfterDeductions(input.amountCents, 0, 0);
  if (share.payoutCents == null || share.feeCents == null || !split.ok || split.creatorCents !== share.payoutCents || split.agencyCents !== share.feeCents) {
    return { ok: false, status: 400, error: "Enter a dollar amount." };
  }
  const found = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = found[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const rights = await db.select().from(usageRights).where(eq(usageRights.dealId, deal.id));
  const right = rights[0];
  if (!right) return { ok: false, status: 400, error: "Set a usage window before recording a renewal fee." };
  const windowEndsOn = right.endsOn ?? "perpetual";
  const existing = await db.select().from(usageRenewalFees).where(eq(usageRenewalFees.dealId, deal.id));
  const already = existing.find((row) => row.windowEndsOn === windowEndsOn);
  if (already) {
    return { ok: true, booked: false, creatorCents: already.creatorCents, agencyCents: already.agencyCents, invoiceId: already.invoiceId };
  }

  const payout = await recordPayoutLine(db, viewer, {
    creatorId: deal.creatorId,
    dealId: deal.id,
    brand: deal.brand,
    grossCents: input.amountCents,
    feeCents: 0,
    expenseCents: 0,
    note: "Usage renewal",
  });
  if (!payout.ok) return payout;

  const payRows = await db.select().from(payments).where(eq(payments.dealId, deal.id));
  if (!payRows[0]) {
    await upsertPayment(db, {
      dealId: deal.id,
      amountOwedCents: input.amountCents,
      amountLabel: formatMoney(input.amountCents),
    });
  }

  const invoice = await generateDealInvoice(db, viewer, { dealId: deal.id, amountCents: input.amountCents });
  const invoiceId = invoice.ok ? invoice.invoiceId : null;
  try {
    await db.insert(usageRenewalFees).values({
      id: crypto.randomUUID(),
      dealId: deal.id,
      windowEndsOn,
      amountCents: input.amountCents,
      creatorCents: split.creatorCents,
      agencyCents: split.agencyCents,
      payoutLineId: payout.id,
      invoiceId,
      createdAt: nowIso(),
    });
  } catch {
    return { ok: true, booked: false, creatorCents: split.creatorCents, agencyCents: split.agencyCents, invoiceId };
  }
  return { ok: true, booked: true, creatorCents: split.creatorCents, agencyCents: split.agencyCents, invoiceId };
}
