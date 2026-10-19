import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { botGuard, readBody } from "@/lib/http";
import { createPlatformInvite } from "@/lib/platform-invites";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const db = await getDb();
  const result = await createPlatformInvite(db, body);
  return NextResponse.json(result.body, { status: result.status });
}
