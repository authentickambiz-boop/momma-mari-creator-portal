import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db";
import { creatorTasks, creators, deals, gameLedger, payments } from "../src/db/schema";
import { markCreatorTaskDone } from "../src/lib/creator-tasks";
import { feeAndPayout, nowIso } from "../src/lib/format";
import { saveGmailConnection } from "../src/lib/onboarding";
import type { Viewer } from "../src/lib/types";
import { characterFigure, defaultCharacter, parseCharacter } from "../src/lib/worlds/character";
import {
  COMMISSION_CREDIT_COMING_SOON,
  creatorCommissionCreditEnabled,
  ledgerSum,
  parseEarnRates,
  refuseCurrencyPurchase,
  walletAccess,
  wearBlock,
} from "../src/lib/worlds/game-wallet";
import {
  bucketBalanceCents,
  buyShopItem,
  creditPaidBrandCommissions,
  grantEarn,
  grantReward,
  ownedSkus,
  readGameWallet,
  saveEarnRates,
  walletBalanceCents,
} from "../src/lib/worlds/game-wallet-store";
import { worldsPaymentsEnabled } from "../src/lib/worlds/office-payments";
import { enqueueOfficeCommand, updateOfficeCommand } from "../src/lib/worlds/office-command-queue";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const abby: Viewer = {
  email: "abby@example.com",
  role: "creator",
  creatorId: "abby",
  name: "Abby",
};

async function creator(db: ReturnType<typeof openTestDb>, id: string, name: string, email: string) {
  const existing = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, id));
  if (existing[0]) return;
  await db.insert(creators).values({
    id,
    name,
    email,
    initials: name.slice(0, 2).toUpperCase(),
    tiktokStatus: "disconnected",
    instagramStatus: "disconnected",
    facebookStatus: "disconnected",
    youtubeStatus: "disconnected",
    emailStatus: "disconnected",
    isSeed: false,
    createdAt: nowIso(),
  });
}

