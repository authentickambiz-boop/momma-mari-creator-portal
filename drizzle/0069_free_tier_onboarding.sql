-- Free self-serve tier, invite codes, typed handles, private stat uploads,
-- commission product requests, and the welcome checklist.
-- Adds columns and tables only. Does not change deals, prices, or payments.
-- MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creators ADD COLUMN account_tier TEXT NOT NULL DEFAULT 'managed';

CREATE TABLE portal_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE signup_invite_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  owner_creator_id TEXT NOT NULL,
  usage_cap INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX signup_invite_codes_owner_idx ON signup_invite_codes (owner_creator_id);

CREATE TABLE signup_referrals (
  id TEXT PRIMARY KEY NOT NULL,
  code_id TEXT NOT NULL,
  referrer_creator_id TEXT NOT NULL,
  referred_creator_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX signup_referrals_referrer_idx ON signup_referrals (referrer_creator_id);

CREATE TABLE signup_rate_events (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX signup_rate_events_lookup_idx ON signup_rate_events (kind, ip, created_at);

CREATE TABLE free_onboarding (
  creator_id TEXT PRIMARY KEY NOT NULL,
  niche TEXT,
  niche_other TEXT,
  stat_note TEXT,
  skipped_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE creator_platform_handles (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  followers INTEGER,
  views INTEGER,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX creator_platform_handles_once ON creator_platform_handles (creator_id, platform);

CREATE TABLE creator_stat_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  body_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX creator_stat_uploads_owner_idx ON creator_stat_uploads (creator_id, created_at);

CREATE TABLE commission_product_requests (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE UNIQUE INDEX commission_product_one_open ON commission_product_requests (creator_id) WHERE status = 'open';
CREATE INDEX commission_product_creator_idx ON commission_product_requests (creator_id, created_at);

CREATE TABLE welcome_checklists (
  creator_id TEXT PRIMARY KEY NOT NULL,
  guide_seen_at TEXT,
  dismissed_at TEXT,
  updated_at TEXT NOT NULL
);
