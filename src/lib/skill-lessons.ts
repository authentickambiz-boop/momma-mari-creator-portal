import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, skillLessons } from "@/db/schema";
import { isStaff } from "./authz";
import { nowIso } from "./format";
import type { Viewer } from "./types";

export const SKILL_TOPICS = [
  { id: "hooks", label: "Hooks" },
  { id: "filming", label: "Filming" },
  { id: "editing", label: "Editing" },
  { id: "posting", label: "Posting" },
  { id: "growth", label: "Growth" },
  { id: "ugc", label: "UGC basics" },
] as const;

export type SkillTopicId = (typeof SKILL_TOPICS)[number]["id"];

const TOPIC_IDS = new Set<string>(SKILL_TOPICS.map((topic) => topic.id));
const PRIVATE_RATES = /\$|\bminimums?\b|\brate floors?\b/i;

export type SkillLessonView = {
  id: string;
  topic: SkillTopicId;
  topicLabel: string;
  title: string;
  body: string;
  paragraphs: string[];
  creatorId: string | null;
  audienceLabel: string;
  updatedAt: string;
};

type Fail = { ok: false; status: number; error: string; code: string };

export function lessonLeaksPrivateRates(text: string) {
  return PRIVATE_RATES.test(text);
}

export function canWriteLessons(viewer: Viewer) {
  return isStaff(viewer);
}

function topicOf(value: string): SkillTopicId | null {
  return TOPIC_IDS.has(value) ? (value as SkillTopicId) : null;
}

function topicLabel(id: SkillTopicId) {
  return SKILL_TOPICS.find((topic) => topic.id === id)?.label ?? id;
}

function paragraphs(body: string) {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function assigned(viewer: Viewer) {
  return new Set(viewer.assignedCreatorIds ?? []);
}

function canTouchCreator(viewer: Viewer, creatorId: string | null) {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "manager") return false;
  if (creatorId == null) return true;
  return assigned(viewer).has(creatorId);
}

function readable(viewer: Viewer, creatorId: string | null, focus: string | "all") {
  if (viewer.role === "creator") return creatorId == null || creatorId === viewer.creatorId;
  if (!canTouchCreator(viewer, creatorId)) return false;
  if (focus === "all") return true;
  return creatorId == null || creatorId === focus;
}

export async function listSkillLessons(
  db: PortalDb,
  viewer: Viewer,
  focus: string | "all",
): Promise<{ ok: true; lessons: SkillLessonView[]; canWrite: boolean }> {
  const people = await db.select({ id: creators.id, name: creators.name }).from(creators);
  const names = new Map(people.map((creator) => [creator.id, creator.name]));
  const rows = await db.select().from(skillLessons);
  const order = new Map<string, number>(SKILL_TOPICS.map((topic, index) => [topic.id, index]));
  const lessons: SkillLessonView[] = [];
  for (const row of rows) {
    if (!readable(viewer, row.creatorId, focus)) continue;
    const topic = topicOf(row.topic);
    if (!topic) continue;
    lessons.push({
      id: row.id,
      topic,
      topicLabel: topicLabel(topic),
      title: row.title,
      body: row.body,
      paragraphs: paragraphs(row.body),
      creatorId: row.creatorId,
      audienceLabel: row.creatorId == null ? "For everyone" : `For ${names.get(row.creatorId) ?? "one creator"}`,
      updatedAt: row.updatedAt,
    });
  }
  lessons.sort((left, right) => {
    const byTopic = (order.get(left.topic) ?? 99) - (order.get(right.topic) ?? 99);
    if (byTopic !== 0) return byTopic;
    if ((left.creatorId == null) !== (right.creatorId == null)) return left.creatorId == null ? -1 : 1;
    return left.title.localeCompare(right.title);
  });
  return { ok: true, lessons, canWrite: canWriteLessons(viewer) };
}

export async function saveSkillLesson(
  db: PortalDb,
  viewer: Viewer,
  input: { id?: string | null; topic: string; title: string; body: string; creatorId: string | null },
): Promise<{ ok: true; id: string } | Fail> {
  if (!canWriteLessons(viewer)) {
    return { ok: false, status: 403, error: "Lessons are added by Kamron or a manager.", code: "forbidden" };
  }
  const topic = topicOf(input.topic.trim());
  if (!topic) return { ok: false, status: 400, error: "Pick a topic.", code: "topic" };
  const title = input.title.replace(/\s+/g, " ").trim();
  if (!title || title.length > 120) return { ok: false, status: 400, error: "Add a short title.", code: "title" };
  const body = input.body.trim();
  if (!body || body.length > 4000) return { ok: false, status: 400, error: "Write the lesson.", code: "body" };
  if (lessonLeaksPrivateRates(`${title}\n${body}`)) {
    return { ok: false, status: 400, error: "Leave private rates off this lesson.", code: "private" };
  }
  const creatorId = input.creatorId?.trim() || null;
  if (!canTouchCreator(viewer, creatorId)) {
    return { ok: false, status: 403, error: "Pick a creator on your list, or everyone.", code: "creator" };
  }
  if (creatorId) {
    const people = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
    if (!people[0]) return { ok: false, status: 404, error: "That creator was not found.", code: "creator" };
  }
  const timestamp = nowIso();
  const existingId = input.id?.trim() || "";
  if (!existingId) {
    const id = crypto.randomUUID();
    await db.insert(skillLessons).values({
      id,
      topic,
      title,
      body,
      creatorId,
      createdBy: viewer.email,
      updatedBy: viewer.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { ok: true, id };
  }
  const rows = await db.select().from(skillLessons).where(eq(skillLessons.id, existingId));
  const current = rows[0];
  if (!current) return { ok: false, status: 404, error: "That lesson was not found.", code: "missing" };
  if (!canTouchCreator(viewer, current.creatorId)) {
    return { ok: false, status: 403, error: "That lesson stays with Kamron or the manager for that creator.", code: "forbidden" };
  }
  await db.update(skillLessons).set({
    topic,
    title,
    body,
    creatorId,
    updatedBy: viewer.email,
    updatedAt: timestamp,
  }).where(eq(skillLessons.id, current.id));
  return { ok: true, id: current.id };
}
