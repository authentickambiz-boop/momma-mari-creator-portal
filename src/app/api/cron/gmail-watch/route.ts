import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { authorizeCron, renewGmailWatches, renewMailboxWatch } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

async function renew(request: Request) {
  const allowed = authorizeCron(request.headers.get("authorization"));
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const db = await getDb();
  const mailboxes = await renewGmailWatches(db, ({ refreshToken }) => renewMailboxWatch(refreshToken));
  return NextResponse.json({ mailboxes });
}

export async function GET(request: Request) {
  return renew(request);
}

export async function POST(request: Request) {
  return renew(request);
}
