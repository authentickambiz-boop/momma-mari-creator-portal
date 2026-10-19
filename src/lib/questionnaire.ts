import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creatorProfiles, creatorQuestionnaires, creators, mediaKits } from "@/db/schema";
import { FORMAT_OPTIONS, LANGUAGE_OPTIONS, LOCATION_OPTIONS, NICHE_CATALOG, PLATFORM_OPTIONS } from "./niche-catalog";
import { nowIso, parseJson } from "./format";
import { onboardingForCreator } from "./onboarding";
import { cleanTag } from "./tag-picker";
import type { Viewer } from "./types";

export const QUESTION_STEPS = [
  { id: "niches", title: "What do you post about?", optional: false },
  { id: "platforms", title: "Platforms and handles", optional: false },
  { id: "audience", title: "Your audience", optional: false },
  { id: "formats", title: "Content formats", optional: false },
  { id: "frequency", title: "How often you post", optional: false },
  { id: "rates", title: "Rates by deliverable", optional: false },
  { id: "brands", title: "Brands", optional: false },
  { id: "kids", title: "Kids' age ranges", optional: true },
  { id: "camera", title: "Kids on camera", optional: true },
  { id: "availability", title: "Availability and turnaround", optional: false },
  { id: "shipping", title: "Shipping region", optional: false },
  { id: "languages", title: "Languages", optional: false },
  { id: "bot", title: "Tell us about your bot", optional: false },
] as const;

export type QuestionStepId = (typeof QUESTION_STEPS)[number]["id"];

export type QuestionnaireAnswers = {
  niches: string[];
  platforms: string[];
  handles: Record<string, string>;
  audienceSize: string;
  audienceAge: string;
  genderSplit: string;
  locations: string[];
  formats: string[];
  frequency: string;
  rates: Record<string, string>;
  brands: string[];
  blocked: string[];
  kidAges: string[];
  kidsConfirm: boolean;
  onCamera: string;
  availability: string;
  turnaround: string;
  shipping: string;
  languages: string[];
};

const EMPTY: QuestionnaireAnswers = {
  niches: [],
  platforms: [],
  handles: {},
  audienceSize: "",
  audienceAge: "",
  genderSplit: "",
  locations: [],
  formats: [],
  frequency: "",
  rates: {},
  brands: [],
  blocked: [],
  kidAges: [],
  kidsConfirm: false,
  onCamera: "",
  availability: "",
  turnaround: "",
  shipping: "",
  languages: [],
};

