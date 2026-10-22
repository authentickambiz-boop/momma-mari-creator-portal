import { appBaseUrl } from "./format";

const STATE_COOKIE = "mm_oauth_state";

export function oauthStateCookieName() {
  return STATE_COOKIE;
}

export function googleRedirectUri() {
  return `${appBaseUrl()}/api/auth/callback`;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is required for Google sign-in.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64Url(bytes);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${nonce}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyOAuthState(cookie: string | undefined, returned: string | null) {
  if (!cookie || !returned || cookie !== returned) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await sign(payload);
  if (expected !== parts[2]) return false;
  return Number(parts[1]) > Date.now();
}

export function googleAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

const GMAIL_STATE_COOKIE = "mm_gmail_state";

/** Gmail connect is a second consent, not sign-in. Read and draft only. */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;

export function gmailStateCookieName() {
  return GMAIL_STATE_COOKIE;
}

export function isGmailOAuthState(state: string | null) {
  return Boolean(state?.startsWith("gmail."));
}

export async function createGmailOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64Url(bytes);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `gmail.${nonce}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyGmailOAuthState(cookie: string | undefined, returned: string | null) {
  if (!cookie || !returned || cookie !== returned || !cookie.startsWith("gmail.")) return false;
  const parts = cookie.split(".");
  if (parts.length !== 4) return false;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = await sign(payload);
  if (expected !== parts[3]) return false;
  return Number(parts[2]) > Date.now();
}

/** Per-creator bridge stays read-only. It does not label or draft. */
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/**
 * The three watched inboxes need this scope so the portal can add MM/ labels and create drafts.
 * gmail.modify can also send. The portal never calls send, trash, or delete.
 * Do not request gmail.send or https://mail.google.com/.
 */
export const GMAIL_WATCH_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export function googleGmailWatchAuthUrl(state: string, loginHint: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_WATCH_SCOPE);
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  return url.toString();
}

const WATCH_CREATOR_COOKIE = "mm_gmail_watch";

export function gmailWatchCreatorCookieName() {
  return WATCH_CREATOR_COOKIE;
}

export async function createWatchCreatorCookie(creatorId: string) {
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${creatorId}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function readWatchCreatorCookie(value: string | undefined) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  if ((await sign(payload)) !== parts[2]) return null;
  if (Number(parts[1]) <= Date.now()) return null;
  return parts[0];
}

const BRIDGE_STATE_COOKIE = "mm_gmail_bridge";
const BRIDGE_CREATOR_COOKIE = "mm_gmail_bridge_creator";

/** Brand-inbox connect is read-only. It does not ask for compose, send, or full mail access. */
export function gmailBridgeStateCookieName() {
  return BRIDGE_STATE_COOKIE;
}

export function gmailBridgeCreatorCookieName() {
  return BRIDGE_CREATOR_COOKIE;
}

export function isGmailBridgeState(state: string | null) {
  return Boolean(state?.startsWith("gbridge."));
}

export async function createGmailBridgeOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64Url(bytes);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `gbridge.${nonce}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyGmailBridgeOAuthState(cookie: string | undefined, returned: string | null) {
  if (!cookie || !returned || cookie !== returned || !cookie.startsWith("gbridge.")) return false;
  const parts = cookie.split(".");
  if (parts.length !== 4) return false;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = await sign(payload);
  if (expected !== parts[3]) return false;
  return Number(parts[2]) > Date.now();
}

export function googleGmailBridgeAuthUrl(state: string, loginHint: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_READONLY_SCOPE);
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  return url.toString();
}

export function googleGmailAuthUrl(state: string, loginHint: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGmailCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!response.ok || !json.access_token || !json.refresh_token) return null;
  const profile = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const mailbox = (await profile.json()) as { emailAddress?: string };
  if (!profile.ok || !mailbox.emailAddress) return null;
  return { refreshToken: json.refresh_token, gmailEmail: mailbox.emailAddress };
}

/** Per-creator Drive consent. drive.file only, so this cannot widen into Gmail send. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const DRIVE_STATE_COOKIE = "mm_drive_state";

export function driveStateCookieName() {
  return DRIVE_STATE_COOKIE;
}

export function isDriveOAuthState(state: string | null) {
  return Boolean(state?.startsWith("drive."));
}

export async function createDriveOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64Url(bytes);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `drive.${nonce}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyDriveOAuthState(cookie: string | undefined, returned: string | null) {
  if (!cookie || !returned || cookie !== returned || !cookie.startsWith("drive.")) return false;
  const parts = cookie.split(".");
  if (parts.length !== 4) return false;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = await sign(payload);
  if (expected !== parts[3]) return false;
  return Number(parts[2]) > Date.now();
}

export function googleDriveAuthUrl(state: string, loginHint: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_FILE_SCOPE);
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Read-only calendar. This does not include Gmail, Drive, or a write scope. */
export const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const CALENDAR_STATE_COOKIE = "mm_calendar_state";

export function calendarStateCookieName() {
  return CALENDAR_STATE_COOKIE;
}

export function isCalendarOAuthState(state: string | null) {
  return Boolean(state?.startsWith("gcal."));
}

export async function createCalendarOAuthState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = bytesToBase64Url(bytes);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `gcal.${nonce}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyCalendarOAuthState(cookie: string | undefined, returned: string | null) {
  if (!cookie || !returned || cookie !== returned || !cookie.startsWith("gcal.")) return false;
  const parts = cookie.split(".");
  if (parts.length !== 4) return false;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = await sign(payload);
  if (expected !== parts[3]) return false;
  return Number(parts[2]) > Date.now();
}

export function googleCalendarAuthUrl(state: string, loginHint: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_READONLY_SCOPE);
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", loginHint);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCalendarCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!response.ok || !json.access_token || !json.refresh_token) return null;
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

export async function exchangeDriveCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await response.json()) as { refresh_token?: string };
  if (!response.ok || !json.refresh_token) return null;
  return { refreshToken: json.refresh_token };
}

/** Best-effort Google revoke. Failure still lets the caller clear the saved token. */
export async function revokeGoogleToken(token: string) {
  if (!token) return false;
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type GoogleTokenRevoker = (token: string) => Promise<boolean>;

export async function exchangeCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await response.json()) as { access_token?: string };
  if (!response.ok || !json.access_token) return null;
  const profile = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const user = (await profile.json()) as { email?: string; email_verified?: boolean };
  if (!profile.ok || !user.email || user.email_verified === false) return null;
  return user.email;
}
