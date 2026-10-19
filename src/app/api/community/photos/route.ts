import { saveCommunityPhoto } from "@/lib/community";
import { communityContext, communityJson, guardCommunity } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return guardCommunity(async () => {
    const context = await communityContext();
    if ("response" in context) return context.response;
    const body = await request.json().catch(() => null) as { bytesBase64?: string; contentType?: string; childFace?: boolean } | null;
    if (!body?.bytesBase64 || !body.contentType) return communityJson({ error: "Upload a photo." }, 400);
    const bytes = Buffer.from(body.bytesBase64, "base64");
    const saved = await saveCommunityPhoto(context.db, context.actor, {
      bytes,
      contentType: body.contentType,
      childFace: Boolean(body.childFace),
    });
    if (!saved.ok) return communityJson({ error: saved.error }, saved.status);
    return communityJson({ id: saved.id, held: saved.held }, 201);
  });
}
