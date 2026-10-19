-- Campaigns, prospect list, and outside-creator offers.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  budget_cents INTEGER NOT NULL,
  niches_json TEXT NOT NULL,
  platforms_json TEXT NOT NULL,
  deliverables_json TEXT NOT NULL,
  slots INTEGER NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  status TEXT NOT NULL,
  open_outside INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE campaign_allocations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  creator_id TEXT,
  prospect_id TEXT,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  niches_json TEXT NOT NULL,
  notes TEXT,
  converted_creator_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE outside_offers (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  approval_id TEXT,
  created_at TEXT NOT NULL
);
