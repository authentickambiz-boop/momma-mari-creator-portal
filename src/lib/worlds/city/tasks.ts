/**
 * Placeholder city tasks. Submission is mocked: the note is stored on the
 * session and nothing is sent to a webhook, a mailbox, or a payment processor.
 */

import {
  ACTION_LIMITS,
  ASSET_OWNER,
  EARNINGS_CAP_CENTS,
  HOME_TIER_LABEL,
  HOME_TIER_PRICE_CENTS,
  HOME_TIERS,
  REAL_PAYMENTS,
  findCityShopItem,
  formatKash,
  homeTierRank,
  type ActionClass,
  type HomeTier,
} from "../economy";
import {
  SKILL_LABEL,
  type CityLocationId,
  type SkillId,
} from "./locations";

export type CityTaskKind = "lesson" | "paid" | "visit";

export type CityTask = {
  id: string;
  locationId: CityLocationId;
  name: string;
  taskType: string;
  kind: CityTaskKind;
  skill: SkillId | null;
  teaches: SkillId | null;
  requiresSkill: SkillId | null;
  minTier: HomeTier | null;
  payoutCents: number;
  realWork: boolean;
  disclosure: string;
  prompt: string;
};

export type CitySession = {
  kashCents: number;
  skills: SkillId[];
  badges: SkillId[];
  homeTier: HomeTier;
  ownedSkus: string[];
  lastAt: Record<string, number>;
  windows: Record<string, { start: number; count: number }>;
  submissions: { taskId: string; at: number; note: string }[];
};

export type CitySuccess = { ok: true; session: CitySession; message: string };
export type CityFailure = { ok: false; error: string };
export type CityResult = CitySuccess | CityFailure;

function realWorkLine(earns: string) {
  return `This is real work for Momma Mari. It earns ${earns}. It is optional. Nothing is sent outside the city, and no real payment is made.`;
}

function lessonLine(skill: SkillId) {
  return `This lesson teaches ${SKILL_LABEL[skill]}. It is not paid. Finish it to unlock the paid version. This is a learning center lesson, not a school assignment.`;
}

function visitLine() {
  return "This stays in the city. It is not work for Momma Mari, and it does not pay Kash.";
}

function task(partial: Omit<CityTask, "disclosure"> & { disclosure?: string }): CityTask {
  const disclosure = partial.disclosure
    ?? (partial.realWork
      ? realWorkLine(formatKash(partial.payoutCents))
      : partial.kind === "lesson" && partial.teaches
        ? lessonLine(partial.teaches)
        : visitLine());
  return { ...partial, disclosure };
}

