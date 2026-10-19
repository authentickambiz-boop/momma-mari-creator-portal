import { and, asc, eq, gt } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorInterest, creators, deals, offerScreenings } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { setDealStage } from "./deal-stage";
import { normalizeEmail, nowIso } from "./format";
import { assertStaffAccess, assignedManagersByCreator, notifyStaff, staffHistoryRole } from "./managers";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type InterestDecision = "interested" | "declined";

export type CreatorInterestRow = {
  id: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  manager: { id: string; name: string; email: string } | null;
  decision: string;
  note: string | null;
  approvalId: string | null;
  createdAt: string;
  workflowStage: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function firstEmail(value: string | null | undefined) {
  const match = value?.match(EMAIL_PATTERN);
  return match ? normalizeEmail(match[0]) : null;
}

function isInterestDecision(value: string): value is InterestDecision {
  return value === "interested" || value === "declined";
}

async function releasedScreening(db: PortalDb, dealId: string) {
  const rows = await db
    .select()
    .from(offerScreenings)
    .where(and(eq(offerScreenings.dealId, dealId), eq(offerScreenings.decision, "released")))
    .orderBy(asc(offerScreenings.createdAt));
  return rows[0] ?? null;
}

async function savedChoice(db: PortalDb, dealId: string) {
  const rows = await db
    .select()
    .from(creatorInterest)
    .where(eq(creatorInterest.dealId, dealId))
    .orderBy(asc(creatorInterest.createdAt));
  return rows[0] ?? null;
}

export async function interestContextForDeal(db: PortalDb, dealId: string) {
  const [released, choice] = await Promise.all([releasedScreening(db, dealId), savedChoice(db, dealId)]);
  return {
    offerReleased: Boolean(released),
    brandEmail: released?.brandEmail ?? null,
    interest: choice
      ? {
          decision: choice.decision,
          note: choice.note,
          createdAt: choice.createdAt,
          approvalId: choice.approvalId,
        }
      : null,
  };
}

function offerStillOpen(workflowStage: string | null) {
  return !workflowStage || workflowStage === "offer_received" || workflowStage === "offer_shared";
}

export async function releaseOffer(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; actorRole: string; brandEmail?: string | null; note?: string | null },
): Promise<Result<{ changed: boolean; workflowStage: string | null }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "manager") {
    return { ok: false, status: 403, error: "Only Kamron can release an offer to a creator." };
  }
  const rows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = rows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (input.actorRole === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "stage",
    });
    if (!allowed.ok) return allowed;
  }
  if (!offerStillOpen(deal.workflowStage)) {
    return { ok: false, status: 409, error: "This deal is already past the offer. Nothing was changed." };
  }

  const existing = await releasedScreening(db, deal.id);
  const email = firstEmail(input.brandEmail) ?? existing?.brandEmail ?? firstEmail(deal.contact);
  if (existing?.brandEmail && deal.workflowStage === "offer_shared") {
    return { ok: true, changed: false, workflowStage: deal.workflowStage };
  }
  if (!email) return { ok: false, status: 400, error: "This offer has no brand email yet." };

  const timestamp = nowIso();
  const note = clean(input.note) ?? "Screened and released to creator.";
  if (deal.workflowStage !== "offer_shared") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "offer_shared",
      actorEmail: input.actorEmail,
      actorRole: staffHistoryRole(input.actorRole),
      note,
    });
    if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  }
  if (!deal.contact) {
    await db.update(deals).set({ contact: email, updatedAt: timestamp }).where(eq(deals.id, deal.id));
  }
  if (existing) {
    await db.update(offerScreenings).set({ brandEmail: email }).where(eq(offerScreenings.id, existing.id));
  } else {
    await db.insert(offerScreenings).values({
      id: crypto.randomUUID(),
      dealId: deal.id,
      decision: "released",
      actorEmail: input.actorEmail,
      brandEmail: email,
      note,
      createdAt: timestamp,
    });
  }
  return { ok: true, changed: true, workflowStage: "offer_shared" };
}

/** When Kamron moves a deal to "shared" from the stage menu, log that screening too. */
export async function logOfferScreening(
  db: PortalDb,
  input: { dealId: string; actorEmail: string; note?: string | null },
) {
  const existing = await releasedScreening(db, input.dealId);
  if (existing) return;
  const rows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = rows[0];
  if (!deal || deal.workflowStage !== "offer_shared") return;
  const email = firstEmail(deal.contact);
  await db.insert(offerScreenings).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    decision: "released",
    actorEmail: input.actorEmail,
    brandEmail: email,
    note: clean(input.note) ?? "Screened and released to creator.",
    createdAt: nowIso(),
  });
}

