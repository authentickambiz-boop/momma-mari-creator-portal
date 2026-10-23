import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { isOwner } from "@/lib/authz";
import { authorizeBot } from "@/lib/bot-api";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import { listOfficeWallets, saveOfficeWallet } from "@/lib/worlds/office-wallet-store";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Owner session, or the bot token Money Bot uses to read and write balances. */
async function allow(request: Request) {
  const header = request.headers.get("authorization");
  if (header) {
    const bot = authorizeBot(header);
    if (!bot.ok) return NextResponse.json(bot.body, { status: bot.status });
    return null;
  }
  const viewer = await currentViewer();
  if (!viewer || !isOwner(viewer)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return null;
}

export async function GET(request: Request) {
  const denied = await allow(request);
  if (denied) return denied;
  const db = await getDb();
  return noStore(await listOfficeWallets(db));
}

/** Create a balance or update the wallet with this id or name. Admin session or bot token. */
export async function POST(request: Request) {
  const denied = await allow(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return noStore({ error: "Expected JSON." }, 400);
  const db = await getDb();
  const result = await saveOfficeWallet(db, body);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body, result.status);
}