export const CITY_TASKS: readonly CityTask[] = [
  task({
    id: "lesson-research",
    locationId: "learning-center",
    name: "Read a brand brief",
    taskType: "lesson",
    kind: "lesson",
    skill: "research",
    teaches: "research",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "In a sentence, what would you look for in a sample brand brief?",
  }),
  task({
    id: "lesson-writing",
    locationId: "learning-center",
    name: "Summarize in one breath",
    taskType: "lesson",
    kind: "lesson",
    skill: "writing",
    teaches: "writing",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Practice a one-sentence summary of a sample post. It is not published.",
  }),
  task({
    id: "lesson-outreach",
    locationId: "learning-center",
    name: "Shape a call opener",
    taskType: "lesson",
    kind: "lesson",
    skill: "outreach",
    teaches: "outreach",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Write a practice opener. It is not dialed and no DM is sent.",
  }),
  task({
    id: "lesson-design",
    locationId: "learning-center",
    name: "Frame a thumbnail",
    taskType: "lesson",
    kind: "lesson",
    skill: "design",
    teaches: "design",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Name the one thing a viewer should see first. No file is uploaded.",
  }),
  task({
    id: "lesson-audio",
    locationId: "learning-center",
    name: "Mark a ten-second cue",
    taskType: "lesson",
    kind: "lesson",
    skill: "audio",
    teaches: "audio",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Describe where a short music cue would start and stop. Nothing is recorded.",
  }),
  task({
    id: "lesson-data",
    locationId: "learning-center",
    name: "Check a sample row",
    taskType: "lesson",
    kind: "lesson",
    skill: "data",
    teaches: "data",
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Say what you would double-check on a sample row. The row is fake.",
  }),
  task({
    id: "research-scan",
    locationId: "research-lab",
    name: "Sample brand scan",
    taskType: "brand-scan",
    kind: "paid",
    skill: "research",
    teaches: null,
    requiresSkill: "research",
    minTier: null,
    payoutCents: 800,
    realWork: true,
    prompt: "Write a short sample scan: who the brand is for, and one thing you noticed. This is a placeholder. It is not sent to a client.",
  }),
  task({
    id: "library-summary",
    locationId: "library",
    name: "Content summary",
    taskType: "summary",
    kind: "paid",
    skill: "writing",
    teaches: null,
    requiresSkill: "writing",
    minTier: null,
    payoutCents: 650,
    realWork: true,
    prompt: "Summarize this sample line: “The Friday drop is a 20-second clip and a still.” Keep it to two sentences.",
  }),
  task({
    id: "data-entry",
    locationId: "computer-lab",
    name: "Sample data entry",
    taskType: "data-entry",
    kind: "paid",
    skill: "data",
    teaches: null,
    requiresSkill: "data",
    minTier: null,
    payoutCents: 500,
    realWork: true,
    prompt: "Type the sample row: clip, 20 seconds, Friday. Add nothing else.",
  }),
  task({
    id: "qa-check",
    locationId: "computer-lab",
    name: "Sample QA check",
    taskType: "qa-check",
    kind: "paid",
    skill: "data",
    teaches: null,
    requiresSkill: "data",
    minTier: null,
    payoutCents: 550,
    realWork: true,
    prompt: "Mark the sample row pass or fix, and say why in one line.",
  }),
  task({
    id: "call-script",
    locationId: "call-center",
    name: "Outreach call script",
    taskType: "call-script",
    kind: "paid",
    skill: "outreach",
    teaches: null,
    requiresSkill: "outreach",
    minTier: null,
    payoutCents: 700,
    realWork: true,
    prompt: "Draft a four-line call script for a sample brand hello. It is not dialed.",
  }),
  task({
    id: "dm-review",
    locationId: "call-center",
    name: "Reviewed DM note",
    taskType: "dm-review",
    kind: "paid",
    skill: "outreach",
    teaches: null,
    requiresSkill: "outreach",
    minTier: null,
    payoutCents: 600,
    realWork: true,
    prompt: "Review this sample DM: “Can you send the Friday cut?” Note what you would reply. The reply is not sent.",
  }),
  task({
    id: "thumbnail",
    locationId: "art-studio",
    name: "Thumbnail note",
    taskType: "thumbnail",
    kind: "paid",
    skill: "design",
    teaches: null,
    requiresSkill: "design",
    minTier: null,
    payoutCents: 900,
    realWork: true,
    prompt: "Describe a thumbnail: subject, three words of type, and the background. No file is uploaded.",
  }),
  task({
    id: "audio-snippet",
    locationId: "music-studio",
    name: "Audio snippet note",
    taskType: "audio-snippet",
    kind: "paid",
    skill: "audio",
    teaches: null,
    requiresSkill: "audio",
    minTier: null,
    payoutCents: 750,
    realWork: true,
    prompt: "Describe a 10-second audio snippet: mood, where it swells, and where it ends. Nothing is recorded.",
  }),
  task({
    id: "club-hello",
    locationId: "social-club",
    name: "Say hello",
    taskType: "hello",
    kind: "visit",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Optional. Wave at the room. Nobody outside the city is contacted.",
  }),
  task({
    id: "bank-visit",
    locationId: "bank",
    name: "Visit the bank",
    taskType: "visit-bank",
    kind: "visit",
    skill: "finance",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    disclosure: "This is the in-game bank, the same one as the office vault. No real payment is sent. Momma Mari owns the in-game balances.",
    prompt: "Open the vault bank when you want to move in-game Kash. This visit does not move money by itself.",
  }),
  task({
    id: "home-rest",
    locationId: "home",
    name: "Rest",
    taskType: "rest",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: "studio",
    payoutCents: 0,
    realWork: false,
    prompt: "Sit for a moment. This stays in the home.",
  }),
  task({
    id: "home-journal",
    locationId: "home",
    name: "Journal",
    taskType: "journal",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: "studio",
    payoutCents: 0,
    realWork: false,
    prompt: "Write a private line. It is not a deliverable.",
  }),
  task({
    id: "home-cook",
    locationId: "home",
    name: "Cook",
    taskType: "cook",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: "apartment",
    payoutCents: 0,
    realWork: false,
    prompt: "The apartment kitchen is unlocked. This is not a paid task.",
  }),
  task({
    id: "home-host",
    locationId: "home",
    name: "Host",
    taskType: "host",
    kind: "visit",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: "house",
    payoutCents: 0,
    realWork: false,
    prompt: "The house can host. No one outside the city is invited.",
  }),
  task({
    id: "home-idea",
    locationId: "home",
    name: "Pin a content idea",
    taskType: "idea",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: "creator-loft",
    payoutCents: 0,
    realWork: false,
    prompt: "Pin an idea on the loft wall. It is not assigned as work until you opt in somewhere else.",
  }),
  task({
    id: "home-gallery",
    locationId: "home",
    name: "Open the gallery",
    taskType: "gallery",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: "mansion",
    payoutCents: 0,
    realWork: false,
    prompt: "Walk the mansion gallery. The pieces stay Momma Mari's.",
  }),
];

