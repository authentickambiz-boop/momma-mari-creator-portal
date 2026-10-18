import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { adminNotifications, approvalEmails, contracts, contractSignatures, creators, deals, drafts, livePosts, managers } from "@/db/schema";
import { adminEmails } from "./authz";
import { normalizeEmail, nowIso } from "./format";
import type { ManagerPermissions, Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type StaffPermission = "stage" | "email" | "video" | "contract" | "countersign";

export type AssignedManager = { id: string; name: string; email: string };

export type ManagerRecord = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  permissions: ManagerPermissions;
  createdAt: string;
  deactivatedAt: string | null;
};

const PERMISSION_ERROR: Record<Exclude<StaffPermission, "stage">, string> = {
  email: "You can't approve brand email.",
  video: "You can't approve videos.",
  contract: "You can't approve contracts.",
  countersign: "You can't countersign.",
};

function permissionsOf(row: typeof managers.$inferSelect): ManagerPermissions {
  return {
    approveEmail: row.canApproveEmail,
    approveVideo: row.canApproveVideo,
    approveContract: row.canApproveContract,
    countersign: row.canCountersign,
  };
}

function toManager(row: typeof managers.$inferSelect): ManagerRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    active: row.active,
    permissions: permissionsOf(row),
    createdAt: row.createdAt,
    deactivatedAt: row.deactivatedAt,
  };
}

export function staffHistoryRole(role: string) {
  if (role === "bot") return "bot" as const;
  if (role === "manager") return "manager" as const;
  return "admin" as const;
}

export async function findManagerByEmail(db: PortalDb, email: string) {
  const normalized = normalizeEmail(email);
  const rows = await db.select().from(managers).where(sql`lower(${managers.email}) = ${normalized}`);
  return rows[0] ? toManager(rows[0]) : null;
}

export async function listManagers(db: PortalDb) {
  const rows = await db.select().from(managers).orderBy(asc(managers.name));
  return rows.map(toManager);
}

export async function assignedCreatorIds(db: PortalDb, managerId: string) {
  const rows = await db
    .select({ id: creators.id, primaryManagerId: creators.primaryManagerId, backupManagerId: creators.backupManagerId })
    .from(creators);
  return rows
    .filter((row) => row.primaryManagerId === managerId || row.backupManagerId === managerId)
    .map((row) => row.id);
}

export async function assertStaffAccess(
  db: PortalDb,
  input: { actorEmail: string; actorRole: string; creatorId: string; permission: StaffPermission },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (input.actorRole === "admin" || input.actorRole === "bot" || input.actorRole === "system") return { ok: true };
  if (input.actorRole !== "manager") return { ok: false, status: 403, error: "That creator isn't on your list." };
  const manager = await findManagerByEmail(db, input.actorEmail);
  if (!manager || !manager.active) return { ok: false, status: 403, error: "That creator isn't on your list." };
  const rows = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  const creator = rows[0];
  if (!creator || (creator.primaryManagerId !== manager.id && creator.backupManagerId !== manager.id)) {
    return { ok: false, status: 403, error: "That creator isn't on your list." };
  }
  if (input.permission === "stage") return { ok: true };
  const allowed = input.permission === "email"
    ? manager.permissions.approveEmail
    : input.permission === "video"
      ? manager.permissions.approveVideo
      : input.permission === "contract"
        ? manager.permissions.approveContract
        : manager.permissions.countersign;
  if (!allowed) return { ok: false, status: 403, error: PERMISSION_ERROR[input.permission] };
  return { ok: true };
}

export async function addManager(
  db: PortalDb,
  input: { actorRole: string; name: string; email: string; permissions?: Partial<ManagerPermissions> },
): Promise<Result<{ id: string; email: string; permissions: ManagerPermissions }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can add a manager." };
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!name) return { ok: false, status: 400, error: "Enter the manager's name." };
  if (!email || !email.includes("@") || email.endsWith(".invalid")) {
    return { ok: false, status: 400, error: "Enter a Google email address." };
  }
  if (adminEmails().includes(email)) return { ok: false, status: 400, error: "That address is already an owner." };
  const creatorRows = await db.select({ id: creators.id }).from(creators).where(sql`lower(${creators.email}) = ${email}`);
  if (creatorRows[0]) return { ok: false, status: 400, error: "That address already belongs to a creator." };
  const existing = await findManagerByEmail(db, email);
  if (existing) return { ok: false, status: 409, error: "That manager is already on the team." };
  const permissions: ManagerPermissions = {
    approveEmail: input.permissions?.approveEmail ?? true,
    approveVideo: input.permissions?.approveVideo ?? true,
    approveContract: input.permissions?.approveContract ?? false,
    countersign: input.permissions?.countersign ?? false,
  };
  const id = crypto.randomUUID();
  await db.insert(managers).values({
    id,
    email,
    name,
    active: true,
    canApproveEmail: permissions.approveEmail,
    canApproveVideo: permissions.approveVideo,
    canApproveContract: permissions.approveContract,
    canCountersign: permissions.countersign,
    createdAt: nowIso(),
    deactivatedAt: null,
  });
  return { ok: true, id, email, permissions };
}

