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

export type CityTaskKind = "lesson" | "paid" | "visit" | "social";

/** Live likes, comments, follows, and story posts stay off until Kamron turns this on. Practice mode only scores drafts. */
export const LIVE_SOCIAL_ACTIONS = false;

/** Outreach email is a draft. This build never auto-sends, even if a mailbox is connected. */
export const LIVE_EMAIL_SEND = false;

export type ExternalChannel = "none" | "social" | "email";

export type TaskPipeline = {
  autoChecks: readonly string[];
  /** A peer or an office bot scores the draft after the auto check. */
  peerScore: boolean;
  /** Anything that could leave the city waits for Kamron. */
  ownerGate: boolean;
};

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
  pipeline: TaskPipeline;
  external: ExternalChannel;
  /** Practice drafts are scored here. The live platform action stays off. */
  practice: boolean;
  /** Own daily cap. Null uses the shared cap for the action class. */
  dailyLimit: number | null;
};

/** Reading the library shelf reveals one of these. The line shows on that task afterward. */
export const LIBRARY_TIPS: readonly { taskId: string; text: string }[] = [
  { taskId: "research-scan", text: "Name the audience before the observation." },
  { taskId: "call-email", text: "One ask, then stop." },
  { taskId: "library-story", text: "One character, one turn, then stop." },
  { taskId: "thumbnail", text: "Three words of type, then the background." },
];

export type CitySession = {
  kashCents: number;
  skills: SkillId[];
  badges: SkillId[];
  homeTier: HomeTier;
  ownedSkus: string[];
  lastAt: Record<string, number>;
  windows: Record<string, { start: number; count: number }>;
  submissions: { taskId: string; at: number; note: string }[];
  /** Creator bots check in once, then the office stays locked until they leave. */
  officeCheckedIn: boolean;
  /** Task ids whose library tip has been read. */
  libraryTips: string[];
};

export type CitySuccess = { ok: true; session: CitySession; message: string; sent?: false; score?: number | null };
export type CityFailure = { ok: false; error: string };
export type CityResult = CitySuccess | CityFailure;

function realWorkLine(earns: string, external: ExternalChannel) {
  const base = `This is real work for Momma Mari. It earns ${earns}. It is optional.`;
  if (external === "social") {
    return `${base} Practice mode scores this draft. Live likes, comments, follows, and story posts are off. Nothing is posted, and no real payment is made.`;
  }
  if (external === "email") {
    return `${base} This is a draft only. It is never auto-sent. Kamron has to approve anything that could leave the city. No real payment is made.`;
  }
  return `${base} Nothing is sent outside the city, and no real payment is made.`;
}

function defaultPipeline(realWork: boolean, external: ExternalChannel): TaskPipeline {
  if (!realWork && external === "none") {
    return { autoChecks: ["The note stays in the city."], peerScore: false, ownerGate: false };
  }
  if (external === "email") {
    return {
      autoChecks: ["Greeting, one reason, and a close.", "The draft is never auto-sent."],
      peerScore: true,
      ownerGate: true,
    };
  }
  if (external === "social") {
    return {
      autoChecks: ["The draft names the action and stays kind.", "Live posting is off."],
      peerScore: true,
      ownerGate: true,
    };
  }
  return {
    autoChecks: ["The note is specific enough to score."],
    peerScore: true,
    ownerGate: false,
  };
}

function lessonLine(skill: SkillId) {
  return `This lesson teaches ${SKILL_LABEL[skill]}. It is not paid. Finish it to unlock the paid version. This is a learning center lesson, not a school assignment.`;
}

function visitLine() {
  return "This stays in the city. It is not work for Momma Mari, and it does not pay Kash.";
}

function task(partial: Omit<CityTask, "disclosure" | "pipeline" | "external" | "practice" | "dailyLimit"> & {
  disclosure?: string;
  pipeline?: TaskPipeline;
  external?: ExternalChannel;
  practice?: boolean;
  dailyLimit?: number | null;
}): CityTask {
  const external = partial.external ?? "none";
  const practice = partial.practice ?? external === "social";
  const pipeline = partial.pipeline ?? defaultPipeline(partial.realWork, external);
  const disclosure = partial.disclosure
    ?? (partial.realWork
      ? realWorkLine(formatKash(partial.payoutCents), external)
      : partial.kind === "lesson" && partial.teaches
        ? lessonLine(partial.teaches)
        : visitLine());
  return { ...partial, external, practice, pipeline, dailyLimit: partial.dailyLimit ?? null, disclosure };
}

