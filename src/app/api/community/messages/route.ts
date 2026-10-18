import { postCommunityMessage } from "@/lib/community";
import { communityContext, communityJson } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await communityContext();
  if ("response" in context) return context.response;
  const body = await request.json().catch(() => null) as {
    channelId?: string;
    body?: string;
    photoId?: string;
    acknowledgePrivate?: boolean;
  } | null;
  if (!body?.channelId) return communityJson({ error: "channelId is required." }, 400);
  const posted = await postCommunityMessage(context.db, context.actor, {
    channelId: body.channelId,
    body: body.body,
    photoId: body.photoId,
    acknowledgePrivate: body.acknowledgePrivate,
  });
  if (!posted.ok) return communityJson({ error: posted.error, kinds: posted.kinds ?? [] }, posted.status);
  return communityJson({ id: posted.id }, 201);
}
