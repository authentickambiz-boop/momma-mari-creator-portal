export const SERVICE_PLATFORMS = [
  "TikTok",
  "Instagram",
  "YouTube",
  "Twitch",
  "Podcast",
  "LinkedIn",
  "X",
  "Facebook",
  "Pinterest",
  "Snapchat",
  "Newsletter",
  "Blog",
] as const;

export const PLATFORM_METRICS = [
  { platform: "Twitch", metric: "Average concurrent viewers" },
  { platform: "Twitch", metric: "Hours streamed" },
  { platform: "YouTube", metric: "Average views" },
  { platform: "Podcast", metric: "Downloads per episode" },
  { platform: "LinkedIn", metric: "Impressions" },
  { platform: "LinkedIn", metric: "Followers" },
  { platform: "X", metric: "Impressions" },
  { platform: "Facebook", metric: "Followers" },
  { platform: "Pinterest", metric: "Impressions" },
  { platform: "Snapchat", metric: "Views" },
  { platform: "Newsletter", metric: "Subscribers" },
  { platform: "Blog", metric: "Monthly readers" },
] as const;

export type PlatformStat = { platform: string; metric: string; value: string };

/** Live Stripe prices. Nothing on this list is charged from the portal while payments are off. */
export const MEDIA_KIT_CATALOG = [
  { id: "media_kit_build", name: "Media Kit", priceLabel: "$149" },
  { id: "rate_card_build", name: "Rate card build", priceLabel: "$79" },
  { id: "media_kit_bundle", name: "Media Kit + Rate Card", priceLabel: "$199" },
  { id: "contract_review", name: "Contract Review", priceLabel: "$125" },
  { id: "starter_kits", name: "Starter Kits", priceLabel: "$149/$299/$499" },
] as const;

export const BENCH_PROMOTE_SCORE = 70;
