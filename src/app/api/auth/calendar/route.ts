import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { creatorBlockedFromConnections } from "@/lib/account-tier";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import { calendarOwnerId } from "@/lib/google-calendar";
import {
  calendarStateCookieName,
  createCalendarOAuthState,
  googleCalendarAuthUrl,
  googleConfigured,
} from "@/lib/google-oauth";
import { sessionCookieOptions } from "@/lib/session";
import { tokenEncryptionConfigured } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

/** Start read-only Calendar consent for the signed-in user. This does not replace the portal session. */
export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.redirect(`${appBaseUrl()}/login`);
  if (await creatorBlockedFromConnections(await getDb(), viewer)) {
    return NextResponse.redirect(`${appBaseUrl()}/pricing?locked=connect`);
  }
  if (!calendarOwnerId(viewer)) {
    return NextResponse.redirect(`${appBaseUrl()}/calendar?calendarError=own`);
  }
  if (!googleConfigured() || !tokenEncryptionConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/calendar?calendarError=setup`);
  }
  const state = await createCalendarOAuthState();
  const response = NextResponse.redirect(googleCalendarAuthUrl(state, viewer.email));
  response.cookies.set(calendarStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
