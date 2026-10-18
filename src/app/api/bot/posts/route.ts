import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listLivePostsSince, submitLivePosts } from "@/lib/fulfillment";
import { botGuard, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const db = await getDb();
  const posts = await listLivePostsSince(db, since);
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const links = Array.isArray(record.links)
    ? record.links.flatMap((link) => {
        if (!link || typeof link !== "object") return [];
        const row = link as Record<string, unknown>;
        return [{ platform: typeof row.platform === "string" ? row.platform : "", url: typeof row.url === "string" ? row.url : "" }];
      })
    : [];
  const db = await getDb();
  const result = await submitLivePosts(db, {
    dealId: typeof record.dealId === "string" ? record.dealId : "",
    links,
    actorEmail: "bot",
    actorRole: "bot",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ workflowStage: result.workflowStage }, { status: 201 });
}
