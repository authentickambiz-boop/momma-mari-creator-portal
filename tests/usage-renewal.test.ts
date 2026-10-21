import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, brandInvoices, invoiceReminders, payments, payoutLedger, usageRenewalDrafts, usageRenewalFees, usageRights } from "../src/db/schema";
import { listSendableApprovals } from "../src/lib/approvals";
import { boldSignEnabled } from "../src/lib/boldsign";
import { saveDealRules, savePricingFloor, type DealRules } from "../src/lib/deal-rules";
import { paymentsEnabled } from "../src/lib/payments";
import { addManager, assignCreatorManagers } from "../src/lib/managers";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { getDealForViewer } from "../src/lib/queries";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { upsertDeal } from "../src/lib/bot-api";
import { bookUsageRenewalFee, queueUsageRenewalDrafts, renewalOfferDraft } from "../src/lib/usage-renewal";
import {
  PERPETUAL_WITHHELD_ERROR,
  listUsageEndingSoon,
  saveUsageRights,
  usageEndDate,
  usageWindowStatus,
} from "../src/lib/usage";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const TODAY = "2026-10-21";

describe("usage renewal windows", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("end date is the start date plus the tier", () => {
    assert.equal(usageEndDate("2026-01-01", 30), "2026-01-31");
    assert.equal(usageEndDate("2026-01-01", 60), "2026-03-02");
    assert.equal(usageEndDate("2026-01-01", 90), "2026-04-01");
    assert.equal(usageEndDate("2026-01-01", 180), "2026-06-30");
    assert.equal(usageEndDate("2026-01-01", 365), "2027-01-01");
    assert.equal(usageEndDate("2024-02-01", 30), "2024-03-02");
    assert.equal(usageEndDate("2026-02-31", 30), null);
    assert.equal(usageEndDate("2026-10-05", 30), "2026-11-04");
  });

  test("the owner list keeps a 14-day window and the last 7 expired days", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.equal((await upsertDeal(db, {
      id: "usage-soon",
      brand: "Soon Brand",
      creatorId: "mariclare",
      status: "active",
      workflowStage: "draft_due",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "usage-edge",
      brand: "Edge Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "usage-old",
      brand: "Old Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "usage-fresh",
      brand: "Fresh Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
    })).status, 201);

    const soonEnd = usageEndDate("2026-10-05", 30);
    assert.equal(soonEnd, "2026-11-04");
    assert.equal(usageWindowStatus(soonEnd, TODAY)?.status, "soon");
    assert.equal(usageWindowStatus(soonEnd, TODAY)?.daysLeft, 14);
    assert.equal(usageWindowStatus(usageEndDate("2026-10-06", 30), TODAY), null);
    assert.equal(usageWindowStatus(usageEndDate("2026-09-14", 30), TODAY)?.status, "expired");
    assert.equal(usageWindowStatus(usageEndDate("2026-09-14", 30), TODAY)?.daysLeft, -7);
    assert.equal(usageWindowStatus(usageEndDate("2026-09-13", 30), TODAY), null);
    assert.equal(usageWindowStatus(null, TODAY), null);

    assert.equal((await saveUsageRights(db, {
      dealId: "usage-soon",
      startsOn: "2026-10-05",
      endsOn: null,
      tier: 30,
      channels: ["organic_repost", "paid_ads", "website", "email"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-edge",
      startsOn: "2026-09-14",
      endsOn: null,
      tier: 30,
      channels: ["email"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-old",
      startsOn: "2026-09-13",
      endsOn: null,
      tier: 30,
      channels: ["website"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-fresh",
      startsOn: "2026-10-06",
      endsOn: null,
      tier: 30,
      channels: ["paid_ads"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);

    const rows = await listUsageEndingSoon(db, admin, TODAY);
    const soon = rows.find((row) => row.dealId === "usage-soon");
    const edge = rows.find((row) => row.dealId === "usage-edge");
    assert.equal(soon?.brand, "Soon Brand");
    assert.equal(soon?.creatorName, "MariClare");
    assert.equal(soon?.tierLabel, "30 days");
    assert.equal(soon?.channelsLabel, "Organic repost, Paid ads / whitelisting, Website, Email");
    assert.equal(soon?.endsOn, "2026-11-04");
    assert.equal(soon?.status, "soon");
    assert.equal(edge?.status, "expired");
    assert.equal(edge?.endsOn, "2026-10-14");
    assert.equal(rows.some((row) => row.dealId === "usage-old" || row.dealId === "usage-fresh"), false);
    assert.match(source("src/components/owner-signals.tsx"), /Usage rights ending soon/);
    assert.match(source("src/app/dashboard/page.tsx"), /queueUsageRenewalDrafts/);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });

  test("perpetual usage is withheld unless the owner turns it on", async () => {
    assert.equal((await upsertDeal(db, {
      id: "usage-perpetual",
      brand: "Perpetual Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
    })).status, 201);
    const added = await addManager(db, { actorRole: "admin", name: "Usage Manager", email: "usage.manager@gmail.com" });
    assert.equal(added.ok, true);
    if (!added.ok) return;
    assert.equal((await assignCreatorManagers(db, {
      actorRole: "admin",
      creatorId: "mariclare",
      primaryManagerId: added.id,
      backupManagerId: null,
    })).ok, true);

    const blank = await saveUsageRights(db, {
      dealId: "usage-perpetual",
      startsOn: "2026-10-01",
      endsOn: null,
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.equal(blank.error, PERPETUAL_WITHHELD_ERROR);

    const namedOnly = await saveUsageRights(db, {
      dealId: "usage-perpetual",
      startsOn: "2026-10-01",
      endsOn: null,
      tier: "perpetual",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(namedOnly.ok, false);
    if (!namedOnly.ok) assert.equal(namedOnly.error, PERPETUAL_WITHHELD_ERROR);
    assert.equal((await db.select().from(usageRights).where(eq(usageRights.dealId, "usage-perpetual"))).length, 0);

    const manager = await saveUsageRights(db, {
      dealId: "usage-perpetual",
      startsOn: "2026-10-01",
      endsOn: null,
      tier: "perpetual",
      perpetualOverride: true,
      channels: ["website"],
      actorEmail: "usage.manager@gmail.com",
      actorRole: "manager",
    });
    assert.equal(manager.ok, false);
    if (!manager.ok) assert.equal(manager.error, PERPETUAL_WITHHELD_ERROR);

    const timed = await saveUsageRights(db, {
      dealId: "usage-perpetual",
      startsOn: "2026-01-01",
      endsOn: null,
      tier: 60,
      channels: ["organic_repost"],
      actorEmail: "usage.manager@gmail.com",
      actorRole: "manager",
    });
    assert.equal(timed.ok, true);
    if (!timed.ok) return;
    assert.equal(timed.endsOn, "2026-03-02");
    const timedRow = (await db.select().from(usageRights).where(eq(usageRights.dealId, "usage-perpetual")))[0];
    assert.equal(timedRow?.perpetualOverride, false);
    assert.equal(timedRow?.tier, "60");

    const owner = await saveUsageRights(db, {
      dealId: "usage-perpetual",
      startsOn: "2026-10-01",
      endsOn: null,
      tier: "perpetual",
      perpetualOverride: true,
      channels: ["website", "email"],
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    assert.equal(owner.endsOn, null);
    const row = (await db.select().from(usageRights).where(eq(usageRights.dealId, "usage-perpetual")))[0];
    assert.equal(row?.tier, "perpetual");
    assert.equal(row?.perpetualOverride, true);
    assert.equal(row?.endsOn, null);
    const listed = await listUsageEndingSoon(db, admin, TODAY);
    assert.equal(listed.some((item) => item.dealId === "usage-perpetual"), false);
  });

  test("a renewal draft is created once for a window and leaves rates out", async () => {
    const rules: DealRules = {
      minRates: { tiktok: 80000 },
      targetRates: {},
      minDealCents: 99000,
      blockedCategories: [],
      blockedBrands: [],
      maxDealsPerMonth: null,
      turnaround: "",
      exclusivityMaxDays: null,
      usageMinDays: 45,
      kidsOnCamera: "",
      kidsLimits: "",
    };
    assert.equal((await savePricingFloor(db, admin, 15000)).ok, true);
    assert.equal((await saveDealRules(db, admin, "mariclare", rules)).ok, true);
    assert.equal((await upsertDeal(db, {
      id: "usage-draft",
      brand: "Draft Brand",
      creatorId: "mariclare",
      contact: "buyer@draftbrand.com",
      status: "active",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-draft",
      startsOn: "2026-10-05",
      endsOn: null,
      tier: 30,
      channels: ["organic_repost", "paid_ads"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);

    const renewalFile = source("src/lib/usage-renewal.ts");
    assert.equal(renewalFile.includes("pricingFloor"), false);
    assert.equal(renewalFile.includes("usageMinDays"), false);
    assert.equal(renewalFile.includes("minRates"), false);
    assert.equal(renewalFile.includes("deal-rules"), false);
    const sample = renewalOfferDraft({
      brand: "Draft Brand",
      creatorName: "MariClare",
      endsOn: "2026-11-04",
      channelsLabel: "Organic repost, Paid ads / whitelisting",
      daysLeft: 14,
    });
    assert.match(sample.body, /30, 60, 90 days/);
    assert.equal(sample.body.toLowerCase().includes("minimum"), false);
    assert.equal(sample.body.toLowerCase().includes("floor"), false);
    assert.equal(sample.body.includes("$"), false);

    const first = await queueUsageRenewalDrafts(db, TODAY);
    assert.equal(first.created, 1);
    const second = await queueUsageRenewalDrafts(db, TODAY);
    assert.equal(second.created, 0);
    const approvals = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "usage-draft"));
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0]?.status, "pending");
    assert.equal(approvals[0]?.gate, "usage_renewal");
    assert.equal(approvals[0]?.toEmail, "buyer@draftbrand.com");
    assert.match(approvals[0]?.body ?? "", /30, 60, 90 days/);
    assert.equal((approvals[0]?.body ?? "").toLowerCase().includes("minimum"), false);
    assert.equal((approvals[0]?.body ?? "").toLowerCase().includes("floor"), false);
    assert.equal((approvals[0]?.body ?? "").includes("$"), false);
    assert.equal((approvals[0]?.body ?? "").includes("15000"), false);
    assert.equal((approvals[0]?.body ?? "").includes("80000"), false);
    assert.equal((approvals[0]?.body ?? "").includes("99000"), false);
    assert.equal((approvals[0]?.body ?? "").includes("45"), false);
    const tracked = await db.select().from(usageRenewalDrafts).where(eq(usageRenewalDrafts.dealId, "usage-draft"));
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0]?.windowEndsOn, "2026-11-04");
    const sendable = await listSendableApprovals(db);
    assert.equal(sendable.some((item) => item.dealId === "usage-draft"), false);

    assert.equal((await saveUsageRights(db, {
      dealId: "usage-draft",
      startsOn: "2026-10-01",
      endsOn: null,
      tier: 30,
      channels: ["website"],
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    const third = await queueUsageRenewalDrafts(db, TODAY);
    assert.equal(third.created, 1);
    const again = await queueUsageRenewalDrafts(db, TODAY);
    assert.equal(again.created, 0);
    assert.equal((await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "usage-draft"))).length, 2);
    assert.equal((await db.select().from(usageRenewalDrafts).where(eq(usageRenewalDrafts.dealId, "usage-draft"))).length, 2);
    assert.match(source("src/app/api/cron/gmail-sync/route.ts"), /queueUsageRenewalDrafts/);
    assert.match(source("src/app/api/bot/reminders/route.ts"), /queueUsageRenewalDrafts/);
    assert.match(source("src/components/approvals-queue.tsx"), /usage_renewal/);
  });

  test("a renewal fee uses the deal split and does not turn payments on", async () => {
    assert.equal(paymentsEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
    assert.notEqual(process.env.PUSH_ENABLED, "true");
    assert.notEqual(process.env.BOLDSIGN_ENABLED, "true");
    assert.notEqual(process.env.PAYMENTS_ENABLED, "true");
    assert.notEqual(process.env.STRIPE_ENABLED, "true");
    const migration = source("drizzle/0045_usage_windows.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.includes("update deals"), false);

    assert.equal((await upsertDeal(db, {
      id: "usage-fee",
      brand: "Fee Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
      paymentTerms: "Net 30",
    })).status, 201);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-fee",
      startsOn: "2026-10-21",
      endsOn: null,
      tier: 365,
      channels: ["email"],
      renewalFeeCents: 25000,
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);

    const booked = await bookUsageRenewalFee(db, admin, { dealId: "usage-fee", amountCents: 25000 });
    assert.equal(booked.ok, true);
    if (!booked.ok) return;
    assert.equal(booked.booked, true);
    assert.equal(booked.creatorCents, 20000);
    assert.equal(booked.agencyCents, 5000);

    const line = (await db.select().from(payoutLedger).where(eq(payoutLedger.dealId, "usage-fee")))[0];
    assert.equal(line?.grossCents, 25000);
    assert.equal(line?.creatorCents, 20000);
    assert.equal(line?.agencyCents, 5000);
    assert.equal(line?.note, "Usage renewal");
    const payment = (await db.select().from(payments).where(eq(payments.dealId, "usage-fee")))[0];
    assert.equal(payment?.creatorSplitPercent, 80);
    assert.equal(payment?.agencySplitPercent, 20);
    assert.equal(payment?.creatorPayoutCents, 20000);
    const invoice = (await db.select().from(brandInvoices).where(eq(brandInvoices.dealId, "usage-fee")))[0];
    assert.equal(invoice?.status, "draft");
    assert.equal(invoice?.amountCents, 25000);
    assert.equal(invoice?.stripeInvoiceId, null);
    const reminders = await db.select().from(invoiceReminders).where(eq(invoiceReminders.invoiceId, invoice?.id ?? ""));
    assert.equal(reminders.length > 0, true);
    assert.equal(reminders.every((reminder) => reminder.status === "draft" && reminder.sentAt == null), true);

    const repeat = await bookUsageRenewalFee(db, admin, { dealId: "usage-fee", amountCents: 25000 });
    assert.equal(repeat.ok, true);
    if (!repeat.ok) return;
    assert.equal(repeat.booked, false);
    assert.equal((await db.select().from(payoutLedger).where(eq(payoutLedger.dealId, "usage-fee"))).length, 1);
    assert.equal((await db.select().from(usageRenewalFees).where(eq(usageRenewalFees.dealId, "usage-fee"))).length, 1);
    assert.equal((await db.select().from(brandInvoices).where(eq(brandInvoices.dealId, "usage-fee"))).length, 1);
    assert.equal(paymentsEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
  });
});
