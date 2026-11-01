import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { adminDisplayName, resolveViewedCreator } from "./authz";
import { assignedCreatorIds, findManagerByEmail } from "./managers";
import { findCreatorById, listCreators } from "./queries";
import { creatorIsFree } from "./account-tier";
import { profileIntakeMissing } from "./profile-intake";
import { gather } from "./parallel";
import { readSession, rememberSessionProfile, sessionProfileFresh, sessionCookieName, type SessionRecord } from "./session";
import type { CreatorProfile, Viewer } from "./types";
import { worldsReturnPath } from "./worlds/office-return";

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

function viewerFromSession(session: SessionRecord): Viewer | null {
  const profile = session.profile;
  if (!profile || !sessionProfileFresh(profile)) return null;
  if (session.role === "admin") {
    return { email: session.email, role: "admin", creatorId: null, name: profile.name, initials: profile.initials || "K" };
  }
  if (session.role === "manager" && profile.managerId && profile.permissions && profile.assignedCreatorIds) {
    return {
      email: session.email,
      role: "manager",
      creatorId: null,
      name: profile.name,
      initials: profile.initials,
      managerId: profile.managerId,
      permissions: profile.permissions,
      assignedCreatorIds: profile.assignedCreatorIds,
    };
  }
  if (session.role === "creator" && session.creatorId && profile.initials) {
    return {
      email: session.email,
      role: "creator",
      creatorId: session.creatorId,
      name: profile.name,
      initials: profile.initials,
    };
  }
  return null;
}

export const currentViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
  const raw = jar.get(sessionCookieName())?.value;
  if (!raw) return null;
  const db = await getDb();
  const session = await readSession(db, raw);
  if (!session) return null;
  const cached = viewerFromSession(session);
  if (cached) return cached;
  if (session.role === "admin") {
    const viewer = { email: session.email, role: "admin" as const, creatorId: null, name: adminDisplayName(), initials: "K" };
    await rememberSessionProfile(session, viewer);
    return viewer;
  }
  if (session.role === "manager") {
    const manager = await findManagerByEmail(db, session.email);
    if (!manager || !manager.active) return null;
    const viewer = {
      email: manager.email,
      role: "manager" as const,
      creatorId: null,
      name: manager.name,
      initials: manager.name.slice(0, 1).toUpperCase(),
      managerId: manager.id,
      permissions: manager.permissions,
      assignedCreatorIds: await assignedCreatorIds(db, manager.id),
    };
    await rememberSessionProfile(session, viewer);
    return viewer;
  }
  if (!session.creatorId) return null;
  const creator = await findCreatorById(db, session.creatorId);
  if (!creator) return null;
  const viewer = {
    email: creator.email,
    role: "creator" as const,
    creatorId: creator.id,
    name: creator.name,
    initials: creator.initials,
  };
  await rememberSessionProfile(session, viewer);
  return viewer;
});

export async function requireViewer(returnPath?: string) {
  const viewer = await currentViewer();
  if (!viewer) {
    const next = worldsReturnPath(returnPath);
    if (next) redirect(`/login?next=${next}`);
    redirect("/login");
  }
  return viewer;
}

export async function loadPortal(requested: string | null, options?: { allowIncompleteProfile?: boolean }) {
  const viewer = await requireViewer();
  const db = await getDb();
  const creatorId = viewer.role === "creator" ? viewer.creatorId : null;
  const [creatorFree, intakeMissing, everyone] = await gather([
    () => creatorId ? creatorIsFree(db, creatorId) : Promise.resolve(false),
    () => creatorId && !options?.allowIncompleteProfile ? profileIntakeMissing(db, creatorId) : Promise.resolve(false),
    () => listCreators(db),
  ]);
  if (!options?.allowIncompleteProfile && creatorId && !creatorFree && intakeMissing) redirect("/profile/intake");
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
  return { db, viewer, creators, viewedId, viewed, creatorFree };
}
