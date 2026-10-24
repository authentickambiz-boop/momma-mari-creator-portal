import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, deals, gameBankMarks, gameInterestRates, gameInventory, gameLedger, gameWallets, payments } from "@/db/schema";
import { isOwner } from "@/lib/authz";
import { feeAndPayout, nowIso } from "@/lib/format";
import type { Viewer } from "@/lib/types";
import { characterSubjectForViewer, type CharacterSubject } from "./character";
import {
  ECONOMY,
  commandPayoutCents,
  connectPayoutCents,
  dailyDecayCents,
  dailyPayoutCents,
  minigamePayoutCents,
  rewardPayoutCents,
  taskDifficulty,
  taskPayoutCents,
} from "./economy";
import {
  BANK_PERKS,
  BRAND_PAID_STATUSES,
  COMMISSION_CREDIT_COMING_SOON,
  DEFAULT_WEEKLY_BPS,
  GAME_CATALOG,
  GAME_CURRENCY,
  MAX_INTEREST_CATCHUP_DAYS,
  MAX_WEEKLY_BPS,
  addUtcDays,
  bucketOf,
  creatorCommissionCreditEnabled,
  dailyInterestCents,
  findShopItem,
  ledgerSum,
  utcDay,
  walletAccess,
  type EarnType,
  type GameBucket,
  type LedgerDirection,
} from "./game-wallet";
import { findOfficeBot } from "./office-catalog";

const PAID = new Set<string>(BRAND_PAID_STATUSES);
const RATE_ID = "default";

export type PublicLedgerEntry = {
  direction: LedgerDirection;
  amount: number;
  reason: string;
  source: string;
  bucket: GameBucket;
  createdAt: string;
};

export type PublicWallet = {
  subjectKind: CharacterSubject["kind"];
  subjectId: string;
  /** Spendable at shops. */
  balance: number;
  bank: number;
  uncollected: number;
  interestWeeklyPercent: number;
  perks: typeof BANK_PERKS;
  currency: typeof GAME_CURRENCY;
  history: PublicLedgerEntry[];
  /** Set while WORLDS_CREATOR_COMMISSION_CREDIT is off. */
  historyNote: string | null;
};

export type OfficeMoneyRow = {
  id: string;
  name: string;
  wallet: number;
  bank: number;
  uncollected: number;
};

function walletId(subject: CharacterSubject) {
  return `${subject.kind}:${subject.id}`;
}

function units(cents: number) {
  return cents / 100;
}

function earnBucket(type: EarnType): GameBucket {
  return type === "reward" ? "wallet" : "uncollected";
}

async function ensureWallet(db: PortalDb, subject: CharacterSubject) {
  const id = walletId(subject);
  const existing = await db.select({ id: gameWallets.id }).from(gameWallets).where(eq(gameWallets.id, id));
  if (!existing[0]) {
    await db.insert(gameWallets).values({
      id,
      subjectKind: subject.kind,
      subjectId: subject.id,
      createdAt: nowIso(),
    });
  }
  return id;
}

async function rowsFor(db: PortalDb, id: string) {
  return db.select().from(gameLedger).where(eq(gameLedger.walletId, id));
}

function sumBucket(rows: { direction: string; amountCents: number; bucket: string }[], bucket: GameBucket) {
  return ledgerSum(rows.filter((row) => bucketOf(row.bucket) === bucket));
}

export async function bucketBalanceCents(db: PortalDb, subject: CharacterSubject, bucket: GameBucket) {
  const rows = await rowsFor(db, walletId(subject));
  return sumBucket(rows, bucket);
}

export async function walletBalanceCents(db: PortalDb, subject: CharacterSubject) {
  return bucketBalanceCents(db, subject, "wallet");
}

async function balances(db: PortalDb, subject: CharacterSubject) {
  const rows = await rowsFor(db, walletId(subject));
  return {
    wallet: sumBucket(rows, "wallet"),
    bank: sumBucket(rows, "bank"),
    uncollected: sumBucket(rows, "uncollected"),
  };
}

