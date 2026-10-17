import { eq } from "drizzle-orm";
import { sessions } from "@/db/schema";
import type { PortalDb } from "@/db";
import { getKv } from "@/db";
import type { Viewer } from "./types";
import { nowIso } from "./format";

const COOKIE = "mm_session";
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_SECONDS = 14 * 24 * 60 * 60;

export function sessionCookieName() {
  return COOKIE;
}

function randomHex(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a random string of at least 16 characters.");
  }
  const fs = await import("node:fs");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "data", ".session-secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const generated = randomHex(32);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(signature);
}

export async function signSessionId(id: string) {
  const signature = await hmac(await sessionSecret(), id);
  return `${id}.${signature}`;
}

export async function readSignedSessionId(raw: string | undefined | null) {
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const id = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = await hmac(await sessionSecret(), id);
  if (signature.length !== expected.length) return null;
  let diff = 0;
  for (let index = 0; index < signature.length; index += 1) {
    diff |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0 ? id : null;
}

type SessionRecord = {
  id: string;
  email: string;
  creatorId: string | null;
  role: string;
  createdAt: string;
  expiresAt: string;
};

async function writeKv(record: SessionRecord) {
  const kv = await getKv();
  if (!kv) return;
  await kv.put(`session:${record.id}`, JSON.stringify(record), { expirationTtl: FOURTEEN_DAYS_SECONDS });
}

async function deleteKv(id: string) {
  const kv = await getKv();
  if (!kv) return;
  await kv.delete(`session:${id}`);
}

export async function createSession(db: PortalDb, viewer: Viewer) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString();
  const record: SessionRecord = {
    id,
    email: viewer.email,
    creatorId: viewer.creatorId,
    role: viewer.role,
    createdAt,
    expiresAt,
  };
  await db.insert(sessions).values(record);
  await writeKv(record);
  return { id, cookieValue: await signSessionId(id), expiresAt };
}

export async function readSession(db: PortalDb, rawCookie: string | undefined | null): Promise<SessionRecord | null> {
  const id = await readSignedSessionId(rawCookie);
  if (!id) return null;
  const kv = await getKv();
  if (kv) {
    const cached = await kv.get(`session:${id}`);
    if (cached) {
      const record = JSON.parse(cached) as SessionRecord;
      if (record.expiresAt > nowIso()) return record;
      await kv.delete(`session:${id}`);
    }
  }
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  const record = rows[0];
  if (!record) return null;
  if (record.expiresAt <= nowIso()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  await writeKv(record);
  return record;
}

export async function destroySession(db: PortalDb, rawCookie: string | undefined | null) {
  const id = await readSignedSessionId(rawCookie);
  if (!id) return;
  await db.delete(sessions).where(eq(sessions.id, id));
  await deleteKv(id);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: FOURTEEN_DAYS_SECONDS,
  };
}
