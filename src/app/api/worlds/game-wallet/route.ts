import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import { parseCharacterSubject } from "@/lib/worlds/character";
import {
  parseCollectDestination,
  parseEarnRates,
  parseIdempotencyKey,
  parseMoveAmount,
  parseRewardGrant,
  parseWeeklyInterest,
  refuseCurrencyPurchase,
  walletAccess,
  walletAccessStatus,
} from "@/lib/worlds/game-wallet";
import {
  buyShopItem,
  collectEarnings,
  depositToBank,
  grantReward,
  readGameWallet,
  saveEarnRates,
  saveInterestRate,
  withdrawFromBank,
} from "@/lib/worlds/game-wallet-store";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const viewer = await currentViewer();
  if (!viewer) return noStore({ error: "Sign in to see your wallet." }, 401);
  const url = new URL(request.url);
  const kind = url.searchParams.get("subjectKind");
  const id = url.searchParams.get("subjectId");
  const subject = kind || id ? parseCharacterSubject(kind, id) : null;
  if (subject && !subject.ok) return noStore({ error: subject.error }, 400);
  const db = await getDb();
  const result = await readGameWallet(db, viewer, subject?.ok ? subject.value : undefined);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body);
}

export async function POST(request: Request) {
  const viewer = await currentViewer();
  if (!viewer) return noStore({ error: "Sign in to see your wallet." }, 401);
  const body = await readBody(request);
  if (!body || typeof body !== "object") return noStore({ error: "Expected JSON." }, 400);
  const record = body as {
    action?: unknown;
    sku?: unknown;
    rates?: unknown;
    amount?: unknown;
    destination?: unknown;
    idempotencyKey?: unknown;
    weeklyPercent?: unknown;
  };
  if (record.action === "buy-currency") return noStore(refuseCurrencyPurchase(), refuseCurrencyPurchase().status);
  const db = await getDb();
  if (record.action === "buy") {
    if (typeof record.sku !== "string") return noStore({ error: "sku is required." }, 400);
    const bought = await buyShopItem(db, viewer, record.sku);
    if (!bought.ok) return noStore({ error: bought.error }, bought.status);
    return noStore({ wallet: bought.wallet, alreadyOwned: bought.alreadyOwned });
  }
  if (record.action === "set-rates") {
    const gate = walletAccess(viewer, "rates");
    if (!gate.ok) return noStore({ error: gate.error }, walletAccessStatus(gate.error));
    const rates = parseEarnRates(record.rates);
    if (!rates.ok) return noStore({ error: rates.error }, rates.status);
    return noStore({ rates: await saveEarnRates(db, rates.value) });
  }
  if (record.action === "reward") {
    const reward = parseRewardGrant(body);
    if (!reward.ok) return noStore({ error: reward.error }, reward.status);
    const granted = await grantReward(db, viewer, reward.value.subject, reward.value.source, reward.value.idempotencyKey);
    if (!granted.ok) return noStore({ error: granted.error }, granted.status);
    return noStore({ wallet: granted.wallet, duplicate: granted.duplicate });
  }
  if (record.action === "set-interest") {
    const rate = parseWeeklyInterest(record.weeklyPercent);
    if (!rate.ok) return noStore({ error: rate.error }, rate.status);
    const saved = await saveInterestRate(db, viewer, rate.value);
    if (!saved.ok) return noStore({ error: saved.error }, saved.status);
    return noStore({ interestWeeklyPercent: saved.interestWeeklyPercent });
  }
  if (record.action === "collect" || record.action === "deposit" || record.action === "withdraw") {
    const key = parseIdempotencyKey(record.idempotencyKey);
    if (!key.ok) return noStore({ error: key.error }, key.status);
    const amount = parseMoveAmount(record.amount, record.action === "collect");
    if (!amount.ok) return noStore({ error: amount.error }, amount.status);
    if (record.action === "collect") {
      const destination = parseCollectDestination(record.destination);
      if (!destination.ok) return noStore({ error: destination.error }, destination.status);
      const collected = await collectEarnings(db, viewer, amount.value, destination.value, key.value);
      if (!collected.ok) return noStore({ error: collected.error }, collected.status);
      return noStore({ wallet: collected.wallet, duplicate: collected.duplicate });
    }
    if (amount.value == null) return noStore({ error: "Amount must be more than zero." }, 400);
    const moved = record.action === "deposit"
      ? await depositToBank(db, viewer, amount.value, key.value)
      : await withdrawFromBank(db, viewer, amount.value, key.value);
    if (!moved.ok) return noStore({ error: moved.error }, moved.status);
    return noStore({ wallet: moved.wallet, duplicate: moved.duplicate });
  }
  return noStore({ error: "Unknown wallet action." }, 400);
}
