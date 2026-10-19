import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listInboxEvents, parseSince } from "@/lib/gmail-push";
import { botGuard } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const parsed = parseSince(new URL(request.url).searchParams.get("since"));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const db = await getDb();
  const events = await listInboxEvents(db, parsed.since);
  return NextResponse.json({ events });
}