async function postEntry(
  db: PortalDb,
  subject: CharacterSubject,
  entry: {
    bucket: GameBucket;
    direction: LedgerDirection;
    amountCents: number;
    reason: string;
    source: string;
    sourceId: string;
    idempotencyKey: string;
    createdAt?: string;
  },
) {
  if (!Number.isInteger(entry.amountCents) || entry.amountCents <= 0) {
    return { ok: false as const, status: 400, error: "Amount must be more than zero." };
  }
  const source = entry.source.trim().slice(0, 80);
  const sourceId = entry.sourceId.trim().slice(0, 80);
  if (!source || !sourceId) return { ok: false as const, status: 400, error: "source and sourceId are required." };
  const prior = await db.select().from(gameLedger).where(eq(gameLedger.idempotencyKey, entry.idempotencyKey));
  const id = await ensureWallet(db, subject);
  if (prior[0]) {
    const balance = await bucketBalanceCents(db, subject, bucketOf(prior[0].bucket));
    return { ok: true as const, duplicate: true, balanceCents: balance, walletId: prior[0].walletId };
  }
  if (entry.direction === "credit") {
    const same = await db.select({ id: gameLedger.id }).from(gameLedger).where(and(
      eq(gameLedger.walletId, id),
      eq(gameLedger.source, source),
      eq(gameLedger.sourceId, sourceId),
      eq(gameLedger.direction, "credit"),
    ));
    if (same[0]) {
      return { ok: false as const, status: 409, duplicate: true, error: "That credit was already recorded." };
    }
  }
  if (entry.direction === "debit") {
    const balance = await bucketBalanceCents(db, subject, entry.bucket);
    if (balance < entry.amountCents) return { ok: false as const, status: 400, error: "Not enough currency." };
  }
  await insertLedger(db, {
    walletId: id,
    bucket: entry.bucket,
    direction: entry.direction,
    amountCents: entry.amountCents,
    reason: entry.reason,
    source,
    sourceId,
    idempotencyKey: entry.idempotencyKey,
    createdAt: entry.createdAt,
  });
  return { ok: true as const, duplicate: false, balanceCents: await bucketBalanceCents(db, subject, entry.bucket), walletId: id };
}

async function entryByKey(db: PortalDb, key: string) {
  const rows = await db.select().from(gameLedger).where(eq(gameLedger.idempotencyKey, key));
  return rows[0] ?? null;
}

async function insertLedger(
  db: PortalDb,
  entry: {
    walletId: string;
    bucket: GameBucket;
    direction: LedgerDirection;
    amountCents: number;
    reason: string;
    source: string;
    sourceId: string;
    idempotencyKey: string;
    createdAt?: string;
  },
) {
  try {
    await db.insert(gameLedger).values({
      id: crypto.randomUUID(),
      walletId: entry.walletId,
      bucket: entry.bucket,
      direction: entry.direction,
      amountCents: entry.amountCents,
      reason: entry.reason,
      source: entry.source,
      sourceId: entry.sourceId,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt ?? nowIso(),
    });
  } catch (error) {
    const won = await entryByKey(db, entry.idempotencyKey);
    if (won) return;
    const sameCredit = await db.select({ id: gameLedger.id }).from(gameLedger).where(and(
      eq(gameLedger.walletId, entry.walletId),
      eq(gameLedger.source, entry.source),
      eq(gameLedger.sourceId, entry.sourceId),
      eq(gameLedger.direction, "credit"),
    ));
    if (entry.direction === "credit" && sameCredit[0]) return;
    throw error;
  }
}

async function weeklyBps(db: PortalDb) {
  const rows = await db.select().from(gameInterestRates).where(eq(gameInterestRates.id, RATE_ID));
  const saved = rows[0]?.weeklyBps ?? DEFAULT_WEEKLY_BPS;
  return Math.min(MAX_WEEKLY_BPS, Math.max(0, saved));
}

