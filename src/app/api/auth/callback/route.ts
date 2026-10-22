import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { appBaseUrl, normalizeEmail } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import { gmailSyncEnabled } from "@/lib/gmail-sync-flag";
import { mailboxForCreator, renewGmailWatches, renewMailboxWatch } from "@/lib/gmail-push";
import {
  calendarStateCookieName,
  driveStateCookieName,
  exchangeCalendarCode,
  exchangeCode,
  exchangeDriveCode,
  exchangeGmailCode,
  gmailBridgeCreatorCookieName,
  gmailBridgeStateCookieName,
  gmailStateCookieName,
  gmailWatchCreatorCookieName,
  isCalendarOAuthState,
  isDriveOAuthState,
  isGmailBridgeState,
  isGmailOAuthState,
  oauthStateCookieName,
  readWatchCreatorCookie,
  verifyCalendarOAuthState,
  verifyDriveOAuthState,
  verifyGmailBridgeOAuthState,
  verifyGmailOAuthState,
  verifyOAuthState,
} from "@/lib/google-oauth";
import { calendarOwnerId, readPrimaryCalendarId, saveCalendarConnection } from "@/lib/google-calendar";
import { saveDriveConnection } from "@/lib/account-connections";
import { AGENCY_MAILBOX_ID, saveAgencyMailbox } from "@/lib/agency-mailbox";
import { saveGmailConnection } from "@/lib/onboarding";
import { creatorStartPath } from "@/lib/questionnaire";
import { resolveLogin } from "@/lib/queries";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (isDriveOAuthState(state)) {
    return finishDriveConnect(code, state);
  }
  if (isGmailBridgeState(state)) {
    return finishGmailBridge(code, state);
  }
  if (isGmailOAuthState(state)) {
    return finishGmailConnect(code, state);
  }
  if (isCalendarOAuthState(state)) {
    return finishCalendarConnect(code, state);
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

async function finishGmailBridge(code: string | null, state: string | null) {
  const jar = await cookies();
  const valid = await verifyGmailBridgeOAuthState(jar.get(gmailBridgeStateCookieName())?.value, state);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appBaseUrl()}/connect?gmail=${reason}`);
    response.cookies.set(gmailBridgeStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    response.cookies.set(gmailBridgeCreatorCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  };
  if (!valid || !code) return fail("oauth");
  const viewer = await currentViewer();
  const creatorId = await readWatchCreatorCookie(jar.get(gmailBridgeCreatorCookieName())?.value);
  const allowed = creatorId && (viewer?.role === "admin" || (viewer?.role === "creator" && viewer.creatorId === creatorId));
  if (!allowed || !creatorId) return fail("creator_only");
  const mailbox = await exchangeGmailCode(code);
  if (!mailbox) return fail("no_refresh");
  const db = await getDb();
  const saved = await saveGmailConnection(db, creatorId, mailbox);
  if (!saved.ok) return fail(saved.status === 503 ? "not_configured" : "oauth");
  if (gmailSyncEnabled()) {
    try {
      await renewGmailWatches(db, ({ refreshToken }) => renewMailboxWatch(refreshToken));
    } catch {
      // The token is saved. A missing topic can be fixed before the daily job.
    }
  }
  const response = NextResponse.redirect(`${appBaseUrl()}/inbox?connected=1`);
  response.cookies.set(gmailBridgeStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(gmailBridgeCreatorCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

async function finishGmailConnect(code: string | null, state: string | null) {
  const jar = await cookies();
  const valid = await verifyGmailOAuthState(jar.get(gmailStateCookieName())?.value, state);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appBaseUrl()}/connect?gmail=${reason}`);
    response.cookies.set(gmailStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    response.cookies.set(gmailWatchCreatorCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  };
  if (!valid || !code) return fail("oauth");
  const viewer = await currentViewer();
  const watchCreatorId = await readWatchCreatorCookie(jar.get(gmailWatchCreatorCookieName())?.value);
  const mailbox = await exchangeGmailCode(code);
  if (!mailbox) return fail("no_refresh");
  const db = await getDb();
  if (watchCreatorId) {
    const allowed = viewer?.role === "admin" || (viewer?.role === "creator" && viewer.creatorId === watchCreatorId);
    if (!allowed) return fail("creator_only");
    const mapped = mailboxForCreator(watchCreatorId);
    if (!mapped || normalizeEmail(mailbox.gmailEmail) !== mapped.email) return fail("wrong_mailbox");
    const saved = mapped.creatorId === AGENCY_MAILBOX_ID
      ? await saveAgencyMailbox(db, mailbox)
      : await saveGmailConnection(db, mapped.creatorId, mailbox);
    if (!saved.ok) return fail(saved.status === 503 ? "not_configured" : "oauth");
    await renewGmailWatches(db, ({ refreshToken }) => renewMailboxWatch(refreshToken));
    const response = NextResponse.redirect(`${appBaseUrl()}/connect?gmail=connected`);
    response.cookies.set(gmailStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    response.cookies.set(gmailWatchCreatorCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  }
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) return fail("creator_only");
  const saved = await saveGmailConnection(db, viewer.creatorId, mailbox);
  if (!saved.ok) return fail(saved.status === 503 ? "not_configured" : "oauth");
  const response = NextResponse.redirect(`${appBaseUrl()}/onboarding?connected=1`);
  response.cookies.set(gmailStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(gmailWatchCreatorCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

async function finishDriveConnect(code: string | null, state: string | null) {
  const jar = await cookies();
  const valid = await verifyDriveOAuthState(jar.get(driveStateCookieName())?.value, state);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appBaseUrl()}/connect?drive=${reason}`);
    response.cookies.set(driveStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  };
  if (!valid || !code) return fail("oauth");
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) return fail("creator_only");
  const drive = await exchangeDriveCode(code);
  if (!drive) return fail("no_refresh");
  const db = await getDb();
  const saved = await saveDriveConnection(db, viewer.creatorId, drive.refreshToken);
  if (!saved.ok) return fail(saved.status === 503 ? "not_configured" : "oauth");
  const response = NextResponse.redirect(`${appBaseUrl()}/connect?drive=connected`);
  response.cookies.set(driveStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

async function finishCalendarConnect(code: string | null, state: string | null) {
  const jar = await cookies();
  const valid = await verifyCalendarOAuthState(jar.get(calendarStateCookieName())?.value, state);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appBaseUrl()}/calendar?calendarError=${reason}`);
    response.cookies.set(calendarStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  };
  if (!valid || !code) return fail("oauth");
  const viewer = await currentViewer();
  const ownerId = viewer ? calendarOwnerId(viewer) : null;
  if (!ownerId) return fail("own");
  const calendar = await exchangeCalendarCode(code);
  if (!calendar) return fail("refresh");
  const calendarEmail = await readPrimaryCalendarId(calendar.accessToken);
  const db = await getDb();
  const saved = await saveCalendarConnection(db, ownerId, {
    refreshToken: calendar.refreshToken,
    calendarEmail,
  });
  if (!saved.ok) return fail(saved.status === 503 ? "setup" : "oauth");
  const response = NextResponse.redirect(`${appBaseUrl()}/calendar?saved=1`);
  response.cookies.set(calendarStateCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
