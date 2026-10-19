import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { upsertBrandCrmByDomain } from "@/lib/brand-crm";
import { botGuard, readBody } from "@/lib/http";

export async function PUT(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const db = await getDb();
  const saved = await upsertBrandCrmByDomain(db, {
    domain: typeof record.domain === "string" ? record.domain : "",
    contactEmail: typeof record.contactEmail === "string" ? record.contactEmail : "",
    brand: typeof record.brand === "string" ? record.brand : null,
    contactName: typeof record.contactName === "string" ? record.contactName : null,
    outcome: typeof record.outcome === "string" ? record.outcome : undefined,
    ratePaidCents: typeof record.ratePaidCents === "number" ? record.ratePaidCents : undefined,
    nextFollowUp: typeof record.nextFollowUp === "string" ? record.nextFollowUp : undefined,
    note: typeof record.note === "string" ? record.note : undefined,
    creatorId: typeof record.creatorId === "string" ? record.creatorId : undefined,
    actorName: "bot",
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json({ id: saved.id, created: saved.created });
}
