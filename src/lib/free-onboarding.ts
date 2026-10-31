import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorPlatformHandles, creatorStatUploads, freeOnboarding } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import { validateCreatorNiches } from "./creator-niches";
import { nowIso } from "./format";
import { onboardingPlatformId } from "./onboarding-fields";
import type { Viewer } from "./types";

export const FREE_ONBOARDING_STEPS = ["handles", "niche", "uploads"] as const;
export type FreeOnboardingStep = (typeof FREE_ONBOARDING_STEPS)[number];

export type HandleDraft = { platform: string; handle: string; followers: number | null; views: number | null };

function cleanHandle(value: string) {
  return value.trim().replace(/^@+/, "").replace(/\s+/g, "").slice(0, 80);
}

function wholeNumber(value: string) {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  if (!Number.isSafeInteger(number)) return undefined;
  return number;
}

export async function listHandles(db: PortalDb, creatorId: string): Promise<HandleDraft[]> {
  const rows = await db.select().from(creatorPlatformHandles).where(eq(creatorPlatformHandles.creatorId, creatorId));
  return rows.map((row) => ({
    platform: row.platform,
    handle: row.handle,
    followers: row.followers,
    views: row.views,
  }));
}

export async function freeOnboardingState(db: PortalDb, creatorId: string) {
  const [profile, handles, uploads] = await Promise.all([
    db.select().from(freeOnboarding).where(eq(freeOnboarding.creatorId, creatorId)),
    listHandles(db, creatorId),
    db.select({ id: creatorStatUploads.id }).from(creatorStatUploads).where(eq(creatorStatUploads.creatorId, creatorId)),
  ]);
  const row = profile[0];
  const niche = row?.niche ?? "";
  const hasStats = uploads.length > 0 || Boolean(row?.statNote?.trim());
  let first: FreeOnboardingStep | "done" = "done";
  if (handles.length === 0) first = "handles";
  else if (!niche) first = "niche";
  else if (!hasStats) first = "uploads";
  return {
    handles,
    niche,
    nicheOther: row?.nicheOther ?? "",
    statNote: row?.statNote ?? "",
    skipped: Boolean(row?.skippedAt),
    finished: Boolean(row?.finishedAt) || first === "done",
    firstIncomplete: first,
    uploadCount: uploads.length,
  };
}

export function activeFreeStep(saved: FreeOnboardingStep | "done", requested: string | undefined): FreeOnboardingStep {
  const first = saved === "done" ? "uploads" : saved;
  const asked = FREE_ONBOARDING_STEPS.includes(requested as FreeOnboardingStep) ? requested as FreeOnboardingStep : first;
  const savedIndex = FREE_ONBOARDING_STEPS.indexOf(first);
  const askedIndex = FREE_ONBOARDING_STEPS.indexOf(asked);
  if (saved === "done") return asked;
  return askedIndex <= savedIndex ? asked : first;
}

async function touch(db: PortalDb, creatorId: string, patch: Partial<typeof freeOnboarding.$inferInsert>, finish: boolean) {
  const timestamp = nowIso();
  const existing = await db.select().from(freeOnboarding).where(eq(freeOnboarding.creatorId, creatorId));
  const values = {
    niche: patch.niche === undefined ? existing[0]?.niche ?? null : patch.niche,
    nicheOther: patch.nicheOther === undefined ? existing[0]?.nicheOther ?? null : patch.nicheOther,
    statNote: patch.statNote === undefined ? existing[0]?.statNote ?? null : patch.statNote,
    skippedAt: patch.skippedAt === undefined ? existing[0]?.skippedAt ?? null : patch.skippedAt,
    finishedAt: finish ? timestamp : existing[0]?.finishedAt ?? null,
    updatedAt: timestamp,
  };
  if (existing[0]) await db.update(freeOnboarding).set(values).where(eq(freeOnboarding.creatorId, creatorId));
  else await db.insert(freeOnboarding).values({ creatorId, ...values });
}

export async function saveFreeHandles(
  db: PortalDb,
  viewer: Viewer,
  rows: { platform: string; handle: string; followers: string; views: string }[],
) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  if (!(await creatorIsFree(db, viewer.creatorId))) return { ok: false as const, error: "tier" as const };
  const saved: { platform: string; handle: string; followers: number | null; views: number | null }[] = [];
  for (const row of rows) {
    const platform = onboardingPlatformId(row.platform);
    const handle = cleanHandle(row.handle);
    if (!platform || !handle) continue;
    const followers = wholeNumber(row.followers);
    const views = wholeNumber(row.views);
    if (followers === undefined || views === undefined) return { ok: false as const, error: "number" as const };
    if (!saved.some((item) => item.platform === platform)) saved.push({ platform, handle, followers, views });
  }
  if (saved.length === 0) return { ok: false as const, error: "handles" as const };
  const timestamp = nowIso();
  await db.delete(creatorPlatformHandles).where(eq(creatorPlatformHandles.creatorId, viewer.creatorId));
  for (const row of saved) {
    await db.insert(creatorPlatformHandles).values({
      id: crypto.randomUUID(),
      creatorId: viewer.creatorId,
      platform: row.platform,
      handle: row.handle,
      followers: row.followers,
      views: row.views,
      updatedAt: timestamp,
    });
  }
  await touch(db, viewer.creatorId, {}, false);
  return { ok: true as const };
}

export async function saveFreeNiche(db: PortalDb, viewer: Viewer, niches: string[], nicheOther: string) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  if (!(await creatorIsFree(db, viewer.creatorId))) return { ok: false as const, error: "tier" as const };
  const checked = validateCreatorNiches(niches, nicheOther);
  if (!checked.ok) return { ok: false as const, error: "niche" as const };
  await touch(db, viewer.creatorId, {
    niche: checked.niches.join(","),
    nicheOther: checked.nicheOther || null,
  }, false);
  return { ok: true as const };
}

export async function refreshFreeFinish(db: PortalDb, creatorId: string) {
  const state = await freeOnboardingState(db, creatorId);
  const done = state.firstIncomplete === "done";
  await touch(db, creatorId, {}, done);
  return done;
}

export async function saveFreeStatNote(db: PortalDb, viewer: Viewer, note: string) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  if (!(await creatorIsFree(db, viewer.creatorId))) return { ok: false as const, error: "tier" as const };
  const text = note.trim().slice(0, 500);
  const state = await freeOnboardingState(db, viewer.creatorId);
  const done = state.handles.length > 0 && Boolean(state.niche) && (state.uploadCount > 0 || Boolean(text));
  await touch(db, viewer.creatorId, { statNote: text || null }, done);
  return { ok: true as const, done };
}

export async function skipFreeOnboarding(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  if (!(await creatorIsFree(db, viewer.creatorId))) return { ok: false as const, error: "tier" as const };
  await touch(db, viewer.creatorId, { skippedAt: nowIso() }, false);
  return { ok: true as const };
}

export function freeOnboardingError(code: string | undefined) {
  if (code === "handles") return "Add at least one @handle.";
  if (code === "number") return "Follower and view counts have to be whole numbers, or left blank.";
  if (code === "niche") return "Pick a niche.";
  if (code === "file") return "Upload a JPEG, PNG, WEBP, GIF, or PDF under 1.5 MB.";
  if (code === "own" || code === "tier") return "That step was not saved.";
  return null;
}
