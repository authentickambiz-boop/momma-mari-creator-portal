import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { analyticsSnapshots, creatorShowcases, creators } from "../src/db/schema";
import { saveSnapshot } from "../src/lib/analytics-snapshots";
import {
  MEET_HREF,
  MEET_LABEL,
  publicMeetCreator,
  publicMeetCreators,
  publicPhotoPath,
  saveOwnerShowcase,
  workWithHref,
  workWithLabel,
  type PublicMeetCreator,
  type PublicPlatformCard,
} from "../src/lib/public-creators";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function platform(card: PublicMeetCreator, name: string) {
  const found = card.platforms.find((item) => item.platform === name);
  assert.ok(found, `${card.name} is missing ${name}`);
  return found;
}

function absent(card: PublicPlatformCard, key: keyof PublicPlatformCard) {
  assert.equal(Object.hasOwn(card, key), false);
}

describe("meet our creators", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("the public page uses weekly snapshots, hides missing numbers, and stays off pay", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const cards = await publicMeetCreators(db);
    assert.deepEqual(cards.map((creator) => creator.name), ["Abby Theriot", "AuthenticKam", "MariClare"]);

    const mari = cards.find((creator) => creator.id === "mariclare");
    const kam = cards.find((creator) => creator.id === "authentickam");
    const abby = cards.find((creator) => creator.id === "abby");
    assert.ok(mari && kam && abby);
    assert.equal(mari.photo, "/creators/mariclare.jpg");
    assert.equal(kam.photo, "/creators/authentickam.jpg");
    assert.equal(abby.photo, "/creators/abby-theriot.jpg");
    assert.equal(mari.bio?.includes("North Carolina"), true);
    assert.equal(kam.bio, "Stay-at-home dad in North Carolina.");
    assert.equal(abby.location, undefined);
    assert.equal(mari.location, "North Carolina, USA");
    assert.equal(mari.lastUpdated, "2026-10-19");
    assert.equal(mari.lastUpdatedLabel, "Oct 19, 2026");
    assert.equal(mari.totalAudience, "2,643,404");
    assert.deepEqual(mari.platforms.map((item) => item.platform), ["TikTok", "Instagram", "YouTube", "Twitch"]);

    const tiktok = platform(mari, "TikTok");
    assert.equal(tiktok.handle, "@_mariclaremaclamroc_");
    assert.equal(tiktok.followers, "2.3m");
    assert.equal(tiktok.followersLabel, "Followers");
    assert.equal(tiktok.engagement, "6.76%");
    assert.equal(tiktok.averageViews, "245k");
    assert.equal(tiktok.audience?.[0]?.value, "Female 86%");
    assert.equal(tiktok.source, "July");
    absent(tiktok, "averageViewParts");

    const instagram = platform(mari, "Instagram");
    assert.equal(instagram.followers, "326k");
    assert.equal(instagram.engagement, "3.57%");
    assert.equal(instagram.period, "Past 30d");
    assert.equal(instagram.audience?.find((item) => item.label === "Location")?.value, "USA 52.4%");
    absent(instagram, "averageViews");
    absent(instagram, "averageViewParts");
    assert.equal(JSON.stringify(instagram).includes("3m"), false);

    const youtube = platform(mari, "YouTube");
    assert.equal(youtube.followersLabel, "Subscribers");
    assert.equal(youtube.followers, "9,630");
    assert.equal(youtube.engagement, "5.19%");
    absent(youtube, "handle");
    absent(youtube, "averageViews");
    assert.deepEqual(youtube.averageViewParts, [
      { label: "Long-form", value: "9,695" },
      { label: "Shorts", value: "10.8k" },
    ]);
    assert.equal(JSON.stringify(youtube).includes("1m"), false);

    const twitch = platform(mari, "Twitch");
    assert.equal(twitch.followers, "462");
    absent(twitch, "engagement");
    absent(twitch, "averageViews");
    absent(twitch, "handle");
    absent(twitch, "audience");

    const abbyInstagram = platform(abby, "Instagram");
    assert.equal(abbyInstagram.followers, "1,728");
    assert.equal(abbyInstagram.engagement, "1.57%");
    absent(abbyInstagram, "averageViews");
    assert.equal(JSON.stringify(abby).includes("saves"), false);
    absent(platform(abby, "TikTok"), "handle");
    assert.equal(platform(abby, "TikTok").averageViews, "6,237");
    assert.equal(platform(kam, "Facebook").followers, "2");
    absent(platform(kam, "Facebook"), "engagement");
    absent(platform(kam, "Facebook"), "averageViews");

    const packed = JSON.stringify(cards);
    assert.equal(packed.includes("@"), true);
    assert.equal(packed.includes("gmail"), false);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.equal(packed.toLowerCase().includes("revenue"), false);
    assert.equal(packed.includes("Scarlett"), false);
    assert.equal(packed.toLowerCase().includes("kids"), false);
    assert.equal(packed.toLowerCase().includes("rate"), false);
    assert.equal(workWithHref("mariclare"), "/inquire?with=mariclare");
    assert.equal(workWithLabel("MariClare"), "Work with MariClare");
    assert.equal(await publicMeetCreator(db, "missing"), null);
    assert.equal(publicPhotoPath("https://example.com/child.jpg"), null);
    assert.equal(publicPhotoPath("/creators/../secret.jpg"), null);

    await db.update(creators).set({ kidsAges: "secret ages" }).where(eq(creators.id, "mariclare"));
    await db.update(creatorShowcases).set({ publicOn: false }).where(eq(creatorShowcases.creatorId, "abby"));
    const hidden = await publicMeetCreators(db);
    assert.equal(hidden.some((creator) => creator.id === "abby"), false);
    assert.equal(JSON.stringify(hidden).includes("secret ages"), false);
    await db.update(creators).set({ kidsAges: null }).where(eq(creators.id, "mariclare"));
    await db.update(creatorShowcases).set({ publicOn: true }).where(eq(creatorShowcases.creatorId, "abby"));

    await db.insert(creators).values({
      id: "quiet-public",
      name: "Quiet Public",
      email: "quiet.public@example.com",
      handles: "@not-on-the-snapshot",
      kidsAges: "hidden child",
      initials: "QP",
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      isSeed: false,
      createdAt: "2026-10-20T12:00:00.000Z",
    });
    await db.insert(creatorShowcases).values({
      creatorId: "quiet-public",
      publicOn: true,
      bio: "A short public bio.",
      photoPath: "https://cdn.example/child-face.jpg",
      updatedAt: "2026-10-20T12:00:00.000Z",
    });
    const saved = await saveSnapshot(db, {
      creatorId: "quiet-public",
      platform: "TikTok",
      capturedOn: "2026-10-18",
      source: "Zernio",
      metrics: { followers: "1,200" },
      channelName: "Quiet and her toddler",
      revenueCents: 5000,
      location: "Lifestyle",
    }, "Zernio");
    assert.equal(saved.ok, true);
    const quiet = await publicMeetCreator(db, "quiet-public");
    assert.ok(quiet);
    assert.equal(quiet.photo, undefined);
    assert.equal(quiet.location, undefined);
    assert.equal(quiet.lastUpdated, "2026-10-18");
    assert.equal(quiet.platforms[0]?.followers, "1,200");
    assert.equal(quiet.platforms[0]?.source, "Zernio");
    absent(quiet.platforms[0], "engagement");
    absent(quiet.platforms[0], "averageViews");
    absent(quiet.platforms[0], "handle");
    const quietPacked = JSON.stringify(quiet);
    assert.equal(quietPacked.includes("toddler"), false);
    assert.equal(quietPacked.includes("5000"), false);
    assert.equal(quietPacked.includes("@not-on-the-snapshot"), false);
    assert.equal(quietPacked.includes("hidden child"), false);

    await db.insert(creators).values({
      id: "still-private",
      name: "Still Private",
      email: "still.private@example.com",
      initials: "SP",
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      isSeed: false,
      createdAt: "2026-10-20T12:00:00.000Z",
    });
    await db.insert(creators).values({
      id: "marked-invalid",
      name: "Marked Invalid",
      email: "marked@example.invalid",
      initials: "MI",
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      isSeed: false,
      createdAt: "2026-10-20T12:00:00.000Z",
    });
    await db.insert(creatorShowcases).values({
      creatorId: "marked-invalid",
      publicOn: true,
      bio: "Should stay hidden.",
      photoPath: "/creators/mariclare.jpg",
      updatedAt: "2026-10-20T12:00:00.000Z",
    });
    const filtered = await publicMeetCreators(db);
    assert.equal(filtered.some((creator) => creator.id === "still-private" || creator.id === "marked-invalid"), false);

    assert.equal((await saveOwnerShowcase(db, mariclare, {
      creatorId: "abby",
      publicOn: false,
      bio: "Nope",
      photoPath: "",
      creatorOnlyPhoto: false,
    })).ok, false);
    const pay = await saveOwnerShowcase(db, admin, {
      creatorId: "abby",
      publicOn: true,
      bio: "Rates from $500. Minimums apply.",
      photoPath: "/creators/abby-theriot.jpg",
      creatorOnlyPhoto: true,
    });
    assert.equal(pay.ok, false);
    const remote = await saveOwnerShowcase(db, admin, {
      creatorId: "abby",
      publicOn: true,
      bio: "Mom sharing lifestyle content.",
      photoPath: "https://example.com/abby.jpg",
      creatorOnlyPhoto: true,
    });
    assert.equal(remote.ok, false);
    const unconfirmed = await saveOwnerShowcase(db, admin, {
      creatorId: "abby",
      publicOn: true,
      bio: "Mom sharing lifestyle content.",
      photoPath: "/creators/abby-theriot.jpg",
      creatorOnlyPhoto: false,
    });
    assert.equal(unconfirmed.ok, false);
    const kept = await saveOwnerShowcase(db, admin, {
      creatorId: "quiet-public",
      publicOn: false,
      bio: "A short public bio.",
      photoPath: "",
      creatorOnlyPhoto: false,
    });
    assert.equal(kept.ok, true);
    assert.equal(await publicMeetCreator(db, "quiet-public"), null);

    await db.delete(analyticsSnapshots).where(eq(analyticsSnapshots.creatorId, "quiet-public"));
    await db.delete(creatorShowcases).where(eq(creatorShowcases.creatorId, "quiet-public"));
    await db.delete(creatorShowcases).where(eq(creatorShowcases.creatorId, "marked-invalid"));
    await db.delete(creators).where(eq(creators.id, "quiet-public"));
    await db.delete(creators).where(eq(creators.id, "still-private"));
    await db.delete(creators).where(eq(creators.id, "marked-invalid"));

    const page = source("src/app/meet/page.tsx");
    const component = source("src/components/meet-creators.tsx");
    const shell = source("src/components/public-shell.tsx");
    const inquire = source("src/app/inquire/page.tsx");
    const css = source("src/app/globals.css");
    const layout = source("src/app/layout.tsx");
    assert.match(page, /PUBLIC_ROBOTS/);
    assert.match(page, /MEET_LABEL/);
    assert.match(component, /workWithLabel\(creator\.name\)/);
    assert.match(component, /Engagement rate/);
    assert.match(component, /Average views/);
    assert.equal(component.includes("gmail"), false);
    assert.equal(component.toLowerCase().includes("minimum"), false);
    assert.equal(component.includes("kidsAges"), false);
    assert.equal(/\$\d/.test(component), false);
    assert.equal(component.toLowerCase().includes("revenue"), false);
    assert.equal(shell.includes('href="/roster"'), false);
    assert.match(shell, /MEET_HREF/);
    assert.equal(MEET_HREF, "/meet");
    assert.equal(MEET_LABEL, "Meet Our Creators");
    assert.equal(isPublicMarketingPath("/meet", ""), true);
    assert.equal(isPublicMarketingPath("/portal/meet/", "/portal"), true);
    assert.match(inquire, /publicMeetCreator/);
    assert.match(css, /\.meet-card h2 \{ color: #1F3B2D; \}/);
    assert.match(css, /background: #B4532F;/);
    const phone = css.slice(css.indexOf("@media (max-width: 820px)"));
    assert.match(phone, /\.meet-grid \{ grid-template-columns: 1fr; \}/);
    assert.match(layout, /Fraunces/);
    assert.match(layout, /Inter/);

    const restored = await publicMeetCreators(db);
    assert.deepEqual(restored.map((creator) => creator.id), ["abby", "authentickam", "mariclare"]);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingBefore?.stageEvents?.length);
  });
});
