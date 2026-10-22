export const NICHE_TAGS = ["parenting", "food", "home", "beauty", "lifestyle", "wellness", "fashion", "education"] as const;
export const CONTENT_FORMATS = ["TikTok", "Reels", "Stories", "YouTube", "Photo"] as const;
export const AUDIENCE_RANGES = ["Under 10k", "10–50k", "50–100k", "100–500k", "500k+"] as const;
export const AGE_RANGES = ["0–2", "3–5", "6–8", "9–12", "13–17"] as const;
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
  "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
] as const;

export const MEMBER_PLATFORMS = ["TikTok", "Instagram", "YouTube", "Pinterest", "Facebook"] as const;

export const PROFILE_FIELDS = [
  "displayName",
  "avatar",
  "cover",
  "bio",
  "niches",
  "handles",
  "platforms",
  "pins",
  "snack",
  "loving",
  "weekend",
  "audience",
  "formats",
  "askMe",
  "collabs",
  "state",
  "brands",
  "family",
  "joined",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
