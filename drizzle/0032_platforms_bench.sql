-- Platform media kits, any-platform deliverables, the free creator bench, and the sponsor category guardrail.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE media_kits ADD COLUMN platforms_json TEXT;

CREATE TABLE deal_category_overrides (
  deal_id TEXT PRIMARY KEY,
  overridden INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bench_creators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  niches_json TEXT NOT NULL,
  platforms_json TEXT NOT NULL,
  portfolio_json TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  creator_id TEXT,
  created_at TEXT NOT NULL,
  promoted_at TEXT
);

CREATE TABLE bench_offers (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  bench_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  approval_id TEXT,
  fee_cents INTEGER,
  created_at TEXT NOT NULL
);
