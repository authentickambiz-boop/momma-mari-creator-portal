import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { botTokens, brandReplyDrafts, capabilityAudit, capabilityDrafts, capabilityGrants, creators, deals, managers, revisions } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { authorizeBot } from "./bot-api";
import { setDealStage } from "./deal-stage";
import { nowIso } from "./format";
import { gmailConnectionState } from "./onboarding";
import { assignedCreatorIds, findManagerByEmail } from "./managers";
import type { Viewer } from "./types";

export const CAPABILITIES = ["negotiate", "review_contracts", "outreach", "draft_replies", "approve_deals"] as const;
export const CAPABILITY_LEVELS = ["off", "draft", "approval", "full"] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type CapabilityLevel = (typeof CAPABILITY_LEVELS)[number];

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const CAPABILITY_LABELS: Record<Capability, string> = {
  negotiate: "Negotiate",
  review_contracts: "Review contracts",
  outreach: "Outreach",
  draft_replies: "Draft replies",
  approve_deals: "Approve deals",
};

export const LEVEL_LABELS: Record<CapabilityLevel, string> = {
  off: "Off",
  draft: "Draft only",
  approval: "Act with approval",
  full: "Full",
};

export const TRAINING_ITEMS: Record<Capability, { id: string; label: string }[]> = {
  negotiate: [
    { id: "minimums", label: "Minimums and quotes stay private" },
    { id: "practice", label: "Practice deal walked through with Kamron" },
    { id: "voice", label: "Brand replies sound like Kamron" },
  ],
  review_contracts: [
    { id: "checklist", label: "Contract checklist walked through" },
    { id: "usage", label: "Usage rights and exclusivity checked" },
    { id: "no_send", label: "Nothing is sent to the brand from here" },
  ],
  outreach: [
    { id: "from", label: "Mail goes out from authentickambiz@gmail.com" },
    { id: "queue", label: "Outreach waits in the approval queue" },
    { id: "no_auto", label: "The portal never sends by itself" },
  ],
  draft_replies: [
    { id: "copy", label: "Replies are drafts Kamron copies" },
    { id: "hidden", label: "Creators never see the draft" },
    { id: "no_send", label: "Saving a draft does not email anyone" },
  ],
  approve_deals: [
    { id: "hidden", label: "New deals stay hidden until published" },
    { id: "private", label: "Minimums stay off the creator page" },
    { id: "reject", label: "Kamron can still reject a deal" },
  ],
};

export type CapabilityEffect =
  | { kind: "negotiate"; dealId: string; note: string }
  | { kind: "review_contracts"; dealId: string; note: string }
  | { kind: "outreach"; dealId: string; to: string; subject: string; body: string }
  | { kind: "draft_replies"; dealId: string; body: string }
  | { kind: "approve_deals"; dealId: string };

const LEVEL_RANK: Record<CapabilityLevel, number> = { off: 0, draft: 1, approval: 2, full: 3 };

function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

