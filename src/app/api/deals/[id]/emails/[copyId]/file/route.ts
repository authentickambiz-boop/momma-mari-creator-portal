import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { emailCopies, emailCopyFiles } from "@/db/schema";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { getDealForViewer } from "@/lib/queries";

export async function GET(_request: Request, context: { params: Promise<{ id: string; copyId: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id, copyId } = await context.params;
  const db = await getDb();
  const deal = await getDealForViewer(db, viewer, id);
  if (!deal) return NextResponse.json({ error: "That deal isn't on your list." }, { status: 404 });
  const copies = await db.select().from(emailCopies).where(eq(emailCopies.id, copyId));
  const copy = copies[0];
  if (!copy || copy.dealId !== id) return NextResponse.json({ error: "That email copy isn't on your list." }, { status: 404 });
  const rows = await db.select().from(emailCopyFiles).where(eq(emailCopyFiles.copyId, copyId));
  if (!rows[0]) return NextResponse.json({ error: "This file isn't stored on the portal." }, { status: 404 });
  const bytes = Buffer.from(rows[0].bytesBase64, "base64");
  const filename = copy.filename.replace(/["\r\n]/g, "");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Accept-Ranges": "bytes",
    },
  });
}
