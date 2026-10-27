import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { campaigns, deals, payments, sponsoredPostSnapshots, sponsoredPosts } from "../src/db/schema";
import { boldSignEnabled } from "../src/lib/boldsign";
import { nowIso } from "../src/lib/format";
import { pushEnabled } from "../src/lib/home-screen";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { pageGuideIssues } from "../src/lib/page-guides";
import { paymentsEnabled } from "../src/lib/payments-config";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import {
  canonicalPlatform,
  formatSponsoredAverage,
  isPrivateSponsoredText,
  formatSponsoredInstant,
  listSponsoredPosts,
  metricStat,
  normalizeCheckpoint,
  parseOptionalCount,
  rollupSponsoredPosts,
  safeSponsoredText,
  saveSponsoredPost,
  saveSponsoredSnapshot,
  setSponsoredPostArchived,
  SNAPSHOT_REMINDERS,
  sortSponsoredPosts,
  sponsoredBrandRecap,
  sponsoredCheckpointPlan,
  sponsoredMidnight,
  sponsoredPostChoices,
  sponsoredRecapText,
  sponsoredSnapshotsDue,
  SPONSORED_ERRORS,
  type SponsoredPostView,
} from "../src/lib/sponsored-posts";
import { abby, admin, mariclare, openTestDb } from "./harness";
import type { Viewer } from "../src/lib/types";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const manager: Viewer = {
  email: "casey.manager@gmail.com",
  role: "manager",
  creatorId: null,
  name: "Casey",
};

const TERMS = "1 Reel cross-posted to TikTok, 30-day paid usage";

function post(patch: Partial<SponsoredPostView> & Pick<SponsoredPostView, "id" | "brand" | "creatorId" | "creatorName">): SponsoredPostView {
  return {
    dealId: null,
    campaignId: null,
    campaignName: null,
    platform: "Instagram",
    postUrl: "https://www.instagram.com/reel/example",
    postedOn: "2026-10-01",
    deliverableTerms: TERMS,
    archived: false,
    createdBy: "kamron@mommamari.com",
    createdByName: "Kamron",
    createdAt: "2026-10-02T00:00:00.000Z",
    snapshots: [],
    ...patch,
  };
}

