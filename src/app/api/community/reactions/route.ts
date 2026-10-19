import { reactToCommunityMessage } from "@/lib/community";
import { communityContext, communityJson, guardCommunity } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return guardCommunity(async () => {
    const context = await communityContext();
    if ("response" in context) return context.response;
    const body = await request.json().catch(() => null) as { messageId?: string; emoji?: string } | null;
    if (!body?.messageId || !body.emoji) return communityJson({ error: "messageId and emoji are required." }, 400);
    const reacted = await reactToCommunityMessage(context.db, context.actor, { messageId: body.messageId, emoji: body.emoji });
    if (!reacted.ok) return communityJson({ error: reacted.error }, reacted.status);
    return communityJson({ on: reacted.on });
  });
}
