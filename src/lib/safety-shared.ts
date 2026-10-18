export const SAFETY_KINDS = ["school", "house", "location", "name"] as const;

export type SafetyKind = (typeof SAFETY_KINDS)[number];

export function isSafetyKind(value: string): value is SafetyKind {
  return (SAFETY_KINDS as readonly string[]).includes(value);
}

export function safetyLabel(kind: string) {
  if (kind === "school") return "school logo";
  if (kind === "house") return "house number";
  if (kind === "location") return "location tag";
  if (kind === "name") return "child's name";
  return "flag";
}

const SCHOOL = [
  /\belementary\b/i,
  /\bmiddle school\b/i,
  /\bhigh school\b/i,
  /\bpreschool\b/i,
  /\bgrade school\b/i,
  /\bschool logo\b/i,
  /\bschool uniform\b/i,
  /\bschool mascot\b/i,
  /\bpta\b/i,
  /\bschool\b/i,
];

const HOUSE = /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){1,4}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|circle|cir)\b\.?/i;

const LOCATION = [
  /\bgeotag\b/i,
  /\bgeo-tag\b/i,
  /\blocation tag\b/i,
  /\bgps\b/i,
  /\bcheck-in\b/i,
  /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/,
];

function clip(value: string | null | undefined) {
  return (value ?? "").slice(0, 2000);
}

function hasChildFullName(text: string) {
  const kin = "(?:son|daughter|kid|child|children|boy|girl)";
  const person = "[A-Z][a-z]{1,20}\\s+[A-Z][a-z]{1,20}";
  const forward = new RegExp(`\\b${kin}\\b[^\\n.]{0,60}\\b${person}\\b`);
  const backward = new RegExp(`\\b${person}\\b[^\\n.]{0,60}\\b${kin}\\b`);
  return forward.test(text) || backward.test(text);
}

/** Returns flag kinds only. The matched words are not returned. */
export function findSafetyKinds(input: {
  filename?: string | null;
  caption?: string | null;
  locationTag?: string | null;
}): SafetyKind[] {
  const text = [clip(input.filename), clip(input.caption)].filter(Boolean).join("\n");
  const kinds: SafetyKind[] = [];
  if (SCHOOL.some((pattern) => pattern.test(text))) kinds.push("school");
  if (HOUSE.test(text)) kinds.push("house");
  const location = clip(input.locationTag).trim();
  if (location || LOCATION.some((pattern) => pattern.test(text))) kinds.push("location");
  if (hasChildFullName(text)) kinds.push("name");
  return kinds;
}
