import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { welcomeChecklists } from "@/db/schema";
import { creatorIsFree } from "./account-tier";
import { freeOnboardingState } from "./free-onboarding";
import { nowIso } from "./format";
import type { Viewer } from "./types";

export async function welcomeChecklist(db: PortalDb, creatorId: string) {
  const [state, rows] = await Promise.all([
    freeOnboardingState(db, creatorId),
    db.select().from(welcomeChecklists).where(eq(welcomeChecklists.creatorId, creatorId)),
  ]);
  const row = rows[0];
  const handles = state.handles.length > 0;
  const stats = state.uploadCount > 0 || Boolean(state.statNote.trim());
  const guide = Boolean(row?.guideSeenAt);
  const items = [
    { id: "handles", label: "Add your handles", done: handles, href: "/onboarding?step=handles" },
    { id: "stats", label: "Upload your stats", done: stats, href: "/onboarding?step=uploads" },
    { id: "guide", label: "See your where-to-start guide", done: guide, href: "/learn" },
  ];
  const complete = items.every((item) => item.done);
  return { items, complete, dismissed: Boolean(row?.dismissedAt) };
}

export async function markWhereToStartSeen(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return;
  if (!(await creatorIsFree(db, viewer.creatorId))) return;
  const timestamp = nowIso();
  const existing = await db.select().from(welcomeChecklists).where(eq(welcomeChecklists.creatorId, viewer.creatorId));
  if (existing[0]?.guideSeenAt) return;
  if (existing[0]) {
    await db.update(welcomeChecklists).set({ guideSeenAt: timestamp, updatedAt: timestamp }).where(eq(welcomeChecklists.creatorId, viewer.creatorId));
  } else {
    await db.insert(welcomeChecklists).values({
      creatorId: viewer.creatorId,
      guideSeenAt: timestamp,
      dismissedAt: null,
      updatedAt: timestamp,
    });
  }
}

export async function dismissWelcomeChecklist(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "own" as const };
  const list = await welcomeChecklist(db, viewer.creatorId);
  if (!list.complete) return { ok: false as const, error: "open" as const };
  const timestamp = nowIso();
  const existing = await db.select().from(welcomeChecklists).where(eq(welcomeChecklists.creatorId, viewer.creatorId));
  if (existing[0]) {
    await db.update(welcomeChecklists).set({ dismissedAt: timestamp, updatedAt: timestamp }).where(eq(welcomeChecklists.creatorId, viewer.creatorId));
  } else {
    await db.insert(welcomeChecklists).values({
      creatorId: viewer.creatorId,
      guideSeenAt: timestamp,
      dismissedAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return { ok: true as const };
}
