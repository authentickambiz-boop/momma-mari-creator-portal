import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { claimFulfillmentOrder, listQueuedOrders } from "@/lib/fulfillment-orders";
import { botGuard, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const db = await getDb();
  const result = await listQueuedOrders(db);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ orders: result.orders });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  const id = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { id?: unknown }).id === "string"
    ? (body as { id: string }).id
    : null;
  const db = await getDb();
  const result = await claimFulfillmentOrder(db, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ order: result.order });
}
