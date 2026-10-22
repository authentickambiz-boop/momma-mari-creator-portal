import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorNotifications, creatorProfiles, creators, profileAdminLog } from "@/db/schema";
import { rankFor, latestRanks } from "./creator-rank";
import { nowIso } from "./format";
import {
  AVATAR_MAX_BYTES,
  COVER_MAX_BYTES,
  cleanFilename,
  cleanMemberPins,
  cleanMemberPlatforms,
  memberImageSrc,
  parseStoredPins,
  parseStoredPlatforms,
  prepareMemberJpeg,
  scrubMemberText,
  storedSafetyKinds,
  type PinDraft,
  type StoredPin,
} from "./member-profile";
import { PROFILE_ERROR_TEXT } from "./profile-notes";
import { AGE_RANGES, AUDIENCE_RANGES, PROFILE_FIELDS, US_STATES, type ProfileField } from "./profile-shared";
import { findSafetyKinds, type SafetyKind } from "./safety-shared";
import { cleanTag } from "./tag-picker";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type ProfileActor = {
  email: string;
  name: string;
  role: string;
  creatorId?: string | null;
};

export type MemberPin = { url: string; title: string; thumb?: string };
export type MemberPlatform = { platform: string; handle: string };

export type PublicProfile = {
  creatorId: string;
  displayName?: string;
  initials?: string;
  avatarImage?: string;
  coverImage?: string;
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
  platforms?: MemberPlatform[];
  pins?: MemberPin[];
  snack?: string;
  loving?: string;
  weekend?: string;
  rankScore: number;
  rankLabel: string;
  safetyKinds?: SafetyKind[];
  photoHeld?: boolean;
  profileHidden?: boolean;
  hiddenFields?: string[];
};

type ProfileRow = typeof creatorProfiles.$inferSelect;
type ProfileMode = "members" | "owner";

const FIELD_FLAG: Record<ProfileField, keyof ProfileRow> = {
  displayName: "displayNameOn",
  avatar: "avatarOn",
  cover: "coverOn",
  bio: "bioOn",
  niches: "nichesOn",
  handles: "handlesOn",
  platforms: "platformsOn",
  pins: "pinsOn",
  snack: "snackOn",
  loving: "lovingOn",
  weekend: "weekendOn",
  audience: "audienceOn",
  formats: "formatsOn",
  askMe: "askMeOn",
  collabs: "collabsOn",
  state: "stateOn",
  brands: "brandsOn",
  family: "familyOn",
  joined: "joinedOn",
};

export type ProfileSaveInput = {
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
  avatarBytes?: Uint8Array | null;
  avatarFilename?: string;
  coverBytes?: Uint8Array | null;
  coverFilename?: string;
  coverOn?: boolean;
  platforms?: { platform: string; handle: string }[];
  platformsOn?: boolean;
  pins?: PinDraft[];
  pinsOn?: boolean;
  snack?: string;
  snackOn?: boolean;
  loving?: string;
  lovingOn?: boolean;
  weekend?: string;
  weekendOn?: boolean;
  photoHold?: boolean;
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
    const tag = scrubMemberText(cleanTag(value));
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
    .map((item) => scrubMemberText(item.replace(/\$\s?\d[\d,]*/g, "")))
    .filter(Boolean)
    .slice(0, 12);
}

function textOrNull(value: string) {
  const cleaned = scrubMemberText(value.trim());
  return cleaned || null;
}

function aboutLine(value: string | undefined, previous: string | null | undefined): Result<{ line: string | null }> {
  if (value === undefined) return { ok: true, line: previous ?? null };
  if (value.trim().length > 40) return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.about };
  return { ok: true, line: textOrNull(value) };
}

function publicPins(pins: StoredPin[], imagesOpen: boolean): MemberPin[] {
  return pins.map((pin) => {
    const item: MemberPin = { url: pin.url, title: pin.title };
    if (imagesOpen && pin.thumb) {
      const src = memberImageSrc(pin.thumb);
      if (src) item.thumb = src;
    }
    return item;
  });
}

