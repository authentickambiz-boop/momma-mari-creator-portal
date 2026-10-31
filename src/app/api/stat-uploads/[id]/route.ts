import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { base64ToBytes, readStatUpload } from "@/lib/stat-uploads";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to open this file." }, { status: 401 });
  const { id } = await context.params;
  const row = await readStatUpload(await getDb(), viewer, id);
  if (!row) return NextResponse.json({ error: "That file is not available." }, { status: 404 });
  const bytes = base64ToBytes(row.bodyBase64);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": row.contentType,
      "content-disposition": `inline; filename="${row.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
