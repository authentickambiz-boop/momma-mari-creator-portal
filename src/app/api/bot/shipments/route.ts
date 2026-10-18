import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listShipmentsSince, saveShipment } from "@/lib/fulfillment";
import { botGuard, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const db = await getDb();
  const shipments = await listShipmentsSince(db, since);
  return NextResponse.json({ shipments });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const db = await getDb();
  const result = await saveShipment(db, {
    dealId: typeof record.dealId === "string" ? record.dealId : "",
    carrier: typeof record.carrier === "string" ? record.carrier : "",
    trackingNumber: typeof record.trackingNumber === "string" ? record.trackingNumber : "",
    actorEmail: "bot",
    actorRole: "bot",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.id, workflowStage: result.workflowStage }, { status: 201 });
}
