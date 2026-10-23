import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/format";
import { createOAuthState, googleAuthUrl, googleConfigured, oauthStateCookieName } from "@/lib/google-oauth";
import { sessionCookieOptions } from "@/lib/session";
import { WORLDS_RETURN_COOKIE, worldsReturnPath } from "@/lib/worlds/office-return";

export async function GET(request: Request) {
  const next = worldsReturnPath(new URL(request.url).searchParams.get("next"));
  if (!googleConfigured()) {
    const target = next
      ? `${appBaseUrl()}/login?error=not_configured&next=${next}`
      : `${appBaseUrl()}/login?error=not_configured`;
    return NextResponse.redirect(target);
  }
  const state = await createOAuthState();
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set(oauthStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  if (next) {
    response.cookies.set(WORLDS_RETURN_COOKIE, next, { ...sessionCookieOptions(), maxAge: 600 });
  } else {
    response.cookies.set(WORLDS_RETURN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  }
  return response;
}
