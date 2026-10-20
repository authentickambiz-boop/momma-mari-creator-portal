import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { deliverFulfillmentOrder } from "@/lib/fulfillment-orders";
import { botGuard, readBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = botGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const record = body as { url?: unknown; filename?: unknown; body?: unknown };
  const db = await getDb();
  const result = await deliverFulfillmentOrder(db, id, record);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ order: result.order, duplicate: result.duplicate });
}
