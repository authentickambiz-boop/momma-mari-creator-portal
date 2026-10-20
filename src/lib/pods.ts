import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  collabIdeas,
  communityChannels,
  creators,
  podDates,
  podGoals,
  podMembers,
  podMetrics,
  podShoutouts,
  pods,
} from "@/db/schema";
import { inputsFor, sizeBand } from "./creator-rank";
import { nowIso } from "./format";
import { listManagers } from "./managers";
import { questionnaireFor } from "./questionnaire";
import type { Viewer } from "./types";

export type PodRecord = {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  niche: string;
  sizeBand: string;
  channelId: string | null;
  memberIds: string[];
};

async function toPod(db: PortalDb, row: typeof pods.$inferSelect, managerName: string): Promise<PodRecord> {
  const members = await db.select().from(podMembers).where(eq(podMembers.podId, row.id));
  return {
    id: row.id,
    name: row.name,
    managerId: row.managerId,
    managerName,
    niche: row.niche,
    sizeBand: row.sizeBand,
    channelId: row.channelId,
    memberIds: members.map((member) => member.creatorId),
  };
}

export async function canSeePod(db: PortalDb, viewer: Viewer, pod: PodRecord) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "manager") return viewer.managerId === pod.managerId;
  if (viewer.role === "creator" && viewer.creatorId) return pod.memberIds.includes(viewer.creatorId);
  return false;
}

export async function listPods(db: PortalDb, viewer: Viewer) {
  const rows = await db.select().from(pods);
  const managers = await listManagers(db);
  const names = new Map(managers.map((manager) => [manager.id, manager.name]));
  const all = [];
  for (const row of rows) all.push(await toPod(db, row, names.get(row.managerId) ?? "Manager"));
  return all.filter((pod) => viewer.role === "admin" || (viewer.role === "manager" && viewer.managerId === pod.managerId) || (viewer.role === "creator" && viewer.creatorId && pod.memberIds.includes(viewer.creatorId)));
}

export async function podById(db: PortalDb, viewer: Viewer, id: string) {
  const rows = await db.select().from(pods).where(eq(pods.id, id));
  if (!rows[0]) return null;
  const managers = await listManagers(db);
  const pod = await toPod(db, rows[0], managers.find((manager) => manager.id === rows[0].managerId)?.name ?? "Manager");
  if (!(await canSeePod(db, viewer, pod))) return null;
  return pod;
}

export async function suggestPods(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can suggest pods." };
  const people = await db.select().from(creators);
  const managers = await listManagers(db);
  const managerName = new Map(managers.map((manager) => [manager.id, manager.name]));
  const groups = new Map<string, { niche: string; sizeBand: string; managerId: string; managerName: string; creatorIds: string[]; names: string[] }>();
  for (const person of people) {
    const quiz = await questionnaireFor(db, person.id);
    const niche = quiz.answers.niches[0] || "General";
    const inputs = await inputsFor(db, person.id);
    const band = sizeBand(inputs.followers);
    const managerId = person.primaryManagerId || "unassigned";
    const key = `${niche}|${band}|${managerId}`;
    const group = groups.get(key) ?? {
      niche,
      sizeBand: band,
      managerId,
      managerName: managerName.get(managerId) ?? "Unassigned",
      creatorIds: [],
      names: [],
    };
    group.creatorIds.push(person.id);
    group.names.push(person.name);
    groups.set(key, group);
  }
  return { ok: true as const, groups: [...groups.values()].filter((group) => group.creatorIds.length > 0) };
}

export async function savePod(
  db: PortalDb,
  viewer: Viewer,
  input: { name: string; managerId: string; niche: string; sizeBand: string; creatorIds: string[] },
) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can save a pod." };
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Name the pod." };
  if (!input.managerId) return { ok: false as const, error: "Pick a manager." };
  if (!input.creatorIds.length) return { ok: false as const, error: "Add at least one creator." };
  const id = crypto.randomUUID();
  const channelId = `pod-${id}`;
  const timestamp = nowIso();
  await db.insert(communityChannels).values({
    id: channelId,
    slug: channelId,
    name,
    kind: "pod",
    createdAt: timestamp,
  });
  await db.insert(pods).values({
    id,
    name,
    managerId: input.managerId,
    niche: input.niche.trim() || "General",
    sizeBand: input.sizeBand || "nano",
    channelId,
    createdAt: timestamp,
  });
  for (const creatorId of input.creatorIds) {
    await db.insert(podMembers).values({ podId: id, creatorId });
  }
  return { ok: true as const, id };
}

async function editable(db: PortalDb, viewer: Viewer, podId: string) {
  const pod = await podById(db, viewer, podId);
  if (!pod) return null;
  return pod;
}

export async function addPodDate(db: PortalDb, viewer: Viewer, input: { podId: string; title: string; onDate: string; creatorId?: string | null }) {
  const pod = await editable(db, viewer, input.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  const title = input.title.trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(input.onDate)) return { ok: false as const, error: "Add a title and a date." };
  await db.insert(podDates).values({
    id: crypto.randomUUID(),
    podId: pod.id,
    creatorId: input.creatorId || null,
    title,
    onDate: input.onDate,
    createdAt: nowIso(),
  });
  return { ok: true as const };
}

export async function listPodDates(db: PortalDb, podId: string) {
  const rows = await db.select().from(podDates).where(eq(podDates.podId, podId));
  return rows.sort((a, b) => a.onDate.localeCompare(b.onDate));
}