async function rememberInterestDay(db: PortalDb, id: string, day: string) {
  const rows = await db.select().from(gameBankMarks).where(eq(gameBankMarks.walletId, id));
  if (!rows[0]) {
    try {
      await db.insert(gameBankMarks).values({ walletId: id, accruedThrough: day });
    } catch (error) {
      const again = await db.select().from(gameBankMarks).where(eq(gameBankMarks.walletId, id));
      if (!again[0]) throw error;
      if (again[0].accruedThrough < day) {
        await db.update(gameBankMarks).set({ accruedThrough: day }).where(eq(gameBankMarks.walletId, id));
      }
    }
    return;
  }
  if (rows[0].accruedThrough < day) {
    await db.update(gameBankMarks).set({ accruedThrough: day }).where(eq(gameBankMarks.walletId, id));
  }
}

/** Credits the bank once per UTC day. A second read the same day does not credit again. */
export async function accrueBankInterest(db: PortalDb, subject: CharacterSubject, now = new Date()) {
  const id = walletId(subject);
  const existing = await db.select({ id: gameWallets.id }).from(gameWallets).where(eq(gameWallets.id, id));
  if (!existing[0]) return;
  const today = utcDay(now);
  const mark = await db.select().from(gameBankMarks).where(eq(gameBankMarks.walletId, id));
  let day = mark[0] ? addUtcDays(mark[0].accruedThrough, 1) : today;
  const earliest = addUtcDays(today, -(MAX_INTEREST_CATCHUP_DAYS - 1));
  if (day < earliest) day = earliest;
  const rate = await weeklyBps(db);
  while (day <= today) {
    const key = `interest:${id}:${day}`;
    const already = await entryByKey(db, key);
    if (!already) {
      const cents = dailyInterestCents(await bucketBalanceCents(db, subject, "bank"), rate);
      if (cents > 0) {
        await insertLedger(db, {
          walletId: id,
          bucket: "bank",
          direction: "credit",
          amountCents: cents,
          reason: "interest",
          source: "interest",
          sourceId: day,
          idempotencyKey: key,
        });
      }
    }
    await rememberInterestDay(db, id, day);
    day = addUtcDays(day, 1);
  }
}

/**
 * Uncollected earnings older than the decay window lose a daily slice of the weekly rate.
 * Wallet and bank rows are never written here.
 */
export async function accrueUncollectedDecay(db: PortalDb, subject: CharacterSubject, now = new Date()) {
  const id = walletId(subject);
  const existing = await db.select({ id: gameWallets.id }).from(gameWallets).where(eq(gameWallets.id, id));
  if (!existing[0]) return;
  const today = utcDay(now);
  const key = `decay:${id}:${today}`;
  if (await entryByKey(db, key)) return;
  const rows = await rowsFor(db, id);
  const cutoff = addUtcDays(today, -ECONOMY.decay.afterDays);
  let oldCredits = 0;
  let recentCredits = 0;
  let debits = 0;
  for (const row of rows) {
    if (bucketOf(row.bucket) !== "uncollected") continue;
    if (row.direction === "credit") {
      const day = row.createdAt.slice(0, 10);
      if (day <= cutoff) oldCredits += row.amountCents;
      else recentCredits += row.amountCents;
    } else {
      debits += row.amountCents;
    }
  }
  const uncollected = oldCredits + recentCredits - debits;
  if (uncollected <= 0) return;
  const freshLeft = Math.max(0, recentCredits - debits);
  const aged = Math.max(0, uncollected - freshLeft);
  const cents = dailyDecayCents(aged);
  if (cents <= 0) return;
  await insertLedger(db, {
    walletId: id,
    bucket: "uncollected",
    direction: "debit",
    amountCents: cents,
    reason: "decay",
    source: "decay",
    sourceId: today,
    idempotencyKey: key,
    createdAt: now.toISOString(),
  });
}

/**
 * Moves currency between two buckets as a debit and a matching credit.
 * The same idempotency key finishes a half-written pair and does not move twice.
 */
