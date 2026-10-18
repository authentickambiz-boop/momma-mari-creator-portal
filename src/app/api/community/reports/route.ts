import { reportCommunityMessage } from "@/lib/community";
import { communityContext, communityJson } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await communityContext();
  if ("response" in context) return context.response;
  const body = await request.json().catch(() => null) as { messageId?: string } | null;
  if (!body?.messageId) return communityJson({ error: "messageId is required." }, 400);
  const reported = await reportCommunityMessage(context.db, context.actor, body.messageId);
  if (!reported.ok) return communityJson({ error: reported.error }, reported.status);
  return communityJson({ id: reported.id }, 201);
}
