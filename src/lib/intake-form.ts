import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorApplicationAttempts, creatorApplications, creatorIntake, creatorPlatforms, creators, intakeFiles } from "@/db/schema";
import { adminEmails } from "./authz";
import { joinBench } from "./bench";
import { APPLY_EMAIL_LIMIT_ERROR, APPLY_IP_LIMIT_ERROR } from "./creator-apply";
import { redactIntakeForBot, type IntakeView } from "./creator-intake";
import { normalizeEmail, nowIso, safeEqual } from "./format";
import { notifyStaff } from "./managers";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "./niche-catalog";
import { AGE_RANGES, US_STATES } from "./profile-shared";
import { curriculumBand, signingRoute, type CurriculumBandId } from "./signing-thresholds";

export const INTAKE_STEPS = ["contact", "address", "platforms", "niche", "family", "rates", "analytics"] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

export const INTAKE_GOALS = [
  "Brand deals",
  "See all of my deals in one place",
  "A manager to take the weight off",
  "Grow my audience",
] as const;

export const SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;
export const SCREENSHOTS_PER_PLATFORM = 2;

const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;
const IP_LIMIT = 8;

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DC: "District of Columbia", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota",
  MO: "Missouri", MS: "Mississippi", MT: "Montana", NC: "North Carolina", ND: "North Dakota",
  NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada",
  NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia",
  VT: "Vermont", WA: "Washington", WI: "Wisconsin", WV: "West Virginia", WY: "Wyoming",
};

const DOB_LIKE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\bdob\b|\bbirthday\b|\bdate of birth\b/i;

export const INTAKE_ERRORS = {
  contact: "Add your legal name and email.",
  phone: "Enter a 10-digit US phone number.",
  address: "Add a mailing street, city, state, and country.",
  zip: "Enter a 5-digit US ZIP code.",
  state: "Choose a US state.",
  platforms: "Add at least one platform, handle, and follower count.",
  followers: "Enter a follower count as a whole number.",
  niche: "Choose at least one niche from the list.",
  goals: "Choose at least one goal.",
  family: "Say whether kids appear in your content.",
  ages: "Use age ranges only. Do not add names or birthdays.",
  rates: "Add your current rates. Only Kamron sees this.",
  analytics: "Choose connect or screenshots.",
  files: "Upload at least 2 screenshots for each platform.",
  size: "Screenshots must be 10 MB or smaller.",
  type: "Screenshots must be JPEG, PNG, WEBP, or GIF.",
  email: "Use a real email address.",
  roster: "That email is already on the roster. Sign in and complete your profile.",
  waiting: "That application is already waiting.",
  resume: "That resume link is not valid.",
  limitEmail: APPLY_EMAIL_LIMIT_ERROR,
  limitIp: APPLY_IP_LIMIT_ERROR,
  saved: "That was not saved. Nothing was emailed.",
} as const;

export function intakeErrorCode(error: string) {
  const entry = Object.entries(INTAKE_ERRORS).find(([, message]) => message === error);
  return entry ? entry[0] : "saved";
}

export function intakeFormNote(code: string | undefined) {
  if (!code) return null;
  if (code in INTAKE_ERRORS) return INTAKE_ERRORS[code as keyof typeof INTAKE_ERRORS];
  return INTAKE_ERRORS.saved;
}

export type PlatformDraft = {
  platform: string;
  handle: string;
  url: string;
  followers: string;
  avgViews: string;
};

export type ScreenshotDraft = {
  platformIndex: number;
  filename: string;
  contentType: string;
  byteLength: number;
};

export type IntakeSubmission = {
  legalName: string;
  preferredName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  addressState: string;
  zip: string;
  country: string;
  stateOfResidence: string;
  platforms: PlatformDraft[];
  niches: string[];
  goals: string[];
  goalsText: string;
  kidsInContent: "yes" | "no" | "";
  kidsCount: string;
  kidsAges: string[];
  familyNotes: string;
  currentRates: string;
  analyticsMode: string;
  files: ScreenshotDraft[];
  consentAccuracy: boolean;
};

export type NormalizedIntake = Omit<IntakeSubmission, "phone" | "addressState" | "zip" | "country" | "stateOfResidence" | "platforms" | "kidsInContent" | "kidsCount" | "analyticsMode"> & {
  phone: string;
  addressState: string;
  zip: string;
  country: string;
  stateOfResidence: string;
  platforms: { platform: string; handle: string; url: string; followers: number; avgViews: number | null; slot: number }[];
  kidsInContent: boolean;
  kidsCount: number | null;
  kidsAges: string[];
  analyticsMode: "connect" | "screenshots";
  maxFollowers: number;
  route: "sign" | "curriculum";
  band: CurriculumBandId | null;
};

export function isIntakeStep(value: string | undefined): value is IntakeStep {
  return Boolean(value && (INTAKE_STEPS as readonly string[]).includes(value));
}

export function nextIntakeStep(step: IntakeStep) {
  const index = INTAKE_STEPS.indexOf(step);
  return INTAKE_STEPS[Math.min(index + 1, INTAKE_STEPS.length - 1)];
}