function isLevel(value: string): value is CapabilityLevel {
  return (CAPABILITY_LEVELS as readonly string[]).includes(value);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function audit(
  db: PortalDb,
  input: {
    actorEmail: string;
    actorRole: string;
    subjectType?: string | null;
    subjectId?: string | null;
    capability?: string | null;
    action: string;
    detail?: string | null;
  },
) {
  await db.insert(capabilityAudit).values({
    id: crypto.randomUUID(),
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    capability: input.capability ?? null,
    action: input.action,
    detail: input.detail ?? null,
    createdAt: nowIso(),
  });
}

async function grantRow(db: PortalDb, subjectType: string, subjectId: string, capability: Capability) {
  const rows = await db.select().from(capabilityGrants).where(eq(capabilityGrants.subjectId, subjectId));
  return rows.find((row) => row.subjectType === subjectType && row.capability === capability) ?? null;
}

function checkedIds(json: string) {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function trainingComplete(capability: Capability, checked: string[]) {
  const required = TRAINING_ITEMS[capability].map((item) => item.id);
  return required.every((id) => checked.includes(id));
}

export async function listCapabilityGrants(db: PortalDb, subjectType: "manager" | "bot", subjectId: string) {
  const rows = await db.select().from(capabilityGrants).where(eq(capabilityGrants.subjectId, subjectId));
  return CAPABILITIES.map((capability) => {
    const row = rows.find((item) => item.subjectType === subjectType && item.capability === capability);
    const checked = checkedIds(row?.trainingJson ?? "[]");
    return {
      capability,
      label: CAPABILITY_LABELS[capability],
      level: (isLevel(row?.level ?? "") ? row?.level : "off") as CapabilityLevel,
      training: TRAINING_ITEMS[capability].map((item) => ({ ...item, done: checked.includes(item.id) })),
      complete: trainingComplete(capability, checked),
    };
  });
}

export async function setCapabilityLevel(
  db: PortalDb,
  input: {
    actorRole: string;
    actorEmail: string;
    subjectType: "manager" | "bot";
    subjectId: string;
    capability: string;
    level: string;
  },
): Promise<Result<{ level: CapabilityLevel }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can change a capability." };
  if (!isCapability(input.capability) || !isLevel(input.level)) {
    return { ok: false, status: 400, error: "Pick a capability and a level." };
  }
  if (input.subjectType === "manager") {
    const found = await db.select().from(managers).where(eq(managers.id, input.subjectId));
    if (!found[0]) return { ok: false, status: 404, error: "Manager not found." };
  } else {
    const found = await db.select().from(botTokens).where(eq(botTokens.id, input.subjectId));
    if (!found[0] || !found[0].active) return { ok: false, status: 404, error: "Bot not found." };
  }
  const current = await grantRow(db, input.subjectType, input.subjectId, input.capability);
  const checked = checkedIds(current?.trainingJson ?? "[]");
  const raising = LEVEL_RANK[input.level] > LEVEL_RANK[(isLevel(current?.level ?? "") ? current?.level : "off") as CapabilityLevel];
  if (input.level !== "off" && raising && !trainingComplete(input.capability, checked)) {
    return { ok: false, status: 409, error: "Mark the training complete before raising this level." };
  }
  const timestamp = nowIso();
  if (current) {
    await db.update(capabilityGrants).set({
      level: input.level,
      updatedBy: input.actorEmail,
      updatedAt: timestamp,
    }).where(eq(capabilityGrants.id, current.id));
  } else {
    await db.insert(capabilityGrants).values({
      id: crypto.randomUUID(),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      capability: input.capability,
      level: input.level,
      trainingJson: "[]",
      updatedBy: input.actorEmail,
      updatedAt: timestamp,
    });
  }
  await audit(db, {
    actorEmail: input.actorEmail,
    actorRole: "admin",
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    capability: input.capability,
    action: "level_set",
    detail: input.level,
  });
  return { ok: true, level: input.level };
}

export async function setTrainingChecks(
  db: PortalDb,
  input: {
    actorRole: string;
    actorEmail: string;
    subjectType: "manager" | "bot";
    subjectId: string;
    capability: string;
    checked: string[];
  },
): Promise<Result<{ complete: boolean }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can mark training." };
  if (!isCapability(input.capability)) return { ok: false, status: 400, error: "Pick a capability." };
  const allowed = new Set(TRAINING_ITEMS[input.capability].map((item) => item.id));
  const checked = input.checked.filter((id) => allowed.has(id));
  const current = await grantRow(db, input.subjectType, input.subjectId, input.capability);
  const timestamp = nowIso();
  if (current) {
    await db.update(capabilityGrants).set({
      trainingJson: JSON.stringify(checked),
      updatedBy: input.actorEmail,
      updatedAt: timestamp,
    }).where(eq(capabilityGrants.id, current.id));
  } else {
    await db.insert(capabilityGrants).values({
      id: crypto.randomUUID(),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      capability: input.capability,
      level: "off",
      trainingJson: JSON.stringify(checked),
      updatedBy: input.actorEmail,
      updatedAt: timestamp,
    });
  }
  const complete = trainingComplete(input.capability, checked);
  await audit(db, {
    actorEmail: input.actorEmail,
    actorRole: "admin",
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    capability: input.capability,
    action: "training_updated",
    detail: complete ? "complete" : "incomplete",
  });
  return { ok: true, complete };
}