async function deal(db: ReturnType<typeof openTestDb>, id: string, creatorId: string, brand: string) {
  await db.insert(deals).values({
    id,
    creatorId,
    brand,
    status: "active",
    deliverablesJson: "[]",
    visibleToCreator: true,
    chipsJson: "[]",
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: 1,
    isSeed: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function watchPaymentReads(db: PortalDb) {
  let paymentReads = 0;
  const guarded = new Proxy(db, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key !== "select" || typeof value !== "function") {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (...args: unknown[]) => {
        const query = value.apply(target, args) as object;
        return new Proxy(query, {
          get(builder, builderKey) {
            const method = Reflect.get(builder, builderKey, builder);
            if (builderKey === "from" && typeof method === "function") {
              return (table: unknown, ...rest: unknown[]) => {
                if (table === payments) paymentReads += 1;
                return method.call(builder, table, ...rest);
              };
            }
            return typeof method === "function" ? method.bind(builder) : method;
          },
        });
      };
    },
  });
  return { db: guarded as PortalDb, reads: () => paymentReads };
}

describe("Worlds game wallet", { concurrency: false }, () => {
  test("the ledger is append-only and the balance is the sum", async () => {
    const db = openTestDb();
    const migration = source("drizzle/0064_game_wallets.sql").toLowerCase();
    assert.equal(migration.includes("delete "), false);
    assert.equal(migration.includes("drop "), false);
    assert.equal(migration.includes("stripe"), false);
    const store = source("src/lib/worlds/game-wallet-store.ts");
    assert.equal(store.includes("update(gameLedger)"), false);
    assert.equal(store.includes("delete(gameLedger)"), false);
    assert.equal(source("src/lib/fulfillment.ts").includes("game-wallet"), false);
    assert.equal(source("src/lib/payout-ledger.ts").includes("game-wallet"), false);
    assert.equal(source("src/app/payout-actions.ts").includes("game-wallet"), false);
    assert.equal(worldsPaymentsEnabled(), false);
    assert.equal(source(".env.example").includes("WORLDS_PAYMENTS_ENABLED=\n"), true);

    const first = await grantEarn(db, { kind: "user", id: "owner" }, "reward", "sample", "reward:one");
    assert.equal(first.ok, true);
    const second = await grantEarn(db, { kind: "user", id: "owner" }, "reward", "sample", "reward:one");
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.duplicate, true);
    const rows = await db.select().from(gameLedger);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.bucket, "wallet");
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "owner" }), ledgerSum(rows));
    assert.equal(rows[0]?.amountCents, 1000);
  });

  test("earn types use owner rates, and minigames do not credit", async () => {
    const db = openTestDb();
    assert.equal(walletAccess(null, "read").ok, false);
    assert.equal(walletAccess(mariclare, "rates").ok, false);
    assert.equal(walletAccess(mariclare, "read", { kind: "user", id: "abby" }).ok, false);
    assert.equal(walletAccess(admin, "read", { kind: "bot", id: "content" }).ok, true);
    assert.equal(walletAccess(mariclare, "spend", { kind: "bot", id: "content" }).ok, false);
    const rates = parseEarnRates({ task: 3, command: 5, connect: 25, minigame: 15, reward: 10 });
    assert.equal(rates.ok, true);
    if (!rates.ok) return;
    await saveEarnRates(db, rates.value);
    await creator(db, "mariclare", "MariClare", mariclare.email);
    await db.insert(creatorTasks).values({
      id: "task-1",
      creatorId: "mariclare",
      title: "Film the sample",
      category: "content",
      status: "open",
      createdBy: "owner",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const done = await markCreatorTaskDone(db, mariclare, "task-1");
    assert.equal(done.ok, true);
    const again = await markCreatorTaskDone(db, mariclare, "task-1");
    assert.equal(again.ok, true);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 0);
    assert.equal(await bucketBalanceCents(db, { kind: "user", id: "mariclare" }, "uncollected"), 300);

    const queued = await enqueueOfficeCommand(db, {
      kind: "assign_task",
      botId: "money",
      text: "Check the sample list.",
      due: "2026-10-24",
    }, { webhookUrl: null });
    assert.equal(queued.ok, true);
    if (!queued.ok) return;
    assert.equal((await updateOfficeCommand(db, { id: queued.body.command.id, status: "picked_up" })).ok, true);
    assert.equal((await updateOfficeCommand(db, { id: queued.body.command.id, status: "in_progress" })).ok, true);
    assert.equal((await updateOfficeCommand(db, { id: queued.body.command.id, status: "done", result: "Checked." })).ok, true);
    assert.equal(await walletBalanceCents(db, { kind: "bot", id: "money" }), 0);
    assert.equal(await bucketBalanceCents(db, { kind: "bot", id: "money" }, "uncollected"), 500);
    assert.equal((await updateOfficeCommand(db, { id: queued.body.command.id, status: "done", result: "Checked." })).ok, false);
    assert.equal(await bucketBalanceCents(db, { kind: "bot", id: "money" }, "uncollected"), 500);

    const connected = await saveGmailConnection(db, "mariclare", { refreshToken: "refresh-token", gmailEmail: "mari@example.com" });
    assert.equal(connected.ok, true);
    const connectedAgain = await saveGmailConnection(db, "mariclare", { refreshToken: "refresh-token", gmailEmail: "mari@example.com" });
    assert.equal(connectedAgain.ok, true);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 0);
    assert.equal(await bucketBalanceCents(db, { kind: "user", id: "mariclare" }, "uncollected"), 300 + 2500);

    const mini = await grantEarn(db, { kind: "user", id: "mariclare" }, "minigame", "mini", "mini:1");
    assert.equal(mini.ok, false);
    if (!mini.ok) assert.equal("stub" in mini && mini.stub, true);
    assert.equal(await bucketBalanceCents(db, { kind: "user", id: "mariclare" }, "uncollected"), 2800);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 0);

    const reward = await grantReward(db, mariclare, { kind: "user", id: "mariclare" }, "bonus", "bonus-1");
    assert.equal(reward.ok, false);
    const ownerReward = await grantReward(db, admin, { kind: "user", id: "mariclare" }, "bonus", "bonus-1");
    assert.equal(ownerReward.ok, true);
    const ownerRewardAgain = await grantReward(db, admin, { kind: "user", id: "mariclare" }, "bonus", "bonus-1");
    assert.equal(ownerRewardAgain.ok, true);
    if (ownerRewardAgain.ok) assert.equal(ownerRewardAgain.duplicate, true);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 1000);
    assert.equal(await bucketBalanceCents(db, { kind: "user", id: "mariclare" }, "uncollected"), 2800);
  });

  test("a paid brand payment credits the 20% cut once and does not change the payment", async () => {
    const previous = process.env.WORLDS_CREATOR_COMMISSION_CREDIT;
    process.env.WORLDS_CREATOR_COMMISSION_CREDIT = "on";
    const db = openTestDb();
    try {
    await creator(db, "mariclare", "MariClare", mariclare.email);
    await deal(db, "deal-north", "mariclare", "Northwind");
    await deal(db, "deal-wait", "mariclare", "Waiting Co");
    const share = feeAndPayout(100_000);
    assert.equal(share.feeCents, 20_000);
    const before = await db.select().from(payments);
    await db.insert(payments).values({
      id: "pay-north",
      dealId: "deal-north",
      landedAmountCents: 100_000,
      amountOwedCents: 100_000,
      paymentStatus: "brand_paid",
      isSeed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await db.insert(payments).values({
      id: "pay-wait",
      dealId: "deal-wait",
      landedAmountCents: 100_000,
      amountOwedCents: 100_000,
      paymentStatus: "brand_invoiced",
      isSeed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    assert.equal(await creditPaidBrandCommissions(db), 1);
    assert.equal(await creditPaidBrandCommissions(db), 0);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 0);
    assert.equal(await bucketBalanceCents(db, { kind: "user", id: "mariclare" }, "uncollected"), share.feeCents);
    const after = await db.select().from(payments);
    assert.equal(after.length, before.length + 2);
    assert.equal(after.find((row) => row.id === "pay-north")?.paymentStatus, "brand_paid");
    assert.equal(after.find((row) => row.id === "pay-north")?.landedAmountCents, 100_000);
    const view = await readGameWallet(db, mariclare);
    assert.equal(view.ok, true);
    if (!view.ok) return;
    assert.equal(view.body.wallet.balance, 0);
    assert.equal(view.body.wallet.uncollected, 200);
    assert.equal(view.body.wallet.bank, 0);
    assert.equal(view.body.wallet.currency, "currency-dollars");
    assert.equal(view.body.wallet.history[0]?.reason, "commission");
    assert.equal(view.body.wallet.history[0]?.bucket, "uncollected");
    assert.equal(view.body.wallet.history[0]?.source, "Northwind");
    assert.equal(view.body.wallet.historyNote, null);
    const packed = JSON.stringify(view.body);
    assert.equal(packed.includes(mariclare.email), false);
    assert.equal(packed.includes("100000"), false);
    assert.equal(packed.includes("idempotency"), false);
    const owner = await readGameWallet(db, admin);
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    assert.equal(owner.body.creators.some((person) => person.id === "mariclare" && person.uncollected === 200 && person.wallet === 0 && person.name === "MariClare"), true);
    assert.equal(JSON.stringify(owner.body).includes(mariclare.email), false);
    const other = await readGameWallet(db, abby, { kind: "user", id: "mariclare" });
    assert.equal(other.ok, false);
    } finally {
      if (previous === undefined) delete process.env.WORLDS_CREATOR_COMMISSION_CREDIT;
      else process.env.WORLDS_CREATOR_COMMISSION_CREDIT = previous;
    }
  });

  test("commission credit stays off, skips payments, and says coming soon", async () => {
    const previous = process.env.WORLDS_CREATOR_COMMISSION_CREDIT;
    delete process.env.WORLDS_CREATOR_COMMISSION_CREDIT;
    try {
      assert.equal(creatorCommissionCreditEnabled(), false);
      const store = source("src/lib/worlds/game-wallet-store.ts");
      const fn = store.slice(store.indexOf("async function creditPaidBrandCommissions"));
      assert.ok(fn.indexOf("creatorCommissionCreditEnabled") >= 0);
      assert.ok(fn.indexOf("creatorCommissionCreditEnabled") < fn.indexOf(".from(payments)"));
      const db = openTestDb();
      await creator(db, "mariclare", "MariClare", mariclare.email);
      await deal(db, "deal-quiet", "mariclare", "Quiet Co");
      await db.insert(payments).values({
        id: "pay-quiet",
        dealId: "deal-quiet",
        landedAmountCents: 100_000,
        amountOwedCents: 100_000,
        paymentStatus: "brand_paid",
        isSeed: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      const watched = watchPaymentReads(db);
      assert.equal(await creditPaidBrandCommissions(watched.db), 0);
      const view = await readGameWallet(watched.db, mariclare);
      assert.equal(watched.reads(), 0);
      assert.equal(await walletBalanceCents(db, { kind: "user", id: "mariclare" }), 0);
      const credits = await db.select().from(gameLedger);
      assert.equal(credits.some((row) => row.reason === "commission"), false);
      assert.equal(view.ok, true);
      if (!view.ok) return;
      assert.equal(view.body.wallet.historyNote, COMMISSION_CREDIT_COMING_SOON);
      assert.equal(view.body.wallet.history.some((entry) => entry.reason === "commission"), false);
      assert.match(source("src/components/worlds/office-app.tsx"), /historyNote/);
      assert.match(source(".env.example"), /WORLDS_CREATOR_COMMISSION_CREDIT=/);
    } finally {
      if (previous === undefined) delete process.env.WORLDS_CREATOR_COMMISSION_CREDIT;
      else process.env.WORLDS_CREATOR_COMMISSION_CREDIT = previous;
    }
  });

  test("the shop debits currency, unlocks clothes, and refuses real-money purchases", async () => {
    const db = openTestDb();
    const previous = process.env.WORLDS_PAYMENTS_ENABLED;
    process.env.WORLDS_PAYMENTS_ENABLED = "true";
    try {
      const refused = refuseCurrencyPurchase();
      assert.equal(refused.charged, false);
      assert.equal(refused.status, 403);
      assert.equal(refused.error.includes("Nothing was charged"), true);
    } finally {
      if (previous === undefined) delete process.env.WORLDS_PAYMENTS_ENABLED;
      else process.env.WORLDS_PAYMENTS_ENABLED = previous;
    }
    assert.equal(source("src/app/api/worlds/game-wallet/route.ts").includes("api.stripe.com"), false);
    assert.equal(source("src/app/api/worlds/game-wallet/route.ts").includes("refuseCurrencyPurchase"), true);
    assert.equal(source("src/app/api/worlds/characters/route.ts").includes("wearBlock"), true);
    assert.match(source("src/components/worlds/office-app.tsx"), /Currency/);
    assert.match(source("src/components/worlds/office-app.tsx"), /Buy currency with real money/);
    assert.match(source("src/components/worlds/character-creator.tsx"), /disabled=\{Boolean\(lock\)\}/);

    const rates = parseEarnRates({ task: 10, command: 5, connect: 25, minigame: 15, reward: 200 });
    assert.equal(rates.ok, true);
    if (!rates.ok) return;
    await saveEarnRates(db, rates.value);
    const funded = await grantReward(db, admin, { kind: "user", id: "owner" }, "starter", "starter");
    assert.equal(funded.ok, true);
    const poor = await buyShopItem(db, admin, "studio-lot");
    assert.equal(poor.ok, false);
    assert.deepEqual(await ownedSkus(db, { kind: "user", id: "owner" }), []);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "owner" }), 20_000);

    const bought = await buyShopItem(db, admin, "jacket");
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    assert.equal(bought.wallet.balance, 140);
    const repeat = await buyShopItem(db, admin, "jacket");
    assert.equal(repeat.ok, true);
    if (repeat.ok) assert.equal(repeat.alreadyOwned, true);
    assert.equal(await walletBalanceCents(db, { kind: "user", id: "owner" }), 14_000);
    assert.deepEqual(await ownedSkus(db, { kind: "user", id: "owner" }), ["jacket"]);

    const look = defaultCharacter("owner");
    assert.equal(wearBlock(look, []), null);
    const jacket = parseCharacter({
      ...look,
      slots: { ...look.slots, top: { item: "jacket", color: "#2f6d4f" } },
    });
    assert.equal(jacket.ok, true);
    if (!jacket.ok) return;
    assert.equal(wearBlock(jacket.value, []), "Buy that item in the Worlds shop before you wear it.");
    assert.equal(wearBlock(jacket.value, ["jacket"]), null);
    assert.equal(characterFigure(jacket.value).parts.some((part) => part.id === "jacket"), true);
    const lot = (await readGameWallet(db, admin)).ok
      ? (await readGameWallet(db, admin))
      : null;
    assert.equal(lot?.ok, true);
    if (!lot?.ok) return;
    assert.equal(lot.body.catalog.find((item) => item.sku === "studio-lot")?.note?.includes("does not place a building"), true);
    assert.equal(lot.body.catalog.find((item) => item.sku === "jacket")?.owned, true);
  });
});