export async function setManagerActive(
  db: PortalDb,
  input: { actorRole: string; managerId: string; active: boolean },
): Promise<Result<{ active: boolean }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can change a manager." };
  const rows = await db.select().from(managers).where(eq(managers.id, input.managerId));
  if (!rows[0]) return { ok: false, status: 404, error: "Manager not found." };
  await db.update(managers).set({
    active: input.active,
    deactivatedAt: input.active ? null : nowIso(),
  }).where(eq(managers.id, input.managerId));
  return { ok: true, active: input.active };
}

export async function setManagerPermissions(
  db: PortalDb,
  input: { actorRole: string; managerId: string; permissions: ManagerPermissions },
): Promise<Result<{ permissions: ManagerPermissions }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can change a manager." };
  const rows = await db.select().from(managers).where(eq(managers.id, input.managerId));
  if (!rows[0]) return { ok: false, status: 404, error: "Manager not found." };
  await db.update(managers).set({
    canApproveEmail: input.permissions.approveEmail,
    canApproveVideo: input.permissions.approveVideo,
    canApproveContract: input.permissions.approveContract,
    canCountersign: input.permissions.countersign,
  }).where(eq(managers.id, input.managerId));
  return { ok: true, permissions: input.permissions };
}

async function activeManager(db: PortalDb, id: string | null) {
  if (!id) return null;
  const rows = await db.select().from(managers).where(eq(managers.id, id));
  return rows[0]?.active ? rows[0] : null;
}

export async function assignCreatorManagers(
  db: PortalDb,
  input: { actorRole: string; creatorId: string; primaryManagerId: string | null; backupManagerId: string | null },
): Promise<Result<{ primaryManagerId: string | null; backupManagerId: string | null }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an owner can assign a manager." };
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "Creator not found." };
  const primary = input.primaryManagerId || null;
  const backup = input.backupManagerId || null;
  if (primary && backup && primary === backup) return { ok: false, status: 400, error: "Pick a different backup." };
  if (primary && !(await activeManager(db, primary))) return { ok: false, status: 400, error: "Assign an active manager." };
  if (backup && !(await activeManager(db, backup))) return { ok: false, status: 400, error: "Assign an active manager." };
  await db.update(creators).set({ primaryManagerId: primary, backupManagerId: backup }).where(eq(creators.id, input.creatorId));
  return { ok: true, primaryManagerId: primary, backupManagerId: backup };
}

type NoticeTarget = { managerId: string | null; message: string };

export async function noticeTargets(db: PortalDb, creatorId: string | null, message: string): Promise<NoticeTarget[]> {
  if (!creatorId) return [{ managerId: null, message }];
  const rows = await db.select().from(creators).where(eq(creators.id, creatorId));
  const creator = rows[0];
  if (!creator) return [{ managerId: null, message }];
  const primary = await activeManager(db, creator.primaryManagerId);
  if (primary) return [{ managerId: primary.id, message }];
  const backup = await activeManager(db, creator.backupManagerId);
  if (backup) {
    return [
      { managerId: backup.id, message },
      { managerId: null, message: `${message} The backup manager is covering.` },
    ];
  }
  return [{ managerId: null, message }];
}

export async function notifyStaff(
  db: PortalDb,
  input: { kind: string; creatorId: string | null; message: string; upsert?: boolean },
) {
  const targets = await noticeTargets(db, input.creatorId, input.message);
  let notified = false;
  for (const target of targets) {
    const audience = target.managerId ? eq(adminNotifications.managerId, target.managerId) : isNull(adminNotifications.managerId);
    if (input.upsert && input.creatorId) {
      const existing = await db.select().from(adminNotifications).where(and(
        eq(adminNotifications.creatorId, input.creatorId),
        eq(adminNotifications.kind, input.kind),
        isNull(adminNotifications.readAt),
        audience,
      ));
      if (existing[0]) {
        if (existing[0].message !== target.message) {
          await db.update(adminNotifications).set({ message: target.message }).where(eq(adminNotifications.id, existing[0].id));
        }
        continue;
      }
    }
    await db.insert(adminNotifications).values({
      id: crypto.randomUUID(),
      kind: input.kind,
      creatorId: input.creatorId,
      managerId: target.managerId,
      message: target.message,
      createdAt: nowIso(),
      readAt: null,
    });
    notified = true;
  }
  return { notified, managerId: targets.find((target) => target.managerId)?.managerId ?? null };
}

export async function listManagerNotices(db: PortalDb, managerId: string) {
  const [notes, people] = await Promise.all([
    db.select().from(adminNotifications).where(and(
      eq(adminNotifications.managerId, managerId),
      isNull(adminNotifications.readAt),
    )).orderBy(asc(adminNotifications.createdAt)),
    db.select().from(creators),
  ]);
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  return notes.map((note) => ({
    id: note.id,
    kind: note.kind,
    creatorId: note.creatorId,
    creatorName: note.creatorId ? names.get(note.creatorId) ?? "Creator" : "Creator",
    message: note.message,
    createdAt: note.createdAt,
  }));
}