function tags(values: string[]) {
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

export function stepIndex(id: string) {
  return QUESTION_STEPS.findIndex((step) => step.id === id);
}

export function nextStep(id: string): QuestionStepId | "done" {
  const index = stepIndex(id);
  if (index < 0 || index >= QUESTION_STEPS.length - 1) return "done";
  return QUESTION_STEPS[index + 1].id;
}

export async function questionnaireFor(db: PortalDb, creatorId: string) {
  const rows = await db.select().from(creatorQuestionnaires).where(eq(creatorQuestionnaires.creatorId, creatorId));
  const row = rows[0];
  return {
    step: (row?.step || "niches") as QuestionStepId | "done",
    answers: { ...EMPTY, ...parseJson<Partial<QuestionnaireAnswers>>(row?.answersJson, {}) },
    paused: Boolean(row?.pausedAt),
    finished: Boolean(row?.finishedAt),
  };
}

export async function needsQuestionnaire(db: PortalDb, creatorId: string) {
  const state = await questionnaireFor(db, creatorId);
  return !state.finished && !state.paused;
}

async function writeState(db: PortalDb, creatorId: string, step: string, answers: QuestionnaireAnswers, flags: { paused?: boolean; finished?: boolean }) {
  const timestamp = nowIso();
  const existing = await db.select().from(creatorQuestionnaires).where(eq(creatorQuestionnaires.creatorId, creatorId));
  const values = {
    creatorId,
    step,
    answersJson: JSON.stringify(answers),
    pausedAt: flags.paused ? timestamp : null,
    finishedAt: flags.finished ? timestamp : null,
    updatedAt: timestamp,
  };
  if (existing[0]) await db.update(creatorQuestionnaires).set(values).where(eq(creatorQuestionnaires.creatorId, creatorId));
  else await db.insert(creatorQuestionnaires).values(values);
}

export async function saveQuestionnaireStep(
  db: PortalDb,
  viewer: Viewer,
  input: { step: string; skip: boolean; pause: boolean; patch: Partial<QuestionnaireAnswers> },
) {
  if (viewer.role !== "creator" || !viewer.creatorId) return { ok: false as const, error: "Creators fill this in on their own sign-in." };
  const step = QUESTION_STEPS.find((item) => item.id === input.step);
  if (!step) return { ok: false as const, error: "That step is not part of the questionnaire." };
  const current = await questionnaireFor(db, viewer.creatorId);
  const answers = input.skip ? current.answers : applyPatch(current.answers, input.patch);
  if (step.id === "kids" && answers.kidAges.length && !answers.kidsConfirm && !input.skip && !input.pause) {
    return { ok: false as const, error: "Confirm the age ranges, or skip this step." };
  }
  if (input.pause) {
    await writeState(db, viewer.creatorId, step.id, answers, { paused: true });
    await prefillFromAnswers(db, viewer.creatorId, answers);
    return { ok: true as const, next: "home" as const };
  }
  if (input.skip && !step.optional) return { ok: false as const, error: "This step is required." };
  if (!input.skip && step.id === "bot") {
    const prior = await onboardingForCreator(db, viewer.creatorId);
    if (!prior?.finishedAt) return { ok: false as const, error: "Finish the bot questions on this step." };
  }
  if (!input.skip) {
    const problem = stepProblem(step.id, answers);
    if (problem) return { ok: false as const, error: problem };
  }
  const following = nextStep(step.id);
  await writeState(db, viewer.creatorId, following === "done" ? "bot" : following, answers, { finished: following === "done" });
  await prefillFromAnswers(db, viewer.creatorId, answers);
  return { ok: true as const, next: following };
}

async function prefillFromAnswers(db: PortalDb, creatorId: string, answers: QuestionnaireAnswers) {
  const people = await db.select().from(creators).where(eq(creators.id, creatorId));
  const creator = people[0];
  if (!creator) return;
  const existing = await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, creatorId));
  const handles = Object.entries(answers.handles).filter(([, value]) => value.trim()).map(([platform, value]) => `${platform} ${value.trim()}`).join(", ");
  const profile = {
    niches: answers.niches.length ? JSON.stringify(answers.niches) : (existing[0]?.niches ?? "[]"),
    formats: answers.formats.length ? JSON.stringify(answers.formats) : (existing[0]?.formats ?? "[]"),
    brands: answers.brands.length ? JSON.stringify(answers.brands) : (existing[0]?.brands ?? "[]"),
    handles: handles || existing[0]?.handles || null,
    audience: answers.audienceSize || existing[0]?.audience || null,
    childAge: answers.kidAges[0] || existing[0]?.childAge || null,
    updatedAt: nowIso(),
  };
  if (existing[0]) {
    await db.update(creatorProfiles).set(profile).where(eq(creatorProfiles.creatorId, creatorId));
  } else {
    await db.insert(creatorProfiles).values({
      creatorId,
      profileOn: false,
      displayName: creator.name,
      displayNameOn: false,
      avatarOn: false,
      bio: null,
      bioOn: false,
      nichesOn: false,
      handlesOn: false,
      audienceOn: false,
      formatsOn: false,
      askMe: null,
      askMeOn: false,
      collabs: false,
      collabsOn: false,
      state: null,
      stateOn: false,
      brandsOn: false,
      childName: null,
      familyOn: false,
      joinedOn: true,
      ...profile,
    });
  }
  const nicheText = answers.niches.join(", ");
  const kits = await db.select().from(mediaKits).where(eq(mediaKits.creatorId, creatorId));
  if (kits[0]) {
    await db.update(mediaKits).set({ niches: nicheText || kits[0].niches, updatedAt: nowIso() }).where(eq(mediaKits.creatorId, creatorId));
  } else if (nicheText) {
    let slug = `${creator.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || creatorId}`.slice(0, 40);
    const taken = await db.select().from(mediaKits).where(eq(mediaKits.slug, slug));
    if (taken[0] && taken[0].creatorId !== creatorId) slug = `${slug}-${creatorId}`.replace(/[^a-z0-9-]+/g, "").slice(0, 40);
    await db.insert(mediaKits).values({
      creatorId,
      slug,
      published: false,
      displayName: creator.name,
      bio: null,
      followers: null,
      avgViews: null,
      engagement: null,
      niches: nicheText,
      updatedAt: nowIso(),
    });
  }
}

