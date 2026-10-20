import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { readThreadAttachment } from "@/lib/gmail-bridge";
import { downloadGmailAttachment } from "@/lib/gmail-push";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string; attachmentId: string }> },
) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { threadId, attachmentId } = await context.params;
  const messageId = new URL(request.url).searchParams.get("message") ?? "";
  const db = await getDb();
  const result = await readThreadAttachment(
    db,
    viewer,
    { threadId, messageId, attachmentId },
    async ({ messageId: id, attachmentId: fileId, refreshToken }) => downloadGmailAttachment(refreshToken, id, fileId),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.filename.replaceAll("\"", "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
