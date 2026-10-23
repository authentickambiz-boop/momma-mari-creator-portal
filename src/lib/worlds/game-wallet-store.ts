import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, deals, gameEarnRates, gameInventory, gameLedger, gameWallets, payments } from "@/db/schema";
import { isOwner } from "@/lib/authz";
import { feeAndPayout, nowIso } from "@/lib/format";
import type { Viewer } from "@/lib/types";
import { characterSubjectForViewer, type CharacterSubject } from "./character";
import {
  BRAND_PAID_STATUSES,
  COMMISSION_CREDIT_COMING_SOON,
  DEFAULT_EARN_CENTS,
  EARN_TYPES,
  GAME_CATALOG,
  GAME_CURRENCY,
  creatorCommissionCreditEnabled,
  findShopItem,
  ledgerSum,
  walletAccess,
  type EarnType,
  type LedgerDirection,
} from "./game-wallet";
import { findOfficeBot } from "./office-catalog";

const PAID = new Set<string>(BRAND_PAID_STATUSES);

export type PublicLedgerEntry = {
  direction: LedgerDirection;
  amount: number;
  reason: string;
  source: string;
  createdAt: string;
};

export type PublicWallet = {
  subjectKind: CharacterSubject["kind"];
  subjectId: string;
  balance: number;
  currency: typeof GAME_CURRENCY;
  history: PublicLedgerEntry[];
  /** Set while WORLDS_CREATOR_COMMISSION_CREDIT is off. */
  historyNote: string | null;
};

function walletId(subject: CharacterSubject) {
  return `${subject.kind}:${subject.id}`;
}

function units(cents: number) {
  return cents / 100;
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

export async function walletBalanceCents(db: PortalDb, subject: CharacterSubject) {
  const rows = await rowsFor(db, walletId(subject));
  return ledgerSum(rows);
}

async function postEntry(
  db: PortalDb,
  subject: CharacterSubject,
  entry: { direction: LedgerDirection; amountCents: number; reason: string; source: string; idempotencyKey: string },
) {
  if (!Number.isInteger(entry.amountCents) || entry.amountCents <= 0) {
    return { ok: false as const, status: 400, error: "Amount must be more than zero." };
  }
  const source = entry.source.trim().slice(0, 80);
  if (!source) return { ok: false as const, status: 400, error: "source is required." };
  const prior = await db.select().from(gameLedger).where(eq(gameLedger.idempotencyKey, entry.idempotencyKey));
  const id = await ensureWallet(db, subject);
  if (prior[0]) {
    const balance = ledgerSum(await rowsFor(db, prior[0].walletId));
    return { ok: true as const, duplicate: true, balanceCents: balance, walletId: prior[0].walletId };
  }
  if (entry.direction === "debit") {
    const balance = ledgerSum(await rowsFor(db, id));
    if (balance < entry.amountCents) return { ok: false as const, status: 400, error: "Not enough currency." };
  }
  await db.insert(gameLedger).values({
    id: crypto.randomUUID(),
    walletId: id,
    direction: entry.direction,
    amountCents: entry.amountCents,
    reason: entry.reason,
    source,
    idempotencyKey: entry.idempotencyKey,
    createdAt: nowIso(),
  });
  return { ok: true as const, duplicate: false, balanceCents: ledgerSum(await rowsFor(db, id)), walletId: id };
}

export async function earnAmountCents(db: PortalDb, type: EarnType) {
  const rows = await db.select().from(gameEarnRates).where(eq(gameEarnRates.earnType, type));
  return rows[0]?.amountCents ?? DEFAULT_EARN_CENTS[type];
}

export async function readEarnRates(db: PortalDb) {
  const rows = await db.select().from(gameEarnRates);
  const saved = new Map(rows.map((row) => [row.earnType, row.amountCents]));
  const rates = {} as Record<EarnType, number>;
  for (const type of EARN_TYPES) rates[type] = units(saved.get(type) ?? DEFAULT_EARN_CENTS[type]);
  return rates;
}

export async function saveEarnRates(db: PortalDb, cents: Record<EarnType, number>) {
  const updatedAt = nowIso();
  for (const type of EARN_TYPES) {
    const existing = await db.select().from(gameEarnRates).where(eq(gameEarnRates.earnType, type));
    if (existing[0]) {
      await db.update(gameEarnRates).set({ amountCents: cents[type], updatedAt }).where(eq(gameEarnRates.earnType, type));
    } else {
      await db.insert(gameEarnRates).values({ earnType: type, amountCents: cents[type], updatedAt });
    }
  }
  return readEarnRates(db);
}

/** Configured credit. Minigames keep a rate and do not write the ledger. */
export async function grantEarn(
  db: PortalDb,
  subject: CharacterSubject,
  type: EarnType,
  source: string,
  idempotencyKey: string,
) {
  if (type === "minigame") {
    return {
      ok: false as const,
      status: 403,
      stub: true,
      credited: false as const,
      error: "Minigames are not in Worlds yet. Nothing was credited.",
    };
  }
  const amountCents = await earnAmountCents(db, type);
  if (amountCents <= 0) return { ok: true as const, credited: false as const, duplicate: false, balanceCents: await walletBalanceCents(db, subject) };
  const posted = await postEntry(db, subject, {
    direction: "credit",
    amountCents,
    reason: type,
    source,
    idempotencyKey,
  });
  if (!posted.ok) return posted;
  return { ok: true as const, credited: !posted.duplicate, duplicate: posted.duplicate, balanceCents: posted.balanceCents };
}

export async function noteTaskCompleted(db: PortalDb, creatorId: string, taskId: string) {
  try {
    await grantEarn(db, { kind: "user", id: creatorId }, "task", `task:${taskId}`, `task:${taskId}`);
  } catch {
    // Currency is a side effect. The task itself still completes.
  }
}

export async function noteCommandCompleted(db: PortalDb, commandId: string, botIds: readonly string[]) {
  try {
    for (const botId of botIds) {
      if (!findOfficeBot(botId)) continue;
      await grantEarn(db, { kind: "bot", id: botId }, "command", `command:${commandId}`, `command:${commandId}:${botId}`);
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
 * Reads brand-paid deal payments and credits the creator's in-game wallet
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
      direction: "credit",
      amountCents: share.feeCents,
      reason: "commission",
      source: deal.brand,
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
      createdAt: row.createdAt,
    }));
  return {
    subjectKind: subject.kind,
    subjectId: subject.id,
    balance: units(ledgerSum(rows)),
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
    price: units(item.priceCents),
    owned: owned.has(item.sku),
    note: item.note,
  }));
}

