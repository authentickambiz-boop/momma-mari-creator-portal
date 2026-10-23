import { asc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorQuestionnaires, creatorTasks, creators, deals, podGoals, podMembers } from "@/db/schema";
import { depositLockTodos } from "./brand-deposits";
import { isFakeCalendarDay } from "./deadlines";
import { agencyTimeZone, nowIso, parseJson } from "./format";
import { profileIntakeMissing, profileIntakeTaskId } from "./profile-intake";
import { findCreatorByEmail, findCreatorById } from "./queries";
import type { QuestionnaireAnswers } from "./questionnaire";
import type { Viewer } from "./types";

export const TASK_CATEGORIES = ["deal", "goal", "profile", "contract", "content", "admin"] as const;
export const TASK_STATUSES = ["open", "done", "skipped"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

const PRIVATE_LINE = /\$\s?\d|\brates?\b|\bfloors?\b|\bminimums?\b|\bstaff\b|\bkamron\b/i;

export type CreatorTodo = {
  id: string;
  title: string;
  detail: string | null;
  dueDate: string | null;
  category: TaskCategory;
  overdue: boolean;
  /** A filming step that stays put until the brand deposit lands. */
  locked?: boolean;
};

export type OwnerTask = {
  id: string;
  creatorId: string;
  creatorName: string;
  dealId: string | null;
  title: string;
  detail: string | null;
  dueDate: string | null;
  category: string;
  status: string;
  createdBy: string;
  overdue: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTaskCategory(value: string): value is TaskCategory {
  return (TASK_CATEGORIES as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function portalToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: agencyTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/** Drops lines that mention money, floors, or staff notes. Creators never see those. */
export function creatorVisibleText(value: string | null | undefined) {
  if (!value) return null;
  const kept = value
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !PRIVATE_LINE.test(line));
  const text = kept.join(" ").trim();
  return text || null;
}

function calendarDayOrNull(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isFakeCalendarDay(value)) return null;
  return value;
}

function isOverdue(dueDate: string | null, today: string) {
  return Boolean(dueDate && dueDate < today);
}

function byDueDate<T extends { dueDate: string | null; title: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const left = a.dueDate ?? "9999-99-99";
    const right = b.dueDate ?? "9999-99-99";
    return left.localeCompare(right) || a.title.localeCompare(b.title);
  });
}

async function creatorByKey(db: PortalDb, creatorKey: string | null) {
  const key = creatorKey?.trim() ?? "";
  if (!key) return null;
  if (key.includes("@")) return findCreatorByEmail(db, key);
  return findCreatorById(db, key);
}

