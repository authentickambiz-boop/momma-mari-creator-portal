import { listCommunity, touchCommunityPresence } from "@/lib/community";
import { communityContext, communityEmpty, communityJson, guardCommunity } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return guardCommunity(async () => {
    const context = await communityContext();
    if ("response" in context) return context.response;
    const after = new URL(request.url).searchParams.get("after");
    await touchCommunityPresence(context.db, context.actor);
    const listed = await listCommunity(context.db, context.actor, after);
    if (!listed.ok) return communityJson({ error: listed.error }, listed.status);
    if (listed.unchanged) return communityEmpty();
    return communityJson(listed);
  });
}
