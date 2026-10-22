import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { promoImageFiles } from "@/db/schema";
import { currentViewer } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const db = await getDb();
  const rows = await db.select().from(promoImageFiles).where(eq(promoImageFiles.visualId, id));
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "That image is not on file." }, { status: 404 });
  const bytes = Buffer.from(file.bytesBase64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType.startsWith("image/") ? file.mimeType : "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
