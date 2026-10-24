import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CITY_SHOP,
  HOME_TIER_LABEL,
  HOME_TIERS,
  REAL_PAYMENTS,
  homeTierRank,
  type HomeTier,
} from "../src/lib/worlds/economy";
import { worldsCityEnabled, worldsCitySmokeEnabled } from "../src/lib/worlds/city/flag";
import { buyCityItem, emptyCitySession, LIVE_EMAIL_SEND, LIVE_SOCIAL_ACTIONS } from "../src/lib/worlds/city/tasks";

function sessionFor(tier: HomeTier, kashCents: number) {
  return { ...emptyCitySession(), homeTier: tier, kashCents };
}

test("the smoke page stays off unless both city flags are exactly true", () => {
  assert.equal(LIVE_SOCIAL_ACTIONS, false);
  assert.equal(LIVE_EMAIL_SEND, false);
  assert.equal(REAL_PAYMENTS, false);
  assert.equal(worldsCityEnabled({}), false);
  assert.equal(worldsCitySmokeEnabled({}), false);
  assert.equal(worldsCitySmokeEnabled({ WORLDS_CITY: "true" }), false);
  assert.equal(worldsCitySmokeEnabled({ WORLDS_CITY: "true", WORLDS_CITY_SMOKE: "TRUE" }), false);
  assert.equal(worldsCitySmokeEnabled({ WORLDS_CITY: "TRUE", WORLDS_CITY_SMOKE: "true" }), false);
  assert.equal(worldsCitySmokeEnabled({ WORLDS_CITY: "true", WORLDS_CITY_SMOKE: "true" }), true);

  const page = readFileSync("src/app/worlds/city/smoke/page.tsx", "utf8");
  assert.match(page, /worldsCitySmokeEnabled/);
  assert.match(page, /notFound\(\)/);
  assert.equal(page.includes("fetch("), false);
  assert.equal(page.includes("mailto:"), false);
  const app = readFileSync("src/components/worlds/city/smoke-app.tsx", "utf8");
  assert.match(app, /data-city-smoke="owner"/);
  assert.equal(app.includes("fetch("), false);
  assert.equal(app.includes("mailto:"), false);
});

test("every home tier has a buy or reject result for every shop item", () => {
  assert.equal(HOME_TIERS.length, 5);
  assert.equal(new Set(CITY_SHOP.map((item) => item.sku)).size, CITY_SHOP.length);
  assert.ok(CITY_SHOP.length >= 15);
  assert.deepEqual([...HOME_TIERS], ["studio", "apartment", "house", "creator-loft", "mansion"]);
  let now = 3_000_000;
  const bought: string[] = [];
  const rejected: string[] = [];

  for (const tier of HOME_TIERS) {
    for (const item of CITY_SHOP) {
      const session = sessionFor(tier, 500_000);
      const result = buyCityItem(session, item.sku, now);
      now += 5_000;
      const allowed = homeTierRank(tier) >= homeTierRank(item.minTier);
      const label = `${tier} ${item.sku}`;
      if (allowed) {
        assert.equal(result.ok, true, label);
        if (!result.ok) continue;
        assert.equal(result.session.kashCents, 500_000 - item.priceCents, label);
        assert.ok(result.session.ownedSkus.includes(item.sku), label);
        assert.match(result.message, /Momma Mari owns this/);
        assert.match(result.message, /No real payment/);
        assert.equal(result.session.homeTier, tier);
        assert.equal(session.kashCents, 500_000, label);
        assert.equal(session.ownedSkus.length, 0, label);
        bought.push(label);
        continue;
      }
      assert.equal(result.ok, false, label);
      if (result.ok) continue;
      assert.equal(session.kashCents, 500_000, label);
      assert.equal(session.ownedSkus.length, 0, label);
      if (item.kind === "outdoor" || item.kind === "oversized") {
        assert.match(result.error, /cannot buy yard, outdoor, or oversized/, label);
        assert.match(result.error, new RegExp(HOME_TIER_LABEL[item.minTier]), label);
      } else {
        assert.match(result.error, new RegExp(`${HOME_TIER_LABEL[item.minTier]} unlocks ${item.name}`), label);
        assert.match(result.error, new RegExp(`You live in a ${HOME_TIER_LABEL[tier]}`), label);
        assert.equal(result.error.includes("yard, outdoor, or oversized"), false, label);
      }
      rejected.push(label);
    }
  }

  assert.equal(bought.length + rejected.length, HOME_TIERS.length * CITY_SHOP.length);
  assert.ok(bought.includes("studio city-waves"));
  assert.ok(rejected.includes("studio city-lamp"));
  assert.ok(bought.includes("apartment city-lamp"));
  assert.ok(rejected.includes("apartment city-planter"));
  assert.ok(bought.includes("house city-planter"));
  assert.ok(bought.includes("house city-sectional"));
  assert.ok(rejected.includes("house city-backdrop"));
  assert.ok(bought.includes("creator-loft city-backdrop"));
  assert.ok(rejected.includes("creator-loft city-bench"));
  assert.ok(bought.includes("mansion city-bench"));
});

test("a mansion can buy twelve shop items in a day, then the shop cap holds the rest", () => {
  let session = sessionFor("mansion", 500_000);
  let now = 8_000_000;
  let spent = 0;
  for (let index = 0; index < 12; index += 1) {
    const item = CITY_SHOP[index];
    const result = buyCityItem(session, item.sku, now);
    assert.equal(result.ok, true, item?.sku);
    if (!result.ok || !item) return;
    session = result.session;
    spent += item.priceCents;
    now += 3_000;
  }
  assert.equal(session.kashCents, 500_000 - spent);
  assert.equal(session.ownedSkus.length, 12);
  const held = CITY_SHOP[12];
  assert.ok(held);
  assert.ok(homeTierRank("mansion") >= homeTierRank(held.minTier));
  const blocked = buyCityItem(session, held.sku, now);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.match(blocked.error, /limited to 12/);
  assert.equal(session.ownedSkus.includes(held.sku), false);
  assert.equal(session.kashCents, 500_000 - spent);
});

test("an empty wallet is a balance miss, not a tier lock", () => {
  const session = sessionFor("studio", 0);
  const result = buyCityItem(session, "city-waves", 9_000_000);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /That costs Kash \$40\.00/);
  assert.match(result.error, /You have Kash \$0\.00/);
  assert.equal(result.error.includes("unlocks"), false);
});
