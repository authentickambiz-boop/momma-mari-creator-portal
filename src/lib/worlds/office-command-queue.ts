import { asc, desc, eq, inArray } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { officeWorldCommands } from "@/db/schema";
import { nowIso, parseJson } from "@/lib/format";
import { containsPrivateOfficeDetail } from "./office-catalog";
import {
  APPROVAL_PHRASE,
  COMMAND_STATUSES,
  commandTouchesSensitive,
  notifyCommandWebhook,
  parseOfficeCommand,
  PENDING_COMMAND_STATUSES,
  nextCommandState,
  type CommandFetch,
  type CommandStatus,
  type OfficeCommand,
} from "./office-commands";
import { refuseWorldsPayment } from "./office-payments";
import { loadOfficeRecord } from "./office-status";

type CommandRow = typeof officeWorldCommands.$inferSelect;

function touchesSensitiveText(command: { body: string; topic: string | null; due: string | null }) {
  return [command.body, command.topic, command.due].some((value) => Boolean(value) && commandTouchesSensitive(value ?? ""));
}

function rowToCommand(row: CommandRow): OfficeCommand {
  const parsed = parseJson<unknown>(row.botIds, []);
  const botIds = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  return {
    id: row.id,
    kind: row.kind as OfficeCommand["kind"],
    status: row.status as CommandStatus,
    botIds,
    office: (row.office as OfficeCommand["office"]) ?? null,
    noteId: row.noteId,
    todoId: row.todoId,
    decision: row.decision === "approve" || row.decision === "hold" ? row.decision : null,
    topic: row.topic,
    body: row.body,
    due: row.due,
    impactDollars: row.impactDollars,
    result: row.result,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function enqueueOfficeCommand(
  db: PortalDb,
  body: unknown,
  options?: { fetchImpl?: CommandFetch; webhookUrl?: string | null; webhookSecret?: string | null },
) {
  const record = await loadOfficeRecord(db);
  const parsed = parseOfficeCommand(body, record);
  if (!parsed.ok) return { ...parsed, charged: false as const };
  const now = nowIso();
  const command: OfficeCommand = {
    ...parsed.value,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(officeWorldCommands).values({
    id: command.id,
    kind: command.kind,
    status: command.status,
    botIds: JSON.stringify(command.botIds),
    office: command.office,
    noteId: command.noteId,
    todoId: command.todoId,
    decision: command.decision,
    topic: command.topic,
    body: command.body,
    due: command.due,
    impactDollars: command.impactDollars,
    result: command.result,
    createdAt: command.createdAt,
    updatedAt: command.updatedAt,
  });
  const sensitive = command.status === "needs_approval" || touchesSensitiveText(command);
  const refusal = sensitive ? refuseWorldsPayment() : null;
  const webhookSent = command.status === "needs_approval"
    ? false
    : await notifyCommandWebhook(command, {
      fetchImpl: options?.fetchImpl,
      url: options && "webhookUrl" in options ? options.webhookUrl : process.env.WORLDS_COMMAND_WEBHOOK_URL,
      secret: options && "webhookSecret" in options ? options.webhookSecret : process.env.WORLDS_COMMAND_WEBHOOK_SECRET,
    });
  return {
    ok: true as const,
    status: 201,
    charged: false as const,
    body: { command, webhookSent, charged: refusal ? refusal.charged : false },
  };
}

export async function listPendingCommands(db: PortalDb) {
  const rows = await db
    .select()
    .from(officeWorldCommands)
    .where(inArray(officeWorldCommands.status, PENDING_COMMAND_STATUSES))
    .orderBy(asc(officeWorldCommands.createdAt));
  return rows.map(rowToCommand);
}

export async function listRecentCommands(db: PortalDb, limit = 40) {
  const rows = await db
    .select()
    .from(officeWorldCommands)
    .orderBy(desc(officeWorldCommands.updatedAt))
    .limit(limit);
  return rows.map(rowToCommand);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function updateOfficeCommand(db: PortalDb, body: unknown) {
  if (!isRecord(body)) return { ok: false as const, status: 400, error: "Expected a JSON object." };
  if (typeof body.id !== "string" || !body.id.trim()) return { ok: false as const, status: 400, error: "id must be text." };
  if (typeof body.status !== "string" || !COMMAND_STATUSES.includes(body.status as CommandStatus)) {
    return { ok: false as const, status: 400, error: "status is not a command status." };
  }
  let result: string | null = null;
  if (body.result !== undefined && body.result !== null) {
    if (typeof body.result !== "string") return { ok: false as const, status: 400, error: "result must be text." };
    const trimmed = body.result.trim();
    if (trimmed.length > 500) return { ok: false as const, status: 400, error: "result is too long." };
    if (containsPrivateOfficeDetail(trimmed)) {
      return { ok: false as const, status: 400, error: "result includes a private detail. Leave it out of the office." };
    }
    result = trimmed || null;
  }
  const rows = await db.select().from(officeWorldCommands).where(eq(officeWorldCommands.id, body.id.trim()));
  const row = rows[0];
  if (!row) return { ok: false as const, status: 404, error: "Command not found." };
  const current = rowToCommand(row);
  const requested = body.status as CommandStatus;
  if (requested !== current.status && touchesSensitiveText(current)) {
    return refuseWorldsPayment();
  }
  const next = nextCommandState(current.status, requested, result);
  if (!next.ok) return next;
  const updatedAt = nowIso();
  await db
    .update(officeWorldCommands)
    .set({ status: next.value.status, result: next.value.result, updatedAt })
    .where(eq(officeWorldCommands.id, current.id));
  return {
    ok: true as const,
    status: 200,
    body: { command: { ...current, status: next.value.status, result: next.value.result, updatedAt } },
  };
}

export { APPROVAL_PHRASE };
