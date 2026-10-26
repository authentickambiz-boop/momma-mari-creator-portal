import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { officeWorldStatus } from "@/db/schema";
import { nowIso, parseJson } from "@/lib/format";
import {
  OFFICE_POLL_MS,
  OFFICE_STATUS_PATH,
  applyOfficeWrite,
  notesForView,
  officeCopyRejection,
  officeStatusDocument,
  parseOfficeSnapshot,
  recordFromStored,
  type OfficeRecord,
} from "./office-state";

export const OFFICE_STATUS_ID = "current";
export { OFFICE_POLL_MS, OFFICE_STATUS_PATH, notesForView, officeStatusDocument };

async function readRow(db: PortalDb) {
  const rows = await db.select().from(officeWorldStatus).where(eq(officeWorldStatus.id, OFFICE_STATUS_ID));
  const row = rows[0] ?? null;
  const record = recordFromStored(parseJson(row?.document, null));
  return { row, record };
}

async function writeRecord(db: PortalDb, row: { id: string } | null, record: OfficeRecord) {
  const updatedAt = nowIso();
  const document = JSON.stringify(record);
  if (row) {
    await db.update(officeWorldStatus).set({ document, updatedAt }).where(eq(officeWorldStatus.id, OFFICE_STATUS_ID));
  } else {
    await db.insert(officeWorldStatus).values({ id: OFFICE_STATUS_ID, document, updatedAt });
  }
  return officeStatusDocument(record, updatedAt);
}

export async function loadOfficeStatus(db: PortalDb) {
  const { row, record } = await readRow(db);
  return officeStatusDocument(record, row?.updatedAt ?? null);
}

export async function loadOfficeRecord(db: PortalDb) {
  const { record } = await readRow(db);
  return record;
}

export async function saveOfficeSnapshot(db: PortalDb, body: unknown) {
  const parsed = parseOfficeSnapshot(body);
  if (!parsed.ok) return parsed;
  const blocked = officeCopyRejection(parsed.value);
  if (blocked) return { ok: false as const, status: 400, error: blocked };
  const { row } = await readRow(db);
  return { ok: true as const, status: 200, body: await writeRecord(db, row, parsed.value) };
}

export async function saveOfficeWrite(db: PortalDb, body: unknown) {
  const { row, record } = await readRow(db);
  const applied = applyOfficeWrite(record, body);
  if (!applied.ok) return applied;
  return { ok: true as const, status: 200, body: await writeRecord(db, row, applied.value) };
}
