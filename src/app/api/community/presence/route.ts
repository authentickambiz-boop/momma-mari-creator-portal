import { touchCommunityPresence } from "@/lib/community";
import { communityContext, communityJson, guardCommunity } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST() {
  return guardCommunity(async () => {
    const context = await communityContext();
    if ("response" in context) return context.response;
    const seen = await touchCommunityPresence(context.db, context.actor);
    if (!seen.ok) return communityJson({ error: seen.error }, seen.status);
    return communityJson({ seen: true });
  });
}
