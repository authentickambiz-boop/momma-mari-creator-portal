/**
 * Owner commands from the bot office. The queue lives in office_world_commands.
 * Sending, paying, and deleting stop at needs_approval until Kamron says OK in Grok Bot.
 */

import { containsPrivateOfficeDetail } from "./office-catalog";
import { HQ_BOT_ID } from "./office-layout";
import {
  managerForOffice,
  OFFICE_KEYS,
  type OfficeKey,
  type OfficeRecord,
  type OfficeResult,
} from "./office-state";

export const COMMAND_KINDS = [
  "assign_task",
  "call_meeting",
  "note_decision",
  "add_event",
  "add_todo",
  "check_todo",
  "ask",
  "request",
] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

export const COMMAND_STATUSES = [
  "queued",
  "picked_up",
  "in_progress",
  "done",
  "needs_approval",
  "declined",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const PENDING_COMMAND_STATUSES: CommandStatus[] = ["queued", "picked_up", "in_progress"];

export const APPROVAL_PHRASE = "needs your OK in Grok Bot";
export const COMMANDS_PATH = "/api/worlds/commands";

const SENSITIVE = /\b(send|sending|pay|paying|payment|delete|deleting)\b/i;

const NEXT_STATUS: Record<CommandStatus, CommandStatus[]> = {
  queued: ["picked_up", "declined", "needs_approval"],
  picked_up: ["in_progress", "declined", "needs_approval"],
  in_progress: ["done", "needs_approval", "declined"],
  done: [],
  needs_approval: [],
  declined: [],
};

export type OfficeCommand = {
  id: string;
  kind: CommandKind;
  status: CommandStatus;
  botIds: string[];
  office: OfficeKey | null;
  noteId: string | null;
  todoId: string | null;
  decision: "approve" | "hold" | null;
  topic: string | null;
  body: string;
  due: string | null;
  impactDollars: number | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommandDraft = Omit<OfficeCommand, "id" | "createdAt" | "updatedAt">;

function fail(status: number, error: string): OfficeResult<never> {
  return { ok: false, status, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, max = 400): OfficeResult<string> {
  if (typeof value !== "string" || !value.trim()) return fail(400, `${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(400, `${label} is too long.`);
  if (containsPrivateOfficeDetail(trimmed)) return fail(400, `${label} includes a private detail. Leave it out of the office.`);
  return { ok: true, value: trimmed };
}

function officeKey(value: unknown): OfficeResult<OfficeKey> {
  if (typeof value !== "string" || !OFFICE_KEYS.includes(value as OfficeKey)) {
    return fail(400, "office must be personal, business, creators, or hq.");
  }
  return { ok: true, value: value as OfficeKey };
}

function botOnRoster(record: OfficeRecord, id: string) {
  return record.bots.some((bot) => bot.id === id);
}

function oneBot(record: OfficeRecord, value: unknown, label: string): OfficeResult<string> {
  const parsed = text(value, label, 80);
  if (!parsed.ok) return parsed;
  if (!/^[a-zA-Z0-9:_-]+$/.test(parsed.value)) return fail(400, `${label} has an unsupported character.`);
  if (!botOnRoster(record, parsed.value)) return fail(400, `${label} is not on the office roster.`);
  return parsed;
}

export function commandTouchesSensitive(value: string) {
  return SENSITIVE.test(value);
}

function draft(partial: Omit<CommandDraft, "status" | "result"> & { status?: CommandStatus; result?: string | null }): CommandDraft {
  const scanned = [partial.body, partial.topic, partial.due].filter((item): item is string => Boolean(item)).join("\n");
  const sensitive = commandTouchesSensitive(scanned);
  return {
    ...partial,
    status: sensitive ? "needs_approval" : partial.status ?? "queued",
    result: sensitive ? APPROVAL_PHRASE : partial.result ?? null,
  };
}

export function parseOfficeCommand(body: unknown, record: OfficeRecord): OfficeResult<CommandDraft> {
  if (!isRecord(body)) return fail(400, "Expected a JSON object.");
  const kind = body.kind;
  if (typeof kind !== "string" || !COMMAND_KINDS.includes(kind as CommandKind)) {
    return fail(400, "kind must be assign_task, call_meeting, note_decision, add_event, add_todo, check_todo, ask, or request.");
  }

  if (kind === "assign_task") {
    const botId = oneBot(record, body.botId, "botId");
    if (!botId.ok) return botId;
    const task = text(body.text, "text");
    if (!task.ok) return task;
    const due = text(body.due, "due", 40);
    if (!due.ok) return due;
    return { ok: true, value: draft({ kind, botIds: [botId.value], office: null, noteId: null, todoId: null, decision: null, topic: null, body: task.value, due: due.value, impactDollars: null }) };
  }

  if (kind === "call_meeting") {
    if (!Array.isArray(body.botIds) || body.botIds.length === 0) return fail(400, "botIds must list at least one bot.");
    if (body.botIds.length > 40) return fail(400, "botIds is too long.");
    const ids: string[] = [];
    for (const item of body.botIds) {
      const botId = oneBot(record, item, "botId");
      if (!botId.ok) return botId;
      if (!ids.includes(botId.value)) ids.push(botId.value);
    }
    const topic = text(body.topic, "topic", 200);
    if (!topic.ok) return topic;
    return { ok: true, value: draft({ kind, botIds: ids, office: null, noteId: null, todoId: null, decision: null, topic: topic.value, body: topic.value, due: null, impactDollars: null }) };
  }

  if (kind === "note_decision") {
    const noteId = text(body.noteId, "noteId", 80);
    if (!noteId.ok) return noteId;
    if (body.decision !== "approve" && body.decision !== "hold") return fail(400, "decision must be approve or hold.");
    const note = record.notes.find((item) => item.id === noteId.value);
    if (!note) return fail(404, "Note not found.");
    const verb = body.decision === "approve" ? "Approve" : "Hold";
    const ids = [...new Set([record.hqBotId || HQ_BOT_ID, note.bot])];
    return {
      ok: true,
      value: draft({
        kind,
        botIds: ids,
        office: note.office,
        noteId: note.id,
        todoId: null,
        decision: body.decision,
        topic: null,
        body: `${verb}: ${note.idea}`,
        due: null,
        impactDollars: null,
      }),
    };
  }

  if (kind === "add_event") {
    const office = officeKey(body.office);
    if (!office.ok) return office;
    const title = text(body.title, "title", 200);
    if (!title.ok) return title;
    const start = text(body.start, "start", 40);
    if (!start.ok) return start;
    const end = text(body.end, "end", 40);
    if (!end.ok) return end;
    const manager = managerForOffice(record, office.value);
    return {
      ok: true,
      value: draft({
        kind,
        botIds: [manager],
        office: office.value,
        noteId: null,
        todoId: null,
        decision: null,
        topic: end.value,
        body: title.value,
        due: start.value,
        impactDollars: null,
      }),
    };
  }

  if (kind === "add_todo") {
    const office = officeKey(body.office);
    if (!office.ok) return office;
    const task = text(body.text, "text");
    if (!task.ok) return task;
    const botId = oneBot(record, body.botId, "botId");
    if (!botId.ok) return botId;
    const due = text(body.due, "due", 40);
    if (!due.ok) return due;
    const impact = body.impactDollars === undefined ? 0 : body.impactDollars;
    if (typeof impact !== "number" || !Number.isFinite(impact) || impact < 0 || impact > 1_000_000) {
      return fail(400, "impactDollars must be a number from 0 up.");
    }
    return {
      ok: true,
      value: draft({
        kind,
        botIds: [botId.value],
        office: office.value,
        noteId: null,
        todoId: null,
        decision: null,
        topic: null,
        body: task.value,
        due: due.value,
        impactDollars: Math.round(impact),
      }),
    };
  }

  if (kind === "check_todo") {
    const todoId = text(body.todoId, "todoId", 80);
    if (!todoId.ok) return todoId;
    const todo = record.todos.find((item) => item.id === todoId.value);
    if (!todo) return fail(404, "To-do not found.");
    return {
      ok: true,
      value: draft({
        kind,
        botIds: [todo.ownerBot],
        office: todo.office,
        noteId: null,
        todoId: todo.id,
        decision: null,
        topic: null,
        body: `Check off: ${todo.task}`,
        due: todo.due,
        impactDollars: todo.impactDollars,
      }),
    };
  }

  if (kind === "ask") {
    const botId = oneBot(record, body.botId, "botId");
    if (!botId.ok) return botId;
    const question = text(body.text, "text");
    if (!question.ok) return question;
    return { ok: true, value: draft({ kind, botIds: [botId.value], office: null, noteId: null, todoId: null, decision: null, topic: null, body: question.value, due: null, impactDollars: null }) };
  }

  const request = text(body.text, "text");
  if (!request.ok) return request;
  const target = awaitBot(body.botId, record);
  if (!target.ok) return target;
  return { ok: true, value: draft({ kind: "request", botIds: [target.value], office: null, noteId: null, todoId: null, decision: null, topic: null, body: request.value, due: null, impactDollars: null }) };
}

function awaitBot(value: unknown, record: OfficeRecord): OfficeResult<string> {
  if (value === undefined || value === null || value === "") return { ok: true, value: record.hqBotId || HQ_BOT_ID };
  return oneBot(record, value, "botId");
}

export function nextCommandState(current: CommandStatus, status: CommandStatus, result: string | null): OfficeResult<{ status: CommandStatus; result: string | null }> {
  if (!NEXT_STATUS[current].includes(status)) return fail(409, `${current} cannot move to ${status}.`);
  const nextResult = status === "needs_approval" && !result ? APPROVAL_PHRASE : result;
  return { ok: true, value: { status, result: nextResult } };
}

/** Latest open line for each bot. Done commands keep their result until a newer one arrives. */
export function speechForBots(commands: OfficeCommand[]) {
  const latest = new Map<string, OfficeCommand>();
  const sorted = [...commands].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const command of sorted) {
    if (command.status === "declined") continue;
    for (const id of command.botIds) latest.set(id, command);
  }
  const lines: Record<string, string> = {};
  for (const [id, command] of latest) {
    const line = command.result?.trim() || command.body;
    if (line) lines[id] = line;
  }
  return lines;
}

export function isWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type CommandFetch = (url: string, init: { method: "POST"; headers: { "content-type": string }; body: string }) => Promise<unknown>;

export async function notifyCommandWebhook(command: OfficeCommand, options?: { fetchImpl?: CommandFetch; url?: string | null }) {
  const url = (options?.url ?? "").trim();
  if (!url || !isWebhookUrl(url)) return false;
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    return true;
  } catch {
    return false;
  }
}