export function toPublicProfile(
  row: ProfileRow,
  creator: { initials: string; createdAt: string },
  score = 0,
  mode: ProfileMode = "members",
): PublicProfile | null {
  const safetyKinds = storedSafetyKinds(row.safetyKinds);
  if (mode === "members" && (safetyKinds.length > 0 || !row.profileOn)) return null;
  const rank = rankFor(score);
  const card: PublicProfile = { creatorId: row.creatorId, rankScore: score, rankLabel: rank.label };
  const hidden: string[] = [];
  const reveal = (field: ProfileField, on: boolean) => {
    if (mode === "owner" && !on) hidden.push(field);
    return mode === "owner" || on;
  };
  const imagesOpen = mode === "owner" || !row.photoHold;
  const name = row.displayName ? scrubMemberText(row.displayName) : "";
  if (name && reveal("displayName", row.displayNameOn)) card.displayName = name;
  if (!card.displayName) {
    if (mode === "members") return null;
    card.displayName = "Member";
  }
  if (reveal("avatar", row.avatarOn)) {
    card.initials = creator.initials;
    if (imagesOpen) {
      const src = memberImageSrc(row.avatarImage);
      if (src) card.avatarImage = src;
    }
  }
  if (reveal("cover", row.coverOn) && imagesOpen) {
    const src = memberImageSrc(row.coverImage);
    if (src) card.coverImage = src;
  }
  if (reveal("bio", row.bioOn) && row.bio) {
    const bio = scrubMemberText(row.bio);
    if (bio) card.bio = bio;
  }
  if (reveal("niches", row.nichesOn)) card.niches = parseList(row.niches).map((item) => scrubMemberText(item)).filter(Boolean);
  if (reveal("handles", row.handlesOn) && row.handles) {
    const handles = scrubMemberText(row.handles);
    if (handles) card.handles = handles;
  }
  if (reveal("audience", row.audienceOn) && row.audience) card.audience = row.audience;
  if (reveal("formats", row.formatsOn)) card.formats = parseList(row.formats).map((item) => scrubMemberText(item)).filter(Boolean);
  if (reveal("askMe", row.askMeOn) && row.askMe) {
    const askMe = scrubMemberText(row.askMe);
    if (askMe) card.askMe = askMe;
  }
  if (reveal("collabs", row.collabsOn)) card.collabs = row.collabs;
  if (reveal("state", row.stateOn) && row.state) card.state = row.state;
  if (reveal("brands", row.brandsOn)) card.brands = parseList(row.brands).map((item) => scrubMemberText(item)).filter(Boolean);
  if (reveal("family", row.familyOn) && row.childName && row.childAge) {
    const familyName = scrubMemberText(row.childName);
    if (familyName) card.family = { name: familyName, age: row.childAge };
  }
  if (reveal("joined", row.joinedOn)) {
    const joined = monthYear(creator.createdAt);
    if (joined) card.joined = joined;
  }
  const platforms = parseStoredPlatforms(row.platformsJson);
  if (reveal("platforms", row.platformsOn) && platforms.length) card.platforms = platforms;
  const pins = publicPins(parseStoredPins(row.pinsJson), imagesOpen);
  if (reveal("pins", row.pinsOn) && pins.length) card.pins = pins;
  if (reveal("snack", row.snackOn) && row.snack) {
    const snack = scrubMemberText(row.snack);
    if (snack) card.snack = snack;
  }
  if (reveal("loving", row.lovingOn) && row.loving) {
    const loving = scrubMemberText(row.loving);
    if (loving) card.loving = loving;
  }
  if (reveal("weekend", row.weekendOn) && row.weekend) {
    const weekend = scrubMemberText(row.weekend);
    if (weekend) card.weekend = weekend;
  }
  if (mode === "owner") {
    card.safetyKinds = safetyKinds;
    card.photoHeld = row.photoHold;
    card.profileHidden = !row.profileOn;
    card.hiddenFields = hidden;
  }
  return card;
}

async function roster(db: PortalDb) {
  return db.select().from(creators);
}

async function listProfiles(db: PortalDb, mode: ProfileMode): Promise<PublicProfile[]> {
  const people = await roster(db);
  const rows = await db.select().from(creatorProfiles);
  const ranks = await latestRanks(db);
  const byId = new Map(people.map((creator) => [creator.id, creator]));
  const cards = rows.flatMap((row) => {
    const creator = byId.get(row.creatorId);
    if (!creator) return [];
    const card = toPublicProfile(row, creator, ranks.get(creator.id)?.score ?? 0, mode);
    return card ? [card] : [];
  });
  return cards.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
}

