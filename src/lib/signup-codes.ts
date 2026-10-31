import { and, eq, gte, isNull } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorAccounts, creators, portalSettings, signupInviteCodes, signupRateEvents, signupReferrals } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";
import { sessionCookieOptions } from "./session";
import type { Viewer } from "./types";

export const FREE_SIGNUP_COOKIE = "mm_free_signup";
export const SIGNUP_GRANT_COOKIE = "mm_signup_grant";
export const CODE_REQUIRED_KEY = "free_signup_requires_code";

/** New codes start here. The owner can raise or lower each code. */
export const DEFAULT_INVITE_CODE_CAP = 25;

export const CODE_CHECK_LIMIT = 10;
export const CODE_CHECK_WINDOW_MS = 15 * 60 * 1000;
export const SIGNUP_LIMIT = 5;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAID_PLANS = new Set(["pro", "business"]);
const LIVE_STATUS = new Set(["active", "trialing"]);

export type SignupCodeError = "rate" | "missing" | "invalid" | "disabled" | "used" | "try" | "email" | "expired";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is required for sign-up.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function signupCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 600 };
}

/** Missing row means codes are required. The owner turns this off later. */
export async function signupCodeRequired(db: PortalDb) {
  const rows = await db.select().from(portalSettings).where(eq(portalSettings.key, CODE_REQUIRED_KEY));
  if (!rows[0]) return true;
  return rows[0].value !== "false";
}

export async function setSignupCodeRequired(db: PortalDb, viewer: Viewer, required: boolean) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can change sign-up." };
  const timestamp = nowIso();
  const existing = await db.select().from(portalSettings).where(eq(portalSettings.key, CODE_REQUIRED_KEY));
  const value = required ? "true" : "false";
  if (existing[0]) {
    await db.update(portalSettings).set({ value, updatedAt: timestamp }).where(eq(portalSettings.key, CODE_REQUIRED_KEY));
  } else {
    await db.insert(portalSettings).values({ key: CODE_REQUIRED_KEY, value, updatedAt: timestamp });
  }
  return { ok: true as const, required };
}

async function rateLimited(db: PortalDb, kind: "code_check" | "signup", ip: string, limit: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = await db.select({ id: signupRateEvents.id }).from(signupRateEvents).where(and(
    eq(signupRateEvents.kind, kind),
    eq(signupRateEvents.ip, ip || "unknown"),
    gte(signupRateEvents.createdAt, since),
  ));
  return rows.length >= limit;
}

async function recordRate(db: PortalDb, kind: "code_check" | "signup", ip: string) {
  await db.insert(signupRateEvents).values({
    id: crypto.randomUUID(),
    kind,
    ip: ip || "unknown",
    createdAt: nowIso(),
  });
}

export async function creatorCanShareCode(db: PortalDb, creatorId: string) {
  const person = await db.select({ contracted: creators.contracted }).from(creators).where(eq(creators.id, creatorId));
  if (person[0]?.contracted) return true;
  const accounts = await db.select({
    plan: creatorAccounts.subscriptionPlan,
    status: creatorAccounts.subscriptionStatus,
  }).from(creatorAccounts).where(eq(creatorAccounts.creatorId, creatorId));
  const account = accounts[0];
  return Boolean(account?.plan && PAID_PLANS.has(account.plan) && account.status && LIVE_STATUS.has(account.status));
}

function randomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export async function ensureInviteCode(db: PortalDb, creatorId: string) {
  if (!(await creatorCanShareCode(db, creatorId))) return null;
  const existing = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.ownerCreatorId, creatorId));
  if (existing[0]) return existing[0];
  const timestamp = nowIso();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    const id = crypto.randomUUID();
    try {
      await db.insert(signupInviteCodes).values({
        id,
        code,
        ownerCreatorId: creatorId,
        usageCap: DEFAULT_INVITE_CODE_CAP,
        useCount: 0,
        disabledAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const saved = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.id, id));
      return saved[0] ?? null;
    } catch {
      const again = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.ownerCreatorId, creatorId));
      if (again[0]) return again[0];
    }
  }
  return null;
}

