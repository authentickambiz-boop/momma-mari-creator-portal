import type { SkillTopicId } from "./skill-lessons";

/** How far along the stats they typed or uploaded look. Labels stay off the public page. */
export type AnalyticsLevel = "starting" | "building" | "ready";

export type StartGuide = {
  topic: SkillTopicId;
  headline: string;
  body: string;
  /** Same sentence for every level of that niche. Omitted for default, lifestyle, and diy. */
  safety?: string;
};

type LevelGuide = Omit<StartGuide, "safety">;

type NicheKey = "default" | "gaming" | "streaming" | "makeup_beauty" | "diy" | "parenting" | "stay_at_home" | "music" | "sports_fitness" | "modeling" | "lifestyle";

type NicheStart = Record<AnalyticsLevel, LevelGuide> & { safety?: string };

/** Shown above the niche card for every free creator. */
export const START_BASICS: string[] = [
  "Add your handles and a recent analytics screenshot for each platform, so this guide matches where you are.",
  "Put a contact email in every bio, so brands can reach you without a DM.",
  "On every sponsored or gifted post, turn on the platform's paid-partnership label.",
];

/**
 * Edit this table to change which Learn topic a free creator sees.
 * Keys are niche ids from the niche list, plus "default".
 */
export const WHERE_TO_START: Record<NicheKey, NicheStart> = {
  default: {
    starting: { topic: "hooks", headline: "Start with one clear hook", body: "Film a short video that says who it is for in the first line. The hooks lesson shows a simple shape." },
    building: { topic: "posting", headline: "Pick a posting rhythm", body: "Two posts a week is enough to learn what your audience replays. The posting lesson keeps the week small." },
    ready: { topic: "ugc", headline: "Shape a simple brand video", body: "You already have proof on your pages. The UGC lesson is the first brand-style video to practice." },
  },
  lifestyle: {
    starting: { topic: "hooks", headline: "Open with the day, not the brand", body: "A day-in-the-life hook works before any product. Start with the hooks lesson." },
    building: { topic: "filming", headline: "Film one room, one story", body: "Keep the shot list short. The filming lesson is the next step." },
    ready: { topic: "ugc", headline: "Turn a routine into a brand demo", body: "The UGC lesson shows how to fold a product into a routine you already post." },
  },
  gaming: {
    safety: "Say it's sponsored on stream, and pin the disclosure in chat.",
    starting: { topic: "filming", headline: "Capture one clean clip", body: "A single gameplay moment is enough to start. The filming lesson covers the setup." },
    building: { topic: "editing", headline: "Cut to the moment", body: "Trim the quiet parts. The editing lesson is the next pass." },
    ready: { topic: "ugc", headline: "Show a game the way a sponsor would", body: "The UGC lesson is a sponsored-style read of a game you already play." },
  },
  streaming: {
    safety: "Say it's sponsored on stream, and pin the disclosure in chat.",
    starting: { topic: "hooks", headline: "Title the stream in one line", body: "Tell people what happens tonight. Start with the hooks lesson." },
    building: { topic: "posting", headline: "Clip one moment after you go live", body: "The posting lesson is how that clip finds people who missed the stream." },
    ready: { topic: "growth", headline: "Point viewers to the next stream", body: "The growth lesson is the follow-up after a stream that already has an audience." },
  },
  makeup_beauty: {
    safety: "Show the product clearly in the first few seconds, and only claim results you actually saw.",
    starting: { topic: "filming", headline: "Film the product in your light", body: "One look, close to the camera. The filming lesson is the setup." },
    building: { topic: "editing", headline: "Show the before and the finish", body: "The editing lesson is the cut between those two frames." },
    ready: { topic: "ugc", headline: "Read a product the way a brand asks", body: "The UGC lesson is a straight demo you can reuse for pitches." },
  },
  diy: {
    starting: { topic: "filming", headline: "Show the first step, then the result", body: "Two shots are enough. The filming lesson keeps the project watchable." },
    building: { topic: "editing", headline: "Skip the waiting", body: "The editing lesson is how to jump from start to finish." },
    ready: { topic: "ugc", headline: "Make the tool the hero", body: "The UGC lesson puts the product in the step you already know." },
  },
  parenting: {
    safety: "Keep your child's face, name and school out of brand content unless you have a written OK, and work only with family-safe brands.",
    starting: { topic: "hooks", headline: "Lead with the moment, not the pitch", body: "The hooks lesson is a first line a parent would stop for." },
    building: { topic: "posting", headline: "Post when you can, not every day", body: "The posting lesson is a week you can keep." },
    ready: { topic: "ugc", headline: "A product in a real family moment", body: "The UGC lesson is that moment with a clear product shot." },
  },
  stay_at_home: {
    safety: "Keep kids' faces, names and your home address out of brand content unless you have a written OK.",
    starting: { topic: "hooks", headline: "Start from the middle of the day", body: "The hooks lesson is a line that sounds like your house, not a studio." },
    building: { topic: "posting", headline: "Keep one series going", body: "The posting lesson is how a series stays easy." },
    ready: { topic: "ugc", headline: "Show the product in the routine", body: "The UGC lesson fits a product into something you already do." },
  },
  music: {
    safety: "Keep the rights to your own tracks. Using your song in a brand's ad is a separate license.",
    starting: { topic: "filming", headline: "One take, one chorus", body: "The filming lesson is a single performance, not a shoot day." },
    building: { topic: "editing", headline: "Cut on the beat", body: "The editing lesson is the first pass on that take." },
    ready: { topic: "growth", headline: "Send listeners to the full song", body: "The growth lesson is the follow-up after a clip that already travels." },
  },
  sports_fitness: {
    safety: "Use the brand's approved wording for any supplement or health claim.",
    starting: { topic: "filming", headline: "Film one exercise cleanly", body: "The filming lesson is the angle and the count." },
    building: { topic: "posting", headline: "Repeat the series", body: "The posting lesson is how the next workout finds the same people." },
    ready: { topic: "ugc", headline: "Demo gear you actually use", body: "The UGC lesson is a straight read of that gear." },
  },
  modeling: {
    safety: "A brand using your photos or video as ads is a separate fee from the post itself.",
    starting: { topic: "filming", headline: "One outfit, one light", body: "The filming lesson is a simple portrait setup." },
    building: { topic: "editing", headline: "Pick the frame", body: "The editing lesson is choosing one still or one short clip." },
    ready: { topic: "ugc", headline: "Wear the piece and name it", body: "The UGC lesson is a look the brand can recognize." },
  },
};

export function analyticsLevel(input: { followers: number | null; views: number | null; uploads: number }): AnalyticsLevel {
  const reach = Math.max(input.followers ?? 0, input.views ?? 0);
  if (reach >= 50_000) return "ready";
  if (reach >= 1_000 || input.uploads > 0) return "building";
  return "starting";
}

export function whereToStart(niche: string | null | undefined, level: AnalyticsLevel): StartGuide {
  const table = (niche && WHERE_TO_START[niche as NicheKey]) || WHERE_TO_START.default;
  const guide = table[level];
  return table.safety ? { ...guide, safety: table.safety } : guide;
}
