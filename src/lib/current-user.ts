import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { adminDisplayName } from "./authz";
import { findCreatorById, listCreators } from "./queries";
import { resolveViewedCreator } from "./authz";
import { readSession, sessionCookieName } from "./session";
import type { Viewer } from "./types";

export async function currentViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const db = await getDb();
  const session = await readSession(db, jar.get(sessionCookieName())?.value);
  if (!session) return null;
  if (session.role === "admin") {
    return { email: session.email, role: "admin", creatorId: null, name: adminDisplayName(), initials: "K" };
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

export async function loadPortal(requested: string | null) {
  const viewer = await requireViewer();
  const db = await getDb();
  const creators = await listCreators(db);
  const viewedId = resolveViewedCreator(
    viewer,
    requested,
    creators.map((creator) => creator.id),
  );
  const viewed = viewedId === "all" ? null : (creators.find((creator) => creator.id === viewedId) ?? null);
  return { db, viewer, creators, viewedId, viewed };
}