async function insertIfMissing(
  db: PortalDb,
  row: { id: string; creatorId: string; title: string; detail: string | null; category: TaskCategory },
) {
  const existing = await db.select({ id: creatorTasks.id }).from(creatorTasks).where(eq(creatorTasks.id, row.id));
  if (existing[0]) return;
  const timestamp = nowIso();
  await db.insert(creatorTasks).values({
    id: row.id,
    creatorId: row.creatorId,
    dealId: null,
    title: row.title,
    detail: row.detail,
    dueDate: null,
    category: row.category,
    status: "open",
    createdBy: "seed",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Asks every creator who has not saved contract details to finish them. */
export async function ensureProfileIntakeTask(db: PortalDb, creatorId: string) {
  const missing = await profileIntakeMissing(db, creatorId);
  const id = profileIntakeTaskId(creatorId);
  if (!missing) {
    const tasks = await db.select().from(creatorTasks).where(eq(creatorTasks.id, id));
    if (tasks[0] && tasks[0].status !== "done") {
      await db.update(creatorTasks).set({ status: "done", updatedAt: nowIso() }).where(eq(creatorTasks.id, id));
    }
    return;
  }
  await insertIfMissing(db, {
    id,
    creatorId,
    title: "Complete your profile",
    detail: "Add your legal name, mailing address, phone, and handles.",
    category: "profile",
  });
}

/** Starter tasks from a questionnaire or a saved goal. Rates and floors are not copied. */
export async function seedCreatorGoalTasks(db: PortalDb, creatorId: string) {
  const people = await db.select().from(creators).where(eq(creators.id, creatorId));
  const creator = people[0];
  if (!creator) return;
  if (creator.monthlyGoalCents != null) {
    await insertIfMissing(db, {
      id: `goal-${creatorId}-monthly`,
      creatorId,
      title: "Check your monthly goal",
      detail: "A monthly goal is saved on your account. Keep the work that fits it moving.",
      category: "goal",
    });
  }
  const quizzes = await db.select().from(creatorQuestionnaires).where(eq(creatorQuestionnaires.creatorId, creatorId));
  const quiz = quizzes[0];
  if (quiz) {
    const answers = parseJson<Partial<QuestionnaireAnswers>>(quiz.answersJson, {});
    const niches = Array.isArray(answers.niches) ? answers.niches.filter((item) => typeof item === "string" && item.trim()) : [];
    if (niches.length) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-niches`,
        creatorId,
        title: "Keep posting in your niches",
        detail: niches.join(", "),
        category: "content",
      });
    }
    if (typeof answers.frequency === "string" && answers.frequency.trim()) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-frequency`,
        creatorId,
        title: "Keep your posting rhythm",
        detail: answers.frequency.trim(),
        category: "content",
      });
    }
    const availability = [answers.availability, answers.turnaround].filter((item) => typeof item === "string" && item.trim()).join(". ");
    if (availability) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-availability`,
        creatorId,
        title: "Confirm your availability",
        detail: availability,
        category: "profile",
      });
    }
    const brands = Array.isArray(answers.brands) ? answers.brands.filter((item) => typeof item === "string" && item.trim()) : [];
    if (brands.length) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-brands`,
        creatorId,
        title: "Brands you want to work with",
        detail: brands.join(", "),
        category: "goal",
      });
    }
    const cap = typeof answers.maxSponsored === "string" ? answers.maxSponsored.trim() : "";
    if (/^\d+$/.test(cap)) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-cap`,
        creatorId,
        title: "Sponsored post limit",
        detail: `Up to ${cap} sponsored posts a month.`,
        category: "goal",
      });
    }
  }
  const memberships = await db.select().from(podMembers).where(eq(podMembers.creatorId, creatorId));
  for (const membership of memberships) {
    const goals = await db.select().from(podGoals).where(eq(podGoals.podId, membership.podId));
    for (const goal of goals) {
      await insertIfMissing(db, {
        id: `goal-${creatorId}-pod-${goal.id}`,
        creatorId,
        title: goal.title,
        detail: `Pod goal: ${goal.progress} of ${goal.target}.`,
        category: "goal",
      });
    }
  }
}

function toTodo(row: typeof creatorTasks.$inferSelect, today: string): CreatorTodo {
  const category = isTaskCategory(row.category) ? row.category : "admin";
  return {
    id: row.id,
    title: creatorVisibleText(row.title) ?? "To-do",
    detail: creatorVisibleText(row.detail),
    dueDate: row.dueDate,
    category,
    overdue: isOverdue(row.dueDate, today),
  };
}

export async function listCreatorOpenTasks(db: PortalDb, creatorId: string) {
  await seedCreatorGoalTasks(db, creatorId);
  await ensureProfileIntakeTask(db, creatorId);
  const today = portalToday();
  const rows = await db.select().from(creatorTasks).where(eq(creatorTasks.creatorId, creatorId));
  const open = byDueDate(rows.filter((row) => row.status === "open").map((row) => toTodo(row, today)));
  const locked = await depositLockTodos(db, creatorId);
  return [...open, ...locked];
}

export async function listOwnerTasks(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only the owner can edit creator to-dos." };
  const people = await db.select({ id: creators.id, name: creators.name }).from(creators).orderBy(asc(creators.name));
  for (const person of people) {
    await seedCreatorGoalTasks(db, person.id);
    await ensureProfileIntakeTask(db, person.id);
  }
  const today = portalToday();
  const rows = await db.select().from(creatorTasks);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const tasks: OwnerTask[] = byDueDate(rows.map((row) => ({
    id: row.id,
    creatorId: row.creatorId,
    creatorName: names.get(row.creatorId) ?? "Creator",
    dealId: row.dealId,
    title: row.title,
    detail: row.detail,
    dueDate: row.dueDate,
    category: row.category,
    status: row.status,
    createdBy: row.createdBy,
    overdue: isOverdue(row.dueDate, today),
  }))).sort((a, b) => a.creatorName.localeCompare(b.creatorName) || (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
  return { ok: true as const, tasks };
}

export async function markCreatorTaskDone(db: PortalDb, viewer: Viewer, taskId: string) {
  if (taskId.startsWith("deposit-lock-")) {
    return { ok: false as const, error: "That step stays locked until the deposit lands." };
  }
  const rows = await db.select().from(creatorTasks).where(eq(creatorTasks.id, taskId));
  const task = rows[0];
  if (!task) return { ok: false as const, error: "That to-do is not on your list." };
  if (viewer.role === "creator") {
    if (!viewer.creatorId || viewer.creatorId !== task.creatorId) {
      return { ok: false as const, error: "You can only update your own to-dos." };
    }
  } else if (viewer.role !== "admin") {
    return { ok: false as const, error: "You can't update this to-do." };
  }
  if (task.status !== "done") {
    await db.update(creatorTasks).set({ status: "done", updatedAt: nowIso() }).where(eq(creatorTasks.id, task.id));
  }
  return { ok: true as const };
}

export async function saveCreatorTask(
  db: PortalDb,
  viewer: Viewer,
  input: { id: string; title: string; detail: string; dueDate: string; category: string; status: string },
) {
  if (viewer.role !== "admin") return { ok: false as const, error: "You can't edit these to-dos." };
  const rows = await db.select().from(creatorTasks).where(eq(creatorTasks.id, input.id));
  const current = rows[0];
  if (!current) return { ok: false as const, error: "That to-do is not on your list." };
  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "Add a title." };
  if (!isTaskCategory(input.category)) return { ok: false as const, error: "Choose a category." };
  if (!isTaskStatus(input.status)) return { ok: false as const, error: "Choose a status." };
  const due = input.dueDate.trim();
  if (due && !calendarDayOrNull(due)) return { ok: false as const, error: "Due date must be a real day like 2026-11-20." };
  await db.update(creatorTasks).set({
    title,
    detail: input.detail.trim() || null,
    dueDate: due || null,
    category: input.category,
    status: input.status,
    updatedAt: nowIso(),
  }).where(eq(creatorTasks.id, current.id));
  return { ok: true as const };
}

export async function listBotTasks(db: PortalDb, creatorKey: string | null) {
  if (!creatorKey?.trim()) return { status: 400, body: { error: "creator is required." } };
  const creator = await creatorByKey(db, creatorKey);
  if (!creator) return { status: 404, body: { error: "Creator not found." } };
  await seedCreatorGoalTasks(db, creator.id);
  await ensureProfileIntakeTask(db, creator.id);
  const rows = await db.select().from(creatorTasks).where(eq(creatorTasks.creatorId, creator.id));
  return {
    status: 200,
    body: {
      creatorId: creator.id,
      tasks: byDueDate(rows).map((row) => ({
        id: row.id,
        creatorId: row.creatorId,
        dealId: row.dealId,
        title: row.title,
        detail: row.detail,
        dueDate: row.dueDate,
        category: row.category,
        status: row.status,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    },
  };
}

export async function upsertCreatorTask(db: PortalDb, body: unknown) {
  if (!isRecord(body) || typeof body.id !== "string" || !body.id.trim()) {
    return { status: 400, body: { error: "id is required." } };
  }
  const creator = typeof body.creatorEmail === "string"
    ? await findCreatorByEmail(db, body.creatorEmail)
    : typeof body.creatorId === "string"
      ? await findCreatorById(db, body.creatorId)
      : null;
  if (!creator) return { status: 404, body: { error: "Creator not found. Upsert the creator first." } };
  const id = body.id.trim();
  const existing = await db.select().from(creatorTasks).where(eq(creatorTasks.id, id));
  const current = existing[0];
  if (typeof body.category === "string" && !isTaskCategory(body.category)) {
    return { status: 400, body: { error: `category must be one of ${TASK_CATEGORIES.join(", ")}.` } };
  }
  if (typeof body.status === "string" && !isTaskStatus(body.status)) {
    return { status: 400, body: { error: `status must be one of ${TASK_STATUSES.join(", ")}.` } };
  }
  if (!current && (typeof body.title !== "string" || !body.title.trim())) {
    return { status: 400, body: { error: "title is required." } };
  }
  if (!current && typeof body.category !== "string") {
    return { status: 400, body: { error: `category must be one of ${TASK_CATEGORIES.join(", ")}.` } };
  }
  if (typeof body.title === "string" && !body.title.trim()) {
    return { status: 400, body: { error: "title is required." } };
  }
  let dealId = current?.dealId ?? null;
  if ("dealId" in body) {
    if (body.dealId == null || body.dealId === "") dealId = null;
    else if (typeof body.dealId !== "string") return { status: 400, body: { error: "dealId must be a deal id or null." } };
    else {
      const dealRows = await db.select().from(deals).where(eq(deals.id, body.dealId));
      const deal = dealRows[0];
      if (!deal) return { status: 404, body: { error: "Deal not found." } };
      if (deal.creatorId !== creator.id) return { status: 400, body: { error: "That deal belongs to another creator." } };
      dealId = deal.id;
    }
  }
  let dueDate = current?.dueDate ?? null;
  if ("dueDate" in body) {
    if (body.dueDate == null || body.dueDate === "") dueDate = null;
    else if (typeof body.dueDate !== "string" || !calendarDayOrNull(body.dueDate.trim())) {
      return { status: 400, body: { error: "dueDate must be a real day like 2026-11-20." } };
    } else dueDate = body.dueDate.trim();
  }
  const timestamp = nowIso();
  const next = {
    creatorId: creator.id,
    dealId,
    title: typeof body.title === "string" ? body.title.trim() : current?.title ?? "",
    detail: "detail" in body
      ? (typeof body.detail === "string" && body.detail.trim() ? body.detail.trim() : null)
      : current?.detail ?? null,
    dueDate,
    category: typeof body.category === "string" ? body.category : current?.category ?? "admin",
    status: typeof body.status === "string" ? body.status : current?.status ?? "open",
    createdBy: typeof body.createdBy === "string" && body.createdBy.trim()
      ? body.createdBy.trim().slice(0, 80)
      : current?.createdBy ?? "bot",
    updatedAt: timestamp,
  };
  if (current) {
    await db.update(creatorTasks).set(next).where(eq(creatorTasks.id, id));
    return { status: 200, body: { id, created: false, creatorId: creator.id, status: next.status } };
  }
  await db.insert(creatorTasks).values({ ...next, id, createdAt: timestamp });
  return { status: 201, body: { id, created: true, creatorId: creator.id, status: next.status } };
}
