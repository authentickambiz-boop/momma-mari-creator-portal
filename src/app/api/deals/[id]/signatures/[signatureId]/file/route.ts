import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { signatureFiles } from "@/db/schema";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { getDealForViewer } from "@/lib/queries";

export async function GET(_request: Request, context: { params: Promise<{ id: string; signatureId: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id, signatureId } = await context.params;
  const db = await getDb();
  const deal = await getDealForViewer(db, viewer, id);
  if (!deal) return NextResponse.json({ error: "That deal isn't on your list." }, { status: 404 });
  const signature = deal.signatures.find((row) => row.id === signatureId);
  if (!signature || signature.status === "void" || !signature.signedFilename) {
    return NextResponse.json({ error: "That signed copy isn't on your list." }, { status: 404 });
  }
  const rows = await db.select().from(signatureFiles).where(eq(signatureFiles.signatureId, signatureId));
  if (!rows[0]) return NextResponse.json({ error: "This signed copy isn't stored on the portal." }, { status: 404 });
  const bytes = Buffer.from(rows[0].bytesBase64, "base64");
  const filename = signature.signedFilename.replace(/["\r\n]/g, "");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Accept-Ranges": "bytes",
    },
  });
}