async function moveFunds(
  db: PortalDb,
  subject: CharacterSubject,
  move: { from: GameBucket; to: GameBucket; amountCents: number | null; reason: string; idempotencyKey: string; now?: Date },
) {
  if (move.from === move.to) return { ok: false as const, status: 400, error: "That transfer stays in the same place." };
  const id = await ensureWallet(db, subject);
  if (move.from === "bank" || move.to === "bank") await accrueBankInterest(db, subject, move.now ?? new Date());
  const outKey = `${move.idempotencyKey}:out`;
  const inKey = `${move.idempotencyKey}:in`;
  const out = await entryByKey(db, outKey);
  const inn = await entryByKey(db, inKey);
  if (out && inn) return { ok: true as const, status: 200, duplicate: true };
  let amount = out?.amountCents ?? inn?.amountCents ?? move.amountCents;
  if (!out && !inn) {
    const available = await bucketBalanceCents(db, subject, move.from);
    if (amount == null) amount = available;
    if (!Number.isInteger(amount) || amount <= 0) {
      const empty = move.from === "uncollected" ? "Nothing to collect." : "Amount must be more than zero.";
      return { ok: false as const, status: 400, error: empty };
    }
    if (available < amount) return { ok: false as const, status: 400, error: "Not enough currency." };
  }
  if (!amount || amount <= 0) return { ok: false as const, status: 400, error: "Amount must be more than zero." };
  if (!out) {
    await insertLedger(db, {
      walletId: id,
      bucket: move.from,
      direction: "debit",
      amountCents: amount,
      reason: move.reason,
      source: move.to,
      sourceId: outKey,
      idempotencyKey: outKey,
    });
  }
  if (!inn) {
    await insertLedger(db, {
      walletId: id,
      bucket: move.to,
      direction: "credit",
      amountCents: amount,
      reason: move.reason,
      source: move.from,
      sourceId: inKey,
      idempotencyKey: inKey,
    });
  }
  return { ok: true as const, status: 200, duplicate: Boolean(out || inn) };
}

async function ownSpend(db: PortalDb, viewer: Viewer) {
  const own = characterSubjectForViewer(viewer);
  const gate = walletAccess(viewer, "spend", own ?? undefined);
  if (!gate.ok || !gate.value) {
    return gate.ok ? { ok: false as const, status: 403, error: "You can only spend from your own wallet." } : gate;
  }
  return { ok: true as const, subject: gate.value };
}

export async function readInterestPercent(db: PortalDb) {
  return (await weeklyBps(db)) / 100;
}

export async function saveInterestRate(db: PortalDb, viewer: Viewer, weeklyBps: number) {
  const gate = walletAccess(viewer, "rates");
  if (!gate.ok) return gate;
  const capped = Math.min(MAX_WEEKLY_BPS, Math.max(0, weeklyBps));
  const updatedAt = nowIso();
  const existing = await db.select().from(gameInterestRates).where(eq(gameInterestRates.id, RATE_ID));
  if (existing[0]) {
    await db.update(gameInterestRates).set({ weeklyBps: capped, updatedAt }).where(eq(gameInterestRates.id, RATE_ID));
  } else {
    await db.insert(gameInterestRates).values({ id: RATE_ID, weeklyBps: capped, updatedAt });
  }
  return { ok: true as const, status: 200, interestWeeklyPercent: capped / 100 };
}

export type EarnOptions = {
  difficulty?: number;
  category?: string;
  roundMs?: number;
  score?: number;
  now?: Date;
};

function payoutFor(type: EarnType, subject: CharacterSubject, options?: EarnOptions) {
  const botId = subject.kind === "bot" ? subject.id : undefined;
  if (type === "task") return taskPayoutCents(options?.difficulty ?? taskDifficulty(options?.category), botId);
  if (type === "command") return commandPayoutCents(botId);
  if (type === "connect") return connectPayoutCents(botId);
  if (type === "minigame") return minigamePayoutCents(options?.score ?? 0, botId);
  if (type === "daily") return dailyPayoutCents(botId);
  return rewardPayoutCents(botId);
}

