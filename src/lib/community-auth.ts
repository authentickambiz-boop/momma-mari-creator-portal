import { cookies } from "next/headers";
import { getDb } from "@/db/getDb";
import type { CommunityActor } from "./community";
import { readSession, sessionCookieName } from "./session";

export async function communityActor(): Promise<CommunityActor | null> {
  const jar = await cookies();
  const db = await getDb();
  const session = await readSession(db, jar.get(sessionCookieName())?.value);
  if (!session) return null;
  return {
    email: session.email,
    name: session.email,
    role: session.role,
    creatorId: session.creatorId,
  };
}
