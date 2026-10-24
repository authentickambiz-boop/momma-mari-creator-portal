import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { gameLedger } from "../src/db/schema";
import {
  CURRENCY,
  ECONOMY,
  ECONOMY_ITEMS,
  INTEREST_CAP_CENTS,
  catalogPricesFitTiers,
  commandPayoutCents,
  connectPayoutCents,
  dailyDecayCents,
  dailyInterestCents,
  dailyPayoutCents,
  findEconomyItem,
  formatKash,
  minigamePayoutCents,
  rewardPayoutCents,
  taskPayoutCents,
  botLevelMultiplier,
} from "../src/lib/worlds/economy";
import { ledgerSum } from "../src/lib/worlds/game-wallet";
import {
  accrueUncollectedDecay,
  bucketBalanceCents,
  buyShopItem,
  claimDailyLogin,
  claimViewerDaily,
  economyStats,
  grantEarn,
  grantReward,
  walletBalanceCents,
} from "../src/lib/worlds/game-wallet-store";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const owner = { kind: "user" as const, id: "owner" };
const bot = { kind: "bot" as const, id: "content" };

describe("Worlds Kash economy", { concurrency: false }, () => {
  test("the config is the only price list and every price fits its tier", () => {
    assert.equal(CURRENCY.code, "KASH");
    assert.equal(CURRENCY.label, "Kash $");
    assert.equal(formatKash(10), "10 Kash $");
    assert.equal(catalogPricesFitTiers(), true);
    assert.equal(botLevelMultiplier("content"), ECONOMY.botLevelMultiplier);
    assert.equal(findEconomyItem("studio-lot"), null);
    assert.equal(findEconomyItem("studio")?.price, 1500);
    assert.equal(findEconomyItem("apartment")?.price, 6000);
    assert.equal(findEconomyItem("house")?.price, 20000);
    assert.equal(findEconomyItem("creator-loft")?.price, 45000);
    assert.equal(findEconomyItem("mansion")?.price, 100000);
    assert.ok((findEconomyItem("mansion")?.slots ?? 0) > (findEconomyItem("studio")?.slots ?? 0));
    assert.ok((findEconomyItem("mansion")?.activities ?? 0) > (findEconomyItem("studio")?.activities ?? 0));
    const tiers = new Set(ECONOMY_ITEMS.map((item) => item.tier));
    for (const tier of ["basic", "common", "rare", "epic", "legendary"]) assert.equal(tiers.has(tier as "basic"), true);
    const app = source("src/components/worlds/office-app.tsx");
    assert.equal(app.includes("currency-dollars"), false);
    assert.match(app, /formatGameUnits/);
    const migration = source("drizzle/0066_game_economy.sql").toLowerCase();
    assert.equal(migration.includes("delete "), false);
    assert.equal(migration.includes("drop "), false);
    assert.equal(migration.includes("stripe"), false);
    assert.equal(source("src/lib/worlds/game-wallet-store.ts").includes("update(gameLedger)"), false);
    assert.match(source("src/app/api/worlds/economy/stats/route.ts"), /economyStats/);
    assert.match(source("src/app/api/worlds/game-wallet/route.ts"), /action === "daily"/);
    assert.match(app, /action: "daily"/);
  });

  test("a duplicate credit is rejected and command cooldowns hold", async () => {
    const db = openTestDb();
    const first = await grantEarn(db, owner, "task", "same-task", "task:a");
    assert.equal(first.ok, true);
    const again = await grantEarn(db, owner, "task", "same-task", "task:b");
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.duplicate, true);
    assert.equal(await bucketBalanceCents(db, owner, "uncollected"), taskPayoutCents(1));

    const start = new Date("2026-10-23T12:00:00.000Z");
    const opened = await grantEarn(db, bot, "command", "c1", "command:c1", { now: start });
    assert.equal(opened.ok, true);
    if (opened.ok) assert.equal(opened.credited, true);
    const held = await grantEarn(db, bot, "command", "c2", "command:c2", { now: new Date(start.getTime() + 30_000) });
    assert.equal(held.ok, true);
    if (held.ok) assert.equal(held.cooldown, true);
    assert.equal(await bucketBalanceCents(db, bot, "uncollected"), commandPayoutCents(bot.id));
    const later = await grantEarn(db, bot, "command", "c3", "command:c3", { now: new Date(start.getTime() + 61_000) });
    assert.equal(later.ok, true);
    if (later.ok) assert.equal(later.credited, true);
    assert.equal(await bucketBalanceCents(db, bot, "uncollected"), commandPayoutCents(bot.id) * 2);

    const linked = await grantEarn(db, owner, "connect", "gmail", "connect:gmail");
    assert.equal(linked.ok, true);
    const linkedAgain = await grantEarn(db, owner, "connect", "gmail", "connect:gmail:again");
    assert.equal(linkedAgain.ok, false);
    assert.equal(await bucketBalanceCents(db, owner, "uncollected"), taskPayoutCents(1) + connectPayoutCents());

    const short = await grantEarn(db, owner, "minigame", "round-short", "mini:short", { roundMs: 1_000 });
    assert.equal(short.ok, false);
    const round = await grantEarn(db, owner, "minigame", "round-1", "mini:1", { roundMs: ECONOMY.minigame.minRoundMs, score: 1 });
    assert.equal(round.ok, true);
    if (round.ok) assert.equal(round.credited, true);
    assert.equal(minigamePayoutCents(1), 2_000);
    assert.equal(minigamePayoutCents(0), 500);
  });

  test("daily login pays the flat amount and the streak stops at 30", async () => {
    const db = openTestDb();
    let when = new Date("2026-01-01T12:00:00.000Z");
    for (let day = 0; day < ECONOMY.daily.maxStreak + 1; day += 1) {
      const claimed = await claimDailyLogin(db, owner, when);
      assert.equal(claimed.ok, true);
      if (claimed.ok) assert.ok(claimed.streak <= ECONOMY.daily.maxStreak);
      when = new Date(when.getTime() + 86_400_000);
    }
    const rows = (await db.select().from(gameLedger)).filter((row) => row.source === "daily");
    assert.equal(rows.length, ECONOMY.daily.maxStreak + 1);
    assert.ok(rows.every((row) => row.amountCents === dailyPayoutCents()));
    const repeat = await claimDailyLogin(db, owner, new Date(when.getTime() - 86_400_000));
    assert.equal(repeat.ok, true);
    if (repeat.ok) assert.equal(repeat.duplicate, true);
    assert.equal(rows.length, (await db.select().from(gameLedger)).filter((row) => row.source === "daily").length);

    const live = openTestDb();
    const signedIn = await claimViewerDaily(live, admin);
    assert.equal(signedIn.ok, true);
    if (signedIn.ok) {
      assert.equal(signedIn.duplicate, false);
      assert.equal(signedIn.streak, 1);
      assert.equal(signedIn.wallet.uncollected, dailyPayoutCents() / 100);
    }
    const signedInAgain = await claimViewerDaily(live, admin);
    assert.equal(signedInAgain.ok, true);
    if (signedInAgain.ok) assert.equal(signedInAgain.duplicate, true);
    assert.equal(await bucketBalanceCents(live, owner, "uncollected"), dailyPayoutCents());
  });

  test("interest is capped and decay skips the wallet and the bank", async () => {
    assert.equal(dailyInterestCents(INTEREST_CAP_CENTS * 3, 1_000), dailyInterestCents(INTEREST_CAP_CENTS, 1_000));
    assert.ok(dailyInterestCents(INTEREST_CAP_CENTS * 3, 1_000) < Math.floor((INTEREST_CAP_CENTS * 3 * 1_000) / 70_000));
    const db = openTestDb();
    assert.equal((await grantReward(db, admin, owner, "seed", "seed")).ok, true);
    const walletBefore = await walletBalanceCents(db, owner);
    await db.insert(gameLedger).values({
      id: "old-earn",
      walletId: "user:owner",
      bucket: "uncollected",
      direction: "credit",
      amountCents: 100_000,
      reason: "task",
      source: "task",
      sourceId: "old-earn",
      idempotencyKey: "old-earn",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    await db.insert(gameLedger).values({
      id: "bank-seed",
      walletId: "user:owner",
      bucket: "bank",
      direction: "credit",
      amountCents: 50_000,
      reason: "seed",
      source: "seed",
      sourceId: "bank-seed",
      idempotencyKey: "bank-seed",
      createdAt: "2026-10-23T00:00:00.000Z",
    });
    const now = new Date("2026-10-23T12:00:00.000Z");
    await accrueUncollectedDecay(db, owner, now);
    assert.equal(await walletBalanceCents(db, owner), walletBefore);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 50_000);
    assert.equal(await bucketBalanceCents(db, owner, "uncollected"), 100_000 - dailyDecayCents(100_000));
    const decay = (await db.select().from(gameLedger)).filter((row) => row.reason === "decay");
    assert.equal(decay.length, 1);
    assert.equal(decay[0]?.bucket, "uncollected");
    assert.equal(decay[0]?.direction, "debit");
    await accrueUncollectedDecay(db, owner, now);
    assert.equal((await db.select().from(gameLedger)).filter((row) => row.reason === "decay").length, 1);
  });

  test("the shop rejects a short wallet and economy totals match the ledger", async () => {
    const db = openTestDb();
    assert.equal((await grantReward(db, admin, owner, "thin", "thin")).ok, true);
    const poor = await buyShopItem(db, admin, "jacket");
    assert.equal(poor.ok, false);
    if (!poor.ok) assert.equal(poor.error, "Not enough currency.");
    assert.equal(await walletBalanceCents(db, owner), rewardPayoutCents());
    const closed = await economyStats(db, mariclare);
    assert.equal(closed.ok, false);
    if (!closed.ok) assert.equal(closed.status, 403);
    const stats = await economyStats(db, admin);
    assert.equal(stats.ok, true);
    if (!stats.ok) return;
    const rows = await db.select().from(gameLedger);
    const net = ledgerSum(rows) / 100;
    assert.equal(stats.body.supply.wallet + stats.body.supply.bank + stats.body.supply.uncollected, net);
    const earned = rows.filter((row) => row.direction === "credit").reduce((sum, row) => sum + row.amountCents, 0) / 100;
    const spent = rows.filter((row) => row.direction === "debit").reduce((sum, row) => sum + row.amountCents, 0) / 100;
    assert.equal(stats.body.earned.days30, earned);
    assert.equal(stats.body.spent.days30, spent);
    assert.equal(stats.body.currency, "Kash $");
    assert.ok(stats.body.topSources.some((item) => item.source === "reward"));
  });
});
