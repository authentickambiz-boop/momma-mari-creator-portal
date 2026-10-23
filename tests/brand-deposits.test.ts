import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, dealDepositEvents, dealDeposits } from "../src/db/schema";
import { boldSignEnabled } from "../src/lib/boldsign";
import {
  brandBillingSummary,
  depositHalfCents,
  ensureDealDeposit,
  FILMING_LOCK_MESSAGE,
  filmingLockForDeal,
  listDepositsWaiting,
  markDealPaymentTiming,
  overrideDepositLock,
  setBrandBillingTerms,
  setDealDepositStatus,
} from "../src/lib/brand-deposits";
import { markCreatorTaskDone, listCreatorOpenTasks } from "../src/lib/creator-tasks";
import { confirmProductReceived } from "../src/lib/fulfillment";
import { pushEnabled } from "../src/lib/home-screen";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { packageCheckoutEnabled } from "../src/lib/package-checkout-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { listPayoutLedger, recordPayoutLine } from "../src/lib/payout-ledger";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { getDealForViewer } from "../src/lib/queries";
import { setDealStage } from "../src/lib/deal-stage";
import { deals } from "../src/db/schema";
import type { Viewer } from "../src/lib/types";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const manager: Viewer = {
  email: "riley.manager@example.com",
  role: "manager",
  creatorId: null,
  name: "Riley",
  assignedCreatorIds: ["mariclare"],
};

async function insertDeal(db: PortalDb, input: { id: string; brand: string; rateCents?: number | null; paymentTerms?: string | null; workflowStage?: string | null; creatorId?: string; visible?: boolean }) {
  await db.insert(deals).values({
    id: input.id,
    creatorId: input.creatorId ?? "mariclare",
    brand: input.brand,
    subtitle: `${input.brand} film`,
    status: "active",
    workflowStage: input.workflowStage ?? "waiting_for_product",
    rateCents: input.rateCents === undefined ? 200000 : input.rateCents,
    paymentTerms: input.paymentTerms ?? null,
    deliverablesJson: "[]",
    visibleToCreator: input.visible ?? true,
    chipsJson: "[]",
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: 90,
    isSeed: false,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
  });
}

