import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators } from "@/db/schema";
import type { Viewer } from "./types";

export async function creatorIsSigned(db: PortalDb, creatorId: string) {
  const rows = await db.select({ contracted: creators.contracted }).from(creators).where(eq(creators.id, creatorId));
  return Boolean(rows[0]?.contracted);
}

export async function listCreatorSigning(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const rows = await db.select({
    id: creators.id,
    name: creators.name,
    signed: creators.contracted,
  }).from(creators).orderBy(asc(creators.name));
  return rows.map((row) => ({ id: row.id, name: row.name, signed: Boolean(row.signed) }));
}

export async function setCreatorSigned(db: PortalDb, viewer: Viewer, creatorId: string, signed: boolean) {
  if (viewer.role !== "admin") return { ok: false as const, code: "refused" as const };
  const id = creatorId.trim();
  const rows = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, id));
  if (!rows[0]) return { ok: false as const, code: "missing" as const };
  await db.update(creators).set({ contracted: signed }).where(eq(creators.id, id));
  return { ok: true as const };
}

export function signedCreatorNote(code: string | undefined) {
  if (code === "refused") return "Only the owner can mark a creator as signed. Nothing was changed.";
  if (code === "missing") return "That creator is not on the roster. Nothing was changed.";
  return null;
}
