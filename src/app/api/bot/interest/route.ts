import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listCreatorInterest } from "@/lib/creator-interest";
import { botGuard } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const since = new URL(request.url).searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const db = await getDb();
  const decisions = await listCreatorInterest(db, since);
  return NextResponse.json({ decisions });
}