export function emptyCitySession(): CitySession {
  return {
    kashCents: 0,
    skills: [],
    badges: [],
    homeTier: "studio",
    ownedSkus: [],
    lastAt: {},
    windows: {},
    submissions: [],
  };
}

export function tasksForLocation(id: CityLocationId) {
  return CITY_TASKS.filter((item) => item.locationId === id);
}

export function findCityTask(id: string) {
  return CITY_TASKS.find((item) => item.id === id) ?? null;
}

export function unlockedHomeActivities(tier: HomeTier) {
  const rank = homeTierRank(tier);
  return CITY_TASKS.filter((item) => item.locationId === "home" && item.minTier && homeTierRank(item.minTier) <= rank);
}

export function homeItemsForTier(tier: HomeTier) {
  const rank = homeTierRank(tier);
  const items = ["Bed", "Desk"];
  if (rank >= homeTierRank("apartment")) items.push("Sofa", "Kitchen");
  if (rank >= homeTierRank("house")) items.push("Dining table", "Guest chair");
  if (rank >= homeTierRank("creator-loft")) items.push("Backdrop", "Ring light");
  if (rank >= homeTierRank("mansion")) items.push("Gallery wall", "Piano");
  return items;
}

function clone(session: CitySession): CitySession {
  return {
    ...session,
    skills: [...session.skills],
    badges: [...session.badges],
    ownedSkus: [...session.ownedSkus],
    lastAt: { ...session.lastAt },
    windows: { ...session.windows },
    submissions: [...session.submissions],
  };
}

function onCooldown(session: CitySession, key: string, cooldownMs: number, now: number) {
  const last = session.lastAt[key];
  if (last === undefined) return null;
  if (now < last) return "The clock moved backward. Wait for a later time.";
  if (now - last < cooldownMs) {
    const wait = Math.max(1, Math.ceil((cooldownMs - (now - last)) / 1000));
    return `This action is cooling down. Try again in ${wait}s.`;
  }
  return null;
}

function takeWindow(session: CitySession, key: string, limit: number, windowMs: number, now: number): CityResult {
  const current = session.windows[key];
  const fresh = !current || now - current.start >= windowMs;
  if (!fresh && current && current.count >= limit) {
    return {
      ok: false,
      error: `This action is limited to ${limit} in this window. There is no earnings cap. It opens again after the window.`,
    };
  }
  const next = clone(session);
  next.windows[key] = fresh || !current
    ? { start: now, count: 1 }
    : { start: current.start, count: current.count + 1 };
  return { ok: true, session: next, message: "" };
}

function pay(session: CitySession, cents: number) {
  if (EARNINGS_CAP_CENTS !== null) {
    throw new Error("Kash has no earnings cap.");
  }
  if (REAL_PAYMENTS) {
    throw new Error("Real payments stay off.");
  }
  const next = clone(session);
  next.kashCents += cents;
  return next;
}

export function submitCityTask(
  session: CitySession,
  taskId: string,
  input: { optIn: boolean; note: string; now: number },
): CityResult {
  const item = findCityTask(taskId);
  if (!item) return { ok: false, error: "That task is not on the city map." };
  if (input.optIn !== true) {
    return { ok: false, error: "This task is optional. Check the box if you want to do it." };
  }
  const note = input.note.trim();
  if (item.realWork && note.length < 3) {
    return { ok: false, error: "Add a short note. The submission stays in the city." };
  }
  if (item.requiresSkill && !session.skills.includes(item.requiresSkill)) {
    return {
      ok: false,
      error: `Finish the learning center lesson for ${SKILL_LABEL[item.requiresSkill]} first. The paid version stays locked.`,
    };
  }
  if (item.minTier && homeTierRank(session.homeTier) < homeTierRank(item.minTier)) {
    return { ok: false, error: `${HOME_TIER_LABEL[item.minTier]} unlocks this. The home you have is ${HOME_TIER_LABEL[session.homeTier]}.` };
  }
  const limits = ACTION_LIMITS[item.kind];
  const cooled = onCooldown(session, `task:${item.id}`, limits.cooldownMs, input.now);
  if (cooled) return { ok: false, error: cooled };
  const windowKey = `limit:${item.kind}`;
  const slotted = takeWindow(session, windowKey, limits.limit, limits.windowMs, input.now);
  if (!slotted.ok) return slotted;
  let next = slotted.session;
  next.lastAt[`task:${item.id}`] = input.now;
  if (item.teaches && !next.skills.includes(item.teaches)) {
    next.skills.push(item.teaches);
    next.badges.push(item.teaches);
  }
  if (item.payoutCents > 0) next = pay(next, item.payoutCents);
  next.submissions.push({ taskId: item.id, at: input.now, note });
  const earned = item.payoutCents > 0
    ? ` Mock submission saved. You earned ${formatKash(item.payoutCents)}. Balance ${formatKash(next.kashCents)}.`
    : item.teaches
      ? ` Lesson saved. The ${SKILL_LABEL[item.teaches]} badge is yours. The paid version can unlock.`
      : " Saved in the city. Nothing was sent.";
  return { ok: true, session: next, message: `${item.disclosure}${earned}` };
}

