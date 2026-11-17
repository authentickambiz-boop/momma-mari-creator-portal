import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { nowIso } from "@/lib/format";
import { listLiveDeals } from "@/lib/live-deals";
import { logPortalError } from "@/lib/portal-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const db = await getDb();
  try {
    const deals = await listLiveDeals(db, viewer);
    return NextResponse.json({ deals, polledAt: nowIso() });
  } catch (error) {
    logPortalError("live deals", error);
    return NextResponse.json({ deals: [], polledAt: nowIso() });
  }
}
