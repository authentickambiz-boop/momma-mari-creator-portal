import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import { creatorBlockedFromConnections } from "@/lib/account-tier";
import { beginGmailBridgeConnect } from "@/lib/gmail-bridge";
import { createWatchCreatorCookie, gmailBridgeCreatorCookieName, gmailBridgeStateCookieName } from "@/lib/google-oauth";
import { findCreatorById } from "@/lib/queries";
import { sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.redirect(`${appBaseUrl()}/login`);
  const requested = new URL(request.url).searchParams.get("creator") ?? "";
  const creatorId = requested || (viewer.role === "creator" ? viewer.creatorId ?? "" : "");
  const db = await getDb();
  if (await creatorBlockedFromConnections(db, viewer)) {
    return NextResponse.redirect(`${appBaseUrl()}/pricing?locked=connect`);
  }
  const creator = creatorId ? await findCreatorById(db, creatorId) : null;
  const started = await beginGmailBridgeConnect(viewer, creatorId, creator?.email ?? viewer.email);
  if (!started.ok || !creator) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?gmail=${started.ok ? "oauth" : started.reason}`);
  }
  const response = NextResponse.redirect(started.url);
  response.cookies.set(gmailBridgeStateCookieName(), started.state, { ...sessionCookieOptions(), maxAge: 600 });
  response.cookies.set(gmailBridgeCreatorCookieName(), await createWatchCreatorCookie(creatorId), { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
