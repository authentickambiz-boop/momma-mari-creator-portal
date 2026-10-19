import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { reportPdf, reportRecord, sharedReport } from "@/lib/rank-reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await getDb();
  const token = new URL(request.url).searchParams.get("token");
  const viewer = await currentViewer();
  const record = await reportRecord(db, id);
  if (!record) return new Response("Not found", { status: 404 });
  const allowed = viewer?.role === "admin" || (token && token === record.token);
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const body = token ? await sharedReport(db, record.token) : JSON.parse(record.bodyJson);
  if (!body) return new Response("Not found", { status: 404 });
  const bytes = await reportPdf(body);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${record.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
    },
  });
}
