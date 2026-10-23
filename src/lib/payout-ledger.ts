import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorFiled1099s, creatorW9s, creators, payoutLedger } from "@/db/schema";
import { isOwner } from "./authz";
import { formatMoney, nowIso } from "./format";
import { receivedDepositIds } from "./brand-deposits";
import { payoutTransfersEnabled } from "./payout-flag";
import { decryptToken, encryptToken, tokenEncryptionConfigured } from "./token-crypto";
import type { Viewer } from "./types";

export { payoutTransfersEnabled };

/** Fees and expenses come off the gross first. The creator keeps 80% of what is left, and the agency keeps 20%. */
export const CREATOR_SHARE_PERCENT = 80;
export const AGENCY_SHARE_PERCENT = 20;

const W9_MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_W9_BYTES = 2_000_000;

export type PayoutLine = {
  id: string;
  creatorId: string;
  creatorName: string;
  dealId: string | null;
  brand: string;
  grossCents: number;
  feeCents: number;
  expenseCents: number;
  netCents: number;
  creatorCents: number;
  agencyCents: number;
  brandPaidOn: string | null;
  payoutOn: string | null;
  weekOf: string | null;
  note: string | null;
  waitingOnBrand: boolean;
  /** True when the brand deposit is received or this line already has a brand payment date. */
  fundsCleared: boolean;
};

export type PayoutWeek = {
  weekOf: string;
  lines: PayoutLine[];
  creatorCents: number;
  agencyCents: number;
};

type Fail = { ok: false; status: number; error: string; code: string };

export function splitAfterDeductions(grossCents: number, feeCents: number, expenseCents: number) {
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    return { ok: false as const, error: "Gross must be more than zero." };
  }
  if (!Number.isInteger(feeCents) || feeCents < 0 || !Number.isInteger(expenseCents) || expenseCents < 0) {
    return { ok: false as const, error: "Fees and expenses must be zero or more." };
  }
  if (feeCents + expenseCents > grossCents) {
    return { ok: false as const, error: "Fees and expenses cannot be more than the gross." };
  }
  const netCents = grossCents - feeCents - expenseCents;
  const agencyCents = Math.round((netCents * AGENCY_SHARE_PERCENT) / 100);
  const creatorCents = netCents - agencyCents;
  return { ok: true as const, netCents, creatorCents, agencyCents };
}

export function weekOf(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function dollarsToCents(value: string, allowZero: boolean) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return allowZero ? { cents: 0 } : { error: "Enter a dollar amount." };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: "Enter a dollar amount." };
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents < 0 || (!allowZero && cents === 0) || cents > 100_000_000) {
    return { error: "Enter a dollar amount." };
  }
  return { cents };
}

function canSeeCreator(viewer: Viewer, creatorId: string) {
  if (isOwner(viewer)) return true;
  return viewer.role === "creator" && viewer.creatorId === creatorId;
}

function toLine(row: typeof payoutLedger.$inferSelect, names: Map<string, string>, fundsCleared: boolean): PayoutLine {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName: names.get(row.creatorId) ?? "Creator",
    dealId: row.dealId,
    brand: row.brand,
    grossCents: row.grossCents,
    feeCents: row.feeCents,
    expenseCents: row.expenseCents,
    netCents: row.creatorCents + row.agencyCents,
    creatorCents: row.creatorCents,
    agencyCents: row.agencyCents,
    brandPaidOn: row.brandPaidOn,
    payoutOn: row.payoutOn,
    weekOf: row.weekOf,
    note: row.note,
    waitingOnBrand: !row.brandPaidOn,
    fundsCleared,
  };
}

async function nameMap(db: PortalDb) {
  const rows = await db.select().from(creators);
  return new Map(rows.map((creator) => [creator.id, creator.name]));
}

