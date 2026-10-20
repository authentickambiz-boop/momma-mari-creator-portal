const TEAM_ERROR_TEXT = {
  owner: "Only an owner can add a manager.",
  name: "Enter the manager's name.",
  email: "Enter a Google email address.",
  admin: "That address is already an owner.",
  creator: "That address already belongs to a creator.",
  taken: "That manager is already on the team.",
  change: "Only an owner can change a manager.",
  missing: "Manager not found.",
  assign: "Only an owner can assign a manager.",
  who: "Creator not found.",
  backup: "Pick a different backup.",
  active: "Assign an active manager.",
} as const;

/** A short code for the team form. Unknown wording stays the fixed fallback. */
export function teamErrorCode(error: string) {
  const match = (Object.keys(TEAM_ERROR_TEXT) as (keyof typeof TEAM_ERROR_TEXT)[])
    .find((code) => TEAM_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known team sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function teamErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return TEAM_ERROR_TEXT[code as keyof typeof TEAM_ERROR_TEXT] ?? null;
}
