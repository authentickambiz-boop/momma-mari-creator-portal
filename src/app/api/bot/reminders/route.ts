import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { runDeliverableNudges } from "@/lib/calendar";
import { botGuard, readBody } from "@/lib/http";
import { queueUsageRenewalDrafts } from "@/lib/usage-renewal";

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const db = await getDb();
  const today = typeof record.today === "string" ? record.today : "";
  const usageRenewals = await queueUsageRenewalDrafts(db, today);
  const result = await runDeliverableNudges(db, {
    today,
    channel: typeof record.channel === "string" ? record.channel : "portal",
    actorRole: "bot",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ nudged: result.nudged, usageRenewalDrafts: usageRenewals.created });
}