export async function assignedManagersByCreator(db: PortalDb) {
  const [people, rows] = await Promise.all([
    db.select({ id: creators.id, primaryManagerId: creators.primaryManagerId }).from(creators),
    db.select({ id: managers.id, name: managers.name, email: managers.email }).from(managers),
  ]);
  const byId = new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, email: row.email }]));
  const map = new Map<string, AssignedManager | null>();
  for (const person of people) {
    map.set(person.id, person.primaryManagerId ? byId.get(person.primaryManagerId) ?? null : null);
  }
  return map;
}

export type NeedsYouItem = { id: string; title: string; detail: string; href: string };

export async function needsYou(db: PortalDb, viewer: Viewer): Promise<NeedsYouItem[]> {
  const ids = new Set(viewer.assignedCreatorIds ?? []);
  if (viewer.role !== "manager" || ids.size === 0) return [];
  const permissions = viewer.permissions;
  const [dealRows, creatorRows, draftRows, emailRows, contractRows, signatureRows, postRows] = await Promise.all([
    db.select().from(deals),
    db.select({ id: creators.id, name: creators.name }).from(creators),
    db.select().from(drafts),
    db.select().from(approvalEmails),
    db.select().from(contracts),
    db.select().from(contractSignatures),
    db.select().from(livePosts),
  ]);
  const names = new Map(creatorRows.map((creator) => [creator.id, creator.name]));
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const items: NeedsYouItem[] = [];
  const hrefFor = (dealId: string, creatorId: string) => `/deals/${dealId}?creator=${encodeURIComponent(creatorId)}`;
  for (const deal of dealRows) {
    if (!ids.has(deal.creatorId) || deal.workflowStage !== "offer_received") continue;
    items.push({
      id: `offer-${deal.id}`,
      title: deal.brand,
      detail: `${names.get(deal.creatorId) ?? "Creator"} · Screen and release this offer`,
      href: hrefFor(deal.id, deal.creatorId),
    });
  }
  if (permissions?.approveEmail) {
    for (const email of emailRows) {
      if (email.status !== "pending") continue;
      const deal = dealById.get(email.dealId);
      if (!deal || !ids.has(deal.creatorId)) continue;
      items.push({
        id: `email-${email.id}`,
        title: email.subject,
        detail: `${names.get(deal.creatorId) ?? "Creator"} · ${deal.brand} · Approve this brand email`,
        href: `/approvals?creator=${encodeURIComponent(deal.creatorId)}`,
      });
    }
  }
  if (permissions?.approveVideo) {
    for (const draft of draftRows) {
      if (draft.isSeed || draft.status !== "new") continue;
      const deal = dealById.get(draft.dealId);
      if (!deal || !ids.has(deal.creatorId)) continue;
      items.push({
        id: `video-${draft.id}`,
        title: deal.brand,
        detail: `${names.get(deal.creatorId) ?? "Creator"} · Review draft v${draft.version}`,
        href: hrefFor(deal.id, deal.creatorId),
      });
    }
  }
  if (permissions?.approveContract) {
    for (const contract of contractRows) {
      if (contract.status !== "received" && contract.status !== "in_review") continue;
      const deal = dealById.get(contract.dealId);
      if (!deal || !ids.has(deal.creatorId)) continue;
      items.push({
        id: `contract-${contract.id}`,
        title: deal.brand,
        detail: `${names.get(deal.creatorId) ?? "Creator"} · Review contract v${contract.version}`,
        href: hrefFor(deal.id, deal.creatorId),
      });
    }
  }
  const seenPosts = new Set<string>();
  for (const post of postRows) {
    if (post.meetsBrief !== null || seenPosts.has(post.dealId)) continue;
    const deal = dealById.get(post.dealId);
    if (!deal || !ids.has(deal.creatorId)) continue;
    seenPosts.add(post.dealId);
    items.push({
      id: `post-${deal.id}`,
      title: deal.brand,
      detail: `${names.get(deal.creatorId) ?? "Creator"} · Confirm the live post matches the brief`,
      href: hrefFor(deal.id, deal.creatorId),
    });
  }
  if (permissions?.countersign) {
    for (const signature of signatureRows) {
      if (signature.status !== "pending_countersign") continue;
      const deal = dealById.get(signature.dealId);
      if (!deal || !ids.has(deal.creatorId)) continue;
      items.push({
        id: `sign-${signature.id}`,
        title: deal.brand,
        detail: `${names.get(deal.creatorId) ?? "Creator"} · Countersign v${signature.version}`,
        href: `/deals/${deal.id}/sign?contract=${signature.contractId}&creator=${encodeURIComponent(deal.creatorId)}`,
      });
    }
  }
  return items;
}