export async function addCollab(db: PortalDb, viewer: Viewer, input: { podId: string; title: string; body: string }) {
  const pod = await editable(db, viewer, input.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  const creatorId = viewer.creatorId || pod.memberIds[0];
  if (!creatorId) return { ok: false as const, error: "Add a creator before posting an idea." };
  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "Name the collab." };
  const id = crypto.randomUUID();
  await db.insert(collabIdeas).values({
    id,
    podId: pod.id,
    creatorId,
    title,
    body: input.body.trim(),
    partnerId: null,
    status: "idea",
    createdAt: nowIso(),
  });
  return { ok: true as const, id };
}

export async function pairCollab(db: PortalDb, viewer: Viewer, ideaId: string, partnerId: string) {
  const rows = await db.select().from(collabIdeas).where(eq(collabIdeas.id, ideaId));
  const idea = rows[0];
  if (!idea) return { ok: false as const, error: "That collab is not on the board." };
  const pod = await editable(db, viewer, idea.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  if (viewer.role === "creator") return { ok: false as const, error: "A manager pairs creators for a collab." };
  if (!pod.memberIds.includes(partnerId)) return { ok: false as const, error: "Pick a creator in this pod." };
  await db.update(collabIdeas).set({ partnerId, status: "paired" }).where(eq(collabIdeas.id, ideaId));
  return { ok: true as const };
}

export async function markCollabPosted(db: PortalDb, viewer: Viewer, ideaId: string) {
  const rows = await db.select().from(collabIdeas).where(eq(collabIdeas.id, ideaId));
  const idea = rows[0];
  if (!idea) return { ok: false as const, error: "That collab is not on the board." };
  const pod = await editable(db, viewer, idea.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  await db.update(collabIdeas).set({ status: "posted" }).where(eq(collabIdeas.id, ideaId));
  return { ok: true as const };
}

export async function podCollabs(db: PortalDb, podId: string) {
  const rows = await db.select().from(collabIdeas).where(eq(collabIdeas.podId, podId));
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addShoutout(db: PortalDb, viewer: Viewer, podId: string, body: string) {
  const pod = await editable(db, viewer, podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  const text = body.trim();
  if (!text) return { ok: false as const, error: "Write the shout-out." };
  await db.insert(podShoutouts).values({
    id: crypto.randomUUID(),
    podId,
    authorEmail: viewer.email,
    body: text,
    createdAt: nowIso(),
  });
  return { ok: true as const };
}

export async function listShoutouts(db: PortalDb, podId: string) {
  const rows = await db.select().from(podShoutouts).where(eq(podShoutouts.podId, podId));
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addGoal(db: PortalDb, viewer: Viewer, input: { podId: string; title: string; target: number }) {
  const pod = await editable(db, viewer, input.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  if (viewer.role === "creator") return { ok: false as const, error: "A manager sets the pod goal." };
  if (!input.title.trim() || !Number.isInteger(input.target) || input.target < 1) return { ok: false as const, error: "Add a goal and a target." };
  const id = crypto.randomUUID();
  await db.insert(podGoals).values({
    id,
    podId: pod.id,
    title: input.title.trim(),
    target: input.target,
    progress: 0,
    createdAt: nowIso(),
  });
  return { ok: true as const, id };
}

export async function setGoalProgress(db: PortalDb, viewer: Viewer, goalId: string, progress: number) {
  const rows = await db.select().from(podGoals).where(eq(podGoals.id, goalId));
  const goal = rows[0];
  if (!goal) return { ok: false as const, error: "That goal is not on this pod." };
  const pod = await editable(db, viewer, goal.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  const next = Math.max(0, Math.min(goal.target, Math.round(progress)));
  await db.update(podGoals).set({ progress: next }).where(eq(podGoals.id, goalId));
  return { ok: true as const };
}

export async function listGoals(db: PortalDb, podId: string) {
  return db.select().from(podGoals).where(eq(podGoals.podId, podId));
}

export async function recordPodMetric(db: PortalDb, viewer: Viewer, input: { podId: string; month: string; followers: number; collabPosts: number }) {
  if (viewer.role !== "admin" && viewer.role !== "manager") return { ok: false as const, error: "A manager records the pod numbers." };
  const pod = await editable(db, viewer, input.podId);
  if (!pod) return { ok: false as const, error: "That pod is not on your list." };
  if (!/^\d{4}-\d{2}$/.test(input.month) || Number(input.month.slice(5, 7)) < 1 || Number(input.month.slice(5, 7)) > 12) {
    return { ok: false as const, error: "Use a month like 2026-10." };
  }
  await db.insert(podMetrics).values({
    id: crypto.randomUUID(),
    podId: pod.id,
    month: input.month,
    followers: Math.max(0, Math.round(input.followers)),
    collabPosts: Math.max(0, Math.round(input.collabPosts)),
    createdAt: nowIso(),
  });
  return { ok: true as const };
}

export async function podMetricRows(db: PortalDb, podId: string) {
  const rows = await db.select().from(podMetrics).where(eq(podMetrics.podId, podId));
  return rows.sort((a, b) => a.month.localeCompare(b.month));
}

export function collabLift(points: { followers: number; collabPosts: number }[]) {
  const deltas: { collab: boolean; delta: number }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    deltas.push({ collab: points[index].collabPosts > 0, delta: points[index].followers - points[index - 1].followers });
  }
  const average = (rows: typeof deltas) => (rows.length ? rows.reduce((sum, row) => sum + row.delta, 0) / rows.length : 0);
  return Math.round(average(deltas.filter((row) => row.collab)) - average(deltas.filter((row) => !row.collab)));
}
