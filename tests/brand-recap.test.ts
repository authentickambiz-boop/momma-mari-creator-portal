import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import {
  approvalEmails,
  brandCampaignReports,
  brandRecapDrafts,
  campaignAllocations,
  campaigns,
  creatorProfiles,
  deals,
  livePosts,
  payments,
  usageRights,
} from "../src/db/schema";
import { listSendableApprovals } from "../src/lib/approvals";
import {
  NOT_REPORTED,
  addCalendarDays,
  brandInquiryPrefill,
  composeBrandRecap,
  isRecapDue,
  listDueBrandRecaps,
  publicBrandRecap,
  queueBrandRecapDrafts,
  recapInquirePath,
} from "../src/lib/brand-recap";
import { boldSignEnabled } from "../src/lib/boldsign";
import { saveDealRules, savePricingFloor, type DealRules } from "../src/lib/deal-rules";
import { nowIso } from "../src/lib/format";
import { pushEnabled } from "../src/lib/home-screen";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { upsertDeal } from "../src/lib/bot-api";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const TODAY = "2026-10-21";

function leaksPrivate(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("minimum")
    || lower.includes("floor")
    || lower.includes("fee split")
    || lower.includes("deal rule")
    || text.includes("$")
    || text.includes("80/20")
    || text.includes("80000")
    || text.includes("99000")
    || text.includes("15000")
    || text.includes("120000")
    || text.includes("25000")
    || text.includes("100000")
    || text.includes("500000")
    || text.includes("96000");
}

