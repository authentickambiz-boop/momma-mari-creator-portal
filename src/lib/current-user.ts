import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { adminDisplayName, resolveViewedCreator } from "./authz";
import { assignedCreatorIds, findManagerByEmail } from "./managers";
import { findCreatorById, listCreators } from "./queries";
import { profileIntakeMissing } from "./profile-intake";
import { readSession, sessionCookieName } from "./session";
import type { CreatorProfile, Viewer } from "./types";

/** Managers see connection status only. Links, tokens, and passwords stay with the owner. */
export function hideAccountCredentials(creator: CreatorProfile): CreatorProfile {
  const blank = (status: string) => ({ status, connectUrl: null });
  return {
    ...creator,
    accounts: {
      tiktok: blank(creator.accounts.tiktok.status),
      instagram: blank(creator.accounts.instagram.status),
      facebook: blank(creator.accounts.facebook.status),
      youtube: blank(creator.accounts.youtube.status),
      email: blank(creator.accounts.email.status),
    },
  };
}

export async function currentViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const db = await getDb();
  const session = await readSession(db, jar.get(sessionCookieName())?.value);
  if (!session) return null;
  if (session.role === "admin") {
    return { email: session.email, role: "admin", creatorId: null, name: adminDisplayName(), initials: "K" };
  }
  if (session.role === "manager") {
    const manager = await findManagerByEmail(db, session.email);
    if (!manager || !manager.active) return null;
    return {
      email: manager.email,
      role: "manager",
      creatorId: null,
      name: manager.name,
      initials: manager.name.slice(0, 1).toUpperCase(),
      managerId: manager.id,
      permissions: manager.permissions,
      assignedCreatorIds: await assignedCreatorIds(db, manager.id),
    };
  }
  if (!session.creatorId) return null;
  const creator = await findCreatorById(db, session.creatorId);
  if (!creator) return null;
  return {
    email: creator.email,
    role: "creator",
    creatorId: creator.id,
    name: creator.name,
    initials: creator.initials,
  };
}

export async function requireViewer() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function loadPortal(requested: string | null, options?: { allowIncompleteProfile?: boolean }) {
  const viewer = await requireViewer();
  const db = await getDb();
  if (!options?.allowIncompleteProfile && viewer.role === "creator" && viewer.creatorId) {
    if (await profileIntakeMissing(db, viewer.creatorId)) redirect("/profile/intake");
  }
  const everyone = await listCreators(db);
  const assigned = viewer.role === "manager"
    ? everyone.filter((creator) => (viewer.assignedCreatorIds ?? []).includes(creator.id))
    : everyone;
  const creators = viewer.role === "manager" ? assigned.map(hideAccountCredentials) : assigned;
  const viewedId = resolveViewedCreator(
    viewer,
    requested,
    creators.map((creator) => creator.id),
  );
  const viewed = viewedId === "all" ? null : (creators.find((creator) => creator.id === viewedId) ?? null);
  return { db, viewer, creators, viewedId, viewed };
}
