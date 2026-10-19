export const ONBOARDING_PLATFORMS = [
  "tiktok", "instagram", "youtube", "twitch", "podcast", "linkedin", "x", "facebook", "pinterest", "snapchat", "newsletter", "blog",
] as const;
export type OnboardingPlatform = (typeof ONBOARDING_PLATFORMS)[number];

const PLATFORM_LABELS: Record<OnboardingPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitch: "Twitch",
  podcast: "Podcast",
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  newsletter: "Newsletter",
  blog: "Blog",
};

export function onboardingPlatformLabel(id: string) {
  return PLATFORM_LABELS[id as OnboardingPlatform] ?? id;
}

const PLATFORM_IDS: Record<string, OnboardingPlatform> = {
  tiktok: "tiktok",
  instagram: "instagram",
  youtube: "youtube",
  twitch: "twitch",
  podcast: "podcast",
  linkedin: "linkedin",
  x: "x",
  facebook: "facebook",
  pinterest: "pinterest",
  snapchat: "snapchat",
  newsletter: "newsletter",
  blog: "blog",
  TikTok: "tiktok",
  Instagram: "instagram",
  YouTube: "youtube",
  Twitch: "twitch",
  Podcast: "podcast",
  LinkedIn: "linkedin",
  X: "x",
  Facebook: "facebook",
  Pinterest: "pinterest",
  Snapchat: "snapchat",
  Newsletter: "newsletter",
  Blog: "blog",
};

export function onboardingPlatformId(value: string) {
  return PLATFORM_IDS[value.trim()] ?? null;
}