async function cooldownActive(db: PortalDb, id: string, source: string, now: Date) {
  if (source !== "command") return false;
  const rows = await rowsFor(db, id);
  let latest = "";
  for (const row of rows) {
    if (row.direction !== "credit" || row.source !== source) continue;
    if (row.createdAt > latest) latest = row.createdAt;
  }
  if (!latest) return false;
  return now.getTime() - Date.parse(latest) < ECONOMY.command.cooldownMs;
}

/** Credits from the economy config. Task, command, connect, minigame, and daily login land uncollected. Rewards land in the wallet. */
export async function grantEarn(
  db: PortalDb,
  subject: CharacterSubject,
  type: EarnType,
  sourceId: string,
  idempotencyKey: string,
  options?: EarnOptions,
) {
  const now = options?.now ?? new Date();
  if (type === "minigame" && (options?.roundMs ?? 0) < ECONOMY.minigame.minRoundMs) {
    return {
      ok: false as const,
      status: 400,
      credited: false as const,
      error: `That round is too short to earn ${GAME_CURRENCY}.`,
    };
  }
  const bucket = earnBucket(type);
  const amountCents = payoutFor(type, subject, options);
  if (amountCents <= 0) {
    return { ok: true as const, credited: false as const, duplicate: false, cooldown: false, balanceCents: await bucketBalanceCents(db, subject, bucket) };
  }
  const id = await ensureWallet(db, subject);
  if (await cooldownActive(db, id, type, now)) {
    return { ok: true as const, credited: false as const, duplicate: false, cooldown: true, balanceCents: await bucketBalanceCents(db, subject, bucket) };
  }
  const posted = await postEntry(db, subject, {
    bucket,
    direction: "credit",
    amountCents,
    reason: type,
    source: type,
    sourceId,
    idempotencyKey,
    createdAt: now.toISOString(),
  });
  if (!posted.ok) return posted;
  return { ok: true as const, credited: !posted.duplicate, duplicate: posted.duplicate, cooldown: false, balanceCents: posted.balanceCents };
}

export async function noteTaskCompleted(db: PortalDb, creatorId: string, taskId: string, category?: string) {
  try {
    await grantEarn(db, { kind: "user", id: creatorId }, "task", taskId, `task:${taskId}`, { category });
  } catch {
    // Currency is a side effect. The task itself still completes.
  }
}

export async function noteCommandCompleted(db: PortalDb, commandId: string, botIds: readonly string[]) {
  try {
    for (const botId of botIds) {
      if (!findOfficeBot(botId)) continue;
      await grantEarn(db, { kind: "bot", id: botId }, "command", `${commandId}:${botId}`, `command:${commandId}:${botId}`);
    }
  } catch {
    // Currency is a side effect. The command itself still completes.
  }
}

export async function noteAccountConnected(db: PortalDb, creatorId: string, platform: string) {
  try {
    const name = platform.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(name)) return;
    await grantEarn(db, { kind: "user", id: creatorId }, "connect", name, `connect:${name}:${creatorId}`);
  } catch {
    // Currency is a side effect. The account connection itself still saves.
  }
}

/**
 * Reads brand-paid deal payments and credits the creator's uncollected bank earnings
 * with the existing 20% fee. Does not update payments, deals, or payouts.
 */
