import { getDb } from "@/db/getDb";
import { publicRosterFeed } from "@/lib/roster-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await publicRosterFeed(await getDb());
  return Response.json(feed, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