export async function ensureEligibleInviteCodes(db: PortalDb) {
  const people = await db.select({ id: creators.id }).from(creators);
  const codes = [];
  for (const person of people) {
    const code = await ensureInviteCode(db, person.id);
    if (code) codes.push(code);
  }
  return codes;
}

export async function listInviteCodes(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  await ensureEligibleInviteCodes(db);
  const codes = await db.select().from(signupInviteCodes);
  const people = await db.select({ id: creators.id, name: creators.name }).from(creators);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const referrals = await db.select().from(signupReferrals);
  return codes
    .map((code) => ({
      id: code.id,
      code: code.code,
      ownerCreatorId: code.ownerCreatorId,
      ownerName: names.get(code.ownerCreatorId) ?? "Creator",
      usageCap: code.usageCap,
      useCount: code.useCount,
      disabled: Boolean(code.disabledAt),
      referred: referrals.filter((row) => row.codeId === code.id).map((row) => row.referredCreatorId),
    }))
    .sort((left, right) => left.ownerName.localeCompare(right.ownerName));
}

export async function setInviteCodeDisabled(db: PortalDb, viewer: Viewer, codeId: string, disabled: boolean) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can change a code." };
  const rows = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.id, codeId));
  if (!rows[0]) return { ok: false as const, error: "That code was not found." };
  await db.update(signupInviteCodes).set({
    disabledAt: disabled ? nowIso() : null,
    updatedAt: nowIso(),
  }).where(eq(signupInviteCodes.id, codeId));
  return { ok: true as const };
}

export async function setInviteCodeCap(db: PortalDb, viewer: Viewer, codeId: string, cap: number) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can change a code." };
  if (!Number.isInteger(cap) || cap < 1 || cap > 10000) {
    return { ok: false as const, error: "The cap has to be a whole number from 1 to 10000." };
  }
  const rows = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.id, codeId));
  if (!rows[0]) return { ok: false as const, error: "That code was not found." };
  await db.update(signupInviteCodes).set({ usageCap: cap, updatedAt: nowIso() }).where(eq(signupInviteCodes.id, codeId));
  return { ok: true as const };
}

async function findCode(db: PortalDb, raw: string) {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 6) return null;
  const rows = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.code, code));
  return rows[0] ?? null;
}

export async function checkInviteCode(db: PortalDb, raw: string, ip: string) {
  if (await rateLimited(db, "code_check", ip, CODE_CHECK_LIMIT, CODE_CHECK_WINDOW_MS)) {
    return { ok: false as const, error: "rate" as const };
  }
  await recordRate(db, "code_check", ip);
  const row = await findCode(db, raw);
  if (!row) return { ok: false as const, error: "invalid" as const };
  if (row.disabledAt) return { ok: false as const, error: "disabled" as const };
  if (row.useCount >= row.usageCap) return { ok: false as const, error: "used" as const };
  return { ok: true as const, codeId: row.id };
}

