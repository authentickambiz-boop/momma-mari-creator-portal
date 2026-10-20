import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { classifyBotThread, listBotThreads } from "@/lib/gmail-bridge";
import { botGuard, readBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const db = await getDb();
  const threads = await listBotThreads(db);
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const record = body as { creatorEmail?: unknown; threadId?: unknown; classification?: unknown };
  const db = await getDb();
  const result = await classifyBotThread(db, {
    creatorEmail: typeof record.creatorEmail === "string" ? record.creatorEmail : "",
    threadId: typeof record.threadId === "string" ? record.threadId : "",
    classification: typeof record.classification === "string" ? record.classification : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.id, classification: result.classification, private: result.private });
}
