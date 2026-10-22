import { currentViewer } from "@/lib/current-user";
import { getDb } from "@/db/getDb";
import { yearlySummaryCsv } from "@/lib/payout-ledger";

export async function GET(request: Request) {
  const viewer = await currentViewer();
  if (!viewer) return new Response("Sign in required.", { status: 401 });
  const year = Number(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
  const db = await getDb();
  const result = await yearlySummaryCsv(db, viewer, year);
  if (!result.ok) return new Response(result.error, { status: result.status });
  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
