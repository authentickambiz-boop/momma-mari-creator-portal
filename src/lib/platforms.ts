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

/** Existing catalog prices for a media kit. Nothing on this list is charged from the portal. */
export const MEDIA_KIT_CATALOG = [
  { id: "C4", name: "Media kit", priceLabel: "$179" },
  { id: "C5", name: "Rate card refresh", priceLabel: "$99" },
  { id: "C6", name: "Sponsor-ready kit", priceLabel: "$229" },
] as const;

export const BENCH_PROMOTE_SCORE = 70;
