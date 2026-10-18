import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { markApprovalDraftSent } from "@/lib/bot-api";
import { botGuard, readBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = botGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const db = await getDb();
  const result = await markApprovalDraftSent(db, id, body);
  return NextResponse.json(result.body, { status: result.status });
}
