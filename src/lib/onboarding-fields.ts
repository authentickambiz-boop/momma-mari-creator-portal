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

const PLATFORM_IDS: Record<string, OnboardingPlatform> = {
  tiktok: "tiktok",
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  TikTok: "tiktok",
  Instagram: "instagram",
  Facebook: "facebook",
  YouTube: "youtube",
};

export function onboardingPlatformId(value: string) {
  return PLATFORM_IDS[value.trim()] ?? null;
}
