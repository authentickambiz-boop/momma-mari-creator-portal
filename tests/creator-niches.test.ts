import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { CREATOR_NICHES, MAX_NICHES, VIEWER_BAR, meetsViewerBar, nichesFromStored, parseAvgViewers, validateCreatorNiches } from "../src/lib/creator-niches";
import { MEMBER_PLATFORMS } from "../src/lib/profile-shared";
import { PLATFORM_OPTIONS, platformLabel } from "../src/lib/niche-catalog";
import { ONBOARDING_PLATFORMS, onboardingPlatformId, onboardingPlatformLabel } from "../src/lib/onboarding-fields";
import { SERVICE_PLATFORMS } from "../src/lib/platforms";
import { POST_PLATFORMS, PROOF_KINDS } from "../src/lib/fulfillment";
import { deliverableKind } from "../src/lib/deal-rules";

const ids = CREATOR_NICHES.map((niche) => niche.id);

describe("creator niches", () => {
  test("rejects an empty list, a sixth niche, an unknown value, and a blocked value", () => {
    const none = validateCreatorNiches([]);
    assert.equal(none.ok, false);
    if (!none.ok) assert.equal(none.error, "Pick at least one niche.");

    const five = validateCreatorNiches(ids.slice(0, MAX_NICHES));
    assert.equal(five.ok, true);
    if (five.ok) assert.deepEqual(five.niches, ids.slice(0, 5));

    const six = validateCreatorNiches(ids.slice(0, MAX_NICHES + 1));
    assert.equal(six.ok, false);
    if (!six.ok) assert.equal(six.error, "Pick up to 5.");

    const unknown = validateCreatorNiches(["underwater"]);
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.error, "Pick a niche from the list.");

    const blocked = validateCreatorNiches(["nsfw"]);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error, "Pick a niche from the list.");
    const blockedCase = validateCreatorNiches(["NSFW"]);
    assert.equal(blockedCase.ok, false);

    const other = validateCreatorNiches(["other"], "x".repeat(41));
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.error, "Other can be 40 characters.");
    const otherOk = validateCreatorNiches(["Other"], "tabletop");
    assert.equal(otherOk.ok, true);
    if (otherOk.ok) {
      assert.deepEqual(otherOk.niches, ["other"]);
      assert.equal(otherOk.nicheOther, "tabletop");
    }
  });

  test("maps one stored vertical into the niche array and leaves unknown text alone", () => {
    assert.deepEqual(nichesFromStored(null, "Parenting"), ["parenting"]);
    assert.deepEqual(nichesFromStored('["lifestyle","gaming"]'), ["lifestyle", "gaming"]);
    assert.deepEqual(nichesFromStored("Stay-at-Home, Music"), ["stay_at_home", "music"]);
    assert.deepEqual(nichesFromStored(null, "Mom life"), []);
  });

  test("platform enum includes Kick, Twitch, X, and Snapchat", () => {
    for (const name of ["Kick", "Twitch", "X", "Snapchat", "YouTube Live"]) {
      assert.equal(PLATFORM_OPTIONS.includes(name as (typeof PLATFORM_OPTIONS)[number]), true);
      assert.equal(SERVICE_PLATFORMS.includes(name as (typeof SERVICE_PLATFORMS)[number]), true);
      assert.equal(MEMBER_PLATFORMS.includes(name as (typeof MEMBER_PLATFORMS)[number]), true);
    }
    assert.equal(platformLabel("X"), "X (Twitter)");
    assert.equal(onboardingPlatformLabel("x"), "X (Twitter)");
    assert.equal(onboardingPlatformId("Kick"), "kick");
    assert.equal(onboardingPlatformId("X (Twitter)"), "x");
    assert.equal(onboardingPlatformId("YouTube Live"), "youtube_live");
    assert.equal(ONBOARDING_PLATFORMS.includes("kick"), true);
    assert.equal(ONBOARDING_PLATFORMS.includes("twitch"), true);
    assert.equal(ONBOARDING_PLATFORMS.includes("snapchat"), true);
    for (const id of ["kick", "twitch", "youtube_live"]) {
      assert.equal(POST_PLATFORMS.includes(id as (typeof POST_PLATFORMS)[number]), true);
    }
    assert.deepEqual(PROOF_KINDS, ["vod", "screenshot"]);
    assert.equal(deliverableKind("Kick live"), "kick");
    assert.equal(deliverableKind("Twitch live"), "twitch");
    assert.equal(deliverableKind("YouTube Live"), "youtube_live");
    assert.equal(deliverableKind("Kickstarter link in bio"), null);
    assert.equal(deliverableKind("Stream segment"), "stream");
  });

  test("average viewers has to be a whole number, and 50 is the internal bar", () => {
    assert.equal(parseAvgViewers("", true).ok, false);
    assert.equal(parseAvgViewers("12.5", true).ok, false);
    assert.equal(parseAvgViewers("nope", false).ok, false);
    assert.equal(parseAvgViewers("-3", true).ok, false);
    const fifty = parseAvgViewers("50", true);
    assert.equal(fifty.ok, true);
    if (fifty.ok) {
      assert.equal(fifty.value, 50);
      assert.equal(meetsViewerBar(fifty.value), true);
    }
    const below = parseAvgViewers("49", true);
    assert.equal(below.ok, true);
    if (below.ok) assert.equal(meetsViewerBar(below.value), false);
    assert.equal(meetsViewerBar(null), false);
    assert.equal(meetsViewerBar(50.5), false);
    assert.equal(VIEWER_BAR, 50);
    const optional = parseAvgViewers("", false);
    assert.equal(optional.ok, true);
    if (optional.ok) assert.equal(optional.value, null);
  });

  test("creator screens do not mention a blocked niche or parent creators", () => {
    const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    const creatorUi = [
      "src/components/niche-multi-select.tsx",
      "src/app/profile/page.tsx",
      "src/components/question-step.tsx",
    ].map(read).join("\n");
    const adminUi = ["src/app/directory/page.tsx", "src/app/dashboard/page.tsx"].map(read).join("\n");
    assert.equal(/nsfw/i.test(creatorUi + adminUi), false);
    assert.equal(/parent creators/i.test(creatorUi + adminUi), false);
    assert.match(creatorUi, /Pick up to 5/);
    assert.equal(/meets bar/i.test(creatorUi), false);
    assert.match(adminUi, /Meets bar/);
  });
});
