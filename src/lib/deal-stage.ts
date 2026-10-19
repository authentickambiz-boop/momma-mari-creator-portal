import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { dealStageEvents, deals, revisions } from "@/db/schema";
import { upsertBrandCrm } from "./brand-crm";
import { nowIso } from "./format";
import { assertStaffAccess } from "./managers";
import { creatorStageMessage, getDealStage, stageAdminLabel, type StageActorRole } from "./stages";

export async function setDealStage(
  db: PortalDb,
  input: {
    dealId: string;
    toStage: string;
    actorEmail: string;
    actorRole: StageActorRole | string;
    note?: string | null;
    creatorId?: string | null;
  },
) {
  const stage = getDealStage(input.toStage);
  if (!stage) return { ok: false as const, status: 400, error: "That is not a deal stage." };
  const existing = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = existing[0];
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };

  const creatorChoice =
    input.actorRole === "creator" &&
    input.creatorId === deal.creatorId &&
    deal.workflowStage === "offer_shared" &&
    stage.id === "creator_interested";
  const creatorSign =
    input.actorRole === "creator" &&
    input.creatorId === deal.creatorId &&
    (deal.workflowStage === "approved_by_agency" || deal.workflowStage === "awaiting_signature") &&
    stage.id === "signed_by_creator";
  const creatorGotProduct =
    input.actorRole === "creator" &&
    input.creatorId === deal.creatorId &&
    ((deal.workflowStage === "waiting_for_product" && (stage.id === "product_received" || stage.id === "draft_due")) ||
      (deal.workflowStage === "product_received" && stage.id === "draft_due"));
  const creatorPosted =
    input.actorRole === "creator" &&
    input.creatorId === deal.creatorId &&
    deal.workflowStage === "brand_approved" &&
    stage.id === "scheduled_posted";
  let managerOk = false;
  if (input.actorRole === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "stage",
    });
    if (!allowed.ok) return { ok: false as const, status: 403, error: "You can't move this deal." };
    managerOk = true;
  }
  if (!managerOk && input.actorRole !== "admin" && input.actorRole !== "bot" && input.actorRole !== "system" && !creatorChoice && !creatorSign && !creatorGotProduct && !creatorPosted) {
    return { ok: false as const, status: 403, error: "You can't move this deal." };
  }
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
  if (stage.id === "offer_shared" && (input.actorRole === "admin" || input.actorRole === "manager")) {
    patch.visibleToCreator = true;
    patch.reviewStatus = "published";
  }
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

  if (deal.brand.trim()) {
    await upsertBrandCrm(db, {
      brand: deal.brand,
      creatorId: deal.creatorId,
      outcome: stageOutcome(stage.id),
      contactEmail: emailIn(deal.contact),
      actorName: input.actorEmail,
    });
  }

  return { ok: true as const, changed: true, workflowStage: stage.id, status: patch.status ?? deal.status };
}

function stageOutcome(stageId: string) {
  if (stageId === "offer_received") return "offer received";
  if (stageId === "offer_shared") return "offered";
  if (stageId === "creator_interested") return "interested";
  if (stageId === "creator_declined") return "declined";
  if (stageId === "interest_sent") return "interest sent";
  if (stageId === "paid") return "closed";
  return stageAdminLabel(stageId);
}

function emailIn(value: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}
