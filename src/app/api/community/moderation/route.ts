import { moderateCommunity } from "@/lib/community";
import { communityContext, communityJson } from "@/lib/community-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await communityContext();
  if ("response" in context) return context.response;
  const body = await request.json().catch(() => null) as {
    action?: string;
    messageId?: string;
    memberId?: string;
    reportId?: string;
    photoId?: string;
    role?: string;
    readOnly?: boolean;
    slowSeconds?: number;
  } | null;
  if (!body?.action) return communityJson({ error: "action is required." }, 400);
  const result = await moderateCommunity(context.db, context.actor, { ...body, action: body.action });
  if (!result.ok) return communityJson({ error: result.error }, result.status);
  return communityJson({ done: true });
}
