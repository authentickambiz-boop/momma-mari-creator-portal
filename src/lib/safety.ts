import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, deals, draftSafetyFlags, drafts } from "@/db/schema";
import { nowIso } from "./format";
import { assignedCreatorIds, findManagerByEmail } from "./managers";
import { findSafetyKinds, isSafetyKind, type SafetyKind } from "./safety-shared";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type SafetyHold = {
  draftId: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  version: number;
  kinds: SafetyKind[];
};

export async function recordDraftSafety(
  db: PortalDb,
  input: {
    draftId: string;
    dealId: string;
    filename?: string | null;
    caption?: string | null;
    locationTag?: string | null;
  },
): Promise<{ kinds: SafetyKind[] }> {
  const kinds = findSafetyKinds(input);
  if (kinds.length === 0) return { kinds };
  const existing = await db.select().from(draftSafetyFlags).where(eq(draftSafetyFlags.draftId, input.draftId));
  const have = new Set(existing.map((row) => row.kind));
  const timestamp = nowIso();
  for (const kind of kinds) {
    if (have.has(kind)) continue;
    await db.insert(draftSafetyFlags).values({
      id: crypto.randomUUID(),
      draftId: input.draftId,
      dealId: input.dealId,
      kind,
      held: true,
      clearedBy: null,
      clearedAt: null,
      createdAt: timestamp,
    });
  }
  return { kinds };
}

export async function heldSafetyKinds(db: PortalDb, draftId: string): Promise<SafetyKind[]> {
  const rows = await db
    .select()
    .from(draftSafetyFlags)
    .where(and(eq(draftSafetyFlags.draftId, draftId), eq(draftSafetyFlags.held, true)));
  return rows.flatMap((row) => (isSafetyKind(row.kind) ? [row.kind] : []));
}

export async function safetyForDeal(db: PortalDb, dealId: string) {
  const rows = await db.select().from(draftSafetyFlags).where(eq(draftSafetyFlags.dealId, dealId));
  const byDraft = new Map<string, { kind: SafetyKind; held: boolean }[]>();
  for (const row of rows) {
    if (!isSafetyKind(row.kind)) continue;
    const list = byDraft.get(row.draftId) ?? [];
    list.push({ kind: row.kind, held: row.held });
    byDraft.set(row.draftId, list);
  }
  return byDraft;
}

export async function clearSafetyHold(
  db: PortalDb,
  input: { draftId: string; actorEmail: string; actorRole: string },
): Promise<Result<{ cleared: number }>> {
  if (input.actorRole === "creator") {
    return { ok: false, status: 403, error: "You can't clear a safety hold." };
  }
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only Kamron can clear a safety hold." };
  }
  const rows = await db
    .select()
    .from(draftSafetyFlags)
    .where(and(eq(draftSafetyFlags.draftId, input.draftId), eq(draftSafetyFlags.held, true)));
  if (rows.length === 0) return { ok: true, cleared: 0 };
  const timestamp = nowIso();
  await db
    .update(draftSafetyFlags)
    .set({ held: false, clearedBy: input.actorEmail, clearedAt: timestamp })
    .where(and(eq(draftSafetyFlags.draftId, input.draftId), eq(draftSafetyFlags.held, true)));
  return { ok: true, cleared: rows.length };
}

export async function listSafetyHolds(
  db: PortalDb,
  viewer: { role: string; email: string },
): Promise<Result<{ holds: SafetyHold[] }>> {
  if (viewer.role === "creator") {
    return { ok: false, status: 403, error: "Safety holds are for the team." };
  }
  if (viewer.role !== "admin" && viewer.role !== "manager") {
    return { ok: false, status: 403, error: "Safety holds are for the team." };
  }
  const flags = await db.select().from(draftSafetyFlags).where(eq(draftSafetyFlags.held, true));
  const [dealRows, creatorRows, draftRows] = await Promise.all([
    db.select({ id: deals.id, brand: deals.brand, creatorId: deals.creatorId }).from(deals),
    db.select({ id: creators.id, name: creators.name }).from(creators),
    db.select({ id: drafts.id, version: drafts.version }).from(drafts),
  ]);
  let allowedCreators: Set<string> | null = null;
  if (viewer.role === "manager") {
    const manager = await findManagerByEmail(db, viewer.email);
    if (!manager || !manager.active) return { ok: true, holds: [] };
    allowedCreators = new Set(await assignedCreatorIds(db, manager.id));
  }
  const dealById = new Map(dealRows.map((row) => [row.id, row]));
  const nameById = new Map(creatorRows.map((row) => [row.id, row.name]));
  const versionById = new Map(draftRows.map((row) => [row.id, row.version]));
  const grouped = new Map<string, SafetyHold>();
  for (const flag of flags) {
    if (!isSafetyKind(flag.kind)) continue;
    const deal = dealById.get(flag.dealId);
    if (!deal) continue;
    if (allowedCreators && !allowedCreators.has(deal.creatorId)) continue;
    const current = grouped.get(flag.draftId) ?? {
      draftId: flag.draftId,
      dealId: flag.dealId,
      brand: deal.brand,
      creatorId: deal.creatorId,
      creatorName: nameById.get(deal.creatorId) ?? "Creator",
      version: versionById.get(flag.draftId) ?? 1,
      kinds: [],
    };
    if (!current.kinds.includes(flag.kind)) current.kinds.push(flag.kind);
    grouped.set(flag.draftId, current);
  }
  return { ok: true, holds: [...grouped.values()] };
}
