import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { appBaseUrl } from "@/lib/format";
import { exchangeCode, oauthStateCookieName, verifyOAuthState } from "@/lib/google-oauth";
import { resolveLogin } from "@/lib/queries";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") ?? "";
  const stateCookie = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${oauthStateCookieName()}=`))?.split("=").slice(1).join("=");
  const valid = await verifyOAuthState(stateCookie ? decodeURIComponent(stateCookie) : undefined, state);
  if (!valid || !code) {
    return NextResponse.redirect(`${appBaseUrl()}/login?error=oauth`);
  }
  const email = await exchangeCode(code);
  if (!email) return NextResponse.redirect(`${appBaseUrl()}/login?error=oauth`);
  const db = await getDb();
  const login = await resolveLogin(db, email);
  if (!login.ok) return NextResponse.redirect(`${appBaseUrl()}/login?error=not_allowed`);
  const session = await createSession(db, login.viewer);
  const response = NextResponse.redirect(`${appBaseUrl()}/`);
  response.cookies.set(sessionCookieName(), session.cookieValue, sessionCookieOptions());
  response.cookies.set(oauthStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