export function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{9}$/.test(national)) return null;
  return national;
}

export function normalizeUsZip(value: string) {
  const match = value.trim().match(/^(\d{5})(?:-(\d{4}))?$/);
  if (!match) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

export function normalizeUsState(value: string) {
  const trimmed = value.trim().replace(/\./g, "");
  const upper = trimmed.toUpperCase();
  if ((US_STATES as readonly string[]).includes(upper)) return upper;
  const lower = trimmed.toLowerCase();
  const found = Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === lower);
  return found ? found[0] : null;
}

export function parseWholeNumber(value: string) {
  const trimmed = value.trim().replace(/,/g, "");
  if (!/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  if (!Number.isSafeInteger(count)) return null;
  return count;
}

export function validateScreenshot(file: { contentType: string; byteLength: number }) {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.contentType)) return INTAKE_ERRORS.type;
  if (!Number.isInteger(file.byteLength) || file.byteLength <= 0 || file.byteLength > SCREENSHOT_MAX_BYTES) return INTAKE_ERRORS.size;
  return null;
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function blockedEmail(email: string) {
  return !email.includes("@") || email.endsWith(".invalid") || adminEmails().includes(email);
}

function secret() {
  const value = process.env.SESSION_SECRET ?? "";
  return value.length >= 16 ? value : null;
}

export function signIntakeToken(id: string, email: string) {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ id, email: normalizeEmail(email) })).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readIntakeToken(token: string) {
  const key = secret();
  if (!key) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || token.split(".").length !== 2) return null;
  const expected = createHmac("sha256", key).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: unknown; email?: unknown };
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string") return null;
    return { id: parsed.id, email: normalizeEmail(parsed.email) };
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Public and creator-visible summary. Private rates are removed before any text is built. */
export function creatorVisibleIntakeHtml(view: IntakeView) {
  const safe = redactIntakeForBot(view) as IntakeView;
  const lines = [
    safe.legalName ?? "",
    safe.preferredName ?? "",
    safe.email,
    safe.phone ?? "",
    [safe.addressLine1, safe.city, safe.addressState, safe.zip].filter(Boolean).join(", "),
    safe.stateOfResidence ? `State of residence ${safe.stateOfResidence}` : "",
    ...(safe.platforms ?? []).map((row) => `${row.platform} ${row.handle} ${row.followers ?? 0}`),
    (safe.niches ?? []).join(", "),
    (safe.goals ?? []).join(", "),
    safe.goalsText ?? "",
    safe.kidsInContent ? "Kids appear in content" : "Kids do not appear in content",
    safe.kidsAges ?? "",
    safe.analyticsMode ?? "",
  ].map((line) => line.trim()).filter(Boolean);
  return `<article class="intake-summary">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</article>`;
}