export async function creditPaidBrandCommissions(db: PortalDb) {
  if (!creatorCommissionCreditEnabled()) return 0;
  const paid = await db.select({
    id: payments.id,
    dealId: payments.dealId,
    status: payments.paymentStatus,
    landedAmountCents: payments.landedAmountCents,
    amountOwedCents: payments.amountOwedCents,
  }).from(payments);
  const dealRows = await db.select({ id: deals.id, creatorId: deals.creatorId, brand: deals.brand }).from(deals);
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  let credited = 0;
  for (const payment of paid) {
    if (!payment.status || !PAID.has(payment.status)) continue;
    const deal = dealById.get(payment.dealId);
    if (!deal?.creatorId) continue;
    const share = feeAndPayout(payment.landedAmountCents ?? payment.amountOwedCents);
    if (share.feeCents == null || share.feeCents <= 0) continue;
    const posted = await postEntry(db, { kind: "user", id: deal.creatorId }, {
      bucket: "uncollected",
      direction: "credit",
      amountCents: share.feeCents,
      reason: "commission",
      source: deal.brand,
      sourceId: payment.id,
      idempotencyKey: `commission:${payment.id}`,
    });
    if (posted.ok && !posted.duplicate) credited += 1;
  }
  return credited;
}

export async function ownedSkus(db: PortalDb, subject: CharacterSubject) {
  const rows = await db.select({ sku: gameInventory.sku }).from(gameInventory).where(eq(gameInventory.walletId, walletId(subject)));
  return rows.map((row) => row.sku);
}

async function publicWallet(db: PortalDb, subject: CharacterSubject): Promise<PublicWallet> {
  const rows = await rowsFor(db, walletId(subject));
  const history = [...rows]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    .slice(0, 40)
    .map((row) => ({
      direction: row.direction === "debit" ? "debit" as const : "credit" as const,
      amount: units(row.amountCents),
      reason: row.reason,
      source: row.source,
      bucket: bucketOf(row.bucket),
      createdAt: row.createdAt,
    }));
  const money = {
    wallet: sumBucket(rows, "wallet"),
    bank: sumBucket(rows, "bank"),
    uncollected: sumBucket(rows, "uncollected"),
  };
  return {
    subjectKind: subject.kind,
    subjectId: subject.id,
    balance: units(money.wallet),
    bank: units(money.bank),
    uncollected: units(money.uncollected),
    interestWeeklyPercent: await readInterestPercent(db),
    perks: BANK_PERKS,
    currency: GAME_CURRENCY,
    history,
    historyNote: creatorCommissionCreditEnabled() ? null : COMMISSION_CREDIT_COMING_SOON,
  };
}

async function catalogFor(db: PortalDb, subject: CharacterSubject) {
  const owned = new Set(await ownedSkus(db, subject));
  return GAME_CATALOG.map((item) => ({
    sku: item.sku,
    name: item.name,
    category: item.category,
    slot: item.slot,
    tier: item.tier,
    price: units(item.priceCents),
    slots: item.slots,
    activities: item.activities,
    owned: owned.has(item.sku),
    note: item.note,
  }));
}

async function officeBalances(db: PortalDb) {
  const wallets = await db.select().from(gameWallets);
  const names = new Map((await db.select({ id: creators.id, name: creators.name }).from(creators)).map((creator) => [creator.id, creator.name]));
  const bots: OfficeMoneyRow[] = [];
  const people: OfficeMoneyRow[] = [];
  for (const wallet of wallets) {
    const subject: CharacterSubject = wallet.subjectKind === "bot"
      ? { kind: "bot", id: wallet.subjectId }
      : { kind: "user", id: wallet.subjectId };
    const money = await balances(db, subject);
    if (money.wallet === 0 && money.bank === 0 && money.uncollected === 0) continue;
    const row = {
      id: wallet.subjectId,
      name: wallet.subjectKind === "bot" ? (findOfficeBot(wallet.subjectId)?.name ?? wallet.subjectId) : (names.get(wallet.subjectId) ?? "Creator"),
      wallet: units(money.wallet),
      bank: units(money.bank),
      uncollected: units(money.uncollected),
    };
    if (wallet.subjectKind === "bot") {
      if (findOfficeBot(wallet.subjectId)) bots.push(row);
    } else if (wallet.subjectKind === "user" && wallet.subjectId !== "owner") {
      people.push(row);
    }
  }
  return { bots, creators: people };
}

