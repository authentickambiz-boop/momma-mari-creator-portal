import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { decodePushMessage, ingestGmailPush, verifyPubSubOidc } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const verified = await verifyPubSubOidc(request.headers.get("authorization"));
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: verified.status });
  const body = await request.json().catch(() => null);
  const note = decodePushMessage(body);
  if (!note) return NextResponse.json({ error: "Expected a Pub/Sub message." }, { status: 400 });
  const db = await getDb();
  const result = await ingestGmailPush(db, note);
  return NextResponse.json(result.body, { status: result.status });
}