export async function listPayoutLedger(db: PortalDb, viewer: Viewer): Promise<{ ok: true; lines: PayoutLine[]; weeks: PayoutWeek[]; waiting: PayoutLine[] } | Fail> {
  if (viewer.role === "manager") return { ok: false, status: 403, error: "Payouts stay with the owner and each creator.", code: "forbidden" };
  const names = await nameMap(db);
  const rows = await db.select().from(payoutLedger);
  const visible = rows.filter((row) => canSeeCreator(viewer, row.creatorId));
  const cleared = await receivedDepositIds(db, visible.map((row) => row.dealId).filter((id): id is string => Boolean(id)));
  const lines = visible
    .map((row) => toLine(row, names, Boolean(row.brandPaidOn) || (row.dealId != null && cleared.has(row.dealId))))
    .sort((left, right) => (right.payoutOn ?? right.brandPaidOn ?? "").localeCompare(left.payoutOn ?? left.brandPaidOn ?? ""));
  const waiting = lines.filter((line) => !line.payoutOn);
  const grouped = new Map<string, PayoutLine[]>();
  for (const line of lines) {
    if (!line.payoutOn || !line.weekOf) continue;
    const bucket = grouped.get(line.weekOf) ?? [];
    bucket.push(line);
    grouped.set(line.weekOf, bucket);
  }
  const weeks = [...grouped.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([week, weekLines]) => ({
      weekOf: week,
      lines: weekLines,
      creatorCents: weekLines.reduce((sum, line) => sum + line.creatorCents, 0),
      agencyCents: weekLines.reduce((sum, line) => sum + line.agencyCents, 0),
    }));
  return { ok: true, lines, weeks, waiting };
}

export async function recordPayoutLine(
  db: PortalDb,
  viewer: Viewer,
  input: {
    creatorId: string;
    dealId?: string | null;
    brand: string;
    grossCents: number;
    feeCents: number;
    expenseCents: number;
    brandPaidOn?: string | null;
    note?: string | null;
  },
): Promise<{ ok: true; id: string } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can add a payout line.", code: "forbidden" };
  const brand = input.brand.trim();
  if (!brand) return { ok: false, status: 400, error: "A brand name is required.", code: "brand" };
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "Creator not found.", code: "missing" };
  const split = splitAfterDeductions(input.grossCents, input.feeCents, input.expenseCents);
  if (!split.ok) return { ok: false, status: 400, error: split.error, code: "amount" };
  const brandPaidOn = cleanDate(input.brandPaidOn);
  if (input.brandPaidOn?.trim() && !brandPaidOn) return { ok: false, status: 400, error: "Use a YYYY-MM-DD date.", code: "date" };
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await db.insert(payoutLedger).values({
    id,
    creatorId: input.creatorId,
    dealId: input.dealId?.trim() || null,
    brand,
    grossCents: input.grossCents,
    feeCents: input.feeCents,
    expenseCents: input.expenseCents,
    creatorCents: split.creatorCents,
    agencyCents: split.agencyCents,
    brandPaidOn,
    payoutOn: null,
    weekOf: null,
    note: input.note?.trim() ? input.note.trim().slice(0, 240) : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { ok: true, id };
}

function cleanDate(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export async function markBrandPaid(db: PortalDb, viewer: Viewer, lineId: string, brandPaidOn: string): Promise<{ ok: true } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can mark a brand paid.", code: "forbidden" };
  const date = cleanDate(brandPaidOn);
  if (!date) return { ok: false, status: 400, error: "Use a YYYY-MM-DD date.", code: "date" };
  const rows = await db.select().from(payoutLedger).where(eq(payoutLedger.id, lineId));
  const line = rows[0];
  if (!line) return { ok: false, status: 404, error: "Payout line not found.", code: "missing" };
  await db.update(payoutLedger).set({ brandPaidOn: date, updatedAt: nowIso() }).where(eq(payoutLedger.id, line.id));
  return { ok: true };
}

/** Records the week the creator was paid. Refuses until the brand has paid. Does not move money. */
export async function markCreatorPaid(db: PortalDb, viewer: Viewer, lineId: string, payoutOn: string): Promise<
  { ok: true; transferred: false; transfersEnabled: boolean } | Fail
> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can mark a creator paid.", code: "forbidden" };
  const date = cleanDate(payoutOn);
  if (!date) return { ok: false, status: 400, error: "Use a YYYY-MM-DD date.", code: "date" };
  const rows = await db.select().from(payoutLedger).where(eq(payoutLedger.id, lineId));
  const line = rows[0];
  if (!line) return { ok: false, status: 404, error: "Payout line not found.", code: "missing" };
  if (!line.brandPaidOn) return { ok: false, status: 400, error: "The brand has to pay before the creator is paid.", code: "brand" };
  await db.update(payoutLedger).set({
    payoutOn: date,
    weekOf: weekOf(date),
    updatedAt: nowIso(),
  }).where(eq(payoutLedger.id, line.id));
  return { ok: true, transferred: false, transfersEnabled: payoutTransfersEnabled() };
}

