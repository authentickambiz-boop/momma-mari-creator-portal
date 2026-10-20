import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { syncConnectedMailboxes } from "@/lib/gmail-bridge";
import { authorizeCron } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

async function sync(request: Request) {
  const allowed = authorizeCron(request.headers.get("authorization"));
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const db = await getDb();
  const result = await syncConnectedMailboxes(db);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return sync(request);
}

export async function POST(request: Request) {
  return sync(request);
}
