import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorIntake, creatorPlatforms, creatorTasks, creators } from "@/db/schema";
import { nowIso } from "./format";
import { noteTaskCompleted } from "./worlds/game-wallet-store";
import { PLATFORM_OPTIONS } from "./niche-catalog";
import { US_STATES } from "./profile-shared";
import type { Viewer } from "./types";

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

export const PROFILE_INTAKE_ERRORS = {
  own: "Creators complete their own profile.",
  name: "Add your legal name.",
  phone: "Enter a 10-digit US phone number.",
  address: "Add a mailing street, city, state, and country.",
  zip: "Enter a 5-digit US ZIP code.",
  state: "Choose a US state.",
  handles: "Add at least one platform and handle.",
  followers: "Enter a follower count as a whole number.",
} as const;

export type ProfileHandleInput = {
  platform: string;
  handle: string;
  url: string;
  followers: string;
};

export type ProfileIntakeInput = {
  legalName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  addressState: string;
  zip: string;
  country: string;
  handles: ProfileHandleInput[];
};

export type ProfileIntakeForm = {
  legalName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  addressState: string;
  zip: string;
  country: string;
  handles: ProfileHandleInput[];
  email: string;
};

export async function profileIntakeMissing(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, creatorId));
  const row = rows.find((item) => (
    item.status === "submitted"
    && item.legalName?.trim()
    && item.phone?.trim()
    && item.addressLine1?.trim()
    && item.city?.trim()
    && item.addressState?.trim()
    && item.zip?.trim()
    && item.country?.trim()
  ));
  if (!row) return true;
  const handles = (await db.select().from(creatorPlatforms)).filter((item) => item.intakeId === row.id && item.platform.trim() && item.handle.trim());
  return handles.length === 0;
}

export function profileIntakeTaskId(creatorId: string) {
  return `profile-intake-${creatorId}`;
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
  const found = Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === trimmed.toLowerCase());
  return found ? found[0] : null;
}

function parseFollowers(value: string) {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const count = Number(trimmed);
  return Number.isSafeInteger(count) ? count : undefined;
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function validateProfileIntake(input: ProfileIntakeInput) {
  const legalName = clip(input.legalName, 120);
  if (!legalName) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.name };
  const phone = normalizeUsPhone(input.phone);
  if (!phone) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.phone };
  const addressLine1 = clip(input.addressLine1, 120);
  const city = clip(input.city, 80);
  const countryRaw = clip(input.country, 80).toLowerCase();
  const country = countryRaw === "us" || countryRaw === "usa" || countryRaw === "united states" ? "United States" : "";
  if (!addressLine1 || !city || !country) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.address };
  const addressState = normalizeUsState(input.addressState);
  if (!addressState) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.state };
  const zip = normalizeUsZip(input.zip);
  if (!zip) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.zip };
  const handles = [];
  for (const row of input.handles) {
    const platform = row.platform.trim();
    const handle = clip(row.handle, 80);
    const url = clip(row.url, 200);
    const followersRaw = row.followers.trim();
    if (!platform && !handle && !url && !followersRaw) continue;
    if (!(PLATFORM_OPTIONS as readonly string[]).includes(platform) || !handle) {
      return { ok: false as const, error: PROFILE_INTAKE_ERRORS.handles };
    }
    if (url && !/^https?:\/\//i.test(url)) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.handles };
    const followers = parseFollowers(followersRaw);
    if (followers === undefined) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.followers };
    handles.push({ platform, handle, url, followers });
  }
  if (handles.length === 0) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.handles };
  return {
    ok: true as const,
    value: {
      legalName,
      phone,
      addressLine1,
      addressLine2: clip(input.addressLine2, 120),
      city,
      addressState,
      zip,
      country,
      handles,
    },
  };
}

export async function loadProfileIntake(db: PortalDb, viewer: Viewer): Promise<ProfileIntakeForm | null> {
  if (viewer.role !== "creator" || !viewer.creatorId) return null;
  const people = await db.select().from(creators).where(eq(creators.id, viewer.creatorId));
  const creator = people[0];
  if (!creator) return null;
  const rows = await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, viewer.creatorId));
  const row = rows[0];
  const platforms = row
    ? (await db.select().from(creatorPlatforms)).filter((item) => item.intakeId === row.id)
    : [];
  return {
    legalName: row?.legalName ?? "",
    phone: row?.phone ?? "",
    addressLine1: row?.addressLine1 ?? "",
    addressLine2: row?.addressLine2 ?? "",
    city: row?.city ?? "",
    addressState: row?.addressState ?? "",
    zip: row?.zip ?? "",
    country: row?.country || "United States",
    email: creator.email,
    handles: platforms.map((item) => ({
      platform: item.platform,
      handle: item.handle,
      url: item.url ?? "",
      followers: item.followers == null ? "" : String(item.followers),
    })),
  };
}

/** Saves contract details for the signed-in creator. Nothing is emailed. */
export async function saveProfileIntake(db: PortalDb, viewer: Viewer, input: ProfileIntakeInput) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: PROFILE_INTAKE_ERRORS.own };
  const checked = validateProfileIntake(input);
  if (!checked.ok) return checked;
  const people = await db.select().from(creators).where(eq(creators.id, viewer.creatorId));
  const creator = people[0];
  if (!creator || creator.email.toLowerCase() !== viewer.email.toLowerCase()) {
    return { ok: false as const, error: PROFILE_INTAKE_ERRORS.own };
  }
  const value = checked.value;
  const timestamp = nowIso();
  const existing = await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, creator.id));
  const current = existing[0];
  const intakeId = current?.id ?? crypto.randomUUID();
  const record = {
    legalName: value.legalName,
    preferredName: current?.preferredName ?? creator.name,
    email: creator.email.toLowerCase(),
    phone: value.phone,
    addressLine1: value.addressLine1,
    addressLine2: value.addressLine2 || null,
    city: value.city,
    addressState: value.addressState,
    zip: value.zip,
    country: value.country,
    stateOfResidence: value.addressState,
    status: "submitted",
    submittedAt: current?.submittedAt ?? timestamp,
    updatedAt: timestamp,
  };
  if (!current) {
    await db.insert(creatorIntake).values({
      id: intakeId,
      applicationId: null,
      creatorId: creator.id,
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
      createdAt: timestamp,
      ...record,
    });
  } else {
    await db.update(creatorIntake).set(record).where(eq(creatorIntake.id, intakeId));
  }
  await db.delete(creatorPlatforms).where(eq(creatorPlatforms.intakeId, intakeId));
  for (const [index, handle] of value.handles.entries()) {
    await db.insert(creatorPlatforms).values({
      id: `${String(index).padStart(2, "0")}-${crypto.randomUUID()}`,
      intakeId,
      platform: handle.platform,
      handle: handle.handle,
      url: handle.url || null,
      followers: handle.followers,
      avgViews: null,
      capturedAt: timestamp,
      source: "self",
      createdAt: timestamp,
    });
  }
  const taskId = profileIntakeTaskId(creator.id);
  const tasks = await db.select().from(creatorTasks).where(eq(creatorTasks.id, taskId));
  if (tasks[0] && tasks[0].status !== "done") {
    await db.update(creatorTasks).set({ status: "done", updatedAt: timestamp }).where(eq(creatorTasks.id, taskId));
    await noteTaskCompleted(db, creator.id, taskId);
  }
  return { ok: true as const, id: intakeId };
}
