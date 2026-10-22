import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { adminNotifications, approvalEmails, creatorNotifications, giftedOffers, gmailBridgeMessages, gmailBridgeThreads, livePosts, promoVisuals } from "../src/db/schema";
import { listSendableApprovals } from "../src/lib/approvals";
import { upsertDeal } from "../src/lib/bot-api";
import { nowIso } from "../src/lib/format";
import {
  brandInitial,
  choosePromoImage,
  extractOpenGraphImage,
  imageNeedsCheck,
  publicImagePageUrl,
} from "../src/lib/promo-image";
import { promoViewsForDeals, promoViewsForGifts, savePromoVisual } from "../src/lib/promo-visuals";
import { saveUsageRights } from "../src/lib/usage";
import { queueUsageRenewalDrafts, renewalOfferDraft } from "../src/lib/usage-renewal";
import {
  EXPIRED_NOT_EXTENDED,
  EXTENSION_LEAD_DAYS,
  MARICLARE_PAID_USAGE_NOTE,
  TAKEDOWN_NOTICE,
  considerExpiredPostRemoval,
  listPostedUsageWindows,
  syncPostedUsageNotices,
  usageAutoRemovePostsEnabled,
} from "../src/lib/usage-extension";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const TODAY = "2026-10-21";

describe("offer images and posted usage", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a product image prefers the brand email, then the product page, then an owner link", () => {
    const email = choosePromoImage({
      brand: "Glow",
      productName: "Glow bar",
      email: [{ source: "email", url: "https://mail.example/glow-bar.jpg", filename: "glow-bar.jpg" }],
      website: [{ source: "website", url: "https://cdn.example/glow-bar.jpg", pageUrl: "https://glow.example/products/glow-bar", filename: "glow-bar.jpg" }],
      owner: [{ source: "owner", url: "https://files.example/glow-bar.jpg", filename: "glow-bar.jpg" }],
    });
    assert.equal(email?.source, "email");
    assert.equal(email?.sourceLabel, "From brand email");
    assert.equal(email?.needsCheck, false);

    const logo = choosePromoImage({
      brand: "Glow",
      productName: "Glow bar",
      email: [{ source: "email", url: "https://mail.example/logo.png", filename: "logo.png" }],
      website: [{ source: "website", url: "https://cdn.example/glow-bar.jpg", pageUrl: "https://glow.example/products/glow-bar", filename: "glow-bar.jpg" }],
    });
    assert.equal(logo?.source, "email");
    assert.equal(logo?.needsCheck, true);
    assert.equal(imageNeedsCheck({ source: "email", url: "https://mail.example/camera-roll.jpg", filename: "camera-roll.jpg" }, "Glow bar"), true);

    const site = choosePromoImage({
      brand: "Glow",
      productName: "Glow bar",
      email: [{ source: "email", url: "https://mail.example/tracking-pixel.gif", filename: "tracking-pixel.gif" }],
      website: [{ source: "website", url: "https://cdn.example/glow-bar.jpg", pageUrl: "https://glow.example/products/glow-bar", filename: "glow-bar.jpg" }],
      owner: [{ source: "owner", url: "https://files.example/owner.jpg", filename: "owner.jpg" }],
    });
    assert.equal(site?.source, "website");
    assert.equal(site?.sourceLabel, "From brand website");
    assert.equal(site?.pageUrl, "https://glow.example/products/glow-bar");

    const owner = choosePromoImage({
      brand: "Glow",
      productName: "Glow bar",
      owner: [{ source: "owner", url: "https://files.example/glow-bar.jpg", filename: "glow-bar.jpg" }],
    });
    assert.equal(owner?.source, "owner");
    assert.equal(owner?.sourceLabel, "Owner upload");
    assert.equal(choosePromoImage({ brand: "Glow", productName: "Glow bar" }), null);
    assert.equal(brandInitial("Glow"), "G");
    assert.equal(brandInitial("  "), "?");
  });

  test("a product page image is read from og:image and private links are refused", () => {
    const html = `<html><head><meta property="og:image" content="/photos/glow-bar.jpg"></head><body><img class="product" src="/ignored.gif"></body></html>`;
    assert.equal(extractOpenGraphImage(html, "https://glow.example/products/glow-bar"), "https://glow.example/photos/glow-bar.jpg");
    const product = `<html><body><img class="product-hero" src="/images/glow-bar.webp"></body></html>`;
    assert.equal(extractOpenGraphImage(product, "https://glow.example/products/glow-bar"), "https://glow.example/images/glow-bar.webp");
    assert.equal(publicImagePageUrl("https://glow.example/products/glow-bar"), "https://glow.example/products/glow-bar");
    assert.equal(publicImagePageUrl("http://127.0.0.1/admin"), null);
    assert.equal(publicImagePageUrl("http://10.0.0.5/secret"), null);
    assert.equal(publicImagePageUrl("file:///etc/passwd"), null);
    assert.equal(publicImagePageUrl("http://localhost/glow"), null);
  });

  test("synced mail, a saved page image, and a gifted photo resolve in that order", async () => {
    assert.equal((await upsertDeal(db, {
      id: "promo-glow",
      brand: "Glow",
      subtitle: "Glow bar",
      creatorId: "mariclare",
      status: "active",
      workflowStage: "draft_due",
      visibleToCreator: true,
      gmailThreadId: "thread-glow",
    })).status, 201);
    const threadId = "row-glow";
    await db.insert(gmailBridgeThreads).values({
      id: threadId,
      creatorId: "mariclare",
      mailbox: "mmaclamroc@gmail.com",
      threadId: "thread-glow",
      dealId: "promo-glow",
      brand: "Glow",
      subject: "Glow bar for Mari",
      snippet: "See the glow bar https://cdn.example/embedded-glow-bar.jpg",
      fromEmail: "buyer@glow.example",
      classification: "deal",
      private: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.insert(gmailBridgeMessages).values({
      messageId: "msg-glow",
      threadRowId: threadId,
      fromEmail: "buyer@glow.example",
      subject: "Glow bar for Mari",
      snippet: "Photo attached",
      attachmentsJson: JSON.stringify([{ id: "att-glow", filename: "glow-bar.jpg", mimeType: "image/jpeg" }]),
      createdAt: nowIso(),
    });
    assert.equal((await savePromoVisual(db, admin, {
      subjectType: "deal",
      subjectId: "promo-glow",
      productName: "Glow bar",
      productPageUrl: "https://glow.example/products/glow-bar",
      ownerImageUrl: "https://files.example/glow-bar.jpg",
    })).ok, true);
    await db.update(promoVisuals).set({ websiteImageUrl: "https://cdn.example/page-glow-bar.jpg" }).where(eq(promoVisuals.subjectId, "promo-glow"));
    const views = await promoViewsForDeals(db, [{ id: "promo-glow", brand: "Glow", subtitle: "Glow bar" }]);
    assert.equal(views["promo-glow"]?.choice?.source, "email");
    assert.equal(views["promo-glow"]?.choice?.sourceLabel, "From brand email");
    assert.match(views["promo-glow"]?.choice?.url ?? "", /att-glow/);
    assert.equal(views["promo-glow"]?.choice?.needsCheck, false);

    const refused = await savePromoVisual(db, mariclare, {
      subjectType: "deal",
      subjectId: "promo-glow",
      ownerImageUrl: "https://files.example/other.jpg",
    });
    assert.equal(refused.ok, false);
    const local = await savePromoVisual(db, admin, {
      subjectType: "deal",
      subjectId: "promo-glow",
      productPageUrl: "http://192.168.1.8/glow",
    });
    assert.equal(local.ok, false);

    const giftId = "gift-glow";
    await db.insert(giftedOffers).values({
      id: giftId,
      brand: "Glow",
      product: "Glow bar",
      photosJson: JSON.stringify(["https://files.example/glow-bar.jpg"]),
      deliverable: "1 TikTok",
      dueOn: "2026-11-20",
      retailValueCents: 2400,
      createdBy: "Kamron",
      createdAt: nowIso(),
    });
    const gifts = await promoViewsForGifts(db, [{ id: giftId, brand: "Glow", product: "Glow bar", photos: ["https://files.example/glow-bar.jpg"] }]);
    assert.equal(gifts[giftId]?.choice?.source, "email");
    assert.equal(gifts[giftId]?.choice?.sourceLabel, "From brand email");
  });

  test("posted usage flags seven days out, drafts an extension, and does not reveal a rate", async () => {
    assert.equal(EXTENSION_LEAD_DAYS, 7);
    assert.equal((await upsertDeal(db, {
      id: "usage-week",
      brand: "Week Brand",
      creatorId: "mariclare",
      contact: "buyer@weekbrand.example",
      status: "active",
      workflowStage: "scheduled_posted",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "usage-eight",
      brand: "Eight Brand",
      creatorId: "mariclare",
      status: "active",
      workflowStage: "scheduled_posted",
      visibleToCreator: true,
    })).status, 201);
    assert.equal((await upsertDeal(db, {
      id: "usage-abby",
      brand: "Abby Brand",
      creatorId: "abby",
      contact: "buyer@abbybrand.example",
      status: "active",
      workflowStage: "paid",
      visibleToCreator: true,
    })).status, 201);
    const stamp = nowIso();
    for (const dealId of ["usage-week", "usage-eight", "usage-abby"]) {
      await db.insert(livePosts).values({
        id: `post-${dealId}`,
        dealId,
        platform: "tiktok",
        url: `https://www.tiktok.com/@mari/video/${dealId}`,
        meetsBrief: null,
        confirmedAt: null,
        confirmedBy: null,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-week",
      startsOn: "2026-09-28",
      endsOn: null,
      tier: 30,
      channels: ["paid_ads"],
      usageType: "paid",
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-eight",
      startsOn: "2026-09-29",
      endsOn: null,
      tier: 30,
      channels: ["organic_repost"],
      usageType: "organic",
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-abby",
      startsOn: "2026-09-28",
      endsOn: null,
      tier: 30,
      channels: ["paid_ads"],
      usageType: "paid",
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);

    const sample = renewalOfferDraft({
      brand: "Week Brand",
      creatorName: "MariClare",
      endsOn: "2026-10-28",
      channelsLabel: "Paid ads / whitelisting",
      daysLeft: 7,
    });
    assert.equal(sample.body.includes("$"), false);
    assert.equal(sample.body.includes("2500"), false);
    assert.equal(sample.body.toLowerCase().includes("minimum"), false);

    const queued = await queueUsageRenewalDrafts(db, TODAY);
    assert.equal(queued.created >= 1, true);
    const approvals = await db.select().from(approvalEmails).where(eq(approvalEmails.dealId, "usage-week"));
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0]?.status, "pending");
    assert.equal(approvals[0]?.gate, "usage_renewal");
    assert.equal((approvals[0]?.body ?? "").includes("$"), false);
    assert.equal((approvals[0]?.body ?? "").includes("2500"), false);
    assert.equal((approvals[0]?.body ?? "").toLowerCase().includes("minimum"), false);
    const sendable = await listSendableApprovals(db);
    assert.equal(sendable.some((item) => item.dealId === "usage-week"), false);

    const ownerRows = await listPostedUsageWindows(db, admin, TODAY);
    const week = ownerRows.find((row) => row.dealId === "usage-week");
    const eight = ownerRows.find((row) => row.dealId === "usage-eight");
    const abby = ownerRows.find((row) => row.dealId === "usage-abby");
    assert.equal(week?.creatorName, "MariClare");
    assert.equal(week?.postLinks[0], "https://www.tiktok.com/@mari/video/usage-week");
    assert.equal(week?.usageTypeLabel, "Paid ads");
    assert.equal(week?.startsOn, "2026-09-28");
    assert.equal(week?.endsOn, "2026-10-28");
    assert.equal(week?.daysLeft, 7);
    assert.equal(week?.status, "Ending soon");
    assert.equal(week?.flagged, true);
    assert.equal(week?.suggestion, MARICLARE_PAID_USAGE_NOTE);
    assert.equal(eight?.daysLeft, 8);
    assert.equal(eight?.status, "In term");
    assert.equal(eight?.flagged, false);
    assert.equal(eight?.suggestion, null);
    assert.equal(abby?.suggestion, null);
    const creatorRows = await listPostedUsageWindows(db, mariclare, TODAY);
    assert.equal(creatorRows.find((row) => row.dealId === "usage-week")?.suggestion, null);
    assert.equal(creatorRows.some((row) => row.dealId === "usage-abby"), false);
  });

  test("an ended window is marked not extended, Kamron and the creator are told, and the post stays up", async () => {
    assert.equal((await upsertDeal(db, {
      id: "usage-ended",
      brand: "Ended Brand",
      creatorId: "mariclare",
      status: "active",
      workflowStage: "scheduled_posted",
      visibleToCreator: true,
    })).status, 201);
    const stamp = nowIso();
    await db.insert(livePosts).values({
      id: "post-usage-ended",
      dealId: "usage-ended",
      platform: "instagram",
      url: "https://www.instagram.com/p/ended",
      meetsBrief: null,
      confirmedAt: null,
      confirmedBy: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    assert.equal((await saveUsageRights(db, {
      dealId: "usage-ended",
      startsOn: "2026-09-20",
      endsOn: null,
      tier: 30,
      channels: ["website"],
      usageType: "organic",
      actorEmail: admin.email,
      actorRole: "admin",
    })).ok, true);
    const before = await db.select().from(livePosts).where(eq(livePosts.dealId, "usage-ended"));
    const first = await syncPostedUsageNotices(db, TODAY);
    const second = await syncPostedUsageNotices(db, TODAY);
    assert.equal(first.owners, 1);
    assert.equal(first.creators, 1);
    assert.equal(second.owners, 0);
    assert.equal(second.creators, 0);
    const row = (await listPostedUsageWindows(db, admin, TODAY)).find((item) => item.dealId === "usage-ended");
    assert.equal(row?.status, EXPIRED_NOT_EXTENDED);
    assert.equal(row?.takedownNotice, TAKEDOWN_NOTICE);
    assert.equal(row?.daysLeft, -1);
    const ownerNote = (await db.select().from(adminNotifications).where(eq(adminNotifications.kind, "usage_expired")))
      .find((note) => note.message.includes("Ended Brand"));
    assert.match(ownerNote?.message ?? "", /Expired - not extended/);
    assert.equal((ownerNote?.message ?? "").includes("$"), false);
    const creatorNote = (await db.select().from(creatorNotifications).where(eq(creatorNotifications.dealId, "usage-ended")))[0];
    assert.match(creatorNote?.message ?? "", /take this post down if you want/);
    assert.equal((creatorNote?.message ?? "").includes("$"), false);
    assert.equal((creatorNote?.message ?? "").toLowerCase().includes("minimum"), false);
    const removal = considerExpiredPostRemoval();
    assert.equal(usageAutoRemovePostsEnabled(), false);
    assert.equal(removal.removed, false);
    assert.equal(removal.reason, "off");
    const after = await db.select().from(livePosts).where(eq(livePosts.dealId, "usage-ended"));
    assert.equal(after.length, before.length);
    assert.equal(after[0]?.url, "https://www.instagram.com/p/ended");

    const extension = source("src/lib/usage-extension.ts");
    assert.equal(extension.includes("deal-rules"), false);
    assert.equal(extension.includes("minRates"), false);
    assert.equal(extension.includes(".delete("), false);
    const migration = source("drizzle/0055_promo_visuals.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.match(source("src/components/promo-visual.tsx"), /loading="lazy"/);
    assert.match(source("src/components/promo-visual.tsx"), /From brand email|sourceLabel/);
    assert.match(source("src/app/rights/page.tsx"), /How to use/);
    assert.match(source("src/app/rights/page.tsx"), /Expired - not extended/);
    assert.match(source("src/app/rights/page.tsx"), /queueUsageRenewalDrafts/);
    assert.equal(source("src/lib/usage-renewal.ts").includes("2500"), false);
  });
});
