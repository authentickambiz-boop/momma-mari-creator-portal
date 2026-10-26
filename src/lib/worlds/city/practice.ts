/**
 * Owner practice harness for Worlds City.
 * Each run uses a throwaway session, a mocked note, and the normal quality
 * pipeline. It never posts to a social network and never sends email.
 * The city route stays owner-only, and WORLDS_CITY stays off unless it is exactly "true".
 */

import type { HomeTier } from "../economy";
import { SKILL_LABEL, type SkillId } from "./locations";
import {
  CITY_TASKS,
  LIVE_EMAIL_SEND,
  LIVE_SOCIAL_ACTIONS,
  emptyCitySession,
  findCityTask,
  submitCityTask,
  type CityTask,
} from "./tasks";

export type PracticeLocationId = "social-club" | "library" | "call-center";

const NOTES: Record<string, string> = {
  "club-hello": "Wave from the booth.",
  "social-like": "Like the Friday clip because the cut is clear.",
  "social-comment": "The Friday still lands cleanly.",
  "social-follow": "Follow the sample creator for the Friday edits.",
  "social-story": "Friday still. One line about the cut.",
  "social-story-reply": "Reply: the still works and the line is tight.",
  "library-summary": "The Friday drop is a short clip plus one still.",
  "library-test": "A summary names the point and leaves the rest out.",
  "library-read": "Opened the shelf card.",
  "library-story": "A Friday drop waited on the shelf until Mara pressed play and the room went quiet at last.",
  "library-rate": "4. The line is clear and the still is named.",
  "call-script": "Hi, this is a sample hello. One question, then I stop. Thank you for the time.",
  "dm-review": "I would answer that the Friday cut is the 20-second clip.",
  "call-email": "Hi, the Friday cut is ready for a look. One note is enough. Thank you.",
  "call-ideas": "Hello there. One question about Friday. Thanks for a moment.",
  "call-drill": "The cut is close. I would offer the 20-second version and wait.",
};

export function practiceOwnerSession(tier: HomeTier = "mansion") {
  const skills = Object.keys(SKILL_LABEL) as SkillId[];
  return {
    ...emptyCitySession(),
    skills: [...skills],
    badges: [...skills],
    homeTier: tier,
  };
}

export function practiceNote(task: CityTask) {
  return NOTES[task.id] ?? `Sample draft for ${task.name}. It stays in the city.`;
}

export type PracticeRun =
  | {
      ok: true;
      taskId: string;
      locationId: CityTask["locationId"];
      payoutCents: number;
      balanceCents: number;
      score: number | null;
      sent: false;
      message: string;
    }
  | { ok: false; taskId: string; error: string };

/** Run one task as Kamron. The session is thrown away. Nothing is delivered. */
export function runPracticeTask(taskId: string, now = 1_000_000): PracticeRun {
  if (LIVE_SOCIAL_ACTIONS || LIVE_EMAIL_SEND) {
    return { ok: false, taskId, error: "Practice stopped. Live social actions and email sending stay off." };
  }
  const task = findCityTask(taskId);
  if (!task) return { ok: false, taskId, error: "That task is not on the city map." };
  const result = submitCityTask(practiceOwnerSession(), task.id, { optIn: true, note: practiceNote(task), now });
  if (!result.ok) return { ok: false, taskId, error: result.error };
  if (result.sent !== false) return { ok: false, taskId, error: "A practice run must not send anything." };
  return {
    ok: true,
    taskId: task.id,
    locationId: task.locationId,
    payoutCents: task.payoutCents,
    balanceCents: result.session.kashCents,
    score: result.score ?? null,
    sent: false,
    message: result.message,
  };
}

export function practiceTasksFor(locationId: PracticeLocationId) {
  return CITY_TASKS.filter((item) => item.locationId === locationId);
}

/** Every Social club, Library, and Call center task, each on its own owner session. */
export function runPracticeLocation(locationId: PracticeLocationId, now = 1_000_000) {
  return practiceTasksFor(locationId).map((task, index) => runPracticeTask(task.id, now + index));
}