function interestEmail(creatorName: string, brand: string, note: string | null) {
  const lines = [`Hi,`, ``, `${creatorName} is interested in working with ${brand}.`];
  if (note) lines.push(``, `${creatorName} added this note: ${note}`);
  lines.push(``, `Thanks,`, `Kamron`, `Momma Mari`);
  return {
    subject: `${creatorName} is interested in ${brand}`,
    body: lines.join("\n"),
  };
}

export async function recordCreatorInterest(
  db: PortalDb,
  input: {
    dealId: string;
    creatorId: string;
    creatorEmail: string;
    creatorName: string;
    decision: string;
    note?: string | null;
  },
): Promise<Result<{ decision: InterestDecision; approvalId: string; workflowStage: string }>> {
  if (!isInterestDecision(input.decision)) {
    return { ok: false, status: 400, error: "Choose I'm interested or Not for me." };
  }
  const rows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = rows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (deal.creatorId !== input.creatorId) {
    return { ok: false, status: 403, error: "You can only respond to your own offers." };
  }
  const prior = await savedChoice(db, deal.id);
  if (prior) return { ok: false, status: 409, error: "You already answered this offer." };
  if (input.decision === "declined") {
    return { ok: false, status: 403, error: "Creators don't pass on terms from here." };
  }
  const released = await releasedScreening(db, deal.id);
  if (!deal.visibleToCreator || deal.workflowStage !== "offer_shared" || !released) {
    return { ok: false, status: 403, error: "This offer is not on your list yet." };
  }

  const brandEmail = released.brandEmail ?? firstEmail(deal.contact);
  if (!brandEmail) return { ok: false, status: 400, error: "This offer has no brand email yet." };

  const note = clean(input.note);
  const email = interestEmail(input.creatorName, deal.brand, note);

  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "creator_interested",
    actorEmail: input.creatorEmail,
    actorRole: "creator",
    creatorId: input.creatorId,
    note,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };

  const drafted = await createApprovalEmail(db, {
    dealId: deal.id,
    gate: "interest",
    to: brandEmail,
    subject: email.subject,
    body: email.body,
  }, { email: input.creatorEmail, role: "creator" });
  if (!drafted.ok) return { ok: false, status: drafted.status, error: drafted.error };

  const timestamp = nowIso();
  await db.insert(creatorInterest).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    creatorId: deal.creatorId,
    decision: input.decision,
    note,
    approvalId: drafted.id,
    createdAt: timestamp,
  });
  const lead = `${input.creatorName} is interested in ${deal.brand}.`;
  await notifyStaff(db, {
    kind: "creator_interest",
    creatorId: deal.creatorId,
    message: note ? `${lead} ${note}` : lead,
  });
  return {
    ok: true,
    decision: input.decision,
    approvalId: drafted.id,
    workflowStage: moved.workflowStage,
  };
}

export async function listCreatorInterest(db: PortalDb, since: string | null): Promise<CreatorInterestRow[]> {
  const choiceRows = since
    ? await db.select().from(creatorInterest).where(gt(creatorInterest.createdAt, since)).orderBy(asc(creatorInterest.createdAt))
    : await db.select().from(creatorInterest).orderBy(asc(creatorInterest.createdAt));
  const [dealRows, creatorRows, managerByCreator] = await Promise.all([
    db.select({ id: deals.id, brand: deals.brand, workflowStage: deals.workflowStage }).from(deals),
    db.select({ id: creators.id, name: creators.name }).from(creators),
    assignedManagersByCreator(db),
  ]);
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const nameById = new Map(creatorRows.map((creator) => [creator.id, creator.name]));
  return choiceRows.flatMap((row) => {
    const deal = dealById.get(row.dealId);
    if (!deal) return [];
    return [{
      id: row.id,
      dealId: row.dealId,
      brand: deal.brand,
      creatorId: row.creatorId,
      creatorName: nameById.get(row.creatorId) ?? "Creator",
      manager: managerByCreator.get(row.creatorId) ?? null,
      decision: row.decision,
      note: row.note,
      approvalId: row.approvalId,
      createdAt: row.createdAt,
      workflowStage: deal.workflowStage,
    }];
  });
}

export async function listOfferScreenings(db: PortalDb, dealId: string) {
  return db
    .select({
      id: offerScreenings.id,
      dealId: offerScreenings.dealId,
      decision: offerScreenings.decision,
      actorEmail: offerScreenings.actorEmail,
      brandEmail: offerScreenings.brandEmail,
      note: offerScreenings.note,
      createdAt: offerScreenings.createdAt,
    })
    .from(offerScreenings)
    .where(eq(offerScreenings.dealId, dealId))
    .orderBy(asc(offerScreenings.createdAt));
}
