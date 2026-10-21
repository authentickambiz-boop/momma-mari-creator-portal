import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandInvoices, deals, invoiceReminders } from "@/db/schema";
import { isOwner } from "./authz";
import { formatMoney, nowIso } from "./format";
import { stripeInvoicingEnabled } from "./invoice-flag";
import type { Viewer } from "./types";

export { stripeInvoicingEnabled };

/**
 * Reminder drafts are written for the owner to approve.
 * This module never emails them and never calls Stripe's send or finalize endpoints.
 */

export const REMINDER_KINDS = ["due", "plus_3", "plus_7"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

const REMINDER_OFFSET_DAYS: Record<ReminderKind, number> = {
  due: 0,
  plus_3: 3,
  plus_7: 7,
};

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

type StripeJson = { id?: string; error?: { message?: string } };

export type InvoiceReminderView = {
  id: string;
  kind: string;
  dueOn: string;
  subject: string;
  body: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
};

export type BrandInvoiceView = {
  id: string;
  dealId: string;
  brand: string;
  amountCents: number;
  amountLabel: string;
  netDays: number;
  issuedOn: string;
  dueOn: string;
  poNumber: string | null;
  status: string;
  stripeInvoiceId: string | null;
  reminders: InvoiceReminderView[];
};

type GenerateOk = {
  ok: true;
  invoiceId: string;
  created: boolean;
  calledStripe: boolean;
  stripeInvoiceId: string | null;
  stripeError: string | null;
};

type Fail = { ok: false; status: number; error: string; code: string };

function invoicingSecret() {
  return process.env.STRIPE_INVOICING_SECRET?.trim() ?? "";
}

export function parseNetDays(paymentTerms: string | null | undefined) {
  const match = paymentTerms?.match(/net\s*-?\s*(\d{1,3})/i);
  if (!match) return 30;
  const days = Number(match[1]);
  if (!Number.isInteger(days) || days < 0 || days > 180) return 30;
  return days;
}

export function addCalendarDays(isoDate: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error("Date must be YYYY-MM-DD.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function civilDate(now: Date, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function reminderKindLabel(kind: string) {
  if (kind === "due") return "Net due";
  if (kind === "plus_3") return "3 days after due";
  if (kind === "plus_7") return "7 days after due";
  return kind;
}

export function dollarsToInvoiceCents(value: string): { cents: number } | { error: string } {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: "Enter a dollar amount." };
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000_000) return { error: "Enter a dollar amount." };
  return { cents };
}

function reminderDraft(brand: string, kind: ReminderKind, invoiceDue: string, amountLabel: string) {
  const when = kind === "due"
    ? `is due on ${invoiceDue}`
    : kind === "plus_3"
      ? `was due on ${invoiceDue}. This note is for 3 days later`
      : `was due on ${invoiceDue}. This note is for 7 days later`;
  return {
    subject: `Draft reminder: ${brand} invoice`,
    body: `Hi,\n\nThis draft is for the owner to approve. The ${brand} invoice for ${amountLabel} ${when}. It has not been sent.\n\nMomma Mari`,
  };
}

function redact(text: string, secret: string) {
  if (!secret) return text;
  return text.split(secret).join("[secret]");
}

async function stripeForm(path: string, params: URLSearchParams, secret: string, fetchImpl: FetchLike) {
  if (path.includes("send") || path.includes("finalize")) {
    return { ok: false as const, error: "Invoices are not sent from the portal." };
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
    return { ok: false as const, error: "Stripe did not respond. Nothing was sent." };
  }
  const json = await response.json().catch(() => null) as StripeJson | null;
  if (!response.ok || !json?.id) {
    const detail = json?.error?.message?.trim() || "Stripe did not accept that invoice.";
    return { ok: false as const, error: redact(detail, secret) };
  }
  return { ok: true as const, id: json.id };
}

