import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorIntake, creatorPlatforms, intakeFiles } from "@/db/schema";
import type { Viewer } from "./types";

/** Keys stripped from every non-admin and bot payload. Mirrors deal redaction. */
export const INTAKE_PRIVATE_KEYS = [
  "currentRates",
  "current_rates",
  "rates",
  "minRates",
  "minDealCents",
  "minimumPerVideoCents",
  "platformMinimums",
  "typicalRateCents",
  "typicalRate",
  "internalQuoteCents",
  "internalQuote",
  "quoteCents",
  "quote",
] as const;

export type IntakePlatformView = {
  id: string;
  platform: string;
  handle: string;
  url: string | null;
  followers: number | null;
  avgViews: number | null;
  capturedAt: string | null;
  source: string;
};

export type IntakeFileView = {
  id: string;
  platformId: string | null;
  filename: string;
  contentType: string;
  byteLength: number;
  storageKey: string;
  createdAt: string;
};

export type IntakeView = {
  id: string;
  applicationId: string | null;
  creatorId: string | null;
  legalName: string | null;
  preferredName: string | null;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  addressState: string | null;
  zip: string | null;
  country: string | null;
  stateOfResidence: string | null;
  niches: string[];
  goals: string[];
  goalsText: string | null;
  kidsInContent: boolean | null;
  kidsCount: number | null;
  kidsAges: string | null;
  familyNotes: string | null;
  analyticsMode: string | null;
  consent: Record<string, unknown>;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  platforms: IntakePlatformView[];
  files: IntakeFileView[];
  currentRates?: string | null;
};

function parseStringList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseConsent(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isPrivateKey(key: string) {
  return (INTAKE_PRIVATE_KEYS as readonly string[]).includes(key);
}

/** Bot and public payloads drop private rate keys at every nesting level. */
export function redactIntakeForBot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactIntakeForBot(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isPrivateKey(key)) continue;
    out[key] = redactIntakeForBot(item);
  }
  return out;
}

function toView(
  row: typeof creatorIntake.$inferSelect,
  platforms: IntakePlatformView[],
  files: IntakeFileView[],
  role: string,
): IntakeView {
  const view: IntakeView = {
    id: row.id,
    applicationId: row.applicationId,
    creatorId: row.creatorId,
    legalName: row.legalName,
    preferredName: row.preferredName,
    email: row.email,
    phone: row.phone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    addressState: row.addressState,
    zip: row.zip,
    country: row.country,
    stateOfResidence: row.stateOfResidence,
    niches: parseStringList(row.nichesJson),
    goals: parseStringList(row.goalsJson),
    goalsText: row.goalsText,
    kidsInContent: row.kidsInContent,
    kidsCount: row.kidsCount,
    kidsAges: row.kidsAges,
    familyNotes: row.familyNotes,
    analyticsMode: row.analyticsMode,
    consent: parseConsent(row.consentJson),
    status: row.status,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    platforms,
    files,
  };
  if (role === "admin") view.currentRates = row.currentRates;
  return view;
}

async function attachmentsFor(db: PortalDb, intakeIds: string[]) {
  if (intakeIds.length === 0) return { platforms: [], files: [] };
  const idSet = new Set(intakeIds);
  const platforms = (await db.select().from(creatorPlatforms)).filter((row) => idSet.has(row.intakeId));
  const files = (await db.select().from(intakeFiles)).filter((row) => idSet.has(row.intakeId));
  return { platforms, files };
}

export async function listCreatorIntake(db: PortalDb, viewer: Viewer) {
  const rows = await db.select().from(creatorIntake);
  const { platforms, files } = await attachmentsFor(db, rows.map((row) => row.id));
  return rows.map((row) => toView(
    row,
    platforms.filter((item) => item.intakeId === row.id).map((item) => ({
      id: item.id,
      platform: item.platform,
      handle: item.handle,
      url: item.url,
      followers: item.followers,
      avgViews: item.avgViews,
      capturedAt: item.capturedAt,
      source: item.source,
    })),
    files.filter((item) => item.intakeId === row.id).map((item) => ({
      id: item.id,
      platformId: item.platformId,
      filename: item.filename,
      contentType: item.contentType,
      byteLength: item.byteLength,
      storageKey: item.storageKey,
      createdAt: item.createdAt,
    })),
    viewer.role,
  ));
}

export async function getCreatorIntake(db: PortalDb, viewer: Viewer, id: string) {
  const rows = await listCreatorIntake(db, viewer);
  return rows.find((row) => row.id === id) ?? null;
}

/** Bot list. Private rates are removed even when the caller passes them in. */
export async function listBotIntake(db: PortalDb) {
  const rows = await db.select().from(creatorIntake);
  const { platforms, files } = await attachmentsFor(db, rows.map((row) => row.id));
  const payload = rows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    creatorId: row.creatorId,
    legalName: row.legalName,
    preferredName: row.preferredName,
    email: row.email,
    phone: row.phone,
    stateOfResidence: row.stateOfResidence,
    nichesJson: row.nichesJson,
    goalsJson: row.goalsJson,
    goalsText: row.goalsText,
    currentRates: row.currentRates,
    current_rates: row.currentRates,
    analyticsMode: row.analyticsMode,
    status: row.status,
    submittedAt: row.submittedAt,
    platforms: platforms.filter((item) => item.intakeId === row.id).map((item) => ({
      id: item.id,
      platform: item.platform,
      handle: item.handle,
      followers: item.followers,
      avgViews: item.avgViews,
      source: item.source,
    })),
    files: files.filter((item) => item.intakeId === row.id).map((item) => ({
      id: item.id,
      filename: item.filename,
      contentType: item.contentType,
    })),
  }));
  return redactIntakeForBot(payload);
}

export async function intakeRowById(db: PortalDb, id: string) {
  const rows = await db.select().from(creatorIntake).where(eq(creatorIntake.id, id));
  return rows[0] ?? null;
}