describe("brand deposits", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("manual billing flags stay off", () => {
    assert.equal(paymentsEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
    assert.equal(packageCheckoutEnabled(), false);
    const migration = source("drizzle/0058_brand_deposits.sql").toLowerCase();
    assert.equal(migration.includes("drop "), false);
    assert.equal(migration.includes("delete "), false);
    const files = ["src/lib/brand-deposits.ts", "src/app/deposit-actions.ts", "drizzle/0058_brand_deposits.sql"].map(source).join("\n").toLowerCase();
    assert.equal(files.includes("api.stripe.com"), false);
    assert.equal(files.includes("boldsign"), false);
    assert.equal(files.includes("push_enabled"), false);
    assert.equal(files.includes("stripe_invoicing_enabled"), false);
    assert.equal(depositHalfCents(200000), 100000);
    assert.equal(depositHalfCents(101), 51);
  });

  test("a new brand's paid deal stays locked until the deposit is received", async () => {
    await insertDeal(db, { id: "deposit-new", brand: "Northstar Goods", paymentTerms: "Net 30" });
    await ensureDealDeposit(db, "deposit-new");
    const locked = await filmingLockForDeal(db, "deposit-new");
    assert.equal(locked.locked, true);
    assert.equal(locked.message, FILMING_LOCK_MESSAGE);

    const blockedProduct = await confirmProductReceived(db, {
      dealId: "deposit-new",
      actorEmail: mariclare.email,
      actorRole: "creator",
      creatorId: "mariclare",
    });
    assert.equal(blockedProduct.ok, false);
    if (!blockedProduct.ok) assert.equal(blockedProduct.error, FILMING_LOCK_MESSAGE);

    await db.update(deals).set({ workflowStage: "product_received" }).where(eq(deals.id, "deposit-new"));
    const blockedStage = await setDealStage(db, {
      dealId: "deposit-new",
      toStage: "draft_due",
      actorEmail: mariclare.email,
      actorRole: "creator",
      creatorId: "mariclare",
    });
    assert.equal(blockedStage.ok, false);
    if (!blockedStage.ok) assert.equal(blockedStage.error, FILMING_LOCK_MESSAGE);

    const creatorBefore = await getDealForViewer(db, mariclare, "deposit-new");
    assert.equal(creatorBefore?.deposit.status, "not_requested");
    assert.equal(creatorBefore?.deposit.amountCents, null);
    assert.equal(creatorBefore?.deposit.filmingLocked, true);
    assert.equal(JSON.stringify(creatorBefore?.deposit).includes("100000"), false);
    assert.equal(JSON.stringify(creatorBefore?.deposit).toLowerCase().includes("floor"), false);
    assert.equal(JSON.stringify(creatorBefore?.deposit).toLowerCase().includes("minimum"), false);

    const creatorWrite = await setDealDepositStatus(db, mariclare, { dealId: "deposit-new", status: "received", today: "2026-10-22" });
    assert.equal(creatorWrite.ok, false);
    if (!creatorWrite.ok) assert.equal(creatorWrite.status, 403);
    const managerWrite = await setDealDepositStatus(db, manager, { dealId: "deposit-new", status: "invoiced", today: "2026-10-22" });
    assert.equal(managerWrite.ok, false);

    const invoiced = await setDealDepositStatus(db, admin, {
      dealId: "deposit-new",
      status: "invoiced",
      invoicedOn: "2026-10-01",
      today: "2026-10-22",
    });
    assert.equal(invoiced.ok, true);
    const waiting = await listDepositsWaiting(db, admin, "2026-10-22");
    assert.equal(waiting.ok, true);
    if (waiting.ok) {
      const row = waiting.deals.find((deal) => deal.dealId === "deposit-new");
      assert.equal(row?.brand, "Northstar Goods");
      assert.equal(row?.dealLabel, "Northstar Goods film");
      assert.equal(row?.amountCents, 100000);
      assert.equal(row?.daysSinceInvoiced, 21);
    }
    assert.equal((await filmingLockForDeal(db, "deposit-new")).locked, true);
    const creatorInvoiced = await getDealForViewer(db, mariclare, "deposit-new");
    assert.equal(creatorInvoiced?.deposit.status, "invoiced");
    assert.equal(creatorInvoiced?.deposit.amountCents, null);
    assert.equal(creatorInvoiced?.canConfirmProduct, false);

    const draftsBefore = (await db.select().from(approvalEmails)).length;
    const received = await setDealDepositStatus(db, admin, {
      dealId: "deposit-new",
      status: "received",
      receivedOn: "2026-10-20",
      today: "2026-10-22",
    });
    assert.equal(received.ok, true);
    if (received.ok) assert.ok(received.approvalId);
    const drafts = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "deposit-new"));
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.status, "pending");
    assert.equal(drafts[0]?.sentAt, null);
    assert.equal(drafts[0]?.gate, "deposit_go_ahead");
    assert.equal(drafts[0]?.body.includes("%"), false);
    assert.equal(drafts[0]?.body.includes("$"), false);
    assert.equal((await db.select().from(approvalEmails)).length, draftsBefore + 1);
    assert.equal((await filmingLockForDeal(db, "deposit-new")).locked, false);

    await db.update(deals).set({ workflowStage: "waiting_for_product" }).where(eq(deals.id, "deposit-new"));
    const started = await confirmProductReceived(db, {
      dealId: "deposit-new",
      actorEmail: mariclare.email,
      actorRole: "creator",
      creatorId: "mariclare",
    });
    assert.equal(started.ok, true);
    if (started.ok) assert.equal(started.workflowStage, "draft_due");

    assert.equal(paymentsEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
  });

  test("an owner override is logged and unlocks filming before the deposit lands", async () => {
    await insertDeal(db, { id: "deposit-override", brand: "Harbor Soap", rateCents: 80000 });
    await ensureDealDeposit(db, "deposit-override");
    const missing = await overrideDepositLock(db, admin, { dealId: "deposit-override", reason: "   " });
    assert.equal(missing.ok, false);
    const creatorOverride = await overrideDepositLock(db, mariclare, { dealId: "deposit-override", reason: "Please start" });
    assert.equal(creatorOverride.ok, false);
    const saved = await overrideDepositLock(db, admin, { dealId: "deposit-override", reason: "Wire landed. Invoice is still open." });
    assert.equal(saved.ok, true);
    const row = (await db.select().from(dealDeposits).where(eq(dealDeposits.dealId, "deposit-override")))[0];
    assert.equal(row?.status, "not_requested");
    assert.equal(row?.overrideReason, "Wire landed. Invoice is still open.");
    const events = await db.select().from(dealDepositEvents).where(eq(dealDepositEvents.dealId, "deposit-override"));
    assert.equal(events.some((event) => event.action === "override" && event.reason === "Wire landed. Invoice is still open."), true);
    assert.equal((await filmingLockForDeal(db, "deposit-override")).locked, false);
    const ownerView = await getDealForViewer(db, admin, "deposit-override");
    assert.equal(ownerView?.deposit.amountCents, 40000);
    assert.equal(ownerView?.deposit.overrideReason, "Wire landed. Invoice is still open.");
  });

  test("gifted deals and a brief that asks for Net 30 do not skip the first-time rule", async () => {
    await insertDeal(db, { id: "deposit-gift", brand: "Gifted Candle", rateCents: null, paymentTerms: "Gifted" });
    await ensureDealDeposit(db, "deposit-gift");
    assert.equal((await db.select().from(dealDeposits).where(eq(dealDeposits.dealId, "deposit-gift"))).length, 0);
    const gift = await getDealForViewer(db, mariclare, "deposit-gift");
    assert.equal(gift?.deposit.status, "not_required");
    assert.equal(gift?.deposit.filmingLocked, false);
    const filmed = await confirmProductReceived(db, {
      dealId: "deposit-gift",
      actorEmail: mariclare.email,
      actorRole: "creator",
      creatorId: "mariclare",
    });
    assert.equal(filmed.ok, true);

    await insertDeal(db, { id: "deposit-abby", brand: "Other Brand", creatorId: "abby", rateCents: 50000 });
    await ensureDealDeposit(db, "deposit-abby");
    assert.equal(await getDealForViewer(db, mariclare, "deposit-abby"), null);
  });

  test("Net 30 waits for one paid-on-time deal, and a late payment is only a flag", async () => {
    await insertDeal(db, { id: "deposit-ontime", brand: "Kind Soap", rateCents: 100000, workflowStage: "paid" });
    const early = await setBrandBillingTerms(db, admin, { brand: "Kind Soap", terms: "net_30" });
    assert.equal(early.ok, false);
    if (!early.ok) assert.equal(early.code, "ineligible");
    const creatorMark = await markDealPaymentTiming(db, mariclare, { dealId: "deposit-ontime", dueOn: "2026-10-01", paidOn: "2026-10-01" });
    assert.equal(creatorMark.ok, false);

    const onTime = await markDealPaymentTiming(db, admin, { dealId: "deposit-ontime", dueOn: "2026-10-01", paidOn: "2026-10-01" });
    assert.equal(onTime.ok, true);
    if (onTime.ok) assert.equal(onTime.paidOnTime, true);
    let summary = await brandBillingSummary(db, "kind soap");
    assert.equal(summary.eligible, true);
    assert.equal(summary.lateFlag, false);
    assert.equal(summary.terms, "deposit_first");

    const switched = await setBrandBillingTerms(db, admin, { brand: "Kind Soap", terms: "net_30" });
    assert.equal(switched.ok, true);
    await insertDeal(db, { id: "deposit-net", brand: "Kind Soap", rateCents: 90000 });
    await ensureDealDeposit(db, "deposit-net");
    const netView = await getDealForViewer(db, admin, "deposit-net");
    assert.equal(netView?.deposit.status, "not_required");
    assert.equal(netView?.deposit.filmingLocked, false);
    assert.equal(netView?.deposit.amountCents, null);

    await insertDeal(db, { id: "deposit-late", brand: "Kind Soap", rateCents: 90000, workflowStage: "paid" });
    const ten = await markDealPaymentTiming(db, admin, { dealId: "deposit-late", dueOn: "2026-10-01", paidOn: "2026-10-11" });
    assert.equal(ten.ok, true);
    if (ten.ok) assert.equal(ten.daysLate, 10);
    summary = await brandBillingSummary(db, "Kind Soap");
    assert.equal(summary.lateFlag, false);
    assert.equal(summary.terms, "net_30");

    const eleven = await markDealPaymentTiming(db, admin, { dealId: "deposit-late", dueOn: "2026-10-01", paidOn: "2026-10-12" });
    assert.equal(eleven.ok, true);
    if (eleven.ok) {
      assert.equal(eleven.daysLate, 11);
      assert.equal(eleven.paidOnTime, false);
    }
    summary = await brandBillingSummary(db, "Kind Soap");
    assert.equal(summary.lateFlag, true);
    assert.equal(summary.terms, "net_30");

    const back = await setBrandBillingTerms(db, admin, { brand: "Kind Soap", terms: "deposit_first" });
    assert.equal(back.ok, true);
    summary = await brandBillingSummary(db, "Kind Soap");
    assert.equal(summary.terms, "deposit_first");
    assert.equal(summary.lateFlag, true);
    await ensureDealDeposit(db, "deposit-net");
    const relocked = await filmingLockForDeal(db, "deposit-net");
    assert.equal(relocked.locked, true);
  });

  test("the payout queue shows which deals have cleared funds", async () => {
    await insertDeal(db, { id: "deposit-payout", brand: "Clearwater", rateCents: 120000, workflowStage: "payment_pending" });
    await setDealDepositStatus(db, admin, { dealId: "deposit-payout", status: "invoiced", invoicedOn: "2026-10-10", today: "2026-10-22" });
    const line = await recordPayoutLine(db, admin, {
      creatorId: "mariclare",
      dealId: "deposit-payout",
      brand: "Clearwater",
      grossCents: 120000,
      feeCents: 0,
      expenseCents: 0,
    });
    assert.equal(line.ok, true);
    if (!line.ok) return;
    const waiting = await listPayoutLedger(db, admin);
    assert.equal(waiting.ok, true);
    if (!waiting.ok) return;
    assert.equal(waiting.waiting.find((row) => row.id === line.id)?.fundsCleared, false);
    await setDealDepositStatus(db, admin, { dealId: "deposit-payout", status: "received", receivedOn: "2026-10-21", today: "2026-10-22" });
    const cleared = await listPayoutLedger(db, admin);
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.lines.find((row) => row.id === line.id)?.fundsCleared, true);
    const own = await listPayoutLedger(db, mariclare);
    assert.equal(own.ok, true);
    if (!own.ok) return;
    assert.equal(own.lines.find((row) => row.id === line.id)?.fundsCleared, true);
    assert.equal(own.lines.some((row) => row.creatorId !== "mariclare"), false);
  });

  test("the filming to-do stays locked for the creator", async () => {
    await insertDeal(db, { id: "deposit-todo", brand: "Todo Brand", rateCents: 60000, workflowStage: "waiting_for_product" });
    await ensureDealDeposit(db, "deposit-todo");
    const open = await listCreatorOpenTasks(db, "mariclare");
    const task = open.find((item) => item.id === "deposit-lock-deposit-todo");
    assert.ok(task);
    assert.equal(task?.locked, true);
    assert.equal(task?.detail, FILMING_LOCK_MESSAGE);
    assert.equal(JSON.stringify(task).includes("$"), false);
    const done = await markCreatorTaskDone(db, mariclare, "deposit-lock-deposit-todo");
    assert.equal(done.ok, false);
    const still = await listCreatorOpenTasks(db, "mariclare");
    assert.equal(still.some((item) => item.id === "deposit-lock-deposit-todo"), true);
  });
});
