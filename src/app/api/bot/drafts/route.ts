import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { botGuard } from "@/lib/http";
import { listDraftsSince } from "@/lib/queries";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const includeSeed = url.searchParams.get("includeSeed") === "true";
  const db = await getDb();
  const drafts = await listDraftsSince(db, since, includeSeed);
  return NextResponse.json({ drafts });
}