export function matchOffer(answers: QuestionnaireAnswers, offer: { brand: string; subtitle?: string | null }) {
  const reasons: string[] = [];
  let score = 35;
  const brand = offer.brand.trim().toLowerCase();
  const subtitle = (offer.subtitle ?? "").toLowerCase();
  if (answers.niches.length) {
    score += 10;
    reasons.push("Niches are on file");
    if (answers.niches.some((niche) => subtitle.includes(niche.toLowerCase()))) {
      score += 15;
      reasons.push("A niche matches this offer");
    }
  }
  if (answers.platforms.length) {
    score += 10;
    reasons.push("Platforms are on file");
  }
  if (answers.brands.some((item) => item.toLowerCase() === brand)) {
    score += 25;
    reasons.push("She has worked with this brand");
  }
  if (answers.languages.length) score += 5;
  const blocked = [...answers.blocked].some((item) => item.toLowerCase() === brand || (subtitle && subtitle.includes(item.toLowerCase())));
  if (blocked) {
    score = Math.min(score, 12);
    reasons.push("This brand or category is on her no list");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export const AUDIENCE_AGE_OPTIONS = ["Under 18", "18–24", "25–34", "35–44", "45+", "Mixed"] as const;
export const GENDER_OPTIONS = ["Mostly women", "Mostly men", "Even split"] as const;
export const FREQUENCY_OPTIONS = ["Daily", "A few times a week", "Weekly", "A few times a month"] as const;
export const TURNAROUND_OPTIONS = ["2–3 days", "About a week", "2 weeks", "About a month"] as const;
export const SHIPPING_OPTIONS = ["United States", "Canada", "United Kingdom", "No product shipping"] as const;
export const CAMERA_OPTIONS = ["Yes", "No", "With limits"] as const;
export const RATE_FIELDS = [
  "TikTok",
  "Reel",
  "Story",
  "Photo",
  "Stream segment",
  "Viewer-hour",
  "YouTube integration",
  "Dedicated YouTube video",
  "Podcast pre-roll",
  "Podcast mid-roll",
  "Host-read",
  "LinkedIn post",
  "X post",
  "Facebook post",
  "Pinterest pin",
  "Snapchat story",
  "Newsletter placement",
  "Blog post",
] as const;

export function stepProblem(step: QuestionStepId, answers: QuestionnaireAnswers) {
  if (step === "niches" && answers.niches.length === 0) return "Pick at least one niche.";
  if (step === "platforms" && answers.platforms.length === 0) return "Pick at least one platform.";
  if (step === "audience" && !answers.audienceSize.trim()) return "Choose an audience size.";
  if (step === "formats" && answers.formats.length === 0) return "Pick at least one format.";
  if (step === "frequency" && !answers.frequency.trim()) return "Choose how often you post.";
  if (step === "rates" && !Object.values(answers.rates).some((value) => value.trim())) return "Add at least one rate.";
  if (step === "brands" && answers.brands.length === 0) return "Add a brand you have worked with.";
  if (step === "availability" && (!answers.availability.trim() || !answers.turnaround.trim())) return "Add your availability and turnaround.";
  if (step === "shipping" && !answers.shipping.trim()) return "Choose a shipping region.";
  if (step === "languages" && answers.languages.length === 0) return "Pick at least one language.";
  return null;
}

function applyPatch(current: QuestionnaireAnswers, patch: Partial<QuestionnaireAnswers>) {
  const answers: QuestionnaireAnswers = {
    ...current,
    ...patch,
    handles: { ...current.handles },
    rates: { ...current.rates },
  };
  if (patch.niches) answers.niches = tags(patch.niches);
  if (patch.platforms) answers.platforms = tags(patch.platforms);
  if (patch.formats) answers.formats = tags(patch.formats);
  if (patch.brands) answers.brands = tags(patch.brands);
  if (patch.blocked) answers.blocked = tags(patch.blocked);
  if (patch.languages) answers.languages = tags(patch.languages);
  if (patch.locations) answers.locations = tags(patch.locations);
  if (patch.kidAges) answers.kidAges = tags(patch.kidAges);
  if (patch.handles) {
    for (const [key, value] of Object.entries(patch.handles)) answers.handles[key] = value.trim();
  }
  if (patch.rates) {
    for (const [key, value] of Object.entries(patch.rates)) answers.rates[key] = value.trim();
  }
  if (patch.audienceSize !== undefined) answers.audienceSize = patch.audienceSize.trim();
  if (patch.audienceAge !== undefined) answers.audienceAge = patch.audienceAge.trim();
  if (patch.genderSplit !== undefined) answers.genderSplit = patch.genderSplit.trim();
  if (patch.frequency !== undefined) answers.frequency = patch.frequency.trim();
  if (patch.onCamera !== undefined) answers.onCamera = patch.onCamera.trim();
  if (patch.availability !== undefined) answers.availability = patch.availability.trim();
  if (patch.turnaround !== undefined) answers.turnaround = patch.turnaround.trim();
  if (patch.shipping !== undefined) answers.shipping = patch.shipping.trim();
  if (patch.kidsConfirm !== undefined) answers.kidsConfirm = patch.kidsConfirm;
  return answers;
}

export async function creatorStartPath(db: PortalDb, viewer: Viewer) {
  if (viewer.role === "creator" && viewer.creatorId && (await needsQuestionnaire(db, viewer.creatorId))) return "/onboarding";
  return "/";
}

export const pickerOptions = {
  niches: NICHE_CATALOG,
  formats: FORMAT_OPTIONS,
  platforms: PLATFORM_OPTIONS,
  languages: LANGUAGE_OPTIONS,
  locations: LOCATION_OPTIONS,
};
