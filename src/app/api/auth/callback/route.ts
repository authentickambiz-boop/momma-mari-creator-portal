import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import {
  exchangeCode,
  exchangeGmailCode,
  gmailStateCookieName,
  isGmailOAuthState,
  oauthStateCookieName,
  verifyGmailOAuthState,
  verifyOAuthState,
} from "@/lib/google-oauth";
import { saveGmailConnection } from "@/lib/onboarding";
import { creatorStartPath } from "@/lib/questionnaire";
import { resolveLogin } from "@/lib/queries";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (isGmailOAuthState(state)) {
    return finishGmailConnect(code, state);
  }
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
  const start = await creatorStartPath(db, login.viewer);
  const response = NextResponse.redirect(`${appBaseUrl()}${start}`);
  response.cookies.set(sessionCookieName(), session.cookieValue, sessionCookieOptions());
  response.cookies.set(oauthStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

async function finishGmailConnect(code: string | null, state: string | null) {
  const jar = await cookies();
  const valid = await verifyGmailOAuthState(jar.get(gmailStateCookieName())?.value, state);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appBaseUrl()}/connect?gmail=${reason}`);
    response.cookies.set(gmailStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  };
  if (!valid || !code) return fail("oauth");
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) return fail("creator_only");
  const mailbox = await exchangeGmailCode(code);
  if (!mailbox) return fail("no_refresh");
  const db = await getDb();
  const saved = await saveGmailConnection(db, viewer.creatorId, mailbox);
  if (!saved.ok) return fail(saved.status === 503 ? "not_configured" : "oauth");
  const response = NextResponse.redirect(`${appBaseUrl()}/onboarding?connected=1`);
  response.cookies.set(gmailStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