export function buyCityItem(session: CitySession, sku: string, now: number): CityResult {
  const item = findCityShopItem(sku);
  if (!item) return { ok: false, error: "That item is not in the city shop." };
  if (session.ownedSkus.includes(sku)) return { ok: false, error: "You already have that. Momma Mari still owns it." };
  const limits = ACTION_LIMITS.shop;
  const cooled = onCooldown(session, `sku:${sku}`, limits.cooldownMs, now);
  if (cooled) return { ok: false, error: cooled };
  const slotted = takeWindow(session, "limit:shop", limits.limit, limits.windowMs, now);
  if (!slotted.ok) return slotted;
  if (session.kashCents < item.priceCents) {
    return { ok: false, error: `That costs ${formatKash(item.priceCents)}. You have ${formatKash(session.kashCents)}.` };
  }
  const next = pay(slotted.session, -item.priceCents);
  next.lastAt[`sku:${sku}`] = now;
  next.ownedSkus.push(sku);
  return {
    ok: true,
    session: next,
    message: `${item.note} Spent ${formatKash(item.priceCents)}. Balance ${formatKash(next.kashCents)}.`,
  };
}

export function unlockHomeTier(session: CitySession, tier: HomeTier, now: number): CityResult {
  if (!(HOME_TIERS as readonly string[]).includes(tier)) return { ok: false, error: "That home tier is not on the list." };
  if (homeTierRank(tier) <= homeTierRank(session.homeTier)) {
    return { ok: false, error: `${HOME_TIER_LABEL[session.homeTier]} is already unlocked.` };
  }
  const price = HOME_TIER_PRICE_CENTS[tier];
  const limits = ACTION_LIMITS.shop;
  const cooled = onCooldown(session, `tier:${tier}`, limits.cooldownMs, now);
  if (cooled) return { ok: false, error: cooled };
  if (session.kashCents < price) {
    return { ok: false, error: `${HOME_TIER_LABEL[tier]} costs ${formatKash(price)}. You have ${formatKash(session.kashCents)}.` };
  }
  const next = pay(session, -price);
  next.lastAt[`tier:${tier}`] = now;
  next.homeTier = tier;
  return {
    ok: true,
    session: next,
    message: `${ASSET_OWNER} owns the ${HOME_TIER_LABEL[tier].toLowerCase()}. You can use it. Spent ${formatKash(price)}. No real payment was made.`,
  };
}

const SKILLS: readonly SkillId[] = ["research", "writing", "outreach", "design", "audio", "data", "hospitality", "finance"];

export function parseCitySession(raw: string): CitySession | null {
  try {
    const value = JSON.parse(raw) as Partial<CitySession>;
    if (!value || typeof value !== "object") return null;
    if (typeof value.kashCents !== "number" || !Number.isFinite(value.kashCents)) return null;
    if (!value.homeTier || !(HOME_TIERS as readonly string[]).includes(value.homeTier)) return null;
    const skills = Array.isArray(value.skills) ? value.skills.filter((item): item is SkillId => (SKILLS as readonly string[]).includes(item)) : [];
    const badges = Array.isArray(value.badges) ? value.badges.filter((item): item is SkillId => (SKILLS as readonly string[]).includes(item)) : [];
    const ownedSkus = Array.isArray(value.ownedSkus) ? value.ownedSkus.filter((item): item is string => typeof item === "string") : [];
    const lastAt: Record<string, number> = {};
    if (value.lastAt && typeof value.lastAt === "object") {
      for (const [key, item] of Object.entries(value.lastAt)) {
        if (typeof item === "number" && Number.isFinite(item)) lastAt[key] = item;
      }
    }
    const windows: CitySession["windows"] = {};
    if (value.windows && typeof value.windows === "object") {
      for (const [key, item] of Object.entries(value.windows)) {
        if (!item || typeof item !== "object") continue;
        const start = (item as { start?: unknown }).start;
        const count = (item as { count?: unknown }).count;
        if (typeof start === "number" && typeof count === "number" && Number.isFinite(start) && Number.isFinite(count)) {
          windows[key] = { start, count };
        }
      }
    }
    return {
      kashCents: Math.trunc(value.kashCents),
      skills,
      badges,
      homeTier: value.homeTier,
      ownedSkus,
      lastAt,
      windows,
      submissions: [],
    };
  } catch {
    return null;
  }
}

export function actionClassOf(kind: CityTaskKind): ActionClass {
  return kind;
}
