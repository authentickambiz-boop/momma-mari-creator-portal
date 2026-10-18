import { NextResponse } from "next/server";
import { openCommunityPhoto } from "@/lib/community";
import { communityContext, communityJson } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await communityContext();
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const url = new URL(request.url);
  const opened = await openCommunityPhoto(gate.db, gate.actor, {
    id,
    exp: url.searchParams.get("exp"),
    sig: url.searchParams.get("sig"),
  });
  if (!opened.ok) return communityJson({ error: opened.error }, opened.status);
  const bytes = Buffer.from(opened.bytes);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": opened.contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
}