async function applyEffect(
  db: PortalDb,
  effect: CapabilityEffect,
  actorEmail: string,
): Promise<Result<{ applied: true }>> {
  const dealRows = await db.select().from(deals).where(eq(deals.id, effect.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const timestamp = nowIso();
  if (effect.kind === "negotiate") {
    await db.update(deals).set({ nextStep: effect.note, updatedAt: timestamp }).where(eq(deals.id, deal.id));
    return { ok: true, applied: true };
  }
  if (effect.kind === "review_contracts") {
    const prior = await db.select().from(revisions).where(eq(revisions.dealId, deal.id));
    const sortOrder = prior.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
    await db.insert(revisions).values({
      id: crypto.randomUUID(),
      dealId: deal.id,
      draftId: null,
      occurredLabel: timestamp.slice(0, 16).replace("T", " "),
      occurredAt: timestamp,
      source: "us",
      summary: `Contract review: ${effect.note}`,
      emailUrl: null,
      sortOrder,
      isSeed: false,
      createdAt: timestamp,
    });
    return { ok: true, applied: true };
  }
  if (effect.kind === "outreach") {
    const drafted = await createApprovalEmail(db, {
      dealId: deal.id,
      gate: "report",
      to: effect.to,
      subject: effect.subject,
      body: effect.body,
    }, { email: actorEmail, role: "bot" });
    if (!drafted.ok) return drafted;
    return { ok: true, applied: true };
  }
  if (effect.kind === "draft_replies") {
    if (/\[CONFIRM\]/i.test(effect.body)) return { ok: false, status: 400, error: "Fill in the rate and date. A draft cannot contain [CONFIRM]." };
    const existing = await db.select().from(brandReplyDrafts).where(eq(brandReplyDrafts.dealId, deal.id));
    if (existing[0]) {
      await db.update(brandReplyDrafts).set({ body: effect.body, updatedBy: actorEmail, updatedAt: timestamp }).where(eq(brandReplyDrafts.dealId, deal.id));
    } else {
      await db.insert(brandReplyDrafts).values({ dealId: deal.id, body: effect.body, updatedBy: actorEmail, updatedAt: timestamp });
    }
    return { ok: true, applied: true };
  }
  if (!deal.workflowStage || deal.workflowStage === "offer_received") {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "offer_shared",
      actorEmail,
      actorRole: "admin",
      note: "Published from a capability grant.",
    });
    if (!moved.ok) return moved;
  }
  await db.update(deals).set({ visibleToCreator: true, reviewStatus: "published", updatedAt: nowIso() }).where(eq(deals.id, deal.id));
  return { ok: true, applied: true };
}

export async function actWithCapability(
  db: PortalDb,
  input: {
    actorEmail: string;
    actorRole: string;
    subjectType: "manager" | "bot";
    subjectId: string;
    capability: string;
    summary: string;
    effect: CapabilityEffect;
    unrestricted?: boolean;
  },
): Promise<Result<{ mode: "draft" | "pending" | "applied"; draftId: string | null }>> {
  if (!isCapability(input.capability) || input.effect.kind !== input.capability) {
    return { ok: false, status: 400, error: "That action does not match the capability." };
  }
  const summary = input.summary.trim();
  if (!summary) return { ok: false, status: 400, error: "Write a short summary." };
  let level: CapabilityLevel = "full";
  if (!input.unrestricted) {
    const row = await grantRow(db, input.subjectType, input.subjectId, input.capability);
    level = isLevel(row?.level ?? "") ? row!.level as CapabilityLevel : "off";
    if (level === "off") {
      await audit(db, {
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        capability: input.capability,
        action: "denied",
        detail: summary,
      });
      return { ok: false, status: 403, error: "That capability is off." };
    }
  }
  if (level === "draft" || level === "approval") {
    const id = crypto.randomUUID();
    await db.insert(capabilityDrafts).values({
      id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      capability: input.capability,
      level,
      actorEmail: input.actorEmail,
      summary,
      effectJson: JSON.stringify(input.effect),
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: nowIso(),
    });
    await audit(db, {
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      capability: input.capability,
      action: level === "draft" ? "drafted" : "awaiting_approval",
      detail: summary,
    });
    return { ok: true, mode: level === "draft" ? "draft" : "pending", draftId: id };
  }
  const applied = await applyEffect(db, input.effect, input.actorEmail);
  if (!applied.ok) return applied;
  await audit(db, {
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    capability: input.capability,
    action: "acted",
    detail: summary,
  });
  return { ok: true, mode: "applied", draftId: null };
}

