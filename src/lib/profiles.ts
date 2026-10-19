import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorNotifications, creatorProfiles, creators, profileAdminLog } from "@/db/schema";
import { nowIso } from "./format";
import { AGE_RANGES, AUDIENCE_RANGES, PROFILE_FIELDS, US_STATES, type ProfileField } from "./profile-shared";
import { cleanTag } from "./tag-picker";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type ProfileActor = {
  email: string;
  name: string;
  role: string;
  creatorId?: string | null;
};

export type PublicProfile = {
  creatorId: string;
  displayName?: string;
  initials?: string;
  bio?: string;
  niches?: string[];
  handles?: string;
  audience?: string;
  formats?: string[];
  askMe?: string;
  collabs?: boolean;
  state?: string;
  brands?: string[];
  family?: { name: string; age: string };
  joined?: string;
};

type ProfileRow = typeof creatorProfiles.$inferSelect;

const FIELD_FLAG: Record<ProfileField, keyof ProfileRow> = {
  displayName: "displayNameOn",
  avatar: "avatarOn",
  bio: "bioOn",
  niches: "nichesOn",
  handles: "handlesOn",
  audience: "audienceOn",
  formats: "formatsOn",
  askMe: "askMeOn",
  collabs: "collabsOn",
  state: "stateOn",
  brands: "brandsOn",
  family: "familyOn",
  joined: "joinedOn",
};

function parseList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function monthYear(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function cleanTags(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const tag = cleanTag(value);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= 30) break;
  }
  return out;
}

function cleanBrands(value: string) {
  return value
    .split(",")
    .map((item) => item.replace(/\$\s?\d[\d,]*/g, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function toPublicProfile(row: ProfileRow, creator: { initials: string; createdAt: string }): PublicProfile | null {
  if (!row.profileOn) return null;
  const card: PublicProfile = { creatorId: row.creatorId };
  if (row.displayNameOn && row.displayName) card.displayName = row.displayName;
  if (row.avatarOn) card.initials = creator.initials;
  if (row.bioOn && row.bio) card.bio = row.bio;
  if (row.nichesOn) card.niches = parseList(row.niches);
  if (row.handlesOn && row.handles) card.handles = row.handles;
  if (row.audienceOn && row.audience) card.audience = row.audience;
  if (row.formatsOn) card.formats = parseList(row.formats);
  if (row.askMeOn && row.askMe) card.askMe = row.askMe;
  if (row.collabsOn) card.collabs = row.collabs;
  if (row.stateOn && row.state) card.state = row.state;
  if (row.brandsOn) card.brands = parseList(row.brands);
  if (row.familyOn && row.childName && row.childAge) card.family = { name: row.childName, age: row.childAge };
  if (row.joinedOn) {
    const joined = monthYear(creator.createdAt);
    if (joined) card.joined = joined;
  }
  if (!card.displayName) return null;
  return card;
}

async function roster(db: PortalDb) {
  return db.select().from(creators);
}

export async function listPublicProfiles(db: PortalDb): Promise<PublicProfile[]> {
  const people = await roster(db);
  const rows = await db.select().from(creatorProfiles);
  const byId = new Map(people.map((creator) => [creator.id, creator]));
  return rows.flatMap((row) => {
    const creator = byId.get(row.creatorId);
    if (!creator) return [];
    const card = toPublicProfile(row, creator);
    return card ? [card] : [];
  });
}

export async function myProfile(db: PortalDb, actor: ProfileActor) {
  if (actor.role !== "creator" || !actor.creatorId) return null;
  const people = await roster(db);
  const creator = people.find((row) => row.id === actor.creatorId);
  if (!creator) return null;
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creator.id));
  return { creator, profile: rows[0] ?? null, preview: rows[0] ? toPublicProfile(rows[0], creator) : null };
}

export async function saveMyProfile(
  db: PortalDb,
  actor: ProfileActor,
  input: {
    creatorId: string;
    profileOn: boolean;
    displayName: string;
    displayNameOn: boolean;
    avatarOn: boolean;
    bio: string;
    bioOn: boolean;
    niches: string[];
    nichesOn: boolean;
    handles: string;
    handlesOn: boolean;
    audience: string;
    audienceOn: boolean;
    formats: string[];
    formatsOn: boolean;
    askMe: string;
    askMeOn: boolean;
    collabs: boolean;
    collabsOn: boolean;
    state: string;
    stateOn: boolean;
    brands: string;
    brandsOn: boolean;
    childName: string;
    childAge: string;
    familyOn: boolean;
    familyConfirm: boolean;
    joinedOn: boolean;
  },
): Promise<Result<{ saved: true }>> {
  if (actor.role !== "creator" || actor.creatorId !== input.creatorId) {
    return { ok: false, status: 403, error: "You can only edit your own profile." };
  }
  const people = await roster(db);
  const creator = people.find((row) => row.id === input.creatorId);
  if (!creator) return { ok: false, status: 403, error: "That profile is hidden because this creator left the roster." };
  const displayName = input.displayName.trim();
  if (input.profileOn && !displayName) return { ok: false, status: 400, error: "Add a display name before showing your profile." };
  if (input.bio.length > 280) return { ok: false, status: 400, error: "Bio can be 280 characters." };
  const niches = cleanTags(input.niches);
  const formats = cleanTags(input.formats);
  const audience = (AUDIENCE_RANGES as readonly string[]).includes(input.audience) ? input.audience : "";
  const state = (US_STATES as readonly string[]).includes(input.state) ? input.state : "";
  const age = (AGE_RANGES as readonly string[]).includes(input.childAge) ? input.childAge : "";
  const childName = input.childName.trim().split(/\s+/)[0]?.slice(0, 20) ?? "";
  if ((childName || age || input.familyOn) && !input.familyConfirm) {
    return { ok: false, status: 400, error: "Confirm the family details before saving them." };
  }
  const timestamp = nowIso();
  const values = {
    creatorId: creator.id,
    profileOn: input.profileOn,
    displayName: displayName || null,
    displayNameOn: input.displayNameOn,
    avatarOn: input.avatarOn,
    bio: input.bio.trim() || null,
    bioOn: input.bioOn,
    niches: JSON.stringify(niches),
    nichesOn: input.nichesOn,
    handles: input.handles.trim() || null,
    handlesOn: input.handlesOn,
    audience: audience || null,
    audienceOn: input.audienceOn && Boolean(audience),
    formats: JSON.stringify(formats),
    formatsOn: input.formatsOn,
    askMe: input.askMe.trim() || null,
    askMeOn: input.askMeOn,
    collabs: input.collabs,
    collabsOn: input.collabsOn,
    state: state || null,
    stateOn: input.stateOn && Boolean(state),
    brands: JSON.stringify(cleanBrands(input.brands)),
    brandsOn: input.brandsOn,
    childName: childName || null,
    childAge: age || null,
    familyOn: input.familyOn && Boolean(childName) && Boolean(age),
    joinedOn: input.joinedOn,
    updatedAt: timestamp,
  };
  const existing = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creator.id));
  if (existing[0]) await db.update(creatorProfiles).set(values).where(eq(creatorProfiles.creatorId, creator.id));
  else await db.insert(creatorProfiles).values(values);
  return { ok: true, saved: true };
}

