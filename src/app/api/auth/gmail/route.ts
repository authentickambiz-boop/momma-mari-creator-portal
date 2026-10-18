import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import { createGmailOAuthState, gmailStateCookieName, googleConfigured, googleGmailAuthUrl } from "@/lib/google-oauth";
import { tokenEncryptionConfigured } from "@/lib/token-crypto";
import { sessionCookieOptions } from "@/lib/session";

export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.redirect(`${appBaseUrl()}/login`);
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?gmail=creator_only`);
  }
  if (!googleConfigured() || !tokenEncryptionConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?gmail=not_configured`);
  }
  const state = await createGmailOAuthState();
  const response = NextResponse.redirect(googleGmailAuthUrl(state, viewer.email));
  response.cookies.set(gmailStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
