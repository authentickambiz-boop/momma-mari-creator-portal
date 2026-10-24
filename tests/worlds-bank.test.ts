import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { gameBankMarks, gameLedger } from "../src/db/schema";
import { nowIso } from "../src/lib/format";
import { commandPayoutCents, taskPayoutCents } from "../src/lib/worlds/economy";
import {
  BANK_PERKS,
  dailyInterestCents,
  parseWeeklyInterest,
} from "../src/lib/worlds/game-wallet";
import {
  accrueBankInterest,
  bucketBalanceCents,
  buyShopItem,
  collectEarnings,
  depositToBank,
  grantEarn,
  grantReward,
  loseWalletFunds,
  ownedSkus,
  saveInterestRate,
  walletBalanceCents,
  withdrawFromBank,
} from "../src/lib/worlds/game-wallet-store";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const owner = { kind: "user" as const, id: "owner" };
const day = new Date("2026-10-23T12:00:00.000Z");
const nextDay = new Date("2026-10-24T12:00:00.000Z");

describe("Worlds in-game bank", { concurrency: false }, () => {
  test("earnings wait uncollected, then collect, deposit, and withdraw once", async () => {
    const db = openTestDb();
    const migration = source("drizzle/0065_game_bank.sql").toLowerCase();
    assert.equal(migration.includes("delete "), false);
    assert.equal(migration.includes("drop "), false);
    assert.equal(migration.includes("stripe"), false);
    assert.equal(migration.includes("price"), false);
    const route = source("src/app/api/worlds/game-wallet/route.ts");
    assert.equal(route.includes("payments"), false);
    assert.equal(route.includes("stripe"), false);
    assert.equal(route.includes("loseWalletFunds"), false);
    assert.match(route, /collect/);
    assert.match(route, /deposit/);
    assert.match(route, /withdraw/);
    assert.match(route, /set-interest/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /BANK/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /onOpenBank/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Wallet /);
    assert.match(source("src/components/worlds/office-app.tsx"), /Bank /);
    assert.match(source("src/components/worlds/office-app.tsx"), /Uncollected/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Collect to wallet/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Keep in bank/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Deposit/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Withdraw/);
    assert.equal(BANK_PERKS[0]?.note, "Bank-only perks will show up here later.");
    assert.match(source("src/components/worlds/office-app.tsx"), /wallet\.perks/);

    const taskCents = taskPayoutCents(1);
    const commandCents = commandPayoutCents();
    const earned = await grantEarn(db, owner, "task", "task:one", "task:one");
    assert.equal(earned.ok, true);
    assert.equal(await walletBalanceCents(db, owner), 0);
    assert.equal(await bucketBalanceCents(db, owner, "uncollected"), taskCents);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 0);

    const kept = await collectEarnings(db, admin, null, "bank", "keep-1", day);
    assert.equal(kept.ok, true);
    if (!kept.ok) return;
    assert.equal(kept.wallet.bank, taskCents / 100);
    assert.equal(kept.wallet.uncollected, 0);
    assert.equal(kept.wallet.balance, 0);
    const keptAgain = await collectEarnings(db, admin, null, "bank", "keep-1", day);
    assert.equal(keptAgain.ok, true);
    if (keptAgain.ok) assert.equal(keptAgain.duplicate, true);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), taskCents);

    const more = await grantEarn(db, owner, "command", "command:one", "command:one");
    assert.equal(more.ok, true);
    const collected = await collectEarnings(db, admin, null, "wallet", "take-1", day);
    assert.equal(collected.ok, true);
    if (!collected.ok) return;
    assert.equal(collected.wallet.balance, commandCents / 100);
    assert.equal(collected.wallet.uncollected, 0);
    assert.equal(collected.wallet.bank, taskCents / 100);
    const empty = await collectEarnings(db, admin, null, "wallet", "take-2", day);
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, "Nothing to collect.");
    assert.equal(await walletBalanceCents(db, owner), commandCents);

    const deposited = await depositToBank(db, admin, commandCents, "dep-1", day);
    assert.equal(deposited.ok, true);
    const depositedAgain = await depositToBank(db, admin, commandCents, "dep-1", day);
    assert.equal(depositedAgain.ok, true);
    if (depositedAgain.ok) assert.equal(depositedAgain.duplicate, true);
    assert.equal(await walletBalanceCents(db, owner), 0);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), taskCents + commandCents);
    const pair = (await db.select().from(gameLedger)).filter((row) => row.idempotencyKey.startsWith("dep-1"));
    assert.equal(pair.length, 2);
    assert.equal(pair.filter((row) => row.direction === "debit" && row.bucket === "wallet").length, 1);
    assert.equal(pair.filter((row) => row.direction === "credit" && row.bucket === "bank").length, 1);

    const withdrawn = await withdrawFromBank(db, admin, 100, "out-1", day);
    assert.equal(withdrawn.ok, true);
    const withdrawnAgain = await withdrawFromBank(db, admin, 100, "out-1", day);
    assert.equal(withdrawnAgain.ok, true);
    if (withdrawnAgain.ok) assert.equal(withdrawnAgain.duplicate, true);
    assert.equal(await walletBalanceCents(db, owner), 100);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), taskCents + commandCents - 100);
    const tooMuch = await withdrawFromBank(db, admin, 50_000, "out-2", day);
    assert.equal(tooMuch.ok, false);
    if (!tooMuch.ok) assert.equal(tooMuch.error, "Not enough currency.");
    assert.equal(await bucketBalanceCents(db, owner, "bank"), taskCents + commandCents - 100);
    assert.equal((await collectEarnings(db, mariclare, null, "wallet", "nope", day)).ok, false);
  });

  test("a half-written transfer finishes on the same key", async () => {
    const db = openTestDb();
    const funded = await grantReward(db, admin, owner, "starter", "starter");
    assert.equal(funded.ok, true);
    await db.insert(gameLedger).values({
      id: "partial-out",
      walletId: "user:owner",
      bucket: "wallet",
      direction: "debit",
      amountCents: 400,
      reason: "deposit",
      source: "bank",
      sourceId: "once:out",
      idempotencyKey: "once:out",
      createdAt: nowIso(),
    });
    const repaired = await depositToBank(db, admin, 400, "once", day);
    assert.equal(repaired.ok, true);
    if (repaired.ok) assert.equal(repaired.duplicate, true);
    assert.equal(await walletBalanceCents(db, owner), 600);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 400);
    const outs = (await db.select().from(gameLedger)).filter((row) => row.idempotencyKey === "once:out");
    assert.equal(outs.length, 1);
  });

  test("interest accrues once a day, uses the owner rate, and stays capped", async () => {
    const db = openTestDb();
    assert.equal(dailyInterestCents(70_000, 100), 100);
    const parsed = parseWeeklyInterest(1);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value, 100);
    const capped = parseWeeklyInterest(10.01);
    assert.equal(capped.ok, false);
    assert.equal((await saveInterestRate(db, mariclare, 200)).ok, false);

    assert.equal((await grantReward(db, admin, owner, "fund", "fund")).ok, true);
    await db.insert(gameLedger).values({
      id: "seed-bank",
      walletId: "user:owner",
      bucket: "bank",
      direction: "credit",
      amountCents: 70_000,
      reason: "seed",
      source: "seed",
      sourceId: "seed-bank",
      idempotencyKey: "seed-bank",
      createdAt: day.toISOString(),
    });
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 70_000);
    assert.equal((await db.select().from(gameLedger)).some((row) => row.reason === "interest"), false);

    await accrueBankInterest(db, owner, nextDay);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 70_100);
    await accrueBankInterest(db, owner, nextDay);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 70_100);
    assert.equal((await db.select().from(gameLedger)).filter((row) => row.reason === "interest").length, 1);

    assert.equal((await saveInterestRate(db, admin, 200)).ok, true);
    const third = new Date("2026-10-25T12:00:00.000Z");
    await accrueBankInterest(db, owner, third);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 70_100 + dailyInterestCents(70_100, 200));

    await db.update(gameBankMarks).set({ accruedThrough: "2026-09-13" }).where(eq(gameBankMarks.walletId, "user:owner"));
    const before = (await db.select().from(gameLedger)).filter((row) => row.reason === "interest").length;
    await accrueBankInterest(db, owner, new Date("2026-10-23T18:00:00.000Z"));
    const interest = (await db.select().from(gameLedger)).filter((row) => row.reason === "interest");
    assert.equal(interest.length - before, 30);
    const mark = await db.select().from(gameBankMarks).where(eq(gameBankMarks.walletId, "user:owner"));
    assert.equal(mark[0]?.accruedThrough, "2026-10-23");
  });

  test("shops and losses take the wallet only", async () => {
    const db = openTestDb();
    assert.equal((await grantReward(db, admin, owner, "shop-fund", "shop-fund")).ok, true);
    await db.insert(gameLedger).values({
      id: "shop-seed",
      walletId: "user:owner",
      bucket: "wallet",
      direction: "credit",
      amountCents: 19_000,
      reason: "seed",
      source: "seed",
      sourceId: "shop-seed",
      idempotencyKey: "shop-seed",
      createdAt: day.toISOString(),
    });
    assert.equal((await depositToBank(db, admin, 20_000, "hide", day)).ok, true);
    assert.equal(await walletBalanceCents(db, owner), 0);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 20_000);
    const blocked = await buyShopItem(db, admin, "jacket");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error, "Not enough currency.");
    assert.deepEqual(await ownedSkus(db, owner), []);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 20_000);

    assert.equal((await withdrawFromBank(db, admin, 6_000, "spend", day)).ok, true);
    const bought = await buyShopItem(db, admin, "jacket");
    assert.equal(bought.ok, true);
    assert.equal(await walletBalanceCents(db, owner), 0);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 14_000);

    const lost = await loseWalletFunds(db, owner, 100, "storm", "loss:storm");
    assert.equal(lost.ok, false);
    if (!lost.ok) assert.equal(lost.error, "Not enough currency.");
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 14_000);

    assert.equal((await withdrawFromBank(db, admin, 500, "pocket", day)).ok, true);
    const hit = await loseWalletFunds(db, owner, 200, "storm", "loss:storm-2");
    assert.equal(hit.ok, true);
    const hitAgain = await loseWalletFunds(db, owner, 200, "storm", "loss:storm-2");
    assert.equal(hitAgain.ok, true);
    if (hitAgain.ok) assert.equal(hitAgain.duplicate, true);
    assert.equal(await walletBalanceCents(db, owner), 300);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 13_500);
    const drained = await loseWalletFunds(db, owner, 10_000, "storm", "loss:storm-3");
    assert.equal(drained.ok, false);
    assert.equal(await bucketBalanceCents(db, owner, "bank"), 13_500);
  });
});
