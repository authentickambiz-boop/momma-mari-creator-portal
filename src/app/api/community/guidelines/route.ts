import { acceptCommunityGuidelines } from "@/lib/community";
import { communityContext, communityJson } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST() {
  const context = await communityContext();
  if ("response" in context) return context.response;
  const accepted = await acceptCommunityGuidelines(context.db, context.actor);
  if (!accepted.ok) return communityJson({ error: accepted.error }, accepted.status);
  return communityJson({ accepted: true });
}
