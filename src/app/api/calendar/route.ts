import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { buildCalendarFeed } from "@/lib/calendar";
import { currentViewer } from "@/lib/current-user";

export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = await getDb();
  const feed = await buildCalendarFeed(db, viewer);
  if (!feed.ok) return NextResponse.json({ error: feed.error }, { status: feed.status });
  const bytes = Buffer.from(feed.body, "utf8");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${feed.filename}"`,
      "X-Robots-Tag": "noindex",
    },
  });
}