export async function readGameWallet(db: PortalDb, viewer: Viewer, subject?: CharacterSubject, now = new Date()) {
  await creditPaidBrandCommissions(db);
  const gate = walletAccess(viewer, "read", subject);
  if (!gate.ok || !gate.value) return gate.ok ? { ok: false as const, status: 404, error: "This sign-in has no wallet yet." } : gate;
  await accrueBankInterest(db, gate.value, now);
  await accrueUncollectedDecay(db, gate.value, now);
  const wallet = await publicWallet(db, gate.value);
  const catalog = await catalogFor(db, gate.value.kind === "user" ? gate.value : characterSubjectForViewer(viewer) ?? gate.value);
  const extra = isOwner(viewer) ? await officeBalances(db) : { bots: [], creators: [] };
  return { ok: true as const, status: 200, body: { wallet, catalog, owner: isOwner(viewer), bots: extra.bots, creators: extra.creators } };
}

async function finishMove(
  db: PortalDb,
  viewer: Viewer,
  move: { from: GameBucket; to: GameBucket; amountCents: number | null; reason: string; idempotencyKey: string; now?: Date },
) {
  const gate = await ownSpend(db, viewer);
  if (!gate.ok) return gate;
  const moved = await moveFunds(db, gate.subject, move);
  if (!moved.ok) return moved;
  return { ok: true as const, status: 200, duplicate: moved.duplicate, wallet: await publicWallet(db, gate.subject) };
}

export async function collectEarnings(
  db: PortalDb,
  viewer: Viewer,
  amountCents: number | null,
  destination: "wallet" | "bank",
  idempotencyKey: string,
  now = new Date(),
) {
  return finishMove(db, viewer, {
    from: "uncollected",
    to: destination,
    amountCents,
    reason: "collect",
    idempotencyKey,
    now,
  });
}

export async function depositToBank(
  db: PortalDb,
  viewer: Viewer,
  amountCents: number,
  idempotencyKey: string,
  now = new Date(),
) {
  return finishMove(db, viewer, {
    from: "wallet",
    to: "bank",
    amountCents,
    reason: "deposit",
    idempotencyKey,
    now,
  });
}

export async function withdrawFromBank(
  db: PortalDb,
  viewer: Viewer,
  amountCents: number,
  idempotencyKey: string,
  now = new Date(),
) {
  return finishMove(db, viewer, {
    from: "bank",
    to: "wallet",
    amountCents,
    reason: "withdraw",
    idempotencyKey,
    now,
  });
}

/**
 * Future events that can take spendable currency call this.
 * It debits the wallet only. The bank balance is never reduced here.
 */
export async function loseWalletFunds(
  db: PortalDb,
  subject: CharacterSubject,
  amountCents: number,
  source: string,
  idempotencyKey: string,
) {
  return postEntry(db, subject, {
    bucket: "wallet",
    direction: "debit",
    amountCents,
    reason: "loss",
    source,
    sourceId: idempotencyKey,
    idempotencyKey,
  });
}

export async function buyShopItem(db: PortalDb, viewer: Viewer, sku: string) {
  const own = characterSubjectForViewer(viewer);
  const gate = walletAccess(viewer, "spend", own ?? undefined);
  if (!gate.ok || !gate.value) return gate.ok ? { ok: false as const, status: 403, error: "You can only spend from your own wallet." } : gate;
  const item = findShopItem(sku);
  if (!item) return { ok: false as const, status: 404, error: "That item is not in the shop." };
  const id = walletId(gate.value);
  const owned = await db.select({ id: gameInventory.id }).from(gameInventory).where(eq(gameInventory.walletId, id));
  const already = owned.length > 0 && (await ownedSkus(db, gate.value)).includes(item.sku);
  if (already) {
    return { ok: true as const, status: 200, alreadyOwned: true, wallet: await publicWallet(db, gate.value) };
  }
  const posted = await postEntry(db, gate.value, {
    bucket: "wallet",
    direction: "debit",
    amountCents: item.priceCents,
    reason: "shop",
    source: item.sku,
    sourceId: item.sku,
    idempotencyKey: `shop:${id}:${item.sku}`,
  });
  if (!posted.ok) return posted;
  const have = await ownedSkus(db, gate.value);
  if (!have.includes(item.sku)) {
    await db.insert(gameInventory).values({
      id: crypto.randomUUID(),
      walletId: id,
      sku: item.sku,
      acquiredAt: nowIso(),
    });
  }
  return { ok: true as const, status: 200, alreadyOwned: posted.duplicate, wallet: await publicWallet(db, gate.value) };
}