async function officeBalances(db: PortalDb) {
  const wallets = await db.select().from(gameWallets);
  const names = new Map((await db.select({ id: creators.id, name: creators.name }).from(creators)).map((creator) => [creator.id, creator.name]));
  const bots = [];
  const people = [];
  for (const wallet of wallets) {
    const balance = units(ledgerSum(await rowsFor(db, wallet.id)));
    if (balance === 0) continue;
    if (wallet.subjectKind === "bot") {
      const bot = findOfficeBot(wallet.subjectId);
      if (bot) bots.push({ id: bot.id, name: bot.name, balance });
    } else if (wallet.subjectKind === "user" && wallet.subjectId !== "owner") {
      people.push({ id: wallet.subjectId, name: names.get(wallet.subjectId) ?? "Creator", balance });
    }
  }
  return { bots, creators: people };
}

export async function readGameWallet(db: PortalDb, viewer: Viewer, subject?: CharacterSubject) {
  await creditPaidBrandCommissions(db);
  const gate = walletAccess(viewer, "read", subject);
  if (!gate.ok || !gate.value) return gate.ok ? { ok: false as const, status: 404, error: "This sign-in has no wallet yet." } : gate;
  const wallet = await publicWallet(db, gate.value);
  const catalog = await catalogFor(db, gate.value.kind === "user" ? gate.value : characterSubjectForViewer(viewer) ?? gate.value);
  const rates = isOwner(viewer) ? await readEarnRates(db) : null;
  const extra = isOwner(viewer) ? await officeBalances(db) : { bots: [], creators: [] };
  return { ok: true as const, status: 200, body: { wallet, catalog, rates, bots: extra.bots, creators: extra.creators } };
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
    direction: "debit",
    amountCents: item.priceCents,
    reason: "shop",
    source: item.sku,
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
  const granted = await grantEarn(db, subject, "reward", source, `reward:${idempotencyKey}`);
  if (!granted.ok) return granted;
  return { ok: true as const, status: 200, wallet: await publicWallet(db, subject), duplicate: granted.duplicate };
}
