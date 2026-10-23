import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import { parseCharacterSubject } from "@/lib/worlds/character";
import {
  parseEarnRates,
  parseRewardGrant,
  refuseCurrencyPurchase,
  walletAccess,
  walletAccessStatus,
} from "@/lib/worlds/game-wallet";
import { buyShopItem, grantReward, readGameWallet, saveEarnRates } from "@/lib/worlds/game-wallet-store";

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
  const record = body as { action?: unknown; sku?: unknown; rates?: unknown };
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
  return noStore({ error: "Unknown wallet action." }, 400);
}