export async function signSignupGrant(codeId: string) {
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${codeId}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function readSignupGrant(token: string | undefined | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await sign(payload);
  if (expected !== parts[2]) return null;
  if (Number(parts[1]) <= Date.now()) return null;
  return parts[0];
}

export function readCookie(header: string | null | undefined, name: string) {
  if (!header) return null;
  const prefix = `${name}=`;
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function prepareFreeSignup(db: PortalDb, input: { code: string; honeypot: string; ip: string }) {
  if (await rateLimited(db, "signup", input.ip, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)) {
    return { ok: false as const, error: "rate" as const };
  }
  await recordRate(db, "signup", input.ip);
  if (input.honeypot.trim()) return { ok: false as const, error: "try" as const };
  const required = await signupCodeRequired(db);
  const code = input.code.trim();
  if (!code && !required) return { ok: true as const, grant: null };
  if (!code) return { ok: false as const, error: "missing" as const };
  const checked = await checkInviteCode(db, code, input.ip);
  if (!checked.ok) return checked;
  return { ok: true as const, grant: await signSignupGrant(checked.codeId) };
}

function displayName(email: string) {
  const local = email.split("@")[0] ?? "Creator";
  const words = local.replace(/[._-]+/g, " ").trim();
  if (!words) return "Creator";
  return words.slice(0, 80);
}

function initialsFor(name: string) {
  const letters = name.replace(/[^A-Za-z]/g, "");
  return (letters.slice(0, 2) || "CR").toUpperCase();
}

async function claimCode(db: PortalDb, codeId: string) {
  const rows = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.id, codeId));
  const row = rows[0];
  if (!row || row.disabledAt) return { ok: false as const, error: "disabled" as const };
  if (row.useCount >= row.usageCap) return { ok: false as const, error: "used" as const };
  await db.update(signupInviteCodes).set({
    useCount: row.useCount + 1,
    updatedAt: nowIso(),
  }).where(and(
    eq(signupInviteCodes.id, codeId),
    eq(signupInviteCodes.useCount, row.useCount),
    isNull(signupInviteCodes.disabledAt),
  ));
  const after = await db.select().from(signupInviteCodes).where(eq(signupInviteCodes.id, codeId));
  if (!after[0] || after[0].useCount !== row.useCount + 1) return { ok: false as const, error: "used" as const };
  return { ok: true as const, referrerCreatorId: row.ownerCreatorId };
}

export async function completeFreeSignup(db: PortalDb, rawEmail: string, grant: string | null) {
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@") || email.endsWith(".invalid") || email.startsWith("@") || email.endsWith("@")) {
    return { ok: false as const, error: "email" as const };
  }
  const required = await signupCodeRequired(db);
  const codeId = grant ? await readSignupGrant(grant) : null;
  if (required && !codeId) return { ok: false as const, error: "expired" as const };
  if (grant && !codeId) return { ok: false as const, error: "expired" as const };
  const creatorId = crypto.randomUUID();
  const timestamp = nowIso();
  const name = displayName(email);
  if (codeId) {
    const claimed = await claimCode(db, codeId);
    if (!claimed.ok) return claimed;
    await db.insert(creators).values({
      id: creatorId,
      name,
      email,
      handles: null,
      kidsAges: null,
      payoutMethod: null,
      splitPercent: null,
      monthlyGoalCents: null,
      driveFolderId: null,
      initials: initialsFor(name),
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      signerIsMinor: false,
      contracted: false,
      accountTier: "free",
      isSeed: false,
      createdAt: timestamp,
    });
    await db.insert(signupReferrals).values({
      id: crypto.randomUUID(),
      codeId,
      referrerCreatorId: claimed.referrerCreatorId,
      referredCreatorId: creatorId,
      createdAt: timestamp,
    });
  } else {
    await db.insert(creators).values({
      id: creatorId,
      name,
      email,
      handles: null,
      kidsAges: null,
      payoutMethod: null,
      splitPercent: null,
      monthlyGoalCents: null,
      driveFolderId: null,
      initials: initialsFor(name),
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      signerIsMinor: false,
      contracted: false,
      accountTier: "free",
      isSeed: false,
      createdAt: timestamp,
    });
  }
  return {
    ok: true as const,
    viewer: {
      email,
      role: "creator" as const,
      creatorId,
      name,
    },
  };
}

export function signupErrorNote(code: string | undefined) {
  if (code === "rate") return "Too many tries. Wait a few minutes and try again.";
  if (code === "missing") return "Enter the code from the person who invited you.";
  if (code === "invalid") return "That code is not valid.";
  if (code === "disabled") return "That code is turned off.";
  if (code === "used") return "That code has been used up.";
  if (code === "expired") return "That sign-up expired. Enter the code and try again.";
  if (code === "try" || code === "email") return "Sign-up didn't finish. Try again.";
  return null;
}
