import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { driveConfigured, openResumableSession, prepareDriveFolder } from "@/lib/drive";
import { findCreatorById, getDealAccessRow, insertDraft, nextDraftVersion } from "@/lib/queries";
import { allowedVideoType, assertCanUpload, chunkSizeBytes, maxUploadBytes, safeFilename } from "@/lib/uploads";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const db = await getDb();
  const deal = await getDealAccessRow(db, id);
  if (!deal) return NextResponse.json({ error: "That deal isn't on your list." }, { status: 404 });
  const allowed = assertCanUpload(viewer, deal);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const body = await request.json().catch(() => null) as { filename?: string; mimeType?: string; sizeBytes?: number } | null;
  if (!body || typeof body.filename !== "string" || typeof body.sizeBytes !== "number") {
    return NextResponse.json({ error: "filename and sizeBytes are required." }, { status: 400 });
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "video/mp4";
  if (!allowedVideoType(mimeType)) return NextResponse.json({ error: "Upload a video file." }, { status: 400 });
  if (body.sizeBytes <= 0 || body.sizeBytes > maxUploadBytes()) {
    return NextResponse.json({ error: "That file is empty or larger than the portal allows." }, { status: 400 });
  }

  const creator = await findCreatorById(db, deal.creatorId);
  const version = await nextDraftVersion(db, deal.id);
  const filename = `v${version}-${safeFilename(body.filename)}`;
  const draftId = crypto.randomUUID();
  let mode: "drive" | "demo" = "demo";
  let sessionUrl: string | null = null;
  let folderId: string | null = deal.driveFolderId;

  if (driveConfigured()) {
    try {
      folderId = await prepareDriveFolder(db, {
        id: deal.id,
        brand: deal.brand,
        driveFolderId: deal.driveFolderId,
        creatorFolderId: creator?.driveFolderId ?? null,
      });
      sessionUrl = await openResumableSession({ folderId, filename, mimeType, sizeBytes: body.sizeBytes });
      mode = "drive";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Drive upload failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await insertDraft(db, {
    id: draftId,
    dealId: deal.id,
    version,
    filename,
    mimeType,
    sizeBytes: body.sizeBytes,
    uploadSessionUrl: sessionUrl ?? "demo://local",
    driveFolderId: folderId,
    gmailThreadId: deal.gmailThreadId,
    status: "uploading",
  });

  return NextResponse.json({ draftId, version, mode, chunkBytes: chunkSizeBytes() });
}
