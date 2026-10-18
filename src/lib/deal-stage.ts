import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { dealStageEvents, deals, revisions } from "@/db/schema";
import { nowIso } from "./format";
import { creatorStageMessage, getDealStage, stageAdminLabel, type StageActorRole } from "./stages";

export async function setDealStage(
  db: PortalDb,
  input: { dealId: string; toStage: string; actorEmail: string; actorRole: StageActorRole | string; note?: string | null },
) {
  if (input.actorRole !== "admin" && input.actorRole !== "bot" && input.actorRole !== "system") {
    return { ok: false as const, status: 403, error: "You can't move this deal." };
  }
  const stage = getDealStage(input.toStage);
  if (!stage) return { ok: false as const, status: 400, error: "That is not a deal stage." };
  const existing = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = existing[0];
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  if (deal.workflowStage === stage.id) {
    return { ok: true as const, changed: false, workflowStage: stage.id, status: deal.status };
  }

  const timestamp = nowIso();
  const note = input.note?.trim() ? input.note.trim() : null;
  const patch: Partial<typeof deals.$inferInsert> = {
    workflowStage: stage.id,
    updatedAt: timestamp,
  };
  if (stage.bucket) patch.status = stage.bucket;
  if (stage.videoStep !== null) patch.stage = stage.videoStep;
  if (stage.id === "offer_shared") patch.visibleToCreator = true;
  if (stage.id === "offer_received" || stage.id === "creator_declined") patch.visibleToCreator = false;
  await db.update(deals).set(patch).where(eq(deals.id, deal.id));

  await db.insert(dealStageEvents).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    fromStage: deal.workflowStage,
    toStage: stage.id,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    note,
    createdAt: timestamp,
  });

  const prior = await db.select().from(revisions).where(eq(revisions.dealId, deal.id));
  const sortOrder = prior.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const publicLine = creatorStageMessage(stage.id, deal.brand) || `Moved to ${stageAdminLabel(stage.id)}.`;
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    draftId: null,
    occurredLabel: timestamp.slice(0, 16).replace("T", " "),
    occurredAt: timestamp,
    source: "us",
    summary: publicLine,
    emailUrl: null,
    sortOrder,
    isSeed: false,
    createdAt: timestamp,
  });

  return { ok: true as const, changed: true, workflowStage: stage.id, status: patch.status ?? deal.status };
}
