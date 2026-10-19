import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/format";
import { currentViewer } from "@/lib/current-user";
import { mailboxForCreator } from "@/lib/gmail-push";
import {
  createGmailOAuthState,
  createWatchCreatorCookie,
  gmailStateCookieName,
  gmailWatchCreatorCookieName,
  googleConfigured,
  googleGmailWatchAuthUrl,
} from "@/lib/google-oauth";
import { sessionCookieOptions } from "@/lib/session";
import { tokenEncryptionConfigured } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") return NextResponse.redirect(`${appBaseUrl()}/login`);
  const creatorId = new URL(request.url).searchParams.get("creator") ?? "";
  const mailbox = mailboxForCreator(creatorId);
  if (!mailbox) return NextResponse.redirect(`${appBaseUrl()}/connect?gmail=oauth`);
  if (!googleConfigured() || !tokenEncryptionConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/connect?gmail=not_configured`);
  }
  const state = await createGmailOAuthState();
  const response = NextResponse.redirect(googleGmailWatchAuthUrl(state, mailbox.email));
  response.cookies.set(gmailStateCookieName(), state, { ...sessionCookieOptions(), maxAge: 600 });
  response.cookies.set(gmailWatchCreatorCookieName(), await createWatchCreatorCookie(mailbox.creatorId), { ...sessionCookieOptions(), maxAge: 600 });
  return response;
}