export type TaxTotal = {
  creatorId: string;
  creatorName: string;
  year: number;
  creatorCents: number;
  grossCents: number;
  feeCents: number;
  expenseCents: number;
  agencyCents: number;
};

export async function form1099Totals(db: PortalDb, viewer: Viewer, year: number): Promise<{ ok: true; totals: TaxTotal[] } | Fail> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, status: 400, error: "Pick a four-digit year.", code: "year" };
  }
  if (viewer.role === "manager") return { ok: false, status: 403, error: "Tax totals stay with the owner and each creator.", code: "forbidden" };
  const names = await nameMap(db);
  const rows = await db.select().from(payoutLedger);
  const buckets = new Map<string, TaxTotal>();
  for (const row of rows) {
    if (!canSeeCreator(viewer, row.creatorId)) continue;
    if (!row.payoutOn?.startsWith(String(year))) continue;
    const current = buckets.get(row.creatorId) ?? {
      creatorId: row.creatorId,
      creatorName: names.get(row.creatorId) ?? "Creator",
      year,
      creatorCents: 0,
      grossCents: 0,
      feeCents: 0,
      expenseCents: 0,
      agencyCents: 0,
    };
    current.creatorCents += row.creatorCents;
    current.grossCents += row.grossCents;
    current.feeCents += row.feeCents;
    current.expenseCents += row.expenseCents;
    current.agencyCents += row.agencyCents;
    buckets.set(row.creatorId, current);
  }
  return { ok: true, totals: [...buckets.values()].sort((left, right) => left.creatorName.localeCompare(right.creatorName)) };
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function payoutCsv(db: PortalDb, viewer: Viewer, year: number): Promise<{ ok: true; csv: string; filename: string } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "The CPA export stays with the owner.", code: "forbidden" };
  const totals = await form1099Totals(db, viewer, year);
  if (!totals.ok) return totals;
  const names = await nameMap(db);
  const emails = new Map((await db.select().from(creators)).map((creator) => [creator.id, creator.email]));
  const rows = await db.select().from(payoutLedger);
  const header = ["Creator", "Email", "Year", "Brand", "Gross", "Fees", "Expenses", "Net", "Creator share", "Agency share", "Brand paid", "Creator paid", "Week", "In 1099"];
  const lines = [header.join(",")];
  for (const row of rows.filter((item) => item.payoutOn?.startsWith(String(year))).sort((left, right) => (left.payoutOn ?? "").localeCompare(right.payoutOn ?? ""))) {
    lines.push([
      names.get(row.creatorId) ?? "Creator",
      emails.get(row.creatorId) ?? "",
      year,
      row.brand,
      dollars(row.grossCents),
      dollars(row.feeCents),
      dollars(row.expenseCents),
      dollars(row.creatorCents + row.agencyCents),
      dollars(row.creatorCents),
      dollars(row.agencyCents),
      row.brandPaidOn,
      row.payoutOn,
      row.weekOf,
      "yes",
    ].map(csvCell).join(","));
  }
  for (const total of totals.totals) {
    lines.push([
      total.creatorName,
      emails.get(total.creatorId) ?? "",
      year,
      "YEAR TOTAL",
      dollars(total.grossCents),
      dollars(total.feeCents),
      dollars(total.expenseCents),
      dollars(total.creatorCents + total.agencyCents),
      dollars(total.creatorCents),
      dollars(total.agencyCents),
      "",
      "",
      "",
      "yes",
    ].map(csvCell).join(","));
  }
  return { ok: true, csv: `${lines.join("\n")}\n`, filename: `momma-mari-payouts-${year}.csv` };
}

function safeFilename(name: string) {
  const base = name.split(/[/\\]/).pop()?.replace(/[^\w.\- ]+/g, "") ?? "";
  return base.slice(0, 120);
}

