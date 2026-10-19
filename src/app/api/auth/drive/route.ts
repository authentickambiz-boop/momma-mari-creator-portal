import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import {
  createDriveOAuthState,
  driveStateCookieName,
  googleConfigured,
  googleDriveAuthUrl,
} from "@/lib/google-oauth";
import { sessionCookieOptions } from "@/lib/session";
import { tokenEncryptionConfigured } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

/** Start Drive consent for the signed-in creator. This does not replace the portal session. */
export async function GET() {
  const viewer = await currentViewer();
  if (!viewer) return NextResponse.redirect(`${appBaseUrl()}/login`);
  if (viewer.role !== "creator" || !viewer.creatorId) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?drive=creator_only`);
  }
  if (!googleConfigured() || !tokenEncryptionConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?drive=not_configured`);
  }
  const state = await createDriveOAuthState();
  const response = NextResponse.redirect(googleDriveAuthUrl(state, viewer.email));
  response.cookies.set(driveStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
