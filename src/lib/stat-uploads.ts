import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorStatUploads } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import { nowIso } from "./format";
import { onboardingPlatformId } from "./onboarding-fields";
import { refreshFreeFinish } from "./free-onboarding";
import type { Viewer } from "./types";

export const STAT_UPLOAD_MAX_BYTES = 1_500_000;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveStatUpload(
  db: PortalDb,
  viewer: Viewer,
  input: { platform: string; fileName: string; contentType: string; bytes: Uint8Array },
) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  if (!(await creatorIsFree(db, viewer.creatorId))) return { ok: false as const, error: "tier" as const };
  const platform = onboardingPlatformId(input.platform);
  if (!platform) return { ok: false as const, error: "file" as const };
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED.has(contentType) || input.bytes.byteLength < 1 || input.bytes.byteLength > STAT_UPLOAD_MAX_BYTES) {
    return { ok: false as const, error: "file" as const };
  }
  const id = crypto.randomUUID();
  await db.insert(creatorStatUploads).values({
    id,
    creatorId: viewer.creatorId,
    platform,
    fileName: input.fileName.trim().slice(0, 160) || "upload",
    contentType,
    byteSize: input.bytes.byteLength,
    bodyBase64: bytesToBase64(input.bytes),
    createdAt: nowIso(),
  });
  await refreshFreeFinish(db, viewer.creatorId);
  return { ok: true as const, id };
}

/** The uploading creator, or the owner. Other accounts get nothing, including the file bytes. */
export async function readStatUpload(db: PortalDb, viewer: Viewer, id: string) {
  const rows = await db.select().from(creatorStatUploads).where(eq(creatorStatUploads.id, id));
  const row = rows[0];
  if (!row) return null;
  const allowed = viewer.role === "admin" || (viewer.role === "creator" && viewer.creatorId === row.creatorId);
  if (!allowed) return null;
  return row;
}

export async function statUploadMeta(db: PortalDb, creatorId: string) {
  const rows = await db.select({
    id: creatorStatUploads.id,
    platform: creatorStatUploads.platform,
    fileName: creatorStatUploads.fileName,
    contentType: creatorStatUploads.contentType,
    byteSize: creatorStatUploads.byteSize,
    createdAt: creatorStatUploads.createdAt,
  }).from(creatorStatUploads).where(eq(creatorStatUploads.creatorId, creatorId));
  return rows;
}
