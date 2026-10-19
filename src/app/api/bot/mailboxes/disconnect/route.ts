import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { disconnectMailbox } from "@/lib/gmail-push";
import { botGuard, readBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  const email = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { email?: unknown }).email === "string"
    ? (body as { email: string }).email
    : "";
  const db = await getDb();
  const result = await disconnectMailbox(db, email);
  return NextResponse.json(result.body, { status: result.status });
}