export async function storeCreatorW9(
  db: PortalDb,
  viewer: Viewer,
  input: { creatorId: string; filename: string; mimeType: string; bytes: Uint8Array },
): Promise<{ ok: true; id: string } | Fail> {
  if (!canSeeCreator(viewer, input.creatorId)) {
    return { ok: false, status: 403, error: "A W-9 stays with that creator and the owner.", code: "forbidden" };
  }
  if (viewer.role === "manager") return { ok: false, status: 403, error: "A W-9 stays with that creator and the owner.", code: "forbidden" };
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "Creator not found.", code: "missing" };
  if (!W9_MIMES.has(input.mimeType)) return { ok: false, status: 400, error: "Upload a PDF or a photo.", code: "file" };
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_W9_BYTES) {
    return { ok: false, status: 400, error: "That file is empty or too large.", code: "file" };
  }
  const filename = safeFilename(input.filename);
  if (!filename) return { ok: false, status: 400, error: "That file needs a name.", code: "file" };
  if (!tokenEncryptionConfigured()) return { ok: false, status: 503, error: "File storage is not ready.", code: "key" };
  let binary = "";
  for (const byte of input.bytes) binary += String.fromCharCode(byte);
  const ciphertext = await encryptToken(btoa(binary));
  const id = crypto.randomUUID();
  await db.insert(creatorW9s).values({
    id,
    creatorId: input.creatorId,
    filename,
    mimeType: input.mimeType,
    ciphertext,
    byteLength: input.bytes.byteLength,
    uploadedBy: viewer.email,
    createdAt: nowIso(),
  });
  return { ok: true, id };
}

export async function listCreatorW9s(db: PortalDb, viewer: Viewer, creatorId?: string | null) {
  if (viewer.role === "manager") return { ok: false as const, status: 403, error: "A W-9 stays with that creator and the owner.", code: "forbidden" };
  const target = viewer.role === "creator" ? viewer.creatorId : creatorId ?? null;
  if (viewer.role === "creator" && !target) return { ok: false as const, status: 403, error: "A W-9 stays with that creator and the owner.", code: "forbidden" };
  const rows = await db.select().from(creatorW9s);
  const files = rows
    .filter((row) => (target ? row.creatorId === target : true))
    .filter((row) => canSeeCreator(viewer, row.creatorId))
    .map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      filename: row.filename,
      mimeType: row.mimeType,
      byteLength: row.byteLength,
      createdAt: row.createdAt,
    }));
  return { ok: true as const, files };
}

export async function readCreatorW9(db: PortalDb, viewer: Viewer, id: string): Promise<
  { ok: true; filename: string; mimeType: string; bytes: Uint8Array } | Fail
> {
  const rows = await db.select().from(creatorW9s).where(eq(creatorW9s.id, id));
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "W-9 not found.", code: "missing" };
  if (!canSeeCreator(viewer, row.creatorId) || viewer.role === "manager") {
    return { ok: false, status: 403, error: "A W-9 stays with that creator and the owner.", code: "forbidden" };
  }
  try {
    const plain = await decryptToken(row.ciphertext);
    const binary = atob(plain);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { ok: true, filename: row.filename, mimeType: row.mimeType, bytes };
  } catch {
    return { ok: false, status: 500, error: "That file could not be opened.", code: "key" };
  }
}

export function moneyLabel(cents: number) {
  return formatMoney(cents);
}

const MAX_1099_BYTES = 2_000_000;

function isPdf(bytes: Uint8Array) {
  return bytes.byteLength >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function validTaxYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

/** Stores a filed 1099-NEC the owner already has. This does not fill out or generate a form. */
export async function storeFiled1099(
  db: PortalDb,
  viewer: Viewer,
  input: { creatorId: string; year: number; filename: string; mimeType: string; bytes: Uint8Array },
): Promise<{ ok: true; id: string } | Fail> {
  if (!isOwner(viewer)) return { ok: false, status: 403, error: "Only the owner can store a filed 1099.", code: "forbidden" };
  if (!validTaxYear(input.year)) return { ok: false, status: 400, error: "Pick a four-digit year.", code: "year" };
  const people = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!people[0]) return { ok: false, status: 404, error: "Creator not found.", code: "missing" };
  if (input.mimeType !== "application/pdf" || !isPdf(input.bytes)) {
    return { ok: false, status: 400, error: "Upload the filed 1099-NEC as a PDF.", code: "pdf" };
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_1099_BYTES) {
    return { ok: false, status: 400, error: "That PDF is empty or too large.", code: "pdf" };
  }
  const filename = safeFilename(input.filename);
  if (!filename) return { ok: false, status: 400, error: "That file needs a name.", code: "pdf" };
  if (!tokenEncryptionConfigured()) return { ok: false, status: 503, error: "File storage is not ready.", code: "key" };
  const ciphertext = await encryptToken(bytesToBase64(input.bytes));
  const id = crypto.randomUUID();
  await db.insert(creatorFiled1099s).values({
    id,
    creatorId: input.creatorId,
    taxYear: input.year,
    filename,
    mimeType: "application/pdf",
    ciphertext,
    byteLength: input.bytes.byteLength,
    uploadedBy: viewer.email,
    createdAt: nowIso(),
  });
  return { ok: true, id };
}