describe("brand recap drafts", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("7-day and 30-day marks are calendar days after go-live", () => {
    assert.equal(addCalendarDays("2026-10-01", 7), "2026-10-08");
    assert.equal(addCalendarDays("2026-10-01", 30), "2026-10-31");
    assert.equal(addCalendarDays("2026-01-31", 30), "2026-03-02");
    assert.equal(addCalendarDays("2024-02-29", 7), "2024-03-07");
    assert.equal(addCalendarDays("2026-02-31", 7), null);
    assert.equal(isRecapDue("2026-10-01", "2026-10-07", 7), false);
    assert.equal(isRecapDue("2026-10-01", "2026-10-08", 7), true);
    assert.equal(isRecapDue("2026-10-01", "2026-10-30", 30), false);
    assert.equal(isRecapDue("2026-10-01", "2026-10-31", 30), true);
    assert.equal(isRecapDue("Late October", TODAY, 7), false);
  });

  test("a recap is queued once per milestone, and a campaign start is the go-live only when the deal has none", async () => {
    const kosblingBefore = (await db.select().from(deals).where(eq(deals.id, "kosbling")))[0];
    await db.insert(creatorProfiles).values({
      creatorId: "mariclare",
      profileOn: true,
      displayName: "Mari Clare M.",
      displayNameOn: true,
      updatedAt: nowIso(),
    });

    assert.equal((await upsertDeal(db, {
      id: "recap-week",
      brand: "Week Brand",
      creatorId: "mariclare",
      contact: "week@weekbrand.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-14",
      deliverables: ["1 TikTok"],
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-both",
      brand: "Both Brand",
      creatorId: "mariclare",
      contact: "both@bothbrand.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-09-21",
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-future",
      brand: "Future Brand",
      creatorId: "mariclare",
      contact: "future@futurebrand.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-12-01",
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-fuzzy",
      brand: "Fuzzy Brand",
      creatorId: "mariclare",
      contact: "fuzzy@fuzzybrand.example",
      status: "active",
      visibleToCreator: true,
      postDate: "Nov 15 (moved from Oct 15)",
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-camp",
      brand: "Camp Brand",
      creatorId: "mariclare",
      contact: "camp@campbrand.example",
      status: "active",
      visibleToCreator: true,
      deliverables: [],
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-post-wins",
      brand: "Post Wins",
      creatorId: "mariclare",
      contact: "post@postwins.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-11-15",
    })).status, 201);

    await db.insert(campaigns).values({
      id: "camp-recap",
      brand: "Camp Brand",
      name: "Spring",
      budgetCents: 500000,
      nichesJson: "[]",
      platformsJson: "[]",
      deliverablesJson: JSON.stringify(["1 Instagram reel"]),
      slots: 1,
      startsOn: "2026-10-01",
      endsOn: null,
      status: "open",
      openOutside: false,
      updatedAt: nowIso(),
      kind: "campaign",
    });
    await db.insert(campaigns).values({
      id: "camp-early",
      brand: "Post Wins",
      name: "Early",
      budgetCents: 100000,
      nichesJson: "[]",
      platformsJson: "[]",
      deliverablesJson: "[]",
      slots: 1,
      startsOn: "2026-09-01",
      endsOn: null,
      status: "open",
      openOutside: false,
      updatedAt: nowIso(),
      kind: "campaign",
    });
    await db.insert(campaignAllocations).values({
      id: "alloc-recap",
      campaignId: "camp-recap",
      creatorId: "mariclare",
      prospectId: null,
      amountCents: 100000,
      createdAt: nowIso(),
    });
    await db.insert(campaignAllocations).values({
      id: "alloc-early",
      campaignId: "camp-early",
      creatorId: "mariclare",
      prospectId: null,
      amountCents: 100000,
      createdAt: nowIso(),
    });
    await db.update(deals).set({ offerAllocationId: "alloc-recap" }).where(eq(deals.id, "recap-camp"));
    await db.update(deals).set({ offerAllocationId: "alloc-early" }).where(eq(deals.id, "recap-post-wins"));

    const early = await queueBrandRecapDrafts(db, "2026-10-08");
    assert.equal(early.created, 2);
    const week = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-week"));
    assert.equal(week.length, 0);
    const camp = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-camp"));
    assert.equal(camp.length, 1);
    assert.equal(camp[0]?.milestone, "7");
    const bothEarly = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-both"));
    assert.deepEqual(bothEarly.map((row) => row.milestone), ["7"]);
    const campMail = (await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-camp")))[0];
    assert.match(campMail?.body ?? "", /1 Instagram reel/);
    assert.match(campMail?.body ?? "", /Mari Clare M\./);
    assert.equal(leaksPrivate(campMail?.body ?? ""), false);
    assert.equal(leaksPrivate(campMail?.subject ?? ""), false);

    const onToday = await queueBrandRecapDrafts(db, TODAY);
    assert.equal(onToday.created, 2);
    const weekRows = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-week"));
    assert.equal(weekRows.length, 1);
    assert.equal(weekRows[0]?.milestone, "7");
    const bothOnDay = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-both"));
    assert.deepEqual(bothOnDay.map((row) => row.milestone).sort(), ["30", "7"]);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-future"))).length, 0);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-fuzzy"))).length, 0);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-post-wins"))).length, 0);

    const month = await queueBrandRecapDrafts(db, "2026-10-31");
    assert.equal(month.created, 1);
    const campBoth = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-camp"));
    assert.deepEqual(campBoth.map((row) => row.milestone).sort(), ["30", "7"]);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-week"))).length, 1);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-post-wins"))).length, 0);

    const again = await queueBrandRecapDrafts(db, "2026-10-31");
    assert.equal(again.created, 0);
    assert.equal((await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-both"))).length, 2);
    assert.equal((await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-camp"))).length, 2);
    const pending = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-week"));
    assert.equal(pending.length, 1);
    assert.equal(pending.every((row) => row.status === "pending" && row.gate === "brand_recap" && row.sentAt == null), true);
    const sendable = await listSendableApprovals(db);
    assert.equal(sendable.some((item) => item.dealId === "recap-week" || item.dealId === "recap-both" || item.dealId === "recap-camp"), false);

    const kosblingAfter = (await db.select().from(deals).where(eq(deals.id, "kosbling")))[0];
    assert.equal(kosblingAfter?.updatedAt, kosblingBefore?.updatedAt);
    assert.equal(kosblingAfter?.postDate, kosblingBefore?.postDate);
    assert.equal(kosblingAfter?.rateCents, kosblingBefore?.rateCents);
    assert.equal(kosblingAfter?.kamronNotes, kosblingBefore?.kamronNotes);
    assert.match(source("src/app/dashboard/page.tsx"), /queueBrandRecapDrafts/);
    assert.match(source("src/app/api/cron/gmail-sync/route.ts"), /queueBrandRecapDrafts/);
    assert.match(source("src/app/api/bot/reminders/route.ts"), /queueBrandRecapDrafts/);
    assert.match(source("src/components/approvals-queue.tsx"), /brand_recap/);
    assert.match(source("src/components/owner-signals.tsx"), /Brand recaps/);
  });

  test("missing metrics stay unreported, and recorded ones are shown as stored", async () => {
    const missing = composeBrandRecap({
      brand: "Plain Brand",
      creatorName: "Mari Clare M.",
      milestone: 7,
      goLiveOn: "2026-10-01",
      deliverables: [],
      contentLinks: [],
      metrics: { views: null, engagement: null, clicks: null, codes: null },
      usageEndsOn: null,
      inquireUrl: "https://www.mommamari.com/portal/inquire?brand=Plain%20Brand",
      shareUrl: "https://www.mommamari.com/portal/brand-recap/abc",
    });
    for (const label of ["Views", "Engagement rate", "Clicks", "Codes"]) {
      assert.equal(missing.metrics.find((metric) => metric.label === label)?.value, NOT_REPORTED);
      assert.match(missing.body, new RegExp(`${label}: ${NOT_REPORTED}`));
    }
    assert.match(missing.body, /Deliverables: not reported yet/);
    assert.match(missing.body, /Content links: not reported yet/);
    assert.match(missing.body, /Usage rights end date: not reported yet/);

    const priced = composeBrandRecap({
      ...missing,
      metrics: { views: "$9,900", engagement: "4.2%", clicks: null, codes: "  " },
      usageEndsOn: null,
      inquireUrl: missing.shareHref,
      shareUrl: missing.shareHref,
    });
    assert.equal(priced.metrics.find((metric) => metric.label === "Views")?.value, NOT_REPORTED);
    assert.equal(priced.metrics.find((metric) => metric.label === "Engagement rate")?.value, "4.2%");
    assert.equal(priced.body.includes("$"), false);

    assert.equal((await upsertDeal(db, {
      id: "recap-metrics",
      brand: "Metric Brand",
      creatorId: "mariclare",
      contact: "metrics@metricbrand.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-01",
      deliverables: ["1 TikTok"],
    })).status, 201);
    await db.insert(livePosts).values({
      id: "post-recap-metrics",
      dealId: "recap-metrics",
      platform: "tiktok",
      url: "https://www.tiktok.com/@example/video/1",
      meetsBrief: null,
      confirmedAt: null,
      confirmedBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.insert(brandCampaignReports).values({
      id: "report-recap-metrics",
      token: "metricsreporttoken",
      dealId: "recap-metrics",
      title: "Metric Brand campaign report",
      viewsLabel: "12,400",
      engagementLabel: "4.2%",
      clicksLabel: null,
      commentsLabel: null,
      codesLabel: null,
      contentLinks: "see the post",
      createdAt: nowIso(),
    });
    const queued = await queueBrandRecapDrafts(db, "2026-10-08");
    assert.equal(queued.created, 1);
    const mail = (await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-metrics")))[0];
    assert.match(mail?.body ?? "", /Views: 12,400/);
    assert.match(mail?.body ?? "", /Engagement rate: 4\.2%/);
    assert.match(mail?.body ?? "", /Clicks: not reported yet/);
    assert.match(mail?.body ?? "", /Codes: not reported yet/);
    assert.match(mail?.body ?? "", /https:\/\/www\.tiktok\.com\/@example\/video\/1/);
    assert.equal((mail?.body ?? "").includes("see the post"), false);
    assert.equal(mail?.toEmail, "metrics@metricbrand.example");

    await db.update(brandCampaignReports).set({ codesLabel: "SAVE10", clicksLabel: "86" }).where(eq(brandCampaignReports.dealId, "recap-metrics"));
    const draft = (await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-metrics")))[0];
    const page = await publicBrandRecap(db, draft?.token ?? "");
    assert.equal(page?.metrics.find((metric) => metric.label === "Clicks")?.value, "86");
    assert.equal(page?.metrics.find((metric) => metric.label === "Codes")?.value, "SAVE10");
    assert.match(mail?.body ?? "", /Codes: not reported yet/);
    assert.equal(page?.contentLinks.includes("https://www.tiktok.com/@example/video/1"), true);
  });

  test("a recap never shows rate floors, minimums, deal rules, or the fee split", async () => {
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
      id: "recap-floor",
      brand: "Northstar",
      creatorId: "mariclare",
      contact: "buyer@northstar.example",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-01",
      deliverables: ["1 TikTok", "Rate floor $800 minimum"],
      rateCents: 120000,
      rateLabel: "$1,200 + free product",
      amountDisplay: "$1,200",
      kamronNotes: "Her minimum floor is $800 and the agency split is 80/20.",
      paymentTerms: "80/20 after the brand pays",
    })).status, 201);
    await db.insert(payments).values({
      id: "pay-recap-floor",
      dealId: "recap-floor",
      amountOwedCents: 120000,
      creatorSplitPercent: 80,
      agencySplitPercent: 20,
      creatorPayoutCents: 96000,
      isSeed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.insert(usageRights).values({
      id: "rights-recap-floor",
      dealId: "recap-floor",
      startsOn: "2026-10-01",
      endsOn: "2027-01-15",
      renewalFeeCents: 25000,
      perpetualOverride: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const previousBase = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "/portal";
    try {
      const queued = await queueBrandRecapDrafts(db, "2026-10-08");
      assert.equal(queued.created, 1);
      const mail = (await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-floor")))[0];
      assert.equal(mail?.status, "pending");
      assert.equal(mail?.gate, "brand_recap");
      assert.equal(mail?.sentAt, null);
      const packedMail = `${mail?.subject ?? ""}\n${mail?.body ?? ""}`;
      assert.match(packedMail, /1 TikTok/);
      assert.match(packedMail, /Mari Clare M\./);
      assert.match(packedMail, /Northstar/);
      assert.match(packedMail, /Go-live: 2026-10-01/);
      assert.match(packedMail, /Usage rights end date: 2027-01-15/);
      assert.match(packedMail, /Rebook or extend usage: https:\/\/www\.mommamari\.com\/portal\/inquire\?brand=Northstar/);
      assert.match(packedMail, /\/portal\/brand-recap\//);
      assert.equal(leaksPrivate(packedMail), false);
      assert.equal(/\b45\b/.test(packedMail), false);
      assert.equal(packedMail.toLowerCase().includes("split"), false);
      const draft = (await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-floor")))[0];
      const report = await publicBrandRecap(db, draft?.token ?? "");
      const packed = JSON.stringify(report);
      assert.equal(report?.rebookHref, "/portal/inquire?brand=Northstar");
      assert.equal(report?.deliverables.includes("1 TikTok"), true);
      assert.equal(report?.deliverables.some((line) => line.toLowerCase().includes("floor")), false);
      assert.equal(report?.usageEndsOn, "2027-01-15");
      assert.equal(leaksPrivate(packed), false);
      assert.equal(packed.includes("buyer@"), false);
      assert.equal(packed.includes("rateCents"), false);
      assert.equal(packed.includes("kamronNotes"), false);
    } finally {
      if (previousBase == null) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = previousBase;
    }

    const lib = source("src/lib/brand-recap.ts");
    assert.equal(lib.includes("deal-rules"), false);
    assert.equal(lib.includes("pricingFloor"), false);
    assert.equal(lib.includes("minRates"), false);
    assert.equal(lib.includes("feeAndPayout"), false);
    assert.equal(lib.includes("payout-ledger"), false);
    assert.equal(lib.includes("rateCents"), false);
    assert.equal(lib.includes("splitPercent"), false);
    assert.equal(lib.includes("stripe"), false);
    const page = source("src/app/brand-recap/[token]/page.tsx");
    assert.match(page, /Rebook or extend usage/);
    assert.match(page, /recap-sheet/);
    assert.equal(page.includes("rateCents"), false);
    assert.equal(page.includes("stripe"), false);
    assert.equal(page.toLowerCase().includes("minimum"), false);
    assert.equal(page.toLowerCase().includes("floor"), false);
    assert.equal(page.includes("80/20"), false);
    assert.equal(page.includes("PAYMENTS"), false);
    assert.match(source("src/app/globals.css"), /@media print/);
    assert.equal(isPublicMarketingPath("/brand-recap/abc", ""), true);
    assert.equal(isPublicMarketingPath("/portal/brand-recap/abc", "/portal"), true);

    assert.equal(paymentsEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.notEqual(process.env.PUSH_ENABLED, "true");
    assert.notEqual(process.env.BOLDSIGN_ENABLED, "true");
    assert.notEqual(process.env.PAYMENTS_ENABLED, "true");
    assert.notEqual(process.env.STRIPE_ENABLED, "true");
    const migration = source("drizzle/0046_brand_recaps.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.toLowerCase().includes("update "), false);
    assert.match(migration, /CREATE TABLE brand_recap_drafts/);
    assert.match(migration, /UNIQUE \(deal_id, milestone\)/);
  });

  test("the owner panel lists due recaps, and the inquire form can open with the brand filled in", async () => {
    assert.equal((await upsertDeal(db, {
      id: "recap-no-mail",
      brand: "Quiet Brand",
      creatorId: "mariclare",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-01",
    })).status, 201);
    const rows = await listDueBrandRecaps(db, admin, "2026-10-08");
    const quiet = rows.filter((row) => row.dealId === "recap-no-mail");
    assert.equal(quiet.length, 1);
    assert.equal(quiet[0]?.milestoneLabel, "7-day recap");
    assert.equal(quiet[0]?.href, null);
    assert.match(quiet[0]?.statusLabel ?? "", /brand email/);
    assert.equal((await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-no-mail"))).length, 0);
    const camp = rows.find((row) => row.dealId === "recap-camp" && row.milestone === 7);
    assert.equal(camp?.statusLabel, "Draft waiting in Approvals");
    assert.match(camp?.href ?? "", /\/brand-recap\//);
    assert.equal((await listDueBrandRecaps(db, mariclare, "2026-10-08")).length, 0);

    assert.equal(brandInquiryPrefill("  Northstar  "), "Northstar");
    assert.equal(brandInquiryPrefill("<b>Hi</b>"), "bHi/b");
    assert.equal((brandInquiryPrefill("a".repeat(200)) ?? "").length, 120);
    assert.equal(brandInquiryPrefill("   "), null);
    assert.equal(recapInquirePath("Northstar"), "/inquire?brand=Northstar");
    const inquire = source("src/app/inquire/page.tsx");
    const form = source("src/components/brand-brief-form.tsx");
    assert.match(inquire, /brand\?: string/);
    assert.match(inquire, /brandInquiryPrefill/);
    assert.match(form, /defaultValue=\{brand \?\? ""\}/);
  });
});