export async function managerAct(
  db: PortalDb,
  viewer: Viewer,
  input: { capability: string; summary: string; effect: CapabilityEffect },
) {
  if (viewer.role !== "manager" || !viewer.managerId) {
    return { ok: false as const, status: 403, error: "Open this from a manager sign-in." };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.effect.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  const assigned = Array.isArray(viewer.assignedCreatorIds)
    ? viewer.assignedCreatorIds
    : await assignedCreatorIds(db, viewer.managerId);
  if (!assigned.includes(deal.creatorId)) {
    return { ok: false as const, status: 403, error: "That creator is not on your list." };
  }
  return actWithCapability(db, {
    actorEmail: viewer.email,
    actorRole: "manager",
    subjectType: "manager",
    subjectId: viewer.managerId,
    capability: input.capability,
    summary: input.summary,
    effect: input.effect,
  });
}

export async function reviewCapabilityDraft(
  db: PortalDb,
  input: { actorRole: string; actorEmail: string; draftId: string; intent: "approve" | "reject" },
): Promise<Result<{ status: "approved" | "rejected" }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can approve this." };
  const rows = await db.select().from(capabilityDrafts).where(eq(capabilityDrafts.id, input.draftId));
  const draft = rows[0];
  if (!draft) return { ok: false, status: 404, error: "Draft not found." };
  if (draft.status !== "pending") return { ok: false, status: 409, error: "This was already reviewed." };
  const timestamp = nowIso();
  if (input.intent === "reject") {
    await db.update(capabilityDrafts).set({ status: "rejected", reviewedBy: input.actorEmail, reviewedAt: timestamp }).where(eq(capabilityDrafts.id, draft.id));
    await audit(db, {
      actorEmail: input.actorEmail,
      actorRole: "admin",
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      capability: draft.capability,
      action: "rejected",
      detail: draft.summary,
    });
    return { ok: true, status: "rejected" };
  }
  let effect: CapabilityEffect;
  try {
    effect = JSON.parse(draft.effectJson) as CapabilityEffect;
  } catch {
    return { ok: false, status: 400, error: "That draft could not be read." };
  }
  const applied = await applyEffect(db, effect, input.actorEmail);
  if (!applied.ok) return applied;
  await db.update(capabilityDrafts).set({ status: "approved", reviewedBy: input.actorEmail, reviewedAt: timestamp }).where(eq(capabilityDrafts.id, draft.id));
  await audit(db, {
    actorEmail: input.actorEmail,
    actorRole: "admin",
    subjectType: draft.subjectType,
    subjectId: draft.subjectId,
    capability: draft.capability,
    action: "approved",
    detail: draft.summary,
  });
  return { ok: true, status: "approved" };
}

export async function listPendingCapabilityDrafts(db: PortalDb) {
  const rows = await db.select().from(capabilityDrafts).orderBy(asc(capabilityDrafts.createdAt));
  return rows.filter((row) => row.status === "pending").map((row) => ({
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    capability: row.capability,
    level: row.level,
    actorEmail: row.actorEmail,
    summary: row.summary,
    createdAt: row.createdAt,
  }));
}

export async function listCapabilityAudit(db: PortalDb, limit = 40) {
  const rows = await db.select().from(capabilityAudit).orderBy(desc(capabilityAudit.createdAt));
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    capability: row.capability,
    action: row.action,
    detail: row.detail,
    createdAt: row.createdAt,
  }));
}