export async function listFiled1099s(db: PortalDb, viewer: Viewer, year?: number | null) {
  if (viewer.role === "manager") return { ok: false as const, status: 403, error: "A filed 1099 stays with that creator and the owner.", code: "forbidden" };
  if (year != null && !validTaxYear(year)) return { ok: false as const, status: 400, error: "Pick a four-digit year.", code: "year" };
  const names = await nameMap(db);
  const rows = await db.select().from(creatorFiled1099s);
  const files = rows
    .filter((row) => canSeeCreator(viewer, row.creatorId))
    .filter((row) => year == null || row.taxYear === year)
    .map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      creatorName: names.get(row.creatorId) ?? "Creator",
      year: row.taxYear,
      filename: row.filename,
      byteLength: row.byteLength,
      createdAt: row.createdAt,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.creatorName.localeCompare(right.creatorName));
  return { ok: true as const, files };
}

export async function readFiled1099(db: PortalDb, viewer: Viewer, id: string): Promise<
  { ok: true; filename: string; mimeType: string; bytes: Uint8Array } | Fail
> {
  const rows = await db.select().from(creatorFiled1099s).where(eq(creatorFiled1099s.id, id));
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "That 1099 was not found.", code: "missing" };
  if (!canSeeCreator(viewer, row.creatorId) || viewer.role === "manager") {
    return { ok: false, status: 403, error: "A filed 1099 stays with that creator and the owner.", code: "forbidden" };
  }
  try {
    const bytes = base64ToBytes(await decryptToken(row.ciphertext));
    return { ok: true, filename: row.filename, mimeType: row.mimeType, bytes };
  } catch {
    return { ok: false, status: 500, error: "That file could not be opened.", code: "key" };
  }
}

/** Paid lines for a year. A bookkeeping summary, not a tax form. */
export async function yearlySummaryCsv(db: PortalDb, viewer: Viewer, year: number): Promise<{ ok: true; csv: string; filename: string } | Fail> {
  if (!validTaxYear(year)) return { ok: false, status: 400, error: "Pick a four-digit year.", code: "year" };
  if (viewer.role !== "admin" && viewer.role !== "creator") {
    return { ok: false, status: 403, error: "A yearly summary stays with the owner and each creator.", code: "forbidden" };
  }
  if (viewer.role === "creator" && !viewer.creatorId) {
    return { ok: false, status: 403, error: "A yearly summary stays with the owner and each creator.", code: "forbidden" };
  }
  const names = await nameMap(db);
  const emails = new Map((await db.select().from(creators)).map((creator) => [creator.id, creator.email]));
  const rows = await db.select().from(payoutLedger);
  const header = ["Creator", "Email", "Year", "Brand", "Gross", "Fees", "Expenses", "Net", "Creator share", "Agency share", "Brand paid", "Creator paid", "Week", "Notice"];
  const lines = ["Not a tax form. This is a summary of paid lines.", header.join(",")];
  const paid = rows
    .filter((row) => canSeeCreator(viewer, row.creatorId) && row.payoutOn?.startsWith(String(year)))
    .sort((left, right) => (left.payoutOn ?? "").localeCompare(right.payoutOn ?? ""));
  for (const row of paid) {
    lines.push([
      names.get(row.creatorId) ?? "Creator",
      emails.get(row.creatorId) ?? "",
      year,
      row.brand,
      dollars(row.grossCents),
      dollars(row.feeCents),
      dollars(row.expenseCents),
      dollars(row.creatorCents + row.agencyCents),
      dollars(row.creatorCents),
      dollars(row.agencyCents),
      row.brandPaidOn,
      row.payoutOn,
      row.weekOf,
      "Not a tax form",
    ].map(csvCell).join(","));
  }
  return { ok: true, csv: `${lines.join("\n")}\n`, filename: `momma-mari-yearly-summary-${year}.csv` };
}
