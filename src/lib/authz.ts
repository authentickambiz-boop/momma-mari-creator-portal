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

/** Owner addresses. ADMIN_EMAILS stays the owner list. Managers are a separate
 *  role, assigned per creator, and are not added here. */
export const STAGE_APPROVER_ROLES = ["admin"] as const;

export function isOwner(viewer: Viewer) {
  return viewer.role === "admin";
}

export function isStaff(viewer: Viewer) {
  return viewer.role === "admin" || viewer.role === "manager";
}

export function canChangeDealStage(viewer: Viewer) {
  return isStaff(viewer);
}

/** Owner addresses that may approve brand email without a per-person toggle.
 *  A manager can approve only when the owner turned that toggle on. */
export const EMAIL_APPROVER_ROLES = ["admin"] as const;

export function canApproveEmail(viewer: Viewer) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return Boolean(viewer.permissions?.approveEmail);
  return false;
}

export function canApproveVideo(viewer: Viewer) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return Boolean(viewer.permissions?.approveVideo);
  return false;
}

export function canApproveContract(viewer: Viewer) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return Boolean(viewer.permissions?.approveContract);
  return false;
}

export function canCountersign(viewer: Viewer) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return Boolean(viewer.permissions?.countersign);
  return false;
}

export function canSeeDeal(viewer: Viewer, deal: { creatorId: string; visibleToCreator: boolean }) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return (viewer.assignedCreatorIds ?? []).includes(deal.creatorId);
  return viewer.creatorId === deal.creatorId && deal.visibleToCreator;
}

export function resolveViewedCreator(viewer: Viewer, requested: string | null, creatorIds: string[]) {
  if (viewer.role === "creator") return viewer.creatorId ?? "";
  const allowed = viewer.role === "manager"
    ? creatorIds.filter((id) => (viewer.assignedCreatorIds ?? []).includes(id))
    : creatorIds;
  if (viewer.role === "manager") {
    if (requested === "all" || !requested) return "all" as const;
    if (allowed.includes(requested)) return requested;
    return allowed[0] ?? ("all" as const);
  }
  if (requested === "all") return "all" as const;
  if (requested && creatorIds.includes(requested)) return requested;
  if (creatorIds.includes("mariclare")) return "mariclare";
  return creatorIds[0] ?? "all";
}

export function dealPowers(viewer: Viewer) {
  return {
    canChangeStage: canChangeDealStage(viewer),
    canApproveVideo: canApproveVideo(viewer),
    canReviewContract: canApproveContract(viewer),
    canCountersign: canCountersign(viewer),
    isOwner: viewer.role === "admin",
    canSign: viewer.role === "creator",
  };
}

export function devLoginEnabled() {
  return process.env.AUTH_DEV_LOGIN === "true";
}
