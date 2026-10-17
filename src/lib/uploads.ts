import type { Viewer } from "./types";
import { canSeeDeal } from "./authz";

export const CHUNK_MULTIPLE = 256 * 1024;
const MAX_CHUNK = 32 * 1024 * 1024;

export function maxUploadBytes() {
  const raw = Number(process.env.MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024 * 1024);
  return Number.isFinite(raw) && raw > 0 ? raw : 8 * 1024 * 1024 * 1024;
}

export function chunkSizeBytes() {
  const fallback = 8 * 1024 * 1024;
  const raw = Number(process.env.UPLOAD_CHUNK_BYTES ?? fallback);
  if (!Number.isFinite(raw) || raw <= 0 || raw % CHUNK_MULTIPLE !== 0 || raw > MAX_CHUNK) return fallback;
  return raw;
}

export function safeFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "draft.mp4";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim().slice(0, 120);
  return cleaned || "draft.mp4";
}

export function allowedVideoType(mimeType: string) {
  if (!mimeType || mimeType === "application/octet-stream") return true;
  return mimeType.startsWith("video/");
}

export function parseContentRange(header: string | null) {
  if (!header) return null;
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header.trim());
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) };
}

export function validateChunk(input: {
  start: number;
  end: number;
  total: number;
  bytesReceived: number;
  sizeBytes: number;
  bodyLength: number;
}) {
  if (input.total !== input.sizeBytes) {
    return { ok: false as const, error: "Upload size does not match the file you started." };
  }
  if (input.start !== input.bytesReceived) {
    return {
      ok: false as const,
      error: "This chunk is out of order. Send the next missing byte.",
      expectedStart: input.bytesReceived,
    };
  }
  if (input.end < input.start || input.end >= input.total) {
    return { ok: false as const, error: "That byte range is outside the file." };
  }
  const length = input.end - input.start + 1;
  if (length !== input.bodyLength) {
    return { ok: false as const, error: "Chunk length does not match Content-Range." };
  }
  if (length > MAX_CHUNK) return { ok: false as const, error: "Chunk is larger than 32 MB." };
  const complete = input.end === input.total - 1;
  if (!complete && length % CHUNK_MULTIPLE !== 0) {
    return { ok: false as const, error: "Each chunk except the last must be a multiple of 256 KB." };
  }
  return { ok: true as const, complete };
}

export function assertCanUpload(
  viewer: Viewer,
  deal: { creatorId: string; visibleToCreator: boolean; uploadEnabled: boolean },
) {
  if (!canSeeDeal(viewer, deal)) {
    return { ok: false as const, status: 404, error: "That deal isn't on your list." };
  }
  if (!deal.uploadEnabled) {
    return { ok: false as const, status: 403, error: "This deal isn't ready for a draft." };
  }
  return { ok: true as const };
}
