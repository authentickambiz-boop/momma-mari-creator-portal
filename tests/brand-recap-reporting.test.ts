import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, brandRecapDrafts, brandRecapGoals, campaigns, deals, payments } from "../src/db/schema";
import { listSendableApprovals } from "../src/lib/approvals";
import { upsertDeal } from "../src/lib/bot-api";
import { publicBrandRecap, queueBrandRecapDrafts, composeBrandRecap } from "../src/lib/brand-recap";
import {
  importRecapSnapshots,
  logRecapPost,
  saveDealRecapGoal,
  saveNextCampaignNote,
  saveRecapSnapshot,
} from "../src/lib/brand-recap-edit";
import {
  brandRecapCsv,
  parseKickoffGoal,
  parseSnapshotImport,
  recapMetricCards,
  type RecapCsvInput,
} from "../src/lib/brand-recap-report";
import { saveCampaign } from "../src/lib/campaigns";
import { boldSignEnabled } from "../src/lib/boldsign";
import { nowIso } from "../src/lib/format";
import { pushEnabled } from "../src/lib/home-screen";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const MONEY = ["191919", "373737", "424242", "818181", "252525", "80000", "96000"];

function leaksMoney(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("minimum")
    || lower.includes("floor")
    || lower.includes("fee split")
    || lower.includes("creator pay")
    || lower.includes("ratecents")
    || lower.includes("minrates")
    || lower.includes("creatorpayout")
    || lower.includes("payout")
    || text.includes("$")
    || text.includes("80/20")
    || text.includes("20%")
    || MONEY.some((amount) => text.includes(amount));
}

