import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandInvoices, deals, invoiceReminders } from "../src/db/schema";
import {
  addCalendarDays,
  approveInvoiceReminder,
  dollarsToInvoiceCents,
  generateDealInvoice,
  listBrandInvoices,
  parseNetDays,
  stripeInvoicingEnabled,
} from "../src/lib/brand-invoices";
import { paymentsEnabled } from "../src/lib/payments-config";
import { getDealForViewer } from "../src/lib/queries";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { admin, mariclare, openTestDb } from "./harness";

const NOW = new Date("2026-10-01T15:00:00.000Z");

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

async function insertDeal(db: PortalDb, id: string, terms: string | null, rateCents: number | null) {
  await db.insert(deals).values({
    id,
    creatorId: "mariclare",
    brand: "Sample Outdoor",
    contact: "Pat Buyer <pat@sampleoutdoor.test>",
    status: "active",
    rateCents,
    paymentTerms: terms,
    deliverablesJson: "[]",
    visibleToCreator: false,
    chipsJson: "[]",
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: 80,
    isSeed: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  });
}

describe("brand invoices", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("an invoice is one per deal, with draft reminders at due, +3, and +7, and Stripe stays off", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const dealsBefore = (await db.select().from(deals)).length;
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(paymentsEnabled(), false);
    assert.equal(parseNetDays("Net 15"), 15);
    assert.equal(parseNetDays("net-30"), 30);
    assert.equal(parseNetDays("Paid through their ordinary payment process"), 30);
    assert.equal(addCalendarDays("2026-10-30", 3), "2026-11-02");
    assert.deepEqual(dollarsToInvoiceCents("$1,500.50"), { cents: 150050 });

    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ id: "should-not-run" }), { status: 200 });
    };

    const missing = await generateDealInvoice(db, admin, { dealId: "missing-deal", now: NOW }, fetchImpl);
    assert.equal(missing.ok, false);
    const noAmount = await generateDealInvoice(db, admin, { dealId: "kosbling", now: NOW }, fetchImpl);
    assert.equal(noAmount.ok, false);
    if (!noAmount.ok) assert.equal(noAmount.code, "amount");

    await insertDeal(db, "deal-invoice-1", "Net 15", null);
    const forbidden = await generateDealInvoice(db, mariclare, { dealId: "deal-invoice-1", amountCents: 150000, now: NOW }, fetchImpl);
    assert.equal(forbidden.ok, false);

    const created = await generateDealInvoice(db, admin, {
      dealId: "deal-invoice-1",
      amountCents: 150000,
      poNumber: "PO-44",
      now: NOW,
    }, fetchImpl);
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.created, true);
      assert.equal(created.calledStripe, false);
      assert.equal(created.stripeInvoiceId, null);
    }
    assert.deepEqual(calls, []);

    const listed = await listBrandInvoices(db, admin);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      const invoice = listed.invoices.find((item) => item.dealId === "deal-invoice-1");
      assert.equal(invoice?.amountCents, 150000);
      assert.equal(invoice?.netDays, 15);
      assert.equal(invoice?.issuedOn, "2026-10-01");
      assert.equal(invoice?.dueOn, "2026-10-16");
      assert.equal(invoice?.poNumber, "PO-44");
      assert.deepEqual(invoice?.reminders.map((item) => item.dueOn), ["2026-10-16", "2026-10-19", "2026-10-23"]);
      assert.deepEqual(invoice?.reminders.map((item) => item.kind), ["due", "plus_3", "plus_7"]);
      for (const reminder of invoice?.reminders ?? []) {
        assert.equal(reminder.status, "draft");
        assert.equal(reminder.sentAt, null);
        assert.match(reminder.body, /has not been sent/i);
      }
      const approved = await approveInvoiceReminder(db, admin, invoice!.reminders[0]!.id);
      assert.equal(approved.ok, true);
      if (approved.ok) assert.equal(approved.sent, false);
    }

    const again = await generateDealInvoice(db, admin, { dealId: "deal-invoice-1", amountCents: 999, now: NOW }, fetchImpl);
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.created, false);
    const reminders = await db.select().from(invoiceReminders);
    const mine = reminders.filter((row) => row.dueOn.startsWith("2026-10-"));
    assert.equal(mine.length, 3);
    assert.equal(mine.every((row) => row.sentAt == null), true);
    const approvedRow = mine.find((row) => row.kind === "due");
    assert.equal(approvedRow?.status, "approved");
    assert.equal(approvedRow?.sentAt, null);

    const creatorList = await listBrandInvoices(db, mariclare);
    assert.equal(creatorList.ok, false);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.id === "invoices"), false);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.id === "invoices"), true);

    const lib = source("src/lib/brand-invoices.ts");
    assert.equal(lib.includes("gmail"), false);
    assert.equal(lib.includes("/send"), false);
    assert.equal(lib.includes("finalize"), true);
    assert.equal(lib.includes("invoices/${"), false);
    assert.match(source("src/app/invoices/page.tsx"), /Nothing is emailed/);
    assert.equal(source("src/lib/invoice-flag.ts").includes('=== "true"'), true);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal((await db.select().from(deals)).length, dealsBefore + 1);
    const stored = await db.select().from(brandInvoices).where(eq(brandInvoices.dealId, "deal-invoice-1"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.amountCents, 150000);
  });

  test("Stripe invoicing creates a draft invoice only when its own flag and secret are set", async () => {
    const previousFlag = process.env.STRIPE_INVOICING_ENABLED;
    const previousSecret = process.env.STRIPE_INVOICING_SECRET;
    const calls: { url: string; body: string }[] = [];
    process.env.STRIPE_INVOICING_ENABLED = "true";
    process.env.STRIPE_INVOICING_SECRET = "sk_invoicing_test_placeholder";
    try {
      await insertDeal(db, "deal-invoice-2", "Net 30", 80000);
      const fetchImpl: typeof fetch = async (input, init) => {
        calls.push({ url: String(input), body: String(init?.body ?? "") });
        const path = String(input);
        const id = path.endsWith("/customers") ? "cus_test" : path.endsWith("/invoiceitems") ? "ii_test" : "in_test";
        return new Response(JSON.stringify({ id }), { status: 200 });
      };
      const created = await generateDealInvoice(db, admin, { dealId: "deal-invoice-2", now: NOW }, fetchImpl);
      assert.equal(created.ok, true);
      if (created.ok) {
        assert.equal(created.calledStripe, true);
        assert.equal(created.stripeInvoiceId, "in_test");
        assert.equal(created.stripeError, null);
      }
      assert.deepEqual(calls.map((call) => call.url), [
        "https://api.stripe.com/v1/customers",
        "https://api.stripe.com/v1/invoiceitems",
        "https://api.stripe.com/v1/invoices",
      ]);
      for (const call of calls) {
        assert.equal(call.url.includes("send"), false);
        assert.equal(call.url.includes("finalize"), false);
        assert.equal(call.body.includes("sk_invoicing_test_placeholder"), false);
      }
      const invoiceCall = calls[2];
      assert.match(invoiceCall?.body ?? "", /auto_advance=false/);
      const stored = await db.select().from(brandInvoices).where(eq(brandInvoices.dealId, "deal-invoice-2"));
      const drafts = await db.select().from(invoiceReminders).where(eq(invoiceReminders.invoiceId, stored[0]!.id));
      assert.equal(drafts.length, 3);
      assert.equal(drafts.every((row) => row.sentAt == null && row.status === "draft"), true);
      assert.equal(paymentsEnabled(), false);
    } finally {
      if (previousFlag == null) delete process.env.STRIPE_INVOICING_ENABLED;
      else process.env.STRIPE_INVOICING_ENABLED = previousFlag;
      if (previousSecret == null) delete process.env.STRIPE_INVOICING_SECRET;
      else process.env.STRIPE_INVOICING_SECRET = previousSecret;
    }
  });
});