export async function createScopedBot(
  db: PortalDb,
  input: { actorRole: string; actorEmail: string; name: string },
): Promise<Result<{ id: string; name: string; token: string }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can add a bot." };
  const name = input.name.trim();
  if (!name) return { ok: false, status: 400, error: "Name the bot." };
  const token = `bot_${randomBytes(24).toString("hex")}`;
  const id = crypto.randomUUID();
  await db.insert(botTokens).values({
    id,
    name,
    tokenHash: hashToken(token),
    tokenHint: token.slice(-4),
    revealOnce: token,
    active: true,
    createdAt: nowIso(),
    revokedAt: null,
  });
  await audit(db, { actorEmail: input.actorEmail, actorRole: "admin", subjectType: "bot", subjectId: id, action: "token_created", detail: name });
  return { ok: true, id, name, token };
}

export async function listScopedBots(db: PortalDb) {
  const rows = await db.select().from(botTokens).orderBy(asc(botTokens.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hint: row.tokenHint,
    active: row.active,
    reveal: row.revealOnce,
  }));
}

export async function clearBotReveal(db: PortalDb, botId: string) {
  await db.update(botTokens).set({ revealOnce: null }).where(eq(botTokens.id, botId));
}

export async function revokeScopedBot(
  db: PortalDb,
  input: { actorRole: string; actorEmail: string; botId: string },
): Promise<Result<{ active: false }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only Kamron can revoke a bot." };
  const rows = await db.select().from(botTokens).where(eq(botTokens.id, input.botId));
  if (!rows[0]) return { ok: false, status: 404, error: "Bot not found." };
  await db.update(botTokens).set({ active: false, revokedAt: nowIso(), revealOnce: null }).where(eq(botTokens.id, input.botId));
  await audit(db, { actorEmail: input.actorEmail, actorRole: "admin", subjectType: "bot", subjectId: input.botId, action: "token_revoked", detail: rows[0].name });
  return { ok: true, active: false };
}

export async function resolveBotCaller(db: PortalDb, header: string | null) {
  const master = authorizeBot(header);
  if (master.ok) return { ok: true as const, unrestricted: true, botId: null as string | null, email: "bot" };
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) {
    return master.status === 503
      ? { ok: false as const, status: 503, error: "Bot API token is not configured." }
      : { ok: false as const, status: 401, error: "Missing or invalid bearer token." };
  }
  const hash = hashToken(match[1]);
  const rows = await db.select().from(botTokens);
  const row = rows.find((item) => hashesMatch(item.tokenHash, hash));
  if (!row || !row.active) {
    return { ok: false as const, status: 401, error: "Missing or invalid bearer token." };
  }
  return { ok: true as const, unrestricted: false, botId: row.id, email: row.name };
}

export async function readCreatorAccountSecrets(db: PortalDb, viewer: Viewer, creatorId: string) {
  if (viewer.role === "manager") {
    return { ok: false as const, status: 403, error: "Managers never get creator account credentials." };
  }
  if (viewer.role !== "admin") {
    return { ok: false as const, status: 403, error: "Only Kamron can open account credentials." };
  }
  const state = await gmailConnectionState(db, creatorId);
  const person = await db.select().from(creators).where(eq(creators.id, creatorId));
  return {
    ok: true as const,
    gmailConnected: state.connected,
    cipher: state.cipher,
    connectUrls: {
      tiktok: person[0]?.tiktokConnectUrl ?? null,
      instagram: person[0]?.instagramConnectUrl ?? null,
    },
  };
}

export async function managerCapabilityAct(
  db: PortalDb,
  input: { email: string; capability: string; summary: string; effect: CapabilityEffect },
) {
  const manager = await findManagerByEmail(db, input.email);
  if (!manager || !manager.active) return { ok: false as const, status: 403, error: "That manager is not active." };
  return actWithCapability(db, {
    actorEmail: manager.email,
    actorRole: "manager",
    subjectType: "manager",
    subjectId: manager.id,
    capability: input.capability,
    summary: input.summary,
    effect: input.effect,
  });
}
