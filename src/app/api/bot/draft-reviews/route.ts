import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { botGuard } from "@/lib/http";
import { listDraftReviews } from "@/lib/video-review";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const since = new URL(request.url).searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const db = await getDb();
  const reviews = await listDraftReviews(db, since);
  return NextResponse.json({ reviews });
}