export function validateIntake(input: IntakeSubmission): { ok: true; value: NormalizedIntake } | { ok: false; error: string } {
  const legalName = clip(input.legalName, 120);
  const email = normalizeEmail(input.email).slice(0, 120);
  if (!legalName || blockedEmail(email)) return { ok: false, error: INTAKE_ERRORS.contact };
  const phone = normalizeUsPhone(input.phone);
  if (!phone) return { ok: false, error: INTAKE_ERRORS.phone };
  const addressLine1 = clip(input.addressLine1, 120);
  const city = clip(input.city, 80);
  const countryRaw = clip(input.country, 80).toLowerCase();
  const country = countryRaw === "us" || countryRaw === "usa" || countryRaw === "united states" ? "United States" : "";
  if (!addressLine1 || !city || !country) return { ok: false, error: INTAKE_ERRORS.address };
  const addressState = normalizeUsState(input.addressState);
  const stateOfResidence = normalizeUsState(input.stateOfResidence);
  if (!addressState || !stateOfResidence) return { ok: false, error: INTAKE_ERRORS.state };
  const zip = normalizeUsZip(input.zip);
  if (!zip) return { ok: false, error: INTAKE_ERRORS.zip };

  const platforms: NormalizedIntake["platforms"] = [];
  for (let index = 0; index < input.platforms.length; index += 1) {
    const row = input.platforms[index];
    const platform = row.platform.trim();
    const handle = clip(row.handle, 80);
    const url = clip(row.url, 200);
    const followersRaw = row.followers.trim();
    const viewsRaw = row.avgViews.trim();
    if (!platform && !handle && !followersRaw && !url && !viewsRaw) continue;
    if (!(PLATFORM_OPTIONS as readonly string[]).includes(platform) || !handle) return { ok: false, error: INTAKE_ERRORS.platforms };
    if (url && !/^https?:\/\//i.test(url)) return { ok: false, error: INTAKE_ERRORS.platforms };
    const followers = parseWholeNumber(followersRaw);
    if (followers == null) return { ok: false, error: INTAKE_ERRORS.followers };
    const avgViews = viewsRaw ? parseWholeNumber(viewsRaw) : null;
    if (viewsRaw && avgViews == null) return { ok: false, error: INTAKE_ERRORS.followers };
    platforms.push({ platform, handle, url, followers, avgViews, slot: index });
  }
  if (platforms.length === 0) return { ok: false, error: INTAKE_ERRORS.platforms };

  const niches = [...new Set(input.niches.map((item) => item.trim()).filter(Boolean))];
  if (niches.length === 0 || niches.some((item) => !NICHE_CATALOG.includes(item))) return { ok: false, error: INTAKE_ERRORS.niche };
  const goals = [...new Set(input.goals.map((item) => item.trim()).filter(Boolean))];
  if (goals.length === 0 || goals.some((item) => !(INTAKE_GOALS as readonly string[]).includes(item))) return { ok: false, error: INTAKE_ERRORS.goals };
  const goalsText = clip(input.goalsText, 1000);
  if (goalsText && DOB_LIKE.test(goalsText)) return { ok: false, error: INTAKE_ERRORS.ages };

  if (input.kidsInContent !== "yes" && input.kidsInContent !== "no") return { ok: false, error: INTAKE_ERRORS.family };
  const kidsInContent = input.kidsInContent === "yes";
  let kidsCount: number | null = null;
  let kidsAges: string[] = [];
  if (kidsInContent) {
    const count = parseWholeNumber(input.kidsCount);
    if (count == null || count < 1 || count > 12) return { ok: false, error: INTAKE_ERRORS.family };
    kidsAges = [...new Set(input.kidsAges.map((item) => item.trim()).filter(Boolean))];
    if (kidsAges.length === 0 || kidsAges.some((item) => !(AGE_RANGES as readonly string[]).includes(item))) return { ok: false, error: INTAKE_ERRORS.ages };
    kidsCount = count;
  }
  const familyNotes = clip(input.familyNotes, 1000);
  if (familyNotes && DOB_LIKE.test(familyNotes)) return { ok: false, error: INTAKE_ERRORS.ages };

  const currentRates = clip(input.currentRates, 400);
  if (!currentRates) return { ok: false, error: INTAKE_ERRORS.rates };
  if (input.analyticsMode !== "connect" && input.analyticsMode !== "screenshots") return { ok: false, error: INTAKE_ERRORS.analytics };
  if (!input.consentAccuracy) return { ok: false, error: INTAKE_ERRORS.analytics };

  if (input.analyticsMode === "screenshots") {
    for (const file of input.files) {
      const fileError = validateScreenshot(file);
      if (fileError) return { ok: false, error: fileError };
    }
    for (const row of platforms) {
      const count = input.files.filter((file) => file.platformIndex === row.slot).length;
      if (count < SCREENSHOTS_PER_PLATFORM) return { ok: false, error: INTAKE_ERRORS.files };
    }
  }

  const maxFollowers = Math.max(...platforms.map((row) => row.followers));
  const route = signingRoute(maxFollowers);
  return {
    ok: true,
    value: {
      legalName,
      preferredName: clip(input.preferredName, 80),
      email,
      phone,
      addressLine1,
      addressLine2: clip(input.addressLine2, 120),
      city,
      addressState,
      zip,
      country,
      stateOfResidence,
      platforms,
      niches: niches.slice(0, 12),
      goals,
      goalsText,
      kidsInContent,
      kidsCount,
      kidsAges,
      familyNotes,
      currentRates,
      analyticsMode: input.analyticsMode,
      files: input.analyticsMode === "screenshots" ? input.files : [],
      consentAccuracy: true,
      maxFollowers,
      route,
      band: route === "curriculum" ? curriculumBand(maxFollowers) : null,
    },
  };
}

function formList(form: FormData, name: string) {
  return form.getAll(name).map((item) => String(item).trim()).filter(Boolean);
}

export function submissionFromForm(form: FormData): IntakeSubmission {
  const platforms: PlatformDraft[] = [];
  for (let index = 0; index < 6; index += 1) {
    platforms.push({
      platform: String(form.get(`platform-${index}`) ?? ""),
      handle: String(form.get(`handle-${index}`) ?? ""),
      url: String(form.get(`url-${index}`) ?? ""),
      followers: String(form.get(`followers-${index}`) ?? ""),
      avgViews: String(form.get(`views-${index}`) ?? ""),
    });
  }
  const files: ScreenshotDraft[] = [];
  for (let index = 0; index < 6; index += 1) {
    for (let shot = 0; shot < 4; shot += 1) {
      const entry = form.get(`shot-${index}-${shot}`);
      if (!(entry instanceof File) || entry.size <= 0) continue;
      files.push({
        platformIndex: index,
        filename: entry.name || "screenshot",
        contentType: entry.type,
        byteLength: entry.size,
      });
    }
  }
  const kids = String(form.get("kidsInContent") ?? "");
  return {
    legalName: String(form.get("legalName") ?? ""),
    preferredName: String(form.get("preferredName") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    addressLine1: String(form.get("addressLine1") ?? ""),
    addressLine2: String(form.get("addressLine2") ?? ""),
    city: String(form.get("city") ?? ""),
    addressState: String(form.get("addressState") ?? ""),
    zip: String(form.get("zip") ?? ""),
    country: String(form.get("country") ?? ""),
    stateOfResidence: String(form.get("stateOfResidence") ?? ""),
    platforms,
    niches: formList(form, "niches"),
    goals: formList(form, "goals"),
    goalsText: String(form.get("goalsText") ?? ""),
    kidsInContent: kids === "yes" || kids === "no" ? kids : "",
    kidsCount: String(form.get("kidsCount") ?? ""),
    kidsAges: formList(form, "kidsAges"),
    familyNotes: String(form.get("familyNotes") ?? ""),
    currentRates: String(form.get("statedRates") ?? ""),
    analyticsMode: String(form.get("analyticsMode") ?? ""),
    files,
    consentAccuracy: form.get("consentAccuracy") === "1",
  };
}

type DraftRow = typeof creatorIntake.$inferSelect;

async function draftPlatforms(db: PortalDb, intakeId: string) {
  const rows = await db.select().from(creatorPlatforms);
  return rows.filter((row) => row.intakeId === intakeId).sort((left, right) => left.id.localeCompare(right.id));
}

function submissionFromRow(row: DraftRow, platforms: { platform: string; handle: string; url: string | null; followers: number | null; avgViews: number | null }[], files: ScreenshotDraft[], rates: string): IntakeSubmission {
  let goals: string[] = [];
  let niches: string[] = [];
  try { goals = JSON.parse(row.goalsJson) as string[]; } catch { goals = []; }
  try { niches = JSON.parse(row.nichesJson) as string[]; } catch { niches = []; }
  return {
    legalName: row.legalName ?? "",
    preferredName: row.preferredName ?? "",
    email: row.email,
    phone: row.phone ?? "",
    addressLine1: row.addressLine1 ?? "",
    addressLine2: row.addressLine2 ?? "",
    city: row.city ?? "",
    addressState: row.addressState ?? "",
    zip: row.zip ?? "",
    country: row.country ?? "",
    stateOfResidence: row.stateOfResidence ?? "",
    platforms: platforms.map((item) => ({
      platform: item.platform,
      handle: item.handle,
      url: item.url ?? "",
      followers: item.followers == null ? "" : String(item.followers),
      avgViews: item.avgViews == null ? "" : String(item.avgViews),
    })),
    niches,
    goals,
    goalsText: row.goalsText ?? "",
    kidsInContent: row.kidsInContent == null ? "" : row.kidsInContent ? "yes" : "no",
    kidsCount: row.kidsCount == null ? "" : String(row.kidsCount),
    kidsAges: (row.kidsAges ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    familyNotes: row.familyNotes ?? "",
    currentRates: rates,
    analyticsMode: row.analyticsMode ?? "",
    files,
    consentAccuracy: row.consentJson.includes("\"accuracy\":true"),
  };
}

export type ResumeDraft = {
  id: string;
  token: string;
  hasRates: boolean;
  values: IntakeSubmission;
};

export async function loadResumeDraft(db: PortalDb, token: string): Promise<ResumeDraft | null> {
  const parsed = readIntakeToken(token);
  if (!parsed) return null;
  const rows = await db.select().from(creatorIntake).where(eq(creatorIntake.id, parsed.id));
  const row = rows[0];
  if (!row || row.status !== "draft" || normalizeEmail(row.email) !== parsed.email) return null;
  const platforms = await draftPlatforms(db, row.id);
  const values = submissionFromRow(row, platforms, [], "");
  values.currentRates = "";
  return { id: row.id, token, hasRates: Boolean(row.currentRates), values };
}

async function writePlatforms(
  db: PortalDb,
  intakeId: string,
  platforms: { platform: string; handle: string; url: string; followers: number | string; avgViews: number | string | null; slot?: number }[],
) {
  await db.delete(creatorPlatforms).where(eq(creatorPlatforms.intakeId, intakeId));
  const capturedAt = nowIso();
  const slots = new Map<number, string>();
  for (let index = 0; index < platforms.length; index += 1) {
    const row = platforms[index];
    const platform = row.platform.trim();
    const handle = row.handle.trim();
    const followers = typeof row.followers === "number" ? row.followers : parseWholeNumber(row.followers);
    if (!platform || !handle || followers == null) continue;
    const avgViews = typeof row.avgViews === "number" || row.avgViews == null ? row.avgViews : parseWholeNumber(row.avgViews);
    const slot = row.slot ?? index;
    const id = `${String(slot).padStart(2, "0")}-${crypto.randomUUID()}`;
    slots.set(slot, id);
    await db.insert(creatorPlatforms).values({
      id,
      intakeId,
      platform,
      handle,
      url: row.url || null,
      followers,
      avgViews,
      capturedAt,
      source: "self",
      createdAt: capturedAt,
    });
  }
  return slots;
}

async function writeFiles(db: PortalDb, intakeId: string, files: ScreenshotDraft[], slots: Map<number, string>) {
  await db.delete(intakeFiles).where(eq(intakeFiles.intakeId, intakeId));
  const createdAt = nowIso();
  for (const file of files) {
    const id = crypto.randomUUID();
    await db.insert(intakeFiles).values({
      id,
      intakeId,
      platformId: slots.get(file.platformIndex) ?? null,
      filename: clip(file.filename, 120) || "screenshot",
      contentType: file.contentType,
      byteLength: file.byteLength,
      storageKey: `intake/${intakeId}/${id}`,
      createdAt,
    });
  }
}

function blankDraft(email: string) {
  const timestamp = nowIso();
  return {
    id: crypto.randomUUID(),
    applicationId: null,
    creatorId: null,
    legalName: null,
    preferredName: null,
    email,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    addressState: null,
    zip: null,
    country: null,
    stateOfResidence: null,
    nichesJson: "[]",
    goalsJson: "[]",
    goalsText: null,
    currentRates: null,
    kidsInContent: null,
    kidsCount: null,
    kidsAges: null,
    familyNotes: null,
    analyticsMode: null,
    consentJson: "{}",
    status: "draft",
    submittedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function saveIntakeDraft(
  db: PortalDb,
  input: IntakeSubmission,
  meta: { token?: string; honeypot?: string } = {},
) {
  if (meta.honeypot?.trim()) return { ok: true as const, dropped: true as const };
  const email = normalizeEmail(input.email).slice(0, 120);
  if (blockedEmail(email)) return { ok: false as const, error: INTAKE_ERRORS.email };
  if (input.phone.trim() && !normalizeUsPhone(input.phone)) return { ok: false as const, error: INTAKE_ERRORS.phone };
  if (input.zip.trim() && !normalizeUsZip(input.zip)) return { ok: false as const, error: INTAKE_ERRORS.zip };
  if (input.addressState.trim() && !normalizeUsState(input.addressState)) return { ok: false as const, error: INTAKE_ERRORS.state };
  if (input.stateOfResidence.trim() && !normalizeUsState(input.stateOfResidence)) return { ok: false as const, error: INTAKE_ERRORS.state };
  for (const file of input.files) {
    if (file.byteLength <= 0 && !file.contentType) continue;
    const fileError = validateScreenshot(file);
    if (fileError) return { ok: false, error: fileError };
  }
  const familyNotes = clip(input.familyNotes, 1000);
  if (familyNotes && DOB_LIKE.test(familyNotes)) return { ok: false as const, error: INTAKE_ERRORS.ages };

  let row: DraftRow | undefined;
  if (meta.token) {
    const parsed = readIntakeToken(meta.token);
    if (!parsed) return { ok: false as const, error: INTAKE_ERRORS.resume };
    const existing = await db.select().from(creatorIntake).where(eq(creatorIntake.id, parsed.id));
    row = existing[0];
    if (!row || row.status !== "draft") return { ok: false as const, error: INTAKE_ERRORS.resume };
  } else {
    const drafts = await db.select().from(creatorIntake);
    row = drafts.find((item) => item.status === "draft" && item.email === email);
  }

  const phone = input.phone.trim() ? normalizeUsPhone(input.phone) : null;
  const rates = clip(input.currentRates, 400);
  const patch = {
    legalName: clip(input.legalName, 120) || null,
    preferredName: clip(input.preferredName, 80) || null,
    email,
    phone,
    addressLine1: clip(input.addressLine1, 120) || null,
    addressLine2: clip(input.addressLine2, 120) || null,
    city: clip(input.city, 80) || null,
    addressState: input.addressState.trim() ? normalizeUsState(input.addressState) : null,
    zip: input.zip.trim() ? normalizeUsZip(input.zip) : null,
    country: clip(input.country, 80) || null,
    stateOfResidence: input.stateOfResidence.trim() ? normalizeUsState(input.stateOfResidence) : null,
    nichesJson: JSON.stringify(input.niches.filter((item) => NICHE_CATALOG.includes(item)).slice(0, 12)),
    goalsJson: JSON.stringify(input.goals.filter((item) => (INTAKE_GOALS as readonly string[]).includes(item))),
    goalsText: clip(input.goalsText, 1000) || null,
    currentRates: rates || row?.currentRates || null,
    kidsInContent: input.kidsInContent === "yes" ? true : input.kidsInContent === "no" ? false : row?.kidsInContent ?? null,
    kidsCount: input.kidsInContent === "yes" ? parseWholeNumber(input.kidsCount) : null,
    kidsAges: input.kidsInContent === "yes" ? input.kidsAges.filter((item) => (AGE_RANGES as readonly string[]).includes(item)).join(", ") || null : null,
    familyNotes: familyNotes || null,
    analyticsMode: input.analyticsMode === "connect" || input.analyticsMode === "screenshots" ? input.analyticsMode : null,
    consentJson: JSON.stringify({ accuracy: input.consentAccuracy }),
    updatedAt: nowIso(),
  };

  let id = row?.id;
  if (!id) {
    const created = { ...blankDraft(email), ...patch, email, status: "draft" };
    id = created.id;
    await db.insert(creatorIntake).values(created);
  } else {
    await db.update(creatorIntake).set(patch).where(eq(creatorIntake.id, id));
  }
  const filled = input.platforms.filter((item) => item.platform.trim() || item.handle.trim() || item.followers.trim());
  if (filled.length > 0) await writePlatforms(db, id, input.platforms);
  const token = signIntakeToken(id, email);
  if (!token) return { ok: false as const, error: INTAKE_ERRORS.saved };
  return { ok: true as const, id, token };
}

async function limited(db: PortalDb, email: string, ip: string, now: Date) {
  const attempts = await db.select().from(creatorApplicationAttempts);
  const recentEmail = attempts.filter((row) => row.email === email && now.getTime() - Date.parse(row.createdAt) < EMAIL_WINDOW_MS).length;
  if (recentEmail >= EMAIL_LIMIT) return INTAKE_ERRORS.limitEmail;
  if (ip !== "unknown") {
    const recentIp = attempts.filter((row) => row.ip === ip && now.getTime() - Date.parse(row.createdAt) < IP_WINDOW_MS).length;
    if (recentIp >= IP_LIMIT) return INTAKE_ERRORS.limitIp;
  }
  return null;
}

export async function submitCreatorIntake(
  db: PortalDb,
  input: IntakeSubmission,
  meta: { ip?: string; honeypot?: string; token?: string; channel?: "apply" | "bench"; now?: Date } = {},
) {
  if (meta.honeypot?.trim()) return { ok: true as const, dropped: true as const };
  const checked = validateIntake(input);
  if (!checked.ok) return checked;
  const value = checked.value;
  const now = meta.now ?? new Date();
  const ip = (meta.ip ?? "unknown").trim() || "unknown";
  const limitError = await limited(db, value.email, ip, now);
  if (limitError) return { ok: false as const, error: limitError };
  const people = await db.select().from(creators);
  if (people.some((row) => row.email.toLowerCase() === value.email)) return { ok: false as const, error: INTAKE_ERRORS.roster };
  const existingApps = await db.select().from(creatorApplications).where(eq(creatorApplications.email, value.email));
  if (existingApps.some((row) => row.status === "pending" || row.status === "curriculum")) {
    return { ok: false as const, error: INTAKE_ERRORS.waiting };
  }

  let intakeId = "";
  if (meta.token) {
    const parsed = readIntakeToken(meta.token);
    if (!parsed) return { ok: false as const, error: INTAKE_ERRORS.resume };
    const drafts = await db.select().from(creatorIntake).where(eq(creatorIntake.id, parsed.id));
    if (!drafts[0] || drafts[0].status !== "draft") return { ok: false as const, error: INTAKE_ERRORS.resume };
    intakeId = drafts[0].id;
  }
  const timestamp = nowIso();
  const keptRates = value.currentRates;
  if (!intakeId) {
    intakeId = crypto.randomUUID();
    await db.insert(creatorIntake).values({
      ...blankDraft(value.email),
      id: intakeId,
      createdAt: timestamp,
    });
  }

  const applicationId = crypto.randomUUID();
  const displayName = value.preferredName || value.legalName;
  const handles = value.platforms.map((row) => `${row.handle} on ${row.platform}`).join(", ").slice(0, 400);
  const followers = value.platforms.map((row) => `${row.platform} ${row.followers}`).join(", ").slice(0, 200);
  await db.insert(creatorApplications).values({
    id: applicationId,
    name: displayName.slice(0, 80),
    email: value.email,
    handles,
    followers,
    niche: value.niches.join(", ").slice(0, 120),
    rates: keptRates,
    message: (value.goalsText || value.goals.join(", ")).slice(0, 1000),
    status: value.route === "sign" ? "pending" : "curriculum",
    creatorId: null,
    invitedAt: null,
    createdAt: timestamp,
    reviewedAt: null,
  });
  await db.update(creatorIntake).set({
    applicationId,
    legalName: value.legalName,
    preferredName: value.preferredName || null,
    email: value.email,
    phone: value.phone,
    addressLine1: value.addressLine1,
    addressLine2: value.addressLine2 || null,
    city: value.city,
    addressState: value.addressState,
    zip: value.zip,
    country: value.country,
    stateOfResidence: value.stateOfResidence,
    nichesJson: JSON.stringify(value.niches),
    goalsJson: JSON.stringify(value.goals),
    goalsText: value.goalsText || null,
    currentRates: keptRates,
    kidsInContent: value.kidsInContent,
    kidsCount: value.kidsCount,
    kidsAges: value.kidsAges.join(", ") || null,
    familyNotes: value.familyNotes || null,
    analyticsMode: value.analyticsMode,
    consentJson: JSON.stringify({ accuracy: true }),
    status: "submitted",
    submittedAt: timestamp,
    updatedAt: timestamp,
  }).where(eq(creatorIntake.id, intakeId));
  const slots = await writePlatforms(db, intakeId, value.platforms);
  if (value.analyticsMode === "screenshots") await writeFiles(db, intakeId, value.files, slots);
  await db.insert(creatorApplicationAttempts).values({
    id: crypto.randomUUID(),
    email: value.email,
    ip,
    createdAt: now.toISOString(),
  });
  if (meta.channel === "bench" && value.route === "curriculum") {
    await joinBench(db, {
      name: displayName,
      email: value.email,
      niches: value.niches,
      platforms: value.platforms.map((row) => row.platform),
      samples: [],
    });
  }
  await notifyStaff(db, {
    kind: "creator_application",
    creatorId: null,
    message: value.route === "sign"
      ? `New application from ${displayName}. Open Applications on the dashboard. Nothing was emailed.`
      : `New curriculum application from ${displayName}. Nothing was emailed.`,
  });
  return {
    ok: true as const,
    id: intakeId,
    applicationId,
    route: value.route,
    band: value.band,
  };
}

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

function filesFromForm(form: FormData) {
  return submissionFromForm(form).files;
}

export function validateStep(step: IntakeStep, form: FormData, strict: boolean) {
  if (step === "contact") {
    const email = normalizeEmail(field(form, "email"));
    const name = field(form, "legalName").trim();
    if (blockedEmail(email)) return INTAKE_ERRORS.contact;
    if (strict && !name) return INTAKE_ERRORS.contact;
    const phone = field(form, "phone");
    if ((strict || phone.trim()) && !normalizeUsPhone(phone)) return INTAKE_ERRORS.phone;
    return null;
  }
  if (step === "address") {
    const country = field(form, "country").trim().toLowerCase();
    const line = field(form, "addressLine1").trim();
    const city = field(form, "city").trim();
    if (strict && (!line || !city || !country)) return INTAKE_ERRORS.address;
    if ((strict || country) && country !== "us" && country !== "usa" && country !== "united states") return INTAKE_ERRORS.address;
    if ((strict || field(form, "addressState").trim()) && !normalizeUsState(field(form, "addressState"))) return INTAKE_ERRORS.state;
    if ((strict || field(form, "stateOfResidence").trim()) && !normalizeUsState(field(form, "stateOfResidence"))) return INTAKE_ERRORS.state;
    if ((strict || field(form, "zip").trim()) && !normalizeUsZip(field(form, "zip"))) return INTAKE_ERRORS.zip;
    return null;
  }
  if (step === "platforms") {
    const filled = submissionFromForm(form).platforms.filter((row) => row.platform.trim() || row.handle.trim() || row.followers.trim());
    if (!strict && filled.length === 0) return null;
    if (filled.length === 0) return INTAKE_ERRORS.platforms;
    for (const row of filled) {
      if (!(PLATFORM_OPTIONS as readonly string[]).includes(row.platform.trim()) || !row.handle.trim()) return INTAKE_ERRORS.platforms;
      if (row.url.trim() && !/^https?:\/\//i.test(row.url.trim())) return INTAKE_ERRORS.platforms;
      if (parseWholeNumber(row.followers) == null) return INTAKE_ERRORS.followers;
    }
    return null;
  }
  if (step === "niche") {
    const niches = form.getAll("niches").map((item) => String(item).trim()).filter(Boolean);
    const goals = form.getAll("goals").map((item) => String(item).trim()).filter(Boolean);
    if (!strict && niches.length === 0 && goals.length === 0) return null;
    if (niches.length === 0 || niches.some((item) => !NICHE_CATALOG.includes(item))) return INTAKE_ERRORS.niche;
    if (goals.length === 0 || goals.some((item) => !(INTAKE_GOALS as readonly string[]).includes(item))) return INTAKE_ERRORS.goals;
    if (DOB_LIKE.test(field(form, "goalsText"))) return INTAKE_ERRORS.ages;
    return null;
  }
  if (step === "family") {
    const kids = field(form, "kidsInContent");
    if (!strict && !kids) return null;
    if (kids !== "yes" && kids !== "no") return INTAKE_ERRORS.family;
    if (kids === "yes") {
      const count = parseWholeNumber(field(form, "kidsCount"));
      if (count == null || count < 1 || count > 12) return INTAKE_ERRORS.family;
      const ages = form.getAll("kidsAges").map((item) => String(item).trim()).filter(Boolean);
      if (ages.length === 0 || ages.some((item) => !(AGE_RANGES as readonly string[]).includes(item))) return INTAKE_ERRORS.ages;
    }
    if (DOB_LIKE.test(field(form, "familyNotes"))) return INTAKE_ERRORS.ages;
    return null;
  }
  if (step === "rates") {
    if (strict && !field(form, "statedRates").trim()) return INTAKE_ERRORS.rates;
    return null;
  }
  const mode = field(form, "analyticsMode");
  if (!strict && !mode) return null;
  if (mode !== "connect" && mode !== "screenshots") return INTAKE_ERRORS.analytics;
  if (strict && field(form, "consentAccuracy") !== "1") return INTAKE_ERRORS.analytics;
  for (const file of filesFromForm(form)) {
    const fileError = validateScreenshot(file);
    if (fileError) return fileError;
  }
  return null;
}

export async function saveIntakeStep(
  db: PortalDb,
  step: IntakeStep,
  form: FormData,
  meta: { token?: string; honeypot?: string } = {},
) {
  if (meta.honeypot?.trim()) return { ok: true as const, dropped: true as const };
  const strict = field(form, "intakeAction") !== "save";
  const stepError = validateStep(step, form, strict);
  if (stepError) return { ok: false as const, error: stepError };
  const parsed = meta.token ? readIntakeToken(meta.token) : null;
  if (meta.token && !parsed) return { ok: false as const, error: INTAKE_ERRORS.resume };
  let row = parsed ? (await db.select().from(creatorIntake).where(eq(creatorIntake.id, parsed.id)))[0] : undefined;
  if (parsed && (!row || row.status !== "draft")) return { ok: false as const, error: INTAKE_ERRORS.resume };
  const email = step === "contact" ? normalizeEmail(field(form, "email")).slice(0, 120) : row?.email ?? "";
  if (blockedEmail(email)) return { ok: false as const, error: INTAKE_ERRORS.contact };
  if (!row) {
    const drafts = await db.select().from(creatorIntake);
    row = drafts.find((item) => item.status === "draft" && item.email === email);
  }
  if (!row) {
    const created = blankDraft(email);
    await db.insert(creatorIntake).values(created);
    row = created;
  }
  const patch: Partial<typeof creatorIntake.$inferInsert> = { updatedAt: nowIso(), email };
  if (step === "contact") {
    patch.legalName = clip(field(form, "legalName"), 120) || null;
    patch.preferredName = clip(field(form, "preferredName"), 80) || null;
    patch.phone = normalizeUsPhone(field(form, "phone"));
  } else if (step === "address") {
    patch.addressLine1 = clip(field(form, "addressLine1"), 120) || null;
    patch.addressLine2 = clip(field(form, "addressLine2"), 120) || null;
    patch.city = clip(field(form, "city"), 80) || null;
    patch.addressState = normalizeUsState(field(form, "addressState"));
    patch.zip = normalizeUsZip(field(form, "zip"));
    patch.country = "United States";
    patch.stateOfResidence = normalizeUsState(field(form, "stateOfResidence"));
  } else if (step === "platforms") {
    await writePlatforms(db, row.id, submissionFromForm(form).platforms);
  } else if (step === "niche") {
    const picked = submissionFromForm(form);
    patch.nichesJson = JSON.stringify(picked.niches.filter((item) => NICHE_CATALOG.includes(item)).slice(0, 12));
    patch.goalsJson = JSON.stringify(picked.goals.filter((item) => (INTAKE_GOALS as readonly string[]).includes(item)));
    patch.goalsText = clip(field(form, "goalsText"), 1000) || null;
  } else if (step === "family") {
    const kids = field(form, "kidsInContent") === "yes";
    patch.kidsInContent = field(form, "kidsInContent") === "yes" ? true : field(form, "kidsInContent") === "no" ? false : null;
    patch.kidsCount = kids ? parseWholeNumber(field(form, "kidsCount")) : null;
    patch.kidsAges = kids ? submissionFromForm(form).kidsAges.filter((item) => (AGE_RANGES as readonly string[]).includes(item)).join(", ") || null : null;
    patch.familyNotes = clip(field(form, "familyNotes"), 1000) || null;
  } else if (step === "rates") {
    const rates = clip(field(form, "statedRates"), 400);
    if (rates) patch.currentRates = rates;
  } else {
    const mode = field(form, "analyticsMode");
    if (mode === "connect" || mode === "screenshots") patch.analyticsMode = mode;
    patch.consentJson = JSON.stringify({ accuracy: field(form, "consentAccuracy") === "1" });
  }
  await db.update(creatorIntake).set(patch).where(eq(creatorIntake.id, row.id));
  const token = signIntakeToken(row.id, email);
  if (!token) return { ok: false as const, error: INTAKE_ERRORS.saved };
  return { ok: true as const, id: row.id, token };
}

export async function finishIntake(
  db: PortalDb,
  form: FormData,
  meta: { ip?: string; honeypot?: string; token?: string; channel?: "apply" | "bench"; now?: Date } = {},
) {
  if (meta.honeypot?.trim()) return { ok: true as const, dropped: true as const };
  const saved = await saveIntakeStep(db, "analytics", form, meta);
  if (!saved.ok || ("dropped" in saved && saved.dropped)) return saved;
  const rows = await db.select().from(creatorIntake).where(eq(creatorIntake.id, saved.id));
  const row = rows[0];
  if (!row) return { ok: false as const, error: INTAKE_ERRORS.resume };
  const platforms = await draftPlatforms(db, row.id);
  const submission = submissionFromRow(row, platforms, filesFromForm(form), row.currentRates ?? "");
  return submitCreatorIntake(db, submission, { ...meta, token: saved.token });
}
