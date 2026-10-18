import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listContracts, saveContract } from "@/lib/contracts";
import { botGuard, readBody } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const since = new URL(request.url).searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 });
  }
  const db = await getDb();
  const contracts = await listContracts(db, since);
  return NextResponse.json({ contracts });
}

export async function POST(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (typeof record.dealId !== "string" || typeof record.filename !== "string") {
    return NextResponse.json({ error: "dealId and filename are required." }, { status: 400 });
  }
  const db = await getDb();
  const result = await saveContract(db, {
    dealId: record.dealId,
    filename: record.filename,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : "",
    sha256: typeof record.sha256 === "string" ? record.sha256 : null,
    driveFileId: typeof record.driveFileId === "string" ? record.driveFileId : null,
    driveFileUrl: typeof record.driveFileUrl === "string" ? record.driveFileUrl : null,
    docusign: record.docusign === true,
    countersign: record.countersign === true,
    actorEmail: "bot",
    actorRole: "bot",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    id: result.id,
    version: result.version,
    signingFormat: result.signingFormat,
    sha256: result.sha256,
    workflowStage: result.workflowStage,
  }, { status: 201 });
}