async function tellCreator(db: PortalDb, creatorId: string, message: string) {
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId,
    dealId: null,
    kind: "profile",
    message,
    createdAt: nowIso(),
    readAt: null,
  });
}

export async function hideMyProfile(db: PortalDb, actor: ProfileActor): Promise<Result<{ hidden: true }>> {
  if (actor.role !== "creator" || !actor.creatorId) return { ok: false, status: 403, error: "You can only edit your own profile." };
  await db.update(creatorProfiles).set({ profileOn: false, updatedAt: nowIso() }).where(eq(creatorProfiles.creatorId, actor.creatorId));
  return { ok: true, hidden: true };
}

export async function moderateProfileField(
  db: PortalDb,
  actor: ProfileActor,
  input: { creatorId: string; field: string; action: "hide" | "reset"; reason: string },
): Promise<Result<{ done: true }>> {
  if (actor.role !== "admin") return { ok: false, status: 403, error: "Only an owner can hide or reset a profile field." };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, status: 400, error: "Tell the creator why." };
  if (!(PROFILE_FIELDS as readonly string[]).includes(input.field)) return { ok: false, status: 400, error: "Unknown profile field." };
  const field = input.field as ProfileField;
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, input.creatorId));
  if (!rows[0]) return { ok: false, status: 404, error: "That profile is not set up yet." };
  const flag = FIELD_FLAG[field];
  const patch: Record<string, string | boolean | null> = { [flag]: false, updatedAt: nowIso() };
  if (input.action === "reset") {
    if (field === "displayName") patch.displayName = null;
    if (field === "bio") patch.bio = null;
    if (field === "niches") patch.niches = "[]";
    if (field === "handles") patch.handles = null;
    if (field === "audience") patch.audience = null;
    if (field === "formats") patch.formats = "[]";
    if (field === "askMe") patch.askMe = null;
    if (field === "collabs") patch.collabs = false;
    if (field === "state") patch.state = null;
    if (field === "brands") patch.brands = "[]";
    if (field === "family") {
      patch.childName = null;
      patch.childAge = null;
    }
  }
  await db.update(creatorProfiles).set(patch).where(eq(creatorProfiles.creatorId, input.creatorId));
  await db.insert(profileAdminLog).values({
    id: crypto.randomUUID(),
    creatorId: input.creatorId,
    field,
    action: input.action,
    reason,
    actorName: actor.name,
    createdAt: nowIso(),
  });
  await tellCreator(db, input.creatorId, `Kamron ${input.action === "hide" ? "hid" : "reset"} your ${field}: ${reason}`);
  return { ok: true, done: true };
}