export async function grantReward(
  db: PortalDb,
  viewer: Viewer,
  subject: CharacterSubject,
  source: string,
  idempotencyKey: string,
) {
  const gate = walletAccess(viewer, "grant", subject);
  if (!gate.ok) return gate;
  const granted = await grantEarn(db, subject, "reward", `${source}:${idempotencyKey}`, `reward:${idempotencyKey}`);
  if (!granted.ok) return granted;
  return { ok: true as const, status: 200, wallet: await publicWallet(db, subject), duplicate: granted.duplicate };
}

export async function claimDailyLogin(db: PortalDb, subject: CharacterSubject, now = new Date()) {
  const today = utcDay(now);
  const rows = await rowsFor(db, walletId(subject));
  let streak = 1;
  for (let ago = 1; ago < ECONOMY.daily.maxStreak; ago += 1) {
    const day = addUtcDays(today, -ago);
    const hit = rows.some((row) => row.direction === "credit" && row.source === "daily" && row.sourceId === day);
    if (!hit) break;
    streak += 1;
  }
  const granted = await grantEarn(db, subject, "daily", today, `daily:${walletId(subject)}:${today}`, { now });
  if (!granted.ok) return granted;
  return { ...granted, streak: Math.min(streak, ECONOMY.daily.maxStreak) };
}

/** One flat daily login credit for the signed-in person's own wallet. */
export async function claimViewerDaily(db: PortalDb, viewer: Viewer, now = new Date()) {
  const own = characterSubjectForViewer(viewer);
  if (!own) return { ok: false as const, status: 404, error: "This sign-in has no wallet yet." };
  const granted = await claimDailyLogin(db, own, now);
  if (!granted.ok) return granted;
  return {
    ok: true as const,
    status: 200,
    duplicate: granted.duplicate,
    streak: granted.streak,
    wallet: await publicWallet(db, own),
  };
}

export async function economyStats(db: PortalDb, viewer: Viewer, now = new Date()) {
  if (!isOwner(viewer)) return { ok: false as const, status: 403, error: "Only the owner can view the economy." };
  const rows = await db.select().from(gameLedger);
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const sumDirection = (direction: "credit" | "debit", days: number) => {
    const start = since(days);
    return units(rows.reduce((sum, row) => sum + (row.direction === direction && row.createdAt >= start ? row.amountCents : 0), 0));
  };
  const ranked = (direction: "credit" | "debit") => {
    const start = since(30);
    const totals = new Map<string, number>();
    for (const row of rows) {
      if (row.direction !== direction || row.createdAt < start) continue;
      totals.set(row.source, (totals.get(row.source) ?? 0) + row.amountCents);
    }
    return [...totals.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([source, cents]) => ({ source, amount: units(cents) }));
  };
  const supply = {
    wallet: units(sumBucket(rows, "wallet")),
    bank: units(sumBucket(rows, "bank")),
    uncollected: units(sumBucket(rows, "uncollected")),
  };
  return {
    ok: true as const,
    status: 200,
    body: {
      currency: GAME_CURRENCY,
      supply,
      earned: { days7: sumDirection("credit", 7), days30: sumDirection("credit", 30) },
      spent: { days7: sumDirection("debit", 7), days30: sumDirection("debit", 30) },
      topSources: ranked("credit"),
      topSinks: ranked("debit"),
    },
  };
}
