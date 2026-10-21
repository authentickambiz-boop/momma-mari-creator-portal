import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listCommissionInterest } from "@/lib/commission-campaigns";
import { botGuard } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = botGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  const since = new URL(request.url).searchParams.get("since");
  const db = await getDb();
  const result = await listCommissionInterest(db, id, since);
  return NextResponse.json(result.body, { status: result.status });
}
