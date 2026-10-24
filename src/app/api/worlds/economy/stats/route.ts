import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { economyStats } from "@/lib/worlds/game-wallet-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to see your wallet." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const db = await getDb();
  const result = await economyStats(db, viewer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(result.body, { headers: { "Cache-Control": "no-store" } });
}