export async function listPublicProfiles(db: PortalDb): Promise<PublicProfile[]> {
  return listProfiles(db, "members");
}

export async function listDirectoryProfiles(db: PortalDb, actor: ProfileActor): Promise<PublicProfile[]> {
  return listProfiles(db, actor.role === "admin" ? "owner" : "members");
}

export async function memberProfile(db: PortalDb, actor: ProfileActor, creatorId: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9-]{1,64}$/.test(creatorId)) return null;
  const people = await roster(db);
  const creator = people.find((row) => row.id === creatorId);
  if (!creator) return null;
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creatorId));
  if (!rows[0]) return null;
  const ranks = await latestRanks(db);
  const mode: ProfileMode = actor.role === "admin" ? "owner" : "members";
  return toPublicProfile(rows[0], creator, ranks.get(creator.id)?.score ?? 0, mode);
}

export async function myProfile(db: PortalDb, actor: ProfileActor) {
  if (actor.role !== "creator" || !actor.creatorId) return null;
  const people = await roster(db);
  const creator = people.find((row) => row.id === actor.creatorId);
  if (!creator) return null;
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creator.id));
  const ranks = await latestRanks(db);
  const rankScore = ranks.get(creator.id)?.score ?? 0;
  return {
    creator,
    profile: rows[0] ?? null,
    preview: rows[0] ? toPublicProfile(rows[0], creator, rankScore) : null,
    rankScore,
  };
}

