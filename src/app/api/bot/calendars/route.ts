import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { botCalendarBusy } from "@/lib/google-calendar";
import { botGuard } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Busy and free blocks for one creator. Event titles, locations, and tokens stay out. */
export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const db = await getDb();
  const result = await botCalendarBusy(db, {
    creatorId: url.searchParams.get("creatorId") ?? "",
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  return NextResponse.json(result.body, { status: result.status });
}
