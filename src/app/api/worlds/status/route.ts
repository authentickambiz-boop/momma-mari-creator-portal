import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { isOwner } from "@/lib/authz";
import { authorizeBot } from "@/lib/bot-api";
import { currentViewer } from "@/lib/current-user";
import { readBody } from "@/lib/http";
import { loadOfficeStatus, saveOfficeSnapshot, saveOfficeWrite } from "@/lib/worlds/office-status";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Owner session, or the same bearer token the other bot routes use. */
async function readAllowed(request: Request) {
  const header = request.headers.get("authorization");
  if (header) {
    const bot = authorizeBot(header);
    if (!bot.ok) return NextResponse.json(bot.body, { status: bot.status });
    return null;
  }
  const viewer = await currentViewer();
  if (!viewer || !isOwner(viewer)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return null;
}

function writeAllowed(request: Request) {
  const bot = authorizeBot(request.headers.get("authorization"));
  if (!bot.ok) return NextResponse.json(bot.body, { status: bot.status });
  return null;
}

export async function GET(request: Request) {
  const denied = await readAllowed(request);
  if (denied) return denied;
  const db = await getDb();
  return noStore(await loadOfficeStatus(db));
}

/** Scheduler push. Replaces the stored office snapshot. Bot token only. */
export async function POST(request: Request) {
  const denied = writeAllowed(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return noStore({ error: "Expected JSON." }, 400);
  const db = await getDb();
  const result = await saveOfficeSnapshot(db, body);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body, result.status);
}

/** Wing managers update calendar and to-dos. Kash Bot sets note status. Bots drop notes or update a task. */
export async function PATCH(request: Request) {
  const denied = writeAllowed(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return noStore({ error: "Expected JSON." }, 400);
  const db = await getDb();
  const result = await saveOfficeWrite(db, body);
  if (!result.ok) return noStore({ error: result.error }, result.status);
  return noStore(result.body, result.status);
}
