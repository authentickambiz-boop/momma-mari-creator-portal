import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { syncConnectedMailboxes } from "@/lib/gmail-bridge";
import { authorizeCron, catchUpWatchedMailboxes } from "@/lib/gmail-push";
import { queueBrandRecapDrafts } from "@/lib/brand-recap";
import { queueUsageRenewalDrafts } from "@/lib/usage-renewal";
import { syncPostedUsageNotices } from "@/lib/usage-extension";

export const dynamic = "force-dynamic";

async function sync(request: Request) {
  const allowed = authorizeCron(request.headers.get("authorization"));
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const usageRenewals = await queueUsageRenewalDrafts(db, today);
  const usageNotices = await syncPostedUsageNotices(db, today);
  const brandRecaps = await queueBrandRecapDrafts(db, today);
  const caughtUp = await catchUpWatchedMailboxes(db);
  const result = await syncConnectedMailboxes(db);
  return NextResponse.json({ ...result, caughtUp, usageRenewalDrafts: usageRenewals.created, usageNotices, brandRecapDrafts: brandRecaps.created });
}

export async function GET(request: Request) {
  return sync(request);
}

export async function POST(request: Request) {
  return sync(request);
}
