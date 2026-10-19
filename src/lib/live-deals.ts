import { asc } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { deals } from "@/db/schema";
import { canSeeDeal } from "./authz";
import { lastUpdatedLabel } from "./format";
import { creatorStageMessage, stageShortLabel } from "./stages";
import type { Viewer } from "./types";

/** Lightweight poll payload. Creators only see their own visible deals, with no notes or prices. */
export async function listLiveDeals(db: PortalDb, viewer: Viewer) {
  const rows = await db.select().from(deals).orderBy(asc(deals.sortOrder), asc(deals.brand));
  return rows.filter((row) => canSeeDeal(viewer, row)).map((row) => ({
    id: row.id,
    brand: row.brand,
    workflowStage: row.workflowStage,
    stageLabel: row.workflowStage ? stageShortLabel(row.workflowStage) : "",
    message: creatorStageMessage(row.workflowStage, row.brand),
    updatedAt: row.updatedAt,
    updatedLabel: lastUpdatedLabel(row.updatedAt),
  }));
}
