import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { actWithCapability, resolveBotCaller, type CapabilityEffect } from "@/lib/capabilities";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseEffect(value: unknown): CapabilityEffect | null {
  if (!value || typeof value !== "object") return null;
  const effect = value as Record<string, unknown>;
  const dealId = text(effect.dealId);
  if (!dealId) return null;
  if (effect.kind === "negotiate" || effect.kind === "review_contracts") {
    return { kind: effect.kind, dealId, note: text(effect.note) };
  }
  if (effect.kind === "outreach") {
    return { kind: "outreach", dealId, to: text(effect.to), subject: text(effect.subject), body: text(effect.body) };
  }
  if (effect.kind === "draft_replies") return { kind: "draft_replies", dealId, body: text(effect.body) };
  if (effect.kind === "approve_deals") return { kind: "approve_deals", dealId };
  return null;
}

export async function POST(request: Request) {
  const db = await getDb();
  const caller = await resolveBotCaller(db, request.headers.get("authorization"));
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const effect = parseEffect(record.effect);
  if (!effect) return NextResponse.json({ error: "That action does not match the capability." }, { status: 400 });
  const result = await actWithCapability(db, {
    actorEmail: caller.email,
    actorRole: "bot",
    subjectType: "bot",
    subjectId: caller.botId ?? "master",
    capability: text(record.capability),
    summary: text(record.summary),
    effect,
    unrestricted: caller.unrestricted,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ mode: result.mode, draftId: result.draftId });
}
