import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { approvalListAllowed } from "@/lib/approvals";
import { createApprovalDraft, listApprovedApprovals } from "@/lib/bot-api";
import { botGuard, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const allowed = approvalListAllowed(new URL(request.url).searchParams.get("status"));
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const db = await getDb();
  const result = await listApprovedApprovals(db);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const db = await getDb();
  const result = await createApprovalDraft(db, body);
  return NextResponse.json(result.body, { status: result.status });
}
