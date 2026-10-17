import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { forwardChunk } from "@/lib/drive";
import { getDealAccessRow, getDraftRow, markDraftProgress } from "@/lib/queries";
import { assertCanUpload, parseContentRange, validateChunk } from "@/lib/uploads";

export async function PUT(request: Request, context: { params: Promise<{ id: string; draftId: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id, draftId } = await context.params;
  const db = await getDb();
  const deal = await getDealAccessRow(db, id);
  if (!deal) return NextResponse.json({ error: "That deal isn't on your list." }, { status: 404 });
  const allowed = assertCanUpload(viewer, deal);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const draft = await getDraftRow(db, draftId);
  if (!draft || draft.dealId !== deal.id) return NextResponse.json({ error: "That upload isn't on this deal." }, { status: 404 });
  if (draft.status !== "uploading") return NextResponse.json({ error: "This upload already finished." }, { status: 409 });

  const range = parseContentRange(request.headers.get("content-range"));
  if (!range || draft.sizeBytes == null) return NextResponse.json({ error: "Content-Range must look like bytes start-end/total." }, { status: 400 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const check = validateChunk({
    ...range,
    bytesReceived: draft.bytesReceived,
    sizeBytes: draft.sizeBytes,
    bodyLength: bytes.byteLength,
  });
  if (!check.ok) return NextResponse.json({ error: check.error, expectedStart: check.expectedStart }, { status: 409 });

  const received = range.end + 1;
  if (draft.uploadSessionUrl && draft.uploadSessionUrl !== "demo://local") {
    try {
      const result = await forwardChunk({
        sessionUrl: draft.uploadSessionUrl,
        bytes,
        start: range.start,
        end: range.end,
        total: range.total,
      });
      if (!result.complete) {
        await markDraftProgress(db, draft.id, { bytesReceived: received });
        return NextResponse.json({ status: "incomplete", bytesReceived: received });
      }
      await markDraftProgress(db, draft.id, {
        bytesReceived: received,
        status: "new",
        driveFileId: result.fileId,
        driveFileUrl: result.fileUrl,
      });
      return NextResponse.json({ status: "complete", mode: "drive", driveFileId: result.fileId, driveFileUrl: result.fileUrl, gmailThreadId: draft.gmailThreadId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Drive rejected the chunk.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await markDraftProgress(db, draft.id, {
    bytesReceived: received,
    status: check.complete ? "new" : "uploading",
    driveFileId: check.complete ? "demo-not-uploaded" : null,
    driveFileUrl: null,
  });
  return NextResponse.json({
    status: check.complete ? "complete" : "incomplete",
    mode: "demo",
    bytesReceived: received,
    driveFileId: check.complete ? "demo-not-uploaded" : null,
  });
}