describe("brand recap reporting", () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("empty figures and sample labels stay off the cards and the csv", () => {
    assert.equal(parseKickoffGoal(undefined, undefined).ok, true);
    const half = parseKickoffGoal("views", "");
    assert.equal(half.ok, false);
    const sample = parseKickoffGoal("views", "Example 100");
    assert.equal(sample.ok, false);
    const goal = parseKickoffGoal("ugc_assets", "1,500");
    assert.equal(goal.ok, true);
    if (goal.ok) assert.equal(goal.goalTarget, "1500");
    const imported = parseSnapshotImport("48h, views, Example 10, withjuly_platform");
    assert.equal(imported.ok, false);
    const cards = recapMetricCards({
      metrics: [
        { label: "Views", value: "not reported yet" },
        { label: "Example", value: "1200" },
        { label: "Clicks", value: "Example 12" },
        { label: "Codes", value: "SAVE10" },
      ],
      snapshots: [],
    });
    assert.deepEqual(cards.map((card) => card.label), ["Codes"]);
    const csv = brandRecapCsv({
      brand: "Northstar",
      creatorName: "Mari Clare",
      milestone: 7,
      goLiveOn: "2026-10-01",
      metrics: [{ label: "Views", value: "not reported yet" }, { label: "Codes", value: "SAVE10" }],
      usageEndsOn: null,
      goal: null,
      deliverableLog: [{
        label: "Rate floor $800 minimum",
        status: "pending",
        url: null,
        platform: null,
        platformLabel: null,
        postedOn: null,
      }],
      snapshots: [],
      nextCampaignNote: null,
      rateCents: 191919,
      creatorPay: "80/20",
    } as RecapCsvInput);
    assert.equal(csv.includes("SAVE10"), true);
    assert.equal(csv.toLowerCase().includes("not reported yet"), false);
    assert.equal(csv.includes("Example"), false);
    assert.equal(leaksMoney(csv), false);
    assert.equal(csv.includes("rateCents"), false);
  });

  test("kickoff goal, contract posts, sourced snapshots, and the next-campaign note stay on the recap", async () => {
    const saved = await saveCampaign(db, admin, {
      brand: "Northstar",
      name: "Spring",
      budgetCents: 818181,
      niches: [],
      platforms: ["TikTok"],
      deliverables: ["TikTok video"],
      slots: 1,
      startsOn: "2026-10-01",
      goalType: "views",
      goalTarget: "100000",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const kept = await saveCampaign(db, admin, {
      brand: "Northstar",
      name: "Spring",
      budgetCents: 818181,
      niches: [],
      platforms: ["TikTok"],
      deliverables: ["TikTok video"],
      slots: 1,
      startsOn: "2026-10-01",
    }, saved.id);
    assert.equal(kept.ok, true);
    const stored = (await db.select().from(campaigns).where(eq(campaigns.id, saved.id)))[0];
    assert.equal(stored?.goalType, "views");
    assert.equal(stored?.goalTarget, "100000");

    assert.equal((await upsertDeal(db, {
      id: "recap-report",
      brand: "Northstar",
      creatorId: "mariclare",
      contact: "buyer@northstar.test",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-01",
      deliverables: ["TikTok video", "Reel", "Rate floor $800 minimum"],
      rateCents: 191919,
      rateLabel: "$1,919",
      amountDisplay: "$1,919",
      kamronNotes: "Her minimum floor is $800 and the agency split is 80/20.",
      paymentTerms: "80/20 after the brand pays",
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "recap-plain",
      brand: "Plain Co",
      creatorId: "mariclare",
      contact: "buyer@plain.test",
      status: "active",
      visibleToCreator: true,
      postDate: "2026-10-01",
      deliverables: ["1 TikTok"],
    })).status, 201);
    const { campaignAllocations } = await import("../src/db/schema");
    await db.insert(campaignAllocations).values({
      id: "alloc-report",
      campaignId: saved.id,
      creatorId: "mariclare",
      prospectId: null,
      amountCents: 424242,
      createdAt: nowIso(),
    });
    await db.update(deals).set({ offerAllocationId: "alloc-report" }).where(eq(deals.id, "recap-report"));
    await db.insert(payments).values({
      id: "pay-recap-report",
      dealId: "recap-report",
      amountOwedCents: 191919,
      creatorSplitPercent: 80,
      agencySplitPercent: 20,
      creatorPayoutCents: 373737,
      isSeed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const { usageRights } = await import("../src/db/schema");
    await db.insert(usageRights).values({
      id: "rights-recap-report",
      dealId: "recap-report",
      startsOn: "2026-10-01",
      endsOn: "2027-01-15",
      renewalFeeCents: 252525,
      perpetualOverride: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const queued = await queueBrandRecapDrafts(db, "2026-10-08");
    assert.equal(queued.created >= 2, true);
    const draft = (await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-report")))[0];
    assert.ok(draft);
    const early = await publicBrandRecap(db, draft?.token ?? "");
    assert.equal(early?.goal?.label, "Views");
    assert.equal(early?.goal?.target, "100,000");
    assert.equal(early?.goal?.resultStatus, "pending");
    assert.equal(early?.goal?.result, null);
    assert.equal(early?.deliverableLog.find((row) => row.label === "Reel")?.status, "pending");
    assert.equal(early?.deliverableLog.some((row) => row.label.toLowerCase().includes("floor")), false);
    assert.equal(early?.nextCampaignNote, null);
    assert.equal(early?.body.includes("Next campaign"), false);
    assert.match(early?.body ?? "", /Result: Pending/);
    assert.equal((early?.body ?? "").includes("Result: 0"), false);
    const plain = await publicBrandRecap(db, (await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-plain")))[0]?.token ?? "");
    assert.equal(plain?.goal, null);
    assert.deepEqual(plain?.snapshots, []);
    assert.equal(plain?.nextCampaignNote, null);
    assert.equal(plain?.deliverables.includes("1 TikTok"), true);
    assert.equal(plain?.title.includes("Plain Co"), true);

    assert.equal((await logRecapPost(db, mariclare, {
      dealId: "recap-report",
      url: "https://www.tiktok.com/@mariclare/video/987654321",
      platform: "tiktok",
      postedOn: "2026-10-02",
      deliverable: "TikTok video",
    })).ok, false);
    assert.equal((await logRecapPost(db, admin, {
      dealId: "recap-report",
      url: "https://www.tiktok.com/@mariclare/video/987654321",
      platform: "tiktok",
      postedOn: "2026-10-02",
      deliverable: "TikTok video",
    })).ok, true);
    assert.equal((await saveRecapSnapshot(db, admin, {
      dealId: "recap-report",
      window: "48h",
      metric: "views",
      value: "8000",
      source: "withjuly_platform",
    })).ok, true);
    assert.equal((await saveRecapSnapshot(db, admin, {
      dealId: "recap-report",
      window: "7d",
      metric: "views",
      value: "15000",
      source: "link_check",
    })).ok, true);
    assert.equal((await saveRecapSnapshot(db, admin, {
      dealId: "recap-report",
      window: "48h",
      metric: "views",
      value: "8100",
      source: "withjuly_platform",
    })).ok, true);
    assert.equal((await saveRecapSnapshot(db, admin, {
      dealId: "recap-report",
      window: "48h",
      metric: "clicks",
      value: "Example 12",
      source: "creator_submitted",
    })).ok, false);
    assert.equal((await importRecapSnapshots(db, admin, "recap-report", "48h, clicks, 86, creator-submitted\n7d, sales, 40, link_check")).ok, true);

    const filled = await publicBrandRecap(db, draft.token);
    assert.equal(filled?.goal?.result, "15000");
    assert.equal(filled?.goal?.resultWindow, "7 days");
    assert.equal(filled?.goal?.resultSource, "Link check");
    const viewShots = filled?.snapshots.filter((row) => row.metric === "views") ?? [];
    assert.deepEqual(viewShots.map((row) => row.window), ["48h", "7d"]);
    assert.equal(viewShots.find((row) => row.window === "48h")?.value, "8100");
    assert.equal(viewShots.find((row) => row.window === "7d")?.value, "15000");
    assert.equal(filled?.snapshots.some((row) => row.metric === "clicks" && row.window === "7d"), false);
    assert.equal(filled?.deliverableLog.find((row) => row.label === "TikTok video")?.status, "posted");
    assert.equal(filled?.deliverableLog.find((row) => row.label === "TikTok video")?.postedOn, "2026-10-02");
    assert.equal(filled?.deliverableLog.find((row) => row.label === "TikTok video")?.url, "https://www.tiktok.com/@mariclare/video/987654321");
    assert.equal(filled?.deliverableLog.find((row) => row.label === "Reel")?.status, "pending");
    const cards = recapMetricCards(filled ?? { metrics: [], snapshots: [] });
    assert.equal(cards.some((card) => card.value === "not reported yet"), false);
    assert.equal(cards.some((card) => /example/i.test(`${card.label} ${card.value}`)), false);
    assert.equal(cards.every((card) => card.kind === "metric" || Boolean(card.sourceLabel)), true);

    assert.equal((await saveNextCampaignNote(db, admin, {
      dealId: "recap-report",
      milestone: "7",
      note: "The agency split is 80/20.",
    })).ok, false);
    assert.equal((await saveNextCampaignNote(db, admin, {
      dealId: "recap-report",
      milestone: "7",
      note: "Let's line up a spring flight with the same hero.",
    })).ok, true);
    const shared = await publicBrandRecap(db, draft.token);
    assert.equal(shared?.nextCampaignNote, "Let's line up a spring flight with the same hero.");
    assert.match(shared?.body ?? "", /Next campaign/);
    const mail = (await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "recap-report")))[0];
    assert.equal(mail?.status, "pending");
    assert.equal(mail?.sentAt, null);
    assert.match(mail?.body ?? "", /Next campaign/);
    assert.match(mail?.body ?? "", /Let's line up a spring flight/);
    assert.equal((await listSendableApprovals(db)).some((item) => item.dealId === "recap-report"), false);
    assert.equal(leaksMoney(`${mail?.subject ?? ""}\n${mail?.body ?? ""}`), false);

    const packed = `${JSON.stringify(shared)}\n${brandRecapCsv(shared!)}`;
    assert.equal(leaksMoney(packed), false);
    assert.equal(packed.includes("Example"), false);
    assert.equal(packed.includes("buyer@"), false);
    assert.equal(packed.includes("rateCents"), false);
    assert.equal(packed.includes("kamronNotes"), false);
    const csv = brandRecapCsv(shared!);
    const pending = csv.split("\n").find((line) => line.startsWith("deliverable,Reel,"));
    assert.equal(pending, "deliverable,Reel,,,Pending,,,,");
    assert.match(csv, /TikTok video,,,Posted,TikTok,2026-10-02,https:\/\/www\.tiktok\.com\/@mariclare\/video\/987654321,/);
    assert.match(csv, /Views result,15000,Link check,reported,,,,7 days/);
    assert.match(csv, /snapshot,Clicks,86,Creator-submitted,,,,,48 hours/);
    assert.equal(csv.includes("Clicks,0"), false);
    assert.match(csv, /Next campaign,Let's line up a spring flight with the same hero/);
    assert.match(csv, /2027-01-15/);
    for (const line of csv.split("\n")) {
      if (!line.startsWith("snapshot,") && !line.startsWith("metric,")) continue;
      const sourceCell = line.split(",")[3] ?? "";
      assert.notEqual(sourceCell, "");
    }

    assert.equal((await saveDealRecapGoal(db, mariclare, "recap-report", "views", "10")).ok, false);
    assert.equal((await db.select().from(brandRecapGoals).where(eq(brandRecapGoals.dealId, "recap-report"))).length, 0);
    assert.equal((await saveDealRecapGoal(db, admin, "recap-report", "sales", "40")).ok, true);
    const overridden = await publicBrandRecap(db, draft.token);
    assert.equal(overridden?.goal?.label, "Sales");
    assert.equal(overridden?.goal?.result, "40");
    assert.equal(overridden?.goal?.resultSource, "Link check");
    const goals = await db.select().from(brandRecapGoals).where(eq(brandRecapGoals.dealId, "recap-report"));
    assert.equal(goals.length, 1);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "recap-report"))).length, 1);
    assert.equal((await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, "recap-report"))).length, 1);

    const migration = source("drizzle/0057_brand_recap_reporting.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.toLowerCase().includes("update "), false);
    assert.match(migration, /ALTER TABLE campaigns ADD COLUMN goal_type/);
    assert.match(migration, /CREATE TABLE brand_recap_snapshots/);
    assert.match(migration, /ALTER TABLE brand_recap_drafts ADD COLUMN next_campaign_note/);
    const page = source("src/app/brand-recap/[token]/page.tsx");
    const editor = source("src/app/brand-recaps/[dealId]/page.tsx");
    assert.match(page, /recap-sheet/);
    assert.match(page, /Download CSV/);
    assert.match(page, /withBasePath\(`\/brand-recap\/\$\{token\}\/csv`\)/);
    assert.equal(page.includes("report.csvHref"), false);
    assert.equal(page.toLowerCase().includes("minimum"), false);
    assert.equal(page.toLowerCase().includes("floor"), false);
    assert.equal(page.includes("80/20"), false);
    assert.equal(page.includes("rateCents"), false);
    assert.equal(editor.includes("rateCents"), false);
    assert.equal(editor.includes("80/20"), false);
    assert.equal(editor.toLowerCase().includes("minimum"), false);
    assert.equal(editor.toLowerCase().includes("floor"), false);
    assert.equal(paymentsEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
    assert.equal(pushEnabled(), false);
  });

  test("a recap composed without the new fields still reads the way it did", () => {
    const copy = composeBrandRecap({
      brand: "Plain Co",
      creatorName: "Mari Clare",
      milestone: 7,
      goLiveOn: "2026-10-01",
      deliverables: [],
      contentLinks: [],
      metrics: { views: null, engagement: null, clicks: null, codes: null },
      usageEndsOn: null,
      inquireUrl: "https://www.mommamari.com/portal/inquire?brand=Plain%20Co",
      shareUrl: "https://www.mommamari.com/portal/brand-recap/abc",
    });
    assert.equal(copy.goal, null);
    assert.deepEqual(copy.snapshots, []);
    assert.equal(copy.nextCampaignNote, null);
    assert.equal(copy.body.includes("Next campaign"), false);
    assert.match(copy.body, /Views: not reported yet/);
    assert.equal(copy.csvHref, "https://www.mommamari.com/portal/brand-recap/abc/csv");
  });
});
