import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { communityState } from "@/db/schema";
import type { Viewer } from "@/lib/types";
import { isThemeOverride, parseThemeOverride, type ThemeOverride } from "@/lib/seasonal-theme";

/** Existing key/value row. Community code only reads id "last", so this needs no migration. */
const OVERRIDE_ID = "seasonal-theme-override";

export async function readThemeOverride(db: PortalDb): Promise<ThemeOverride> {
  const rows = await db.select().from(communityState).where(eq(communityState.id, OVERRIDE_ID));
  return parseThemeOverride(rows[0]?.cursor);
}

export async function saveThemeOverride(db: PortalDb, viewer: Viewer, value: string) {
  if (viewer.role !== "admin") {
    return { ok: false as const, error: "Only the owner can change the seasonal theme." };
  }
  if (!isThemeOverride(value)) {
    return { ok: false as const, error: "Choose a theme, or none." };
  }
  const existing = await db.select().from(communityState).where(eq(communityState.id, OVERRIDE_ID));
  if (existing[0]) {
    await db.update(communityState).set({ cursor: value }).where(eq(communityState.id, OVERRIDE_ID));
  } else {
    await db.insert(communityState).values({ id: OVERRIDE_ID, cursor: value });
  }
  return { ok: true as const, override: value };
}
