import { getDb } from "@/db/getDb";
import { publicBrandRecap } from "@/lib/brand-recap";
import { brandRecapCsv } from "@/lib/brand-recap-report";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const report = await publicBrandRecap(await getDb(), token);
  if (!report) return new Response("Not found.", { status: 404 });
  const filename = `${report.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand"}-recap.csv`;
  return new Response(brandRecapCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
