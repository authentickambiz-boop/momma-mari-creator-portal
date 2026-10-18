import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { contractFiles } from "@/db/schema";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { getDealForViewer } from "@/lib/queries";

export async function GET(_request: Request, context: { params: Promise<{ id: string; contractId: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id, contractId } = await context.params;
  const db = await getDb();
  const deal = await getDealForViewer(db, viewer, id);
  if (!deal) return NextResponse.json({ error: "That deal isn't on your list." }, { status: 404 });
  const contract = deal.contracts.find((row) => row.id === contractId);
  if (!contract) return NextResponse.json({ error: "That contract isn't on your list." }, { status: 404 });
  const rows = await db.select().from(contractFiles).where(eq(contractFiles.contractId, contractId));
  if (!rows[0]) return NextResponse.json({ error: "This file isn't stored on the portal." }, { status: 404 });
  const bytes = Buffer.from(rows[0].bytesBase64, "base64");
  const filename = contract.filename.replace(/["\r\n]/g, "");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Accept-Ranges": "bytes",
    },
  });
}