export function pipelineLabel(item: Pick<CityTask, "pipeline">) {
  const steps = ["Auto check"];
  if (item.pipeline.peerScore) steps.push("peer or bot score");
  if (item.pipeline.ownerGate) steps.push("owner gate");
  return steps.join(" → ");
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
    id: "research-audience",
    locationId: "research-lab",
    name: "Audience questions",
    taskType: "audience",
    kind: "paid",
    skill: "research",
    teaches: null,
    requiresSkill: "research",
    minTier: null,
    payoutCents: 700,
    realWork: true,
    prompt: "Write three questions you would ask about a sample audience. The answers stay in the city.",
  }),
  task({
    id: "research-competitor",
    locationId: "research-lab",
    name: "Competitor note",
    taskType: "competitor",
    kind: "paid",
    skill: "research",
    teaches: null,
    requiresSkill: "research",
    minTier: null,
    payoutCents: 750,
    realWork: true,
    prompt: "Note one thing a sample competitor does in public, and whether Momma Mari should ignore it.",
  }),
  task({
    id: "research-quotes",
    locationId: "research-lab",
    name: "Sample quotes",
    taskType: "quotes",
    kind: "paid",
    skill: "research",
    teaches: null,
    requiresSkill: "research",
    minTier: null,
    payoutCents: 650,
    realWork: true,
    prompt: "Pull two short lines a sample viewer might say about a Friday clip. They are invented here, not scraped.",
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
    id: "library-test",
    locationId: "library",
    name: "Shelf test",
    taskType: "test",
    kind: "paid",
    skill: "writing",
    teaches: null,
    requiresSkill: "writing",
    minTier: null,
    payoutCents: 600,
    realWork: true,
    prompt: "Test yourself: in two sentences, what belongs in a content summary? This stays on the shelf.",
  }),
  task({
    id: "library-read",
    locationId: "library",
    name: "Read the shelf",
    taskType: "read",
    kind: "visit",
    skill: "writing",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Read one card. A hidden tip for another task may show up after you submit. Nothing is published.",
    pipeline: { autoChecks: ["You opened a card. The tip stays hidden until you submit."], peerScore: false, ownerGate: false },
  }),
  task({
    id: "library-story",
    locationId: "library",
    name: "Short story",
    taskType: "story",
    kind: "paid",
    skill: "writing",
    teaches: null,
    requiresSkill: "writing",
    minTier: null,
    payoutCents: 800,
    realWork: true,
    prompt: "Write a very short story on the topic “a Friday drop.” A few lines is enough. It is not published.",
  }),
  task({
    id: "library-rate",
    locationId: "library",
    name: "Rate a shelf piece",
    taskType: "rate",
    kind: "paid",
    skill: "writing",
    teaches: null,
    requiresSkill: "writing",
    minTier: null,
    payoutCents: 400,
    realWork: true,
    dailyLimit: 6,
    prompt: "Rate this sample shelf line from 1 to 5 and say why: “The Friday drop is a 20-second clip and a still.”",
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
    id: "clip-tags",
    locationId: "computer-lab",
    name: "Tag a sample clip",
    taskType: "clip-tags",
    kind: "paid",
    skill: "data",
    teaches: null,
    requiresSkill: "data",
    minTier: null,
    payoutCents: 500,
    realWork: true,
    prompt: "Tag the sample clip with three words, such as Friday, cut, still. The tags stay in the city.",
  }),
  task({
    id: "sheet-cleanup",
    locationId: "computer-lab",
    name: "Clean a sample sheet",
    taskType: "sheet-cleanup",
    kind: "paid",
    skill: "data",
    teaches: null,
    requiresSkill: "data",
    minTier: null,
    payoutCents: 520,
    realWork: true,
    prompt: "The sample cell says “20 secodns”. Write the corrected cell and nothing else.",
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
    id: "call-email",
    locationId: "call-center",
    name: "Outreach email draft",
    taskType: "email-draft",
    kind: "paid",
    skill: "outreach",
    teaches: null,
    requiresSkill: "outreach",
    minTier: null,
    payoutCents: 850,
    realWork: true,
    external: "email",
    dailyLimit: 3,
    prompt: "Draft an email to a sample brand. Start with a greeting, one reason to talk, and a close. It is never auto-sent.",
  }),
  task({
    id: "call-ideas",
    locationId: "call-center",
    name: "Script ideas",
    taskType: "script-ideas",
    kind: "paid",
    skill: "outreach",
    teaches: null,
    requiresSkill: "outreach",
    minTier: null,
    payoutCents: 600,
    realWork: true,
    prompt: "List three opener lines for a sample brand. They are ideas, not a dialed call.",
  }),
  task({
    id: "call-drill",
    locationId: "call-center",
    name: "Situation drill",
    taskType: "situation-drill",
    kind: "paid",
    skill: "outreach",
    teaches: null,
    requiresSkill: "outreach",
    minTier: null,
    payoutCents: 650,
    realWork: true,
    prompt: "A sample brand says the Friday cut is late. Write the reply you would give. Nothing is sent.",
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
    id: "caption-card",
    locationId: "art-studio",
    name: "Caption card",
    taskType: "caption",
    kind: "paid",
    skill: "design",
    teaches: null,
    requiresSkill: "design",
    minTier: null,
    payoutCents: 700,
    realWork: true,
    prompt: "Write the on-screen caption for a sample Friday still. One line. No file is uploaded.",
  }),
  task({
    id: "cover-crop",
    locationId: "art-studio",
    name: "Cover crop note",
    taskType: "cover-crop",
    kind: "paid",
    skill: "design",
    teaches: null,
    requiresSkill: "design",
    minTier: null,
    payoutCents: 800,
    realWork: true,
    prompt: "Say what you would crop into a cover: face, hands, or the title. No file is uploaded.",
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
    id: "hook-line",
    locationId: "music-studio",
    name: "Hook line",
    taskType: "hook",
    kind: "paid",
    skill: "audio",
    teaches: null,
    requiresSkill: "audio",
    minTier: null,
    payoutCents: 700,
    realWork: true,
    prompt: "Write one sung line for a sample Friday hook. Nothing is recorded.",
  }),
  task({
    id: "music-bed",
    locationId: "music-studio",
    name: "Bed music note",
    taskType: "bed",
    kind: "paid",
    skill: "audio",
    teaches: null,
    requiresSkill: "audio",
    minTier: null,
    payoutCents: 680,
    realWork: true,
    prompt: "Describe a bed under a 20-second clip: tempo, when it ducks, and when it ends. Nothing is recorded.",
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
    id: "social-like",
    locationId: "social-club",
    name: "Like a draft",
    taskType: "like",
    kind: "social",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 200,
    realWork: true,
    external: "social",
    prompt: "Practice a like on a managed creator's sample post. Say which post and why. Nothing is liked on a live platform.",
  }),
  task({
    id: "social-comment",
    locationId: "social-club",
    name: "Comment draft",
    taskType: "comment",
    kind: "social",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 350,
    realWork: true,
    external: "social",
    prompt: "Practice a comment on a managed creator's sample post. Write the comment. Nothing is posted.",
  }),
  task({
    id: "social-follow",
    locationId: "social-club",
    name: "Follow draft",
    taskType: "follow",
    kind: "social",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 250,
    realWork: true,
    external: "social",
    prompt: "Practice a follow for a managed creator. Name the sample account and why. Nothing is followed live.",
  }),
  task({
    id: "social-story",
    locationId: "social-club",
    name: "Story draft",
    taskType: "story-post",
    kind: "social",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 500,
    realWork: true,
    external: "social",
    prompt: "Practice a story post: one still, one line. Nothing is posted to a connected social.",
  }),
  task({
    id: "social-story-reply",
    locationId: "social-club",
    name: "Story reply draft",
    taskType: "story-reply",
    kind: "social",
    skill: "hospitality",
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 400,
    realWork: true,
    external: "social",
    prompt: "Practice a reply to a sample story. Write the reply. Nothing is sent.",
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
  task({
    id: "office-check-in",
    locationId: "office",
    name: "Check in",
    taskType: "check-in",
    kind: "visit",
    skill: null,
    teaches: null,
    requiresSkill: null,
    minTier: null,
    payoutCents: 0,
    realWork: false,
    prompt: "Creator bots check in, then leave. This visit stays short.",
    disclosure: "A creator bot may visit HQ to check in, then has to leave. Office roster bots stay inside. This is not work for Momma Mari.",
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
    officeCheckedIn: false,
    libraryTips: [],
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
    officeCheckedIn: session.officeCheckedIn === true,
    libraryTips: [...session.libraryTips],
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

function peerScore(note: string) {
  const words = note.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(55, Math.min(98, 58 + words * 4));
}

const DISALLOWED_NOTE = /\b(nsfw|porn|xxx|nude|nudes|naked|hentai)\b/i;
const SPAM_PHRASE = /\b(buy now|click here|free followers|act now|limited offer)\b/i;
const SPAM_URL = /https?:\/\/|www\./i;

/** Hard block. This is not a Worlds task, category, or product. The note is not stored. */
function noteIsDisallowed(note: string) {
  return DISALLOWED_NOTE.test(note);
}

/** Repeated pitches, links, and stuffed words are spam comments. */
export function commentIsSpam(note: string) {
  if (SPAM_URL.test(note) || SPAM_PHRASE.test(note)) return true;
  if (/(.)\1{6,}/.test(note)) return true;
  const words = note.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (words.length < 4) return false;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return Math.max(...counts.values()) >= 4;
}

export function taskWindow(item: Pick<CityTask, "id" | "kind" | "dailyLimit">) {
  const limits = ACTION_LIMITS[item.kind];
  return {
    limit: item.dailyLimit ?? limits.limit,
    windowMs: limits.windowMs,
    cooldownMs: limits.cooldownMs,
    windowKey: item.dailyLimit != null ? `limit:task:${item.id}` : `limit:${item.kind}`,
  };
}

function autoFail(item: CityTask, note: string) {
  if (noteIsDisallowed(note)) return "That note is not allowed in the city. Nothing was stored, posted, or sent.";
  if (item.taskType === "comment" && commentIsSpam(note)) return "Spam comments are rejected. Nothing was posted.";
  if (item.external === "email") {
    if (note.length < 24) return "The auto check wants a full draft: greeting, reason, and a close.";
    if (!/\b(hi|hello|hey)\b/i.test(note)) return "The auto check wants a greeting in the draft.";
  }
  if (item.taskType === "comment" && note.length < 8) return "The auto check wants a comment of at least a few words.";
  if (item.taskType === "story" && note.split(/\s+/).filter(Boolean).length < 12) {
    return "The auto check wants a short story of at least a few lines.";
  }
  if (item.taskType === "rate" && !/\b[1-5]\b/.test(note)) return "The auto check wants a score from 1 to 5 and a line about why.";
  if (item.taskType === "story-post" && note.length < 12) return "The auto check wants the still and the line.";
  return null;
}

function pipelineResult(item: CityTask, note: string) {
  if (item.external === "social" && LIVE_SOCIAL_ACTIONS) {
    return { ok: false as const, error: "Live social actions are flagged on, but this build does not post. Nothing was sent." };
  }
  if (item.external === "email" && LIVE_EMAIL_SEND) {
    return { ok: false as const, error: "Email sending is flagged on, but this build never auto-sends. Nothing was sent." };
  }
  const score = item.pipeline.peerScore ? peerScore(note) : null;
  if (item.practice || item.external === "social") {
    const scored = score === null ? "Practice mode saved this draft." : `Practice score ${score}.`;
    const gate = item.pipeline.ownerGate ? " Owner gate holds this draft." : "";
    return { ok: true as const, score, sent: false as const, summary: `${scored}${gate} Live likes, comments, follows, and story posts are off. Nothing was posted.` };
  }
  if (item.external === "email" || item.pipeline.ownerGate) {
    const scored = score === null ? "Auto check passed." : `Auto check passed. Peer score ${score}.`;
    return { ok: true as const, score, sent: false as const, summary: `${scored} Held for Kamron. Nothing was sent.` };
  }
  if (score !== null) {
    return { ok: true as const, score, sent: false as const, summary: `Auto check passed. Peer score ${score}. Nothing was sent outside the city.` };
  }
  return { ok: true as const, score, sent: false as const, summary: "Auto check passed. Nothing was sent outside the city." };
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
  const failed = autoFail(item, note);
  if (failed) return { ok: false, error: failed };
  if (item.requiresSkill && !session.skills.includes(item.requiresSkill)) {
    return {
      ok: false,
      error: `Finish the learning center lesson for ${SKILL_LABEL[item.requiresSkill]} first. The paid version stays locked.`,
    };
  }
  if (item.id === "office-check-in" && session.officeCheckedIn) {
    return { ok: false, error: "You already checked in. Leave the office." };
  }
  if (item.minTier && homeTierRank(session.homeTier) < homeTierRank(item.minTier)) {
    return { ok: false, error: `${HOME_TIER_LABEL[item.minTier]} unlocks this. The home you have is ${HOME_TIER_LABEL[session.homeTier]}.` };
  }
  const window = taskWindow(item);
  const cooled = onCooldown(session, `task:${item.id}`, window.cooldownMs, input.now);
  if (cooled) return { ok: false, error: cooled };
  const slotted = takeWindow(session, window.windowKey, window.limit, window.windowMs, input.now);
  if (!slotted.ok) return slotted;
  const reviewed = pipelineResult(item, note);
  if (!reviewed.ok) return reviewed;
  let next = slotted.session;
  next.lastAt[`task:${item.id}`] = input.now;
  if (item.teaches && !next.skills.includes(item.teaches)) {
    next.skills.push(item.teaches);
    next.badges.push(item.teaches);
  }
  if (item.id === "library-read") {
    const tip = LIBRARY_TIPS.find((entry) => !next.libraryTips.includes(entry.taskId));
    if (tip) next.libraryTips.push(tip.taskId);
  }
  if (item.payoutCents > 0) next = pay(next, item.payoutCents);
  if (item.id === "office-check-in") next.officeCheckedIn = true;
  next.submissions.push({ taskId: item.id, at: input.now, note });
  const earned = item.payoutCents > 0
    ? ` Mock submission saved. You earned ${formatKash(item.payoutCents)}. Balance ${formatKash(next.kashCents)}.`
    : item.teaches
      ? ` Lesson saved. The ${SKILL_LABEL[item.teaches]} badge is yours. The paid version can unlock.`
      : " Saved in the city. Nothing was sent.";
  const tipLine = item.id === "library-read"
    ? (() => {
        const owned = LIBRARY_TIPS.filter((entry) => next.libraryTips.includes(entry.taskId));
        const latest = owned[owned.length - 1];
        return latest ? ` Hidden tip: ${latest.text}` : " You already have the shelf tips.";
      })()
    : "";
  return { ok: true, session: next, message: `${item.disclosure} ${reviewed.summary}${earned}${tipLine}`, sent: false, score: reviewed.score };
}

export function buyCityItem(session: CitySession, sku: string, now: number): CityResult {
  const item = findCityShopItem(sku);
  if (!item) return { ok: false, error: "That item is not in the city shop." };
  if (session.ownedSkus.includes(sku)) return { ok: false, error: "You already have that. Momma Mari still owns it." };
  if (homeTierRank(session.homeTier) < homeTierRank(item.minTier)) {
    if (item.kind === "outdoor" || item.kind === "oversized") {
      return {
        ok: false,
        error: `${HOME_TIER_LABEL[session.homeTier]} cannot buy yard, outdoor, or oversized items. ${HOME_TIER_LABEL[item.minTier]} unlocks ${item.name}.`,
      };
    }
    return { ok: false, error: `${HOME_TIER_LABEL[item.minTier]} unlocks ${item.name}. You live in a ${HOME_TIER_LABEL[session.homeTier]}.` };
  }
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
      officeCheckedIn: value.officeCheckedIn === true,
      libraryTips: Array.isArray(value.libraryTips) ? value.libraryTips.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}

export function actionClassOf(kind: CityTaskKind): ActionClass {
  return kind;
}
