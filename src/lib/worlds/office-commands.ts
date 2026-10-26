/**
 * Owner commands from the bot office. The queue lives in office_world_commands.
 * Sending, paying, and deleting stop at needs_approval until Kamron says OK in Grok Bot.
 * Nothing in this queue sends mail, pays, books, or deletes outside the portal.
 *
 * Chat posts `{ "kind": "message", "botId": "<roster id>", "text": "<text>" }`
 * to POST /api/worlds/commands (owner session). The game routine receives the
 * stored command as JSON on WORLDS_COMMAND_WEBHOOK_URL:
 * `{ "id", "kind": "message", "status": "queued", "botIds": ["<roster id>"],
 *    "office": null, "noteId": null, "todoId": null, "decision": null,
 *    "topic": null, "body": "<text>", "due": null, "impactDollars": null,
 *    "result": null, "createdAt", "updatedAt" }`.
 * A reply walks queued → picked_up → in_progress → done with the bot token:
 * PATCH /api/worlds/commands `{ "id": "<command id>", "status": "done", "result": "<reply>" }`.
 * The owner chat reads that result from GET /api/worlds/commands.
 * Every queued command is POSTed to the webhook. A needs_approval row is not.
 * WORLDS_PAYMENTS_ENABLED does not decide that. A failed delivery is logged with the host and status.
 */

import { containsPrivateOfficeDetail } from "./office-catalog";
import { worldsTextRejection } from "./safety";
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
  "message",
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
/** How often an open chat, board, or meeting panel reloads the command queue. */
export const CHAT_POLL_MS = 4000;
/** A queued message older than this never woke the bot. The chat offers a resend. */
export const STALE_QUEUED_MS = 10 * 60 * 1000;
export const NOT_DELIVERED_LABEL = "not delivered, tap to resend";

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
  const blocked = worldsTextRejection(trimmed);
  if (blocked) return fail(400, blocked);
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
    return fail(400, "kind must be assign_task, call_meeting, note_decision, add_event, add_todo, check_todo, ask, request, or message.");
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
    const blocked = worldsTextRejection(note.idea) ?? worldsTextRejection(note.whyNow);
    if (blocked) return fail(400, blocked);
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
    const blocked = worldsTextRejection(todo.task);
    if (blocked) return fail(400, blocked);
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

  if (kind === "ask" || kind === "message") {
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

export type ChatTurn = {
  id: string;
  from: "owner" | "bot";
  text: string;
  state: "queued" | "sent" | "needs_approval" | "declined" | "not_delivered";
};

function ownerTurnState(command: OfficeCommand, now: number): ChatTurn["state"] {
  if (command.status === "needs_approval") return "needs_approval";
  if (command.status === "declined") return "declined";
  if (command.status !== "queued") return "sent";
  const created = Date.parse(command.createdAt);
  if (Number.isFinite(created) && now - created > STALE_QUEUED_MS) return "not_delivered";
  return "queued";
}

/** Owner lines and bot replies for one bot. Only kind "message" is chat. */
export function chatForBot(commands: OfficeCommand[], botId: string, limit = 12, now = Date.now()): ChatTurn[] {
  const mine = commands
    .filter((command) => command.kind === "message" && command.botIds.includes(botId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const turns: ChatTurn[] = [];
  for (const command of mine) {
    const state = ownerTurnState(command, now);
    turns.push({ id: command.id, from: "owner", text: command.body, state });
    const reply = command.result?.trim() ?? "";
    if (reply && reply !== APPROVAL_PHRASE && command.status !== "needs_approval") {
      turns.push({ id: `${command.id}:reply`, from: "bot", text: reply, state: "sent" });
    }
  }
  return turns.slice(-limit);
}

/** Commands still waiting on a bot. Pass an office to keep one wing's board. */
export function openCommands(commands: OfficeCommand[], kind: CommandKind, office?: OfficeKey) {
  return commands.filter((command) => {
    if (command.kind !== kind) return false;
    if (office !== undefined && command.office !== office) return false;
    return PENDING_COMMAND_STATUSES.includes(command.status);
  });
}

export function isWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type CommandFetch = (
  url: string,
  init: { method: "POST"; headers: { "content-type": string; authorization?: string }; body: string },
) => Promise<unknown>;

function webhookHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "webhook";
  }
}

function responseStatus(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const record = response as { ok?: unknown; status?: unknown };
  if (typeof record.status === "number") return record.status;
  if (record.ok === true) return 200;
  if (record.ok === false) return 0;
  return null;
}

/** POST the stored command. Returns true only after a 2xx. Logs the host and status, never the URL or secret. */
export async function notifyCommandWebhook(
  command: OfficeCommand,
  options?: { fetchImpl?: CommandFetch; url?: string | null; secret?: string | null },
) {
  const url = (options?.url ?? "").trim();
  if (!url || !isWebhookUrl(url)) {
    console.error(`Worlds command webhook skipped for ${command.kind} ${command.id}: WORLDS_COMMAND_WEBHOOK_URL is not set.`);
    return false;
  }
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers: { "content-type": string; authorization?: string } = { "content-type": "application/json" };
  const secret = (options?.secret ?? "").trim();
  if (secret) headers.authorization = `Bearer ${secret}`;
  const host = webhookHost(url);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
    });
    const status = responseStatus(response);
    if (status !== null && (status < 200 || status >= 300)) {
      console.error(`Worlds command webhook failed for ${command.kind} ${command.id} (${host}): HTTP ${status}`);
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    console.error(`Worlds command webhook failed for ${command.kind} ${command.id} (${host}): ${message}`);
    return false;
  }
}