/** Creates a Stripe draft invoice only. It does not finalize or send. */
async function createStripeDraft(
  input: { brand: string; amountCents: number; netDays: number; dealId: string; invoiceId: string; email: string | null },
  fetchImpl: FetchLike,
) {
  const secret = invoicingSecret();
  if (!stripeInvoicingEnabled() || !secret) {
    return { ok: false as const, calledStripe: false as const, error: "Stripe invoicing is off. Nothing was sent." };
  }
  const customer = new URLSearchParams();
  customer.set("name", input.brand);
  if (input.email) customer.set("email", input.email);
  const createdCustomer = await stripeForm("customers", customer, secret, fetchImpl);
  if (!createdCustomer.ok) return { ok: false as const, calledStripe: true as const, error: createdCustomer.error };

  const item = new URLSearchParams();
  item.set("customer", createdCustomer.id);
  item.set("amount", String(input.amountCents));
  item.set("currency", "usd");
  item.set("description", `${input.brand} brand partnership`);
  const createdItem = await stripeForm("invoiceitems", item, secret, fetchImpl);
  if (!createdItem.ok) return { ok: false as const, calledStripe: true as const, error: createdItem.error };

  const invoice = new URLSearchParams();
  invoice.set("customer", createdCustomer.id);
  invoice.set("collection_method", "send_invoice");
  invoice.set("days_until_due", String(input.netDays));
  invoice.set("auto_advance", "false");
  invoice.set("pending_invoice_items_behavior", "include");
  invoice.set("description", `${input.brand} invoice`);
  invoice.set("metadata[deal_id]", input.dealId);
  invoice.set("metadata[portal_invoice_id]", input.invoiceId);
  const createdInvoice = await stripeForm("invoices", invoice, secret, fetchImpl);
  if (!createdInvoice.ok) return { ok: false as const, calledStripe: true as const, error: createdInvoice.error };
  return { ok: true as const, calledStripe: true as const, stripeInvoiceId: createdInvoice.id };
}

function emailIn(value: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

async function loadInvoice(db: PortalDb, invoiceId: string): Promise<BrandInvoiceView | null> {
  const rows = await db.select().from(brandInvoices).where(eq(brandInvoices.id, invoiceId));
  const invoice = rows[0];
  if (!invoice) return null;
  const reminders = await db.select().from(invoiceReminders).where(eq(invoiceReminders.invoiceId, invoice.id));
  return toView(invoice, reminders);
}

function toView(
  invoice: typeof brandInvoices.$inferSelect,
  reminders: (typeof invoiceReminders.$inferSelect)[],
): BrandInvoiceView {
  return {
    id: invoice.id,
    dealId: invoice.dealId,
    brand: invoice.brand,
    amountCents: invoice.amountCents,
    amountLabel: formatMoney(invoice.amountCents),
    netDays: invoice.netDays,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    poNumber: invoice.poNumber,
    status: invoice.status,
    stripeInvoiceId: invoice.stripeInvoiceId,
    reminders: reminders
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        dueOn: row.dueOn,
        subject: row.subject,
        body: row.body,
        status: row.status,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy,
        sentAt: row.sentAt,
      }))
      .sort((left, right) => left.dueOn.localeCompare(right.dueOn)),
  };
}

export async function listBrandInvoices(db: PortalDb, viewer: Viewer): Promise<{ ok: true; invoices: BrandInvoiceView[] } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Invoices stay with the owner.", code: "forbidden" };
  const invoices = await db.select().from(brandInvoices);
  const reminders = await db.select().from(invoiceReminders);
  const views = invoices.map((invoice) => toView(invoice, reminders.filter((row) => row.invoiceId === invoice.id)));
  views.sort((left, right) => right.issuedOn.localeCompare(left.issuedOn) || left.brand.localeCompare(right.brand));
  return { ok: true, invoices: views };
}

