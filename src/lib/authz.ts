import type { Viewer } from "./types";
import { normalizeEmail } from "./format";

export function adminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? "Kamron@mommamari.com";
  return raw
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function adminDisplayName() {
  return process.env.ADMIN_DISPLAY_NAME?.trim() || "Kamron";
}

export function canSeeDeal(viewer: Viewer, deal: { creatorId: string; visibleToCreator: boolean }) {
  if (viewer.role === "admin") return true;
  return viewer.creatorId === deal.creatorId && deal.visibleToCreator;
}

export function resolveViewedCreator(viewer: Viewer, requested: string | null, creatorIds: string[]) {
  if (viewer.role !== "admin") return viewer.creatorId ?? "";
  if (requested === "all") return "all" as const;
  if (requested && creatorIds.includes(requested)) return requested;
  if (creatorIds.includes("mariclare")) return "mariclare";
  return creatorIds[0] ?? "all";
}

export function devLoginEnabled() {
  return process.env.AUTH_DEV_LOGIN === "true";
}
