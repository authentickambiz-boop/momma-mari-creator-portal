/**
 * Who may enter a city building. The rules live on each location.
 * A locked result keeps the visitor on the exterior and says why.
 */

import { HOME_TIER_LABEL, type HomeTier } from "../economy";

export const ACCESS_ROLES = ["owner", "officeBot", "creatorBot", "user"] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export type EnterMode = "full" | "check-in" | "ownership" | "job" | "membership" | "locked";

export type EnterRule = {
  role: AccessRole;
  mode: EnterMode;
  reason: string;
};

export type EnterDecision = {
  open: boolean;
  mode: EnterMode;
  reason: string;
};

export type AccessSession = {
  homeTier: HomeTier;
  skills: readonly string[];
  officeCheckedIn?: boolean;
};

const JOB_SITES = new Set([
  "research-lab",
  "library",
  "computer-lab",
  "call-center",
  "art-studio",
  "music-studio",
]);

const OFFICE_BOT_LOCK = "Office roster bots stay inside HQ until the buildings are connected.";

function article(label: string) {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

export function enterRulesFor(id: string): EnterRule[] {
  if (id === "office") {
    return [
      { role: "owner", mode: "full", reason: "Kamron can enter HQ." },
      { role: "officeBot", mode: "full", reason: "Office roster bots work inside HQ." },
      { role: "creatorBot", mode: "check-in", reason: "Creator bots can check in, then they have to leave." },
      { role: "user", mode: "locked", reason: "Only Kamron and the office roster can enter HQ." },
    ];
  }
  if (id === "home") {
    return [
      { role: "owner", mode: "ownership", reason: "You can enter the home you own." },
      { role: "user", mode: "ownership", reason: "You can enter the home you own." },
      { role: "creatorBot", mode: "locked", reason: "Creator bots do not live in these neighborhoods." },
      { role: "officeBot", mode: "locked", reason: OFFICE_BOT_LOCK },
    ];
  }
  if (JOB_SITES.has(id)) {
    return [
      { role: "owner", mode: "full", reason: "Kamron can enter." },
      { role: "officeBot", mode: "locked", reason: OFFICE_BOT_LOCK },
      { role: "creatorBot", mode: "job", reason: "This job stays locked until you earn the skill badge at the learning center." },
      { role: "user", mode: "job", reason: "This job stays locked until you earn the skill badge at the learning center." },
    ];
  }
  return [
    { role: "owner", mode: "full", reason: "Kamron can enter." },
    { role: "officeBot", mode: "locked", reason: OFFICE_BOT_LOCK },
    { role: "creatorBot", mode: "membership", reason: "This place is open." },
    { role: "user", mode: "membership", reason: "This place is open." },
  ];
}

export function decideEnter(
  location: { id: string; skills: readonly string[]; enterRules: readonly EnterRule[] },
  role: AccessRole,
  session: AccessSession,
  propertyTier?: HomeTier,
): EnterDecision {
  const rule = location.enterRules.find((item) => item.role === role)
    ?? { role, mode: "locked" as const, reason: "This building is locked." };
  if (location.id === "office" && role === "creatorBot") {
    if (session.officeCheckedIn) {
      return { open: false, mode: "locked", reason: "You already checked in. Leave the office." };
    }
    return { open: true, mode: "check-in", reason: rule.reason };
  }
  if (rule.mode === "job") {
    const open = location.skills.some((skill) => session.skills.includes(skill));
    return {
      open,
      mode: open ? "job" : "locked",
      reason: open ? "Your skill badge unlocks this job." : rule.reason,
    };
  }
  if (rule.mode === "ownership") {
    const tier = propertyTier ?? session.homeTier;
    const open = session.homeTier === tier;
    const live = HOME_TIER_LABEL[session.homeTier];
    const place = HOME_TIER_LABEL[tier];
    return {
      open,
      mode: open ? "ownership" : "locked",
      reason: open
        ? `You live in this ${place.toLowerCase()}.`
        : `You live in ${article(live)} ${live}. This ${place} lane is locked until you own ${article(place)} ${place.toLowerCase()}.`,
    };
  }
  if (rule.mode === "locked") return { open: false, mode: "locked", reason: rule.reason };
  return { open: true, mode: rule.mode, reason: rule.reason };
}

export function allowsWalkIn(decision: EnterDecision, interior: "panel" | "walk-in") {
  return decision.open && interior === "walk-in" && decision.mode !== "check-in";
}
