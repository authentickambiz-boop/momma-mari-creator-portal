import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { upsertOfferReview } from "@/lib/creator-deal-review";
import { botGuard, readBody } from "@/lib/http";

export async function PUT(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const db = await getDb();
  const result = await upsertOfferReview(db, body);
  return NextResponse.json(result.body, { status: result.status });
}