export async function generateDealInvoice(
  db: PortalDb,
  viewer: Viewer,
  input: {
    dealId: string;
    amountCents?: number | null;
    netDays?: number | null;
    poNumber?: string | null;
    now?: Date;
  },
  fetchImpl: FetchLike = fetch,
): Promise<GenerateOk | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Invoices stay with the owner.", code: "forbidden" };
  const dealId = input.dealId.trim();
  const found = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = found[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found.", code: "missing" };

  const existingRows = await db.select().from(brandInvoices).where(eq(brandInvoices.dealId, deal.id));
  const existing = existingRows[0];
  if (existing) {
    const stripe = await maybeAttachStripe(db, existing, deal.contact, fetchImpl);
    return {
      ok: true,
      invoiceId: existing.id,
      created: false,
      calledStripe: stripe.calledStripe,
      stripeInvoiceId: stripe.stripeInvoiceId,
      stripeError: stripe.stripeError,
    };
  }

  const amountCents = input.amountCents ?? deal.rateCents ?? null;
  if (amountCents == null || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, status: 400, error: "This deal has no invoice amount.", code: "amount" };
  }
  const netDays = input.netDays == null ? parseNetDays(deal.paymentTerms) : input.netDays;
  if (!Number.isInteger(netDays) || netDays < 0 || netDays > 180) {
    return { ok: false, status: 400, error: "Net days must be from 0 to 180.", code: "net" };
  }
  const issuedOn = civilDate(input.now ?? new Date());
  const dueOn = addCalendarDays(issuedOn, netDays);
  const timestamp = nowIso();
  const invoiceId = crypto.randomUUID();
  const poNumber = input.poNumber?.trim() ? input.poNumber.trim().slice(0, 80) : null;
  await db.insert(brandInvoices).values({
    id: invoiceId,
    dealId: deal.id,
    brand: deal.brand,
    amountCents,
    currency: "usd",
    netDays,
    issuedOn,
    dueOn,
    poNumber,
    status: "draft",
    stripeInvoiceId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const amountLabel = formatMoney(amountCents);
  for (const kind of REMINDER_KINDS) {
    const copy = reminderDraft(deal.brand, kind, dueOn, amountLabel);
    await db.insert(invoiceReminders).values({
      id: crypto.randomUUID(),
      invoiceId,
      kind,
      dueOn: addCalendarDays(dueOn, REMINDER_OFFSET_DAYS[kind]),
      subject: copy.subject,
      body: copy.body,
      status: "draft",
      approvedAt: null,
      approvedBy: null,
      sentAt: null,
      createdAt: timestamp,
    });
  }

  const stripe = await maybeAttachStripe(
    db,
    { id: invoiceId, brand: deal.brand, amountCents, netDays, dealId: deal.id, stripeInvoiceId: null },
    deal.contact,
    fetchImpl,
  );
  return {
    ok: true,
    invoiceId,
    created: true,
    calledStripe: stripe.calledStripe,
    stripeInvoiceId: stripe.stripeInvoiceId,
    stripeError: stripe.stripeError,
  };
}

async function maybeAttachStripe(
  db: PortalDb,
  invoice: { id: string; brand: string; amountCents: number; netDays: number; dealId: string; stripeInvoiceId: string | null },
  contact: string | null,
  fetchImpl: FetchLike,
) {
  if (invoice.stripeInvoiceId) {
    return { calledStripe: false, stripeInvoiceId: invoice.stripeInvoiceId, stripeError: null as string | null };
  }
  if (!stripeInvoicingEnabled() || !invoicingSecret()) {
    return { calledStripe: false, stripeInvoiceId: null as string | null, stripeError: null as string | null };
  }
  const stripe = await createStripeDraft(
    {
      brand: invoice.brand,
      amountCents: invoice.amountCents,
      netDays: invoice.netDays,
      dealId: invoice.dealId,
      invoiceId: invoice.id,
      email: emailIn(contact),
    },
    fetchImpl,
  );
  if (!stripe.ok) {
    return { calledStripe: stripe.calledStripe, stripeInvoiceId: null as string | null, stripeError: stripe.error };
  }
  await db.update(brandInvoices).set({
    stripeInvoiceId: stripe.stripeInvoiceId,
    updatedAt: nowIso(),
  }).where(eq(brandInvoices.id, invoice.id));
  return { calledStripe: true, stripeInvoiceId: stripe.stripeInvoiceId, stripeError: null as string | null };
}

/** Marks a reminder approved. It stays unsent. */
export async function approveInvoiceReminder(db: PortalDb, viewer: Viewer, reminderId: string): Promise<
  { ok: true; sent: false; status: string } | Fail
> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Invoices stay with the owner.", code: "forbidden" };
  const rows = await db.select().from(invoiceReminders).where(eq(invoiceReminders.id, reminderId));
  const reminder = rows[0];
  if (!reminder) return { ok: false, status: 404, error: "Reminder not found.", code: "missing" };
  if (reminder.status !== "approved") {
    await db.update(invoiceReminders).set({
      status: "approved",
      approvedAt: nowIso(),
      approvedBy: viewer.email,
    }).where(eq(invoiceReminders.id, reminder.id));
  }
  const fresh = await db.select().from(invoiceReminders).where(eq(invoiceReminders.id, reminder.id));
  return { ok: true, sent: false, status: fresh[0]?.status ?? "approved" };
}

export async function readInvoice(db: PortalDb, viewer: Viewer, invoiceId: string) {
  if (!isOwner(viewer)) return { ok: false as const, status: 403, error: "Invoices stay with the owner.", code: "forbidden" };
  const invoice = await loadInvoice(db, invoiceId);
  if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found.", code: "missing" };
  return { ok: true as const, invoice };
}
