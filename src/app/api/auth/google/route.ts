import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/format";
import { createOAuthState, googleAuthUrl, googleConfigured, oauthStateCookieName } from "@/lib/google-oauth";
import { sessionCookieOptions } from "@/lib/session";

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/login?error=not_configured`);
  }
  const state = await createOAuthState();
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set(oauthStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
