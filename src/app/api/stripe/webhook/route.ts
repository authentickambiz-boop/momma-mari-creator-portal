import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { handleStripeWebhook } from "@/lib/payments";

export async function POST(request: Request) {
  const db = await getDb();
  const result = await handleStripeWebhook(request, db);
  return NextResponse.json(result.body, { status: result.status });
}
