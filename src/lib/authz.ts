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

/** Who may move a deal's stage. Today every admin is an approver, and admins are
 *  the addresses in ADMIN_EMAILS. Add an email there to add an approver.
 *  Later phases can narrow this (a manager for video, Kamron for contracts)
 *  without changing the stage list. */
export const STAGE_APPROVER_ROLES = ["admin"] as const;

export function canChangeDealStage(viewer: Viewer) {
  return (STAGE_APPROVER_ROLES as readonly string[]).includes(viewer.role);
}

/** Who may approve, edit, or reject an outgoing brand email. Today every admin
 *  is an approver, and admins are the addresses in ADMIN_EMAILS. Add an email
 *  there to add an approver. Later phases can add a narrower role to this list
 *  without opening the queue to creators or to the bot. */
export const EMAIL_APPROVER_ROLES = ["admin"] as const;

export function canApproveEmail(viewer: Viewer) {
  return (EMAIL_APPROVER_ROLES as readonly string[]).includes(viewer.role);
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