describe("sponsored post tracking", () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("checkpoints, counts, and platforms parse without inventing a price", () => {
    assert.equal(isPrivateSponsoredText(TERMS), false);
    assert.equal(safeSponsoredText(TERMS), TERMS);
    assert.equal(isPrivateSponsoredText("Rate floor $800 minimum"), true);
    assert.equal(safeSponsoredText("creator pay 80/20"), null);
    assert.equal(normalizeCheckpoint("24 hours"), "24h");
    assert.equal(normalizeCheckpoint("7 days"), "7d");
    assert.equal(normalizeCheckpoint("30 days"), "30d");
    assert.equal(normalizeCheckpoint("14 days"), "14d");
    assert.equal(normalizeCheckpoint("48h"), "48h");
    assert.equal(normalizeCheckpoint("rate floor"), null);
    assert.deepEqual(parseOptionalCount(""), { ok: true, value: null });
    assert.deepEqual(parseOptionalCount("1,200"), { ok: true, value: 1200 });
    assert.deepEqual(parseOptionalCount("0"), { ok: true, value: 0 });
    assert.equal(parseOptionalCount("-3").ok, false);
    assert.equal(parseOptionalCount("1.5").ok, false);
    assert.equal(canonicalPlatform("kick"), "Kick");
    assert.equal(canonicalPlatform("Snapchat"), "Snapchat");
    assert.equal(canonicalPlatform("x"), "X");
    assert.equal(canonicalPlatform("Twitch"), "Twitch");
    assert.equal(canonicalPlatform("myspace"), null);
    assert.equal(formatSponsoredAverage(200), "200");
    assert.equal(formatSponsoredAverage(200.5), "200.5");
  });

  test("averages stay on one checkpoint and skip a hidden post", () => {
    const posts = [
      post({
        id: "a",
        brand: "Average Co",
        creatorId: "mariclare",
        creatorName: "MariClare",
        createdAt: "2026-10-01T00:00:00.000Z",
        snapshots: [{
          id: "a7", checkpoint: "7d", checkpointLabel: "7 days", views: 100, likes: 10,
          comments: null, shares: null, saves: null, clicks: null, promoCodeUses: null, installs: null,
          note: null, enteredBy: "kamron@mommamari.com", enteredByName: "Kamron", updatedAt: "2026-10-08T00:00:00.000Z",
        }, {
          id: "a24", checkpoint: "24h", checkpointLabel: "24 hours", views: 9999, likes: null,
          comments: null, shares: null, saves: null, clicks: null, promoCodeUses: null, installs: null,
          note: null, enteredBy: "kamron@mommamari.com", enteredByName: "Kamron", updatedAt: "2026-10-02T00:00:00.000Z",
        }],
      }),
      post({
        id: "b",
        brand: "Average Co",
        creatorId: "abby",
        creatorName: "Abby Theriot",
        createdAt: "2026-10-03T00:00:00.000Z",
        snapshots: [{
          id: "b7", checkpoint: "7d", checkpointLabel: "7 days", views: 300, likes: null,
          comments: null, shares: null, saves: 4, clicks: null, promoCodeUses: 2, installs: null,
          note: null, enteredBy: "kamron@mommamari.com", enteredByName: "Kamron", updatedAt: "2026-10-10T00:00:00.000Z",
        }],
      }),
      post({
        id: "c",
        brand: "Average Co",
        creatorId: "mariclare",
        creatorName: "MariClare",
        archived: true,
        snapshots: [{
          id: "c7", checkpoint: "7d", checkpointLabel: "7 days", views: 1000, likes: null,
          comments: null, shares: null, saves: null, clicks: null, promoCodeUses: null, installs: null,
          note: null, enteredBy: "kamron@mommamari.com", enteredByName: "Kamron", updatedAt: "2026-10-10T00:00:00.000Z",
        }],
      }),
    ];
    const rollup = rollupSponsoredPosts(posts);
    assert.equal(rollup.posts, 2);
    assert.equal(metricStat(rollup, "7d", "views")?.average, 200);
    assert.equal(metricStat(rollup, "7d", "views")?.total, 400);
    assert.equal(metricStat(rollup, "7d", "views")?.count, 2);
    assert.equal(metricStat(rollup, "7d", "likes")?.average, 10);
    assert.equal(metricStat(rollup, "7d", "likes")?.count, 1);
    assert.equal(metricStat(rollup, "24h", "views")?.average, 9999);
    assert.equal(metricStat(rollup, "30d", "views"), null);
    const byViews = sortSponsoredPosts(posts, "views7d", "desc");
    assert.deepEqual(byViews.map((item) => item.id), ["c", "b", "a"]);
    const ascending = sortSponsoredPosts(posts.filter((item) => item.id !== "c"), "views7d", "asc");
    assert.deepEqual(ascending.map((item) => item.id), ["a", "b"]);
    const text = sponsoredRecapText({
      brand: "Average Co",
      posts: [
        post({
          id: "secret",
          brand: "Average Co",
          creatorId: "mariclare",
          creatorName: "MariClare",
          deliverableTerms: "Rate floor $2,500 minimum",
          campaignName: "Spring fee 424242",
        }),
      ],
      rollup: rollupSponsoredPosts([]),
    });
    assert.equal(text.includes("Rate floor"), false);
    assert.equal(text.includes("$"), false);
    assert.equal(text.includes("424242"), false);
    assert.equal(text.includes("minimum"), false);
    assert.match(text, /Deliverable: not shown/);
    assert.match(text, /The portal does not send it/);
  });

  test("the migration only adds the post log and checkpoint rows", () => {
    const sql = source("drizzle/0067_sponsored_post_tracking.sql");
    assert.match(sql, /CREATE TABLE sponsored_posts/);
    assert.match(sql, /CREATE TABLE sponsored_post_snapshots/);
    assert.match(sql, /CREATE UNIQUE INDEX sponsored_post_snapshots_post_checkpoint/);
    assert.equal(/\bdrop\b/i.test(sql), false);
    assert.equal(/\bdelete\b/i.test(sql), false);
    assert.equal(/\balter\b/i.test(sql), false);
    const lib = source("src/lib/sponsored-posts.ts");
    const actions = source("src/app/sponsored-post-actions.ts");
    const ui = [
      source("src/app/sponsored-posts/page.tsx"),
      source("src/app/sponsored-posts/recap/page.tsx"),
      source("src/components/sponsored-post-log.tsx"),
    ].join("\n");
    for (const file of [lib, actions, ui]) {
      assert.equal(file.includes(".delete("), false);
      assert.equal(file.includes("rateCents"), false);
      assert.equal(file.includes("budgetCents"), false);
      assert.equal(file.includes("paymentTerms"), false);
      assert.equal(/from ["']@\/lib\/(payments|stripe-billing|boldsign|brand-deposits|brand-invoices|home-screen)/.test(file), false);
      assert.equal(file.includes("worlds"), false);
    }
    assert.equal(/floor/i.test(ui), false);
    assert.equal(ui.includes("minimum"), false);
    assert.equal(ui.includes("formatMoney"), false);
    assert.equal(pageGuideIssues().length, 0);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.id === "sponsored-posts"), true);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.id === "sponsored-posts"), true);
    assert.equal(visiblePortalTabs(manager).some((tab) => tab.id === "sponsored-posts"), false);
    assert.equal(paymentsEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(stripeInvoicingEnabled(), false);
    assert.equal(payoutTransfersEnabled(), false);
  });

  test("the owner logs a post, checkpoints stay separate, and a creator only reads her own", async () => {
    const beforeDeals = await db.select().from(deals).where(eq(deals.id, "kosbling"));
    const beforePayments = await db.select().from(payments).where(eq(payments.dealId, "kosbling"));
    await db.insert(campaigns).values({
      id: "camp-sponsored",
      brand: "KOSBLING",
      name: "Spring posts",
      budgetCents: 424242,
      nichesJson: "[]",
      platformsJson: "[\"TikTok\"]",
      deliverablesJson: "[]",
      slots: 1,
      status: "open",
      openOutside: false,
      kind: "campaign",
      updatedAt: nowIso(),
    });

    const rejected = await saveSponsoredPost(db, admin, {
      brand: "KOSBLING",
      creatorId: "mariclare",
      platform: "Instagram",
      postUrl: "https://www.instagram.com/reel/kosbling",
      postedOn: "2026-10-20",
      deliverableTerms: "Rate floor $800 minimum",
    });
    assert.equal(rejected.ok, false);
    assert.equal(await db.select().from(sponsoredPosts).then((rows) => rows.length), 0);

    const mismatched = await saveSponsoredPost(db, admin, {
      brand: "KOSBLING",
      creatorId: "abby",
      dealId: "kosbling",
      platform: "TikTok",
      postUrl: "https://www.tiktok.com/@abby/video/1",
      postedOn: "2026-10-20",
      deliverableTerms: TERMS,
    });
    assert.equal(mismatched.ok, false);
    if (!mismatched.ok) assert.equal(mismatched.error, SPONSORED_ERRORS.deal);

    const wrongBrand = await saveSponsoredPost(db, admin, {
      brand: "Otherbrand",
      creatorId: "mariclare",
      dealId: "kosbling",
      platform: "Instagram",
      postUrl: "https://www.instagram.com/reel/kosbling",
      postedOn: "2026-10-20",
      deliverableTerms: TERMS,
    });
    assert.equal(wrongBrand.ok, false);

    const saved = await saveSponsoredPost(db, admin, {
      creatorId: "mariclare",
      dealId: "kosbling",
      campaignId: "camp-sponsored",
      platform: "instagram",
      postUrl: "https://www.instagram.com/reel/kosbling",
      postedOn: "2026-10-20",
      deliverableTerms: TERMS,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const row = (await db.select().from(sponsoredPosts).where(eq(sponsoredPosts.id, saved.id)))[0];
    assert.equal(row?.brand, "KOSBLING");
    assert.equal(row?.platform, "Instagram");
    assert.equal(row?.dealId, "kosbling");
    assert.equal(row?.campaignId, "camp-sponsored");
    assert.equal(row?.createdBy, "kamron@mommamari.com");
    assert.equal(row?.createdByName, "Kamron");
    assert.equal(row?.archived, false);

    const corrected = await saveSponsoredPost(db, admin, {
      id: saved.id,
      creatorId: "mariclare",
      dealId: "kosbling",
      campaignId: "camp-sponsored",
      platform: "Instagram",
      postUrl: "https://www.instagram.com/reel/kosbling-live",
      postedOn: "2026-10-21",
      deliverableTerms: TERMS,
    });
    assert.equal(corrected.ok, true);
    assert.equal((await db.select().from(sponsoredPosts)).length, 1);

    const day = await saveSponsoredSnapshot(db, admin, {
      postId: saved.id,
      checkpoint: "24 hours",
      views: "10000",
      likes: "",
      note: "Counted from the platform",
    });
    const week = await saveSponsoredSnapshot(db, admin, {
      postId: saved.id,
      checkpoint: "7d",
      views: "80000",
      likes: "2100",
      comments: "40",
      promoCodeUses: "12",
    });
    const month = await saveSponsoredSnapshot(db, admin, {
      postId: saved.id,
      checkpoint: "30 days",
      installs: "3",
    });
    const again = await saveSponsoredSnapshot(db, admin, {
      postId: saved.id,
      checkpoint: "7 days",
      views: "81000",
      likes: "2200",
      comments: "40",
      promoCodeUses: "12",
    });
    const extra = await saveSponsoredSnapshot(db, admin, {
      postId: saved.id,
      checkpointOther: "14 days",
      views: "80500",
    });
    assert.equal(day.ok && week.ok && month.ok && again.ok && extra.ok, true);
    const snapshots = await db.select().from(sponsoredPostSnapshots).where(eq(sponsoredPostSnapshots.postId, saved.id));
    assert.equal(snapshots.length, 4);
    const weekRow = snapshots.find((item) => item.checkpoint === "7d");
    assert.equal(weekRow?.views, 81000);
    assert.equal(weekRow?.likes, 2200);
    assert.equal(weekRow?.comments, 40);
    assert.equal(weekRow?.promoCodeUses, 12);
    assert.equal(weekRow?.enteredBy, "kamron@mommamari.com");
    assert.equal(weekRow?.enteredByName, "Kamron");
    assert.equal(snapshots.find((item) => item.checkpoint === "24h")?.likes, null);
    assert.equal(snapshots.find((item) => item.checkpoint === "14d")?.views, 80500);
    assert.equal(snapshots.filter((item) => item.checkpoint === "7d").length, 1);

    const other = await saveSponsoredPost(db, admin, {
      brand: "Harbor",
      creatorId: "abby",
      platform: "Kick",
      postUrl: "https://kick.com/abby/video/1",
      postedOn: "2026-10-18",
      deliverableTerms: "One live read on Kick",
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    await saveSponsoredSnapshot(db, admin, { postId: other.id, checkpoint: "7d", views: "50" });

    const creatorList = await listSponsoredPosts(db, mariclare, { creatorId: "abby" });
    assert.equal(creatorList.ok, true);
    if (!creatorList.ok) return;
    assert.equal(creatorList.posts.every((item) => item.creatorId === "mariclare"), true);
    assert.equal(creatorList.posts.some((item) => item.brand === "Harbor"), false);
    assert.equal(metricStat(creatorList.rollup, "7d", "views")?.average, 81000);

    const ownerList = await listSponsoredPosts(db, admin, { creatorId: "all", sort: "views7d", dir: "asc" });
    assert.equal(ownerList.ok, true);
    if (!ownerList.ok) return;
    assert.deepEqual(ownerList.posts.map((item) => item.brand), ["Harbor", "KOSBLING"]);
    assert.equal(ownerList.rollup.byBrand.length >= 2, true);
    assert.equal(ownerList.rollup.byCreator.length, 2);

    const hidden = await setSponsoredPostArchived(db, admin, other.id, true);
    assert.equal(hidden.ok, true);
    const afterArchive = await listSponsoredPosts(db, admin, { creatorId: "all" });
    assert.equal(afterArchive.ok, true);
    if (!afterArchive.ok) return;
    assert.equal(afterArchive.posts.some((item) => item.id === other.id), false);
    assert.equal((await db.select().from(sponsoredPosts)).length, 2);
    const withHidden = await listSponsoredPosts(db, admin, { creatorId: "all", includeArchived: true });
    assert.equal(withHidden.ok, true);
    if (!withHidden.ok) return;
    assert.equal(withHidden.posts.some((item) => item.id === other.id && item.archived), true);
    assert.equal(withHidden.rollup.posts, 1);

    const abbyList = await listSponsoredPosts(db, abby, { creatorId: "mariclare" });
    assert.equal(abbyList.ok, true);
    if (!abbyList.ok) return;
    assert.equal(abbyList.posts.length, 0);

    const creatorBlocked = await saveSponsoredPost(db, mariclare, {
      brand: "Harbor",
      creatorId: "mariclare",
      platform: "TikTok",
      postUrl: "https://www.tiktok.com/@mariclare/video/9",
      postedOn: "2026-10-22",
      deliverableTerms: TERMS,
    });
    assert.equal(creatorBlocked.ok, false);
    const managerBlocked = await listSponsoredPosts(db, manager, {});
    assert.equal(managerBlocked.ok, false);
    const creatorRecap = await sponsoredBrandRecap(db, mariclare, "KOSBLING");
    assert.equal(creatorRecap.ok, false);

    const recap = await sponsoredBrandRecap(db, admin, "kosbling");
    assert.equal(recap.ok, true);
    if (!recap.ok) return;
    assert.equal(recap.brand, "KOSBLING");
    assert.match(recap.text, /Average 7-day views: 81,000/);
    assert.match(recap.text, /Total 7-day views: 81,000/);
    assert.match(recap.text, /Views \/ reach: 81,000/);
    assert.match(recap.text, /Promo-code uses: 12/);
    assert.match(recap.text, /30 days — Installs: 3/);
    assert.match(recap.text, /14 days — Views \/ reach: 80,500/);
    assert.match(recap.text, /Entered by Kamron/);
    assert.match(recap.text, /Campaign: Spring posts/);
    assert.match(recap.text, /Portal deal: linked/);
    assert.match(recap.text, new RegExp(TERMS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(recap.text.includes("424242"), false);
    assert.equal(recap.text.includes("kamron@"), false);
    assert.equal(recap.text.includes("$"), false);
    assert.equal(/floor|minimum|rateCents|payout/i.test(recap.text), false);

    const choices = await sponsoredPostChoices(db, admin);
    assert.equal(choices.ok, true);
    if (!choices.ok) return;
    const packed = JSON.stringify(choices.choices);
    assert.equal(packed.includes("rateCents"), false);
    assert.equal(packed.includes("budgetCents"), false);
    assert.equal(packed.includes("paymentTerms"), false);
    assert.equal(packed.includes("424242"), false);
    assert.equal(choices.choices.platforms.includes("Kick"), true);
    assert.equal(choices.choices.platforms.includes("Snapchat"), true);

    assert.deepEqual(await db.select().from(deals).where(eq(deals.id, "kosbling")), beforeDeals);
    assert.deepEqual(await db.select().from(payments).where(eq(payments.dealId, "kosbling")), beforePayments);
    const campaign = (await db.select().from(campaigns).where(eq(campaigns.id, "camp-sponsored")))[0];
    assert.equal(campaign?.budgetCents, 424242);
  });

  test("checkpoint clocks use America/New_York, including the daylight-saving edges", () => {
    assert.equal(sponsoredMidnight("2026-10-31")?.toISOString(), "2026-10-31T04:00:00.000Z");
    assert.equal(formatSponsoredInstant("2026-10-31T04:00:00.000Z"), "Oct 31, 2026, 12:00 AM EDT");
    assert.equal(sponsoredMidnight("2026-11-01")?.toISOString(), "2026-11-01T04:00:00.000Z");
    assert.equal(sponsoredMidnight("2026-11-02")?.toISOString(), "2026-11-02T05:00:00.000Z");
    assert.equal(formatSponsoredInstant("2026-11-02T05:00:00.000Z"), "Nov 2, 2026, 12:00 AM EST");
    assert.equal(sponsoredMidnight("2026-03-07")?.toISOString(), "2026-03-07T05:00:00.000Z");
    assert.equal(sponsoredMidnight("2026-03-08")?.toISOString(), "2026-03-08T05:00:00.000Z");
    assert.equal(sponsoredMidnight("2026-03-09")?.toISOString(), "2026-03-09T04:00:00.000Z");
    assert.equal(sponsoredMidnight("2026-02-31"), null);
    assert.equal(sponsoredMidnight("2026-11-02T15:00:00.000Z"), null);

    const fallBack = sponsoredCheckpointPlan({ postedOn: "2026-11-01", snapshots: [] }, "2026-11-02T04:30:00.000Z");
    assert.ok(fallBack);
    const fallDay = fallBack.checkpoints.find((item) => item.checkpoint === "24h");
    assert.equal(fallBack.goLiveAt, "2026-11-01T04:00:00.000Z");
    assert.equal(fallDay?.dueAt, "2026-11-02T05:00:00.000Z");
    assert.equal(fallDay?.lateAt, "2026-11-03T05:00:00.000Z");
    assert.equal(fallDay?.status, "upcoming");
    assert.equal(fallDay?.dueLabel, "Nov 2, 2026, 12:00 AM EST");
    const fallWeek = fallBack.checkpoints.find((item) => item.checkpoint === "7d");
    const fallMonth = fallBack.checkpoints.find((item) => item.checkpoint === "30d");
    assert.equal(fallWeek?.dueAt, "2026-11-08T05:00:00.000Z");
    assert.equal(fallWeek?.lateAt, "2026-11-10T05:00:00.000Z");
    assert.equal(fallMonth?.dueAt, "2026-12-01T05:00:00.000Z");
    assert.equal(fallMonth?.lateAt, "2026-12-03T05:00:00.000Z");

    const spring = sponsoredCheckpointPlan({ postedOn: "2026-03-07", snapshots: [] }, "2026-03-07T12:00:00.000Z");
    assert.equal(spring?.checkpoints.find((item) => item.checkpoint === "24h")?.dueAt, "2026-03-08T05:00:00.000Z");
    assert.equal(spring?.checkpoints.find((item) => item.checkpoint === "24h")?.lateAt, "2026-03-09T04:00:00.000Z");
    assert.equal(spring?.checkpoints.find((item) => item.checkpoint === "24h")?.lateLabel, "Mar 9, 2026, 12:00 AM EDT");
  });

  test("a checkpoint is upcoming, due, late, or captured, and only the owner sees the due list", () => {
    const blank = {
      views: null, likes: null, comments: null, shares: null, saves: null, clicks: null, promoCodeUses: null, installs: null,
      note: null, enteredBy: "kamron@mommamari.com", enteredByName: "Kamron",
    };
    const early = post({
      id: "early",
      brand: "Northwind",
      creatorId: "mariclare",
      creatorName: "MariClare",
      platform: "TikTok",
      postedOn: "2026-11-01",
    });
    const middle = post({
      id: "middle",
      brand: "Harbor",
      creatorId: "abby",
      creatorName: "Abby Theriot",
      platform: "Instagram",
      postedOn: "2026-11-10",
    });
    const fresh = post({
      id: "fresh",
      brand: "Northwind",
      creatorId: "mariclare",
      creatorName: "MariClare",
      platform: "YouTube",
      postedOn: "2026-11-14",
      snapshots: [{
        ...blank,
        id: "fresh-24",
        checkpoint: "24h",
        checkpointLabel: "24 hours",
        updatedAt: "2026-11-15T15:00:00.000Z",
      }],
    });
    const open = post({
      id: "open",
      brand: "Harbor",
      creatorId: "abby",
      creatorName: "Abby Theriot",
      platform: "TikTok",
      postedOn: "2026-11-14",
    });
    const hidden = post({
      id: "hidden",
      brand: "Northwind",
      creatorId: "mariclare",
      creatorName: "MariClare",
      postedOn: "2026-10-01",
      archived: true,
    });
    const now = "2026-11-15T16:00:00.000Z";

    const atDue = sponsoredCheckpointPlan(early, "2026-11-02T05:00:00.000Z");
    assert.equal(atDue?.checkpoints.find((item) => item.checkpoint === "24h")?.status, "due");
    const stillDue = sponsoredCheckpointPlan(early, "2026-11-03T04:59:59.999Z");
    assert.equal(stillDue?.checkpoints.find((item) => item.checkpoint === "24h")?.status, "due");
    const justLate = sponsoredCheckpointPlan(early, "2026-11-03T05:00:00.000Z");
    assert.equal(justLate?.checkpoints.find((item) => item.checkpoint === "24h")?.status, "late");
    assert.equal(justLate?.checkpoints.find((item) => item.checkpoint === "7d")?.status, "upcoming");

    const capturedLate = sponsoredCheckpointPlan({
      ...early,
      snapshots: [{ checkpoint: "24h", updatedAt: "2026-11-04T18:00:00.000Z" }],
    }, now);
    assert.equal(capturedLate?.checkpoints.find((item) => item.checkpoint === "24h")?.status, "captured");
    assert.equal(capturedLate?.checkpoints.find((item) => item.checkpoint === "24h")?.capturedLabel, "Nov 4, 2026, 1:00 PM EST");
    const otherWindow = sponsoredCheckpointPlan({
      ...early,
      snapshots: [{ checkpoint: "14d", updatedAt: now }],
    }, now);
    assert.equal(otherWindow?.checkpoints.every((item) => item.status !== "captured"), true);

    const ownerDue = sponsoredSnapshotsDue(admin, [open, early, middle, fresh, hidden], now);
    assert.equal(ownerDue.ok, true);
    if (!ownerDue.ok) return;
    assert.deepEqual(ownerDue.items.map((item) => `${item.postId}:${item.checkpoint}:${item.status}`), [
      "early:24h:late",
      "early:7d:late",
      "middle:24h:late",
      "open:24h:due",
    ]);
    assert.equal(ownerDue.items.some((item) => item.postId === "hidden"), false);
    assert.equal(ownerDue.items.some((item) => item.checkpoint === "30d"), false);
    assert.equal(ownerDue.items[0]?.reminder, SNAPSHOT_REMINDERS["24h"]);
    assert.match(ownerDue.items[0]?.reminder ?? "", /disclosure/i);
    assert.match(ownerDue.items[0]?.reminder ?? "", /source label/i);
    assert.match(SNAPSHOT_REMINDERS["7d"], /organic and paid/i);
    assert.match(SNAPSHOT_REMINDERS["30d"], /boost spend/i);
    const reminderText = Object.values(SNAPSHOT_REMINDERS).join("\n");
    assert.equal(/\$|floor|minimum|payout|80\s*\/\s*20|\brates?\b/i.test(reminderText), false);

    for (const viewer of [mariclare, manager, abby]) {
      const denied = sponsoredSnapshotsDue(viewer, [early, middle, fresh], now);
      assert.equal(denied.ok, false);
      if (denied.ok) return;
      assert.equal(denied.error, SPONSORED_ERRORS.due);
      assert.equal(JSON.stringify(denied).includes("Northwind"), false);
    }

    const log = source("src/components/sponsored-post-log.tsx");
    const page = source("src/app/sponsored-posts/page.tsx");
    const recap = source("src/app/sponsored-posts/recap/page.tsx");
    assert.match(log, /Snapshots due/);
    assert.match(log, /canManage && due/);
    assert.match(log, /data-sponsored-due="owner"/);
    assert.match(page, /creatorId: "all"/);
    assert.match(page, /dueList && dueList\.ok \? sponsoredSnapshotsDue/);
    assert.match(page, /const dueList = canManage \?/);
    assert.equal(recap.includes("Snapshots due"), false);
    assert.equal(recap.includes("sponsoredSnapshotsDue"), false);
    assert.equal(recap.includes("SNAPSHOT_REMINDERS"), false);
  });
});
