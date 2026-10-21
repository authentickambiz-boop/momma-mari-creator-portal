/** Signing bar from Kamron, Oct 21, 2026. One place for the follower cutoff. */
export const SIGN_FOLLOWER_MINIMUM = 100_000;

export const CURRICULUM_BANDS = [
  { id: "0-1k", label: "0 to 1k followers", min: 0, max: 999 },
  { id: "1k-10k", label: "1k to 10k followers", min: 1_000, max: 9_999 },
  { id: "10k-50k", label: "10k to 50k followers", min: 10_000, max: 49_999 },
  { id: "50k-100k", label: "50k to 100k followers", min: 50_000, max: 99_999 },
] as const;

export type CurriculumBandId = (typeof CURRICULUM_BANDS)[number]["id"];

export function curriculumBand(followers: number): CurriculumBandId | null {
  if (!Number.isInteger(followers) || followers < 0) return null;
  const band = CURRICULUM_BANDS.find((item) => followers >= item.min && followers <= item.max);
  return band?.id ?? null;
}

/** 100k followers or more on any platform is the sign path. Everyone else gets the curriculum. */
export function signingRoute(maxFollowers: number): "sign" | "curriculum" {
  return maxFollowers >= SIGN_FOLLOWER_MINIMUM ? "sign" : "curriculum";
}
