import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { readCreatorW9 } from "@/lib/payout-ledger";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const db = await getDb();
  const result = await readCreatorW9(db, viewer, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
