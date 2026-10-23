import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { isOwner } from "@/lib/authz";
import { authorizeBot } from "@/lib/bot-api";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import { enqueueOfficeCommand, listPendingCommands, listRecentCommands, updateOfficeCommand } from "@/lib/worlds/office-command-queue";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Owner session sees the mission log. The bot token sees only pending work. */
export async function GET(request: Request) {
  const header = request.headers.get("authorization");
  const db = await getDb();
  if (header) {
    const bot = authorizeBot(header);
    if (!bot.ok) return NextResponse.json(bot.body, { status: bot.status });
    return noStore({ commands: await listPendingCommands(db) });
  }
  const viewer = await currentViewer();
  if (!viewer || !isOwner(viewer)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return noStore({ commands: await listRecentCommands(db) });
}

/** Queued from the office UI. Owner session only, so a bot cannot enqueue as Kamron. */
export async function POST(request: Request) {
  const viewer = await currentViewer();
  if (!viewer || !isOwner(viewer)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readBody(request);
  if (!body) return noStore({ error: "Expected JSON." }, 400);
  const db = await getDb();
  const result = await enqueueOfficeCommand(db, body);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body, result.status);
}

/** Bot token moves queued -> picked_up -> in_progress -> done, needs_approval, or declined. */
export async function PATCH(request: Request) {
  const bot = authorizeBot(request.headers.get("authorization"));
  if (!bot.ok) return NextResponse.json(bot.body, { status: bot.status });
  const body = await readBody(request);
  if (!body) return noStore({ error: "Expected JSON." }, 400);
  const db = await getDb();
  const result = await updateOfficeCommand(db, body);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body, result.status);
}