export async function saveMyProfile(db: PortalDb, actor: ProfileActor, input: ProfileSaveInput): Promise<Result<{ saved: true }>> {
  if (actor.role !== "creator" || actor.creatorId !== input.creatorId) {
    return { ok: false, status: 403, error: PROFILE_ERROR_TEXT.own };
  }
  const people = await roster(db);
  const creator = people.find((row) => row.id === input.creatorId);
  if (!creator) return { ok: false, status: 403, error: PROFILE_ERROR_TEXT.hidden };
  const displayName = scrubMemberText(input.displayName.trim());
  if (input.profileOn && !displayName) return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.name };
  if (input.bio.length > 160) return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.bio };
  const existing = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creator.id));
  const previous = existing[0];
  const snack = aboutLine(input.snack, previous?.snack);
  if (!snack.ok) return snack;
  const loving = aboutLine(input.loving, previous?.loving);
  if (!loving.ok) return loving;
  const weekend = aboutLine(input.weekend, previous?.weekend);
  if (!weekend.ok) return weekend;
  const niches = cleanTags(input.niches);
  const formats = cleanTags(input.formats);
  const audience = (AUDIENCE_RANGES as readonly string[]).includes(input.audience) ? input.audience : "";
  const state = (US_STATES as readonly string[]).includes(input.state) ? input.state : "";
  const age = (AGE_RANGES as readonly string[]).includes(input.childAge) ? input.childAge : "";
  const childName = scrubMemberText(input.childName.trim().split(/\s+/)[0] ?? "").slice(0, 20);
  if ((childName || age || input.familyOn) && !input.familyConfirm) {
    return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.family };
  }

  let avatarImage = previous?.avatarImage ?? null;
  let avatarMime = previous?.avatarMime ?? null;
  let avatarFilename = previous?.avatarFilename ?? null;
  if (input.avatarBytes === null) {
    avatarImage = null;
    avatarMime = null;
    avatarFilename = null;
  } else if (input.avatarBytes) {
    const prepared = prepareMemberJpeg(input.avatarBytes, AVATAR_MAX_BYTES);
    if (!prepared.ok) return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.picture };
    avatarImage = prepared.base64;
    avatarMime = "image/jpeg";
    avatarFilename = cleanFilename(input.avatarFilename) || null;
  }

  let coverImage = previous?.coverImage ?? null;
  let coverMime = previous?.coverMime ?? null;
  let coverFilename = previous?.coverFilename ?? null;
  if (input.coverBytes === null) {
    coverImage = null;
    coverMime = null;
    coverFilename = null;
  } else if (input.coverBytes) {
    const prepared = prepareMemberJpeg(input.coverBytes, COVER_MAX_BYTES);
    if (!prepared.ok) return { ok: false, status: 400, error: PROFILE_ERROR_TEXT.banner };
    coverImage = prepared.base64;
    coverMime = "image/jpeg";
    coverFilename = cleanFilename(input.coverFilename) || null;
  }

  const priorPins = parseStoredPins(previous?.pinsJson);
  let pinsJson = previous?.pinsJson ?? "[]";
  let storedPins = priorPins;
  if (input.pins) {
    const cleaned = cleanMemberPins(input.pins.map((pin) => {
      const prior = priorPins.find((item) => item.url === pin.url.trim()) ?? null;
      return {
        ...pin,
        keptThumb: pin.thumb === undefined ? prior?.thumb ?? null : null,
        keptThumbFilename: pin.thumb === undefined ? prior?.thumbFilename ?? "" : "",
      };
    }));
    if (!cleaned.ok) return { ok: false, status: 400, error: cleaned.error };
    storedPins = cleaned.pins;
    pinsJson = JSON.stringify(cleaned.pins);
  }

  const platforms = input.platforms ? cleanMemberPlatforms(input.platforms) : parseStoredPlatforms(previous?.platformsJson);
  const brands = cleanBrands(input.brands);
  const bio = textOrNull(input.bio);
  const handles = textOrNull(input.handles);
  const askMe = textOrNull(input.askMe);
  const kinds = findSafetyKinds({
    filename: [avatarFilename, coverFilename, ...storedPins.map((pin) => pin.thumbFilename)].filter(Boolean).join("\n"),
    caption: [
      input.displayName,
      input.bio,
      input.handles,
      input.askMe,
      input.brands,
      input.childName,
      input.snack,
      input.loving,
      input.weekend,
      niches.join(" "),
      formats.join(" "),
      brands.join(" "),
      platforms.map((item) => `${item.platform} ${item.handle}`).join("\n"),
      storedPins.map((pin) => `${pin.title}\n${pin.url}`).join("\n"),
    ].filter((item) => item !== undefined && item !== null).join("\n"),
  });

  const timestamp = nowIso();
  const values = {
    creatorId: creator.id,
    profileOn: input.profileOn,
    displayName: displayName || null,
    displayNameOn: input.displayNameOn,
    avatarOn: input.avatarOn,
    bio,
    bioOn: input.bioOn,
    niches: JSON.stringify(niches),
    nichesOn: input.nichesOn,
    handles,
    handlesOn: input.handlesOn,
    audience: audience || null,
    audienceOn: input.audienceOn && Boolean(audience),
    formats: JSON.stringify(formats),
    formatsOn: input.formatsOn,
    askMe,
    askMeOn: input.askMeOn,
    collabs: input.collabs,
    collabsOn: input.collabsOn,
    state: state || null,
    stateOn: input.stateOn && Boolean(state),
    brands: JSON.stringify(brands),
    brandsOn: input.brandsOn,
    childName: childName || null,
    childAge: age || null,
    familyOn: input.familyOn && Boolean(childName) && Boolean(age),
    joinedOn: input.joinedOn,
    coverOn: input.coverOn ?? previous?.coverOn ?? false,
    avatarImage,
    avatarMime,
    avatarFilename,
    coverImage,
    coverMime,
    coverFilename,
    platformsJson: JSON.stringify(platforms),
    platformsOn: input.platformsOn ?? previous?.platformsOn ?? false,
    pinsJson,
    pinsOn: input.pinsOn ?? previous?.pinsOn ?? false,
    snack: snack.line,
    snackOn: input.snackOn ?? previous?.snackOn ?? false,
    loving: loving.line,
    lovingOn: input.lovingOn ?? previous?.lovingOn ?? false,
    weekend: weekend.line,
    weekendOn: input.weekendOn ?? previous?.weekendOn ?? false,
    safetyKinds: JSON.stringify(kinds),
    photoHold: previous?.photoHold ? true : Boolean(input.photoHold),
    updatedAt: timestamp,
  };
  if (previous) await db.update(creatorProfiles).set(values).where(eq(creatorProfiles.creatorId, creator.id));
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
  if (actor.role !== "creator" || !actor.creatorId) return { ok: false, status: 403, error: PROFILE_ERROR_TEXT.own };
  await db.update(creatorProfiles).set({ profileOn: false, updatedAt: nowIso() }).where(eq(creatorProfiles.creatorId, actor.creatorId));
  return { ok: true, hidden: true };
}

