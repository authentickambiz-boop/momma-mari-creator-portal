export const ONBOARDING_PLATFORMS = ["tiktok", "instagram", "facebook", "youtube"] as const;
export type OnboardingPlatform = (typeof ONBOARDING_PLATFORMS)[number];

const PLATFORM_LABELS: Record<OnboardingPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

export function onboardingPlatformLabel(id: string) {
  return PLATFORM_LABELS[id as OnboardingPlatform] ?? id;
}