const DIRECTORY_ERROR_TEXT = {
  owner: "Only an owner can hide or reset a profile field.",
  reason: "Tell the creator why.",
  field: "Unknown profile field.",
  missing: "That profile is not set up yet.",
  hold: "Only an owner can clear a profile hold.",
} as const;

export const DIRECTORY_NOTES: Record<string, string> = {
  ...DIRECTORY_ERROR_TEXT,
  "1": "That change was not saved.",
};

export function directoryErrorCode(error: string) {
  const match = (Object.keys(DIRECTORY_ERROR_TEXT) as (keyof typeof DIRECTORY_ERROR_TEXT)[])
    .find((code) => DIRECTORY_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function directoryErrorNote(code: string | undefined) {
  if (!code) return null;
  return DIRECTORY_NOTES[code] ?? DIRECTORY_NOTES["1"];
}

export async function moderateProfileField(
  db: PortalDb,
  actor: ProfileActor,
  input: { creatorId: string; field: string; action: "hide" | "reset"; reason: string },
): Promise<Result<{ done: true }>> {
  if (actor.role !== "admin") return { ok: false, status: 403, error: DIRECTORY_ERROR_TEXT.owner };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, status: 400, error: DIRECTORY_ERROR_TEXT.reason };
  if (!(PROFILE_FIELDS as readonly string[]).includes(input.field)) return { ok: false, status: 400, error: DIRECTORY_ERROR_TEXT.field };
  const field = input.field as ProfileField;
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, input.creatorId));
  if (!rows[0]) return { ok: false, status: 404, error: DIRECTORY_ERROR_TEXT.missing };
  const flag = FIELD_FLAG[field];
  const patch: Record<string, string | boolean | null> = { [flag]: false, updatedAt: nowIso() };
  if (input.action === "reset") {
    if (field === "displayName") patch.displayName = null;
    if (field === "avatar") {
      patch.avatarImage = null;
      patch.avatarMime = null;
      patch.avatarFilename = null;
    }
    if (field === "cover") {
      patch.coverImage = null;
      patch.coverMime = null;
      patch.coverFilename = null;
    }
    if (field === "bio") patch.bio = null;
    if (field === "niches") patch.niches = "[]";
    if (field === "handles") patch.handles = null;
    if (field === "platforms") patch.platformsJson = "[]";
    if (field === "pins") patch.pinsJson = "[]";
    if (field === "snack") patch.snack = null;
    if (field === "loving") patch.loving = null;
    if (field === "weekend") patch.weekend = null;
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

export async function clearProfileHold(
  db: PortalDb,
  actor: ProfileActor,
  input: { creatorId: string; hold: "text" | "photo"; reason: string },
): Promise<Result<{ cleared: true }>> {
  if (actor.role !== "admin") return { ok: false, status: 403, error: DIRECTORY_ERROR_TEXT.hold };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, status: 400, error: DIRECTORY_ERROR_TEXT.reason };
  if (input.hold !== "text" && input.hold !== "photo") return { ok: false, status: 400, error: DIRECTORY_ERROR_TEXT.field };
  const rows = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, input.creatorId));
  if (!rows[0]) return { ok: false, status: 404, error: DIRECTORY_ERROR_TEXT.missing };
  const patch = input.hold === "text"
    ? { safetyKinds: "[]", updatedAt: nowIso() }
    : { photoHold: false, updatedAt: nowIso() };
  await db.update(creatorProfiles).set(patch).where(eq(creatorProfiles.creatorId, input.creatorId));
  await db.insert(profileAdminLog).values({
    id: crypto.randomUUID(),
    creatorId: input.creatorId,
    field: input.hold === "text" ? "safety" : "photo",
    action: "clear",
    reason,
    actorName: actor.name,
    createdAt: nowIso(),
  });
  await tellCreator(db, input.creatorId, `Kamron cleared the hold on your profile: ${reason}`);
  return { ok: true, cleared: true };
}
