-- Commission-only campaigns for the roster, including the free bench.
-- This does not change any existing deal row or the paid campaigns table.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here removes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE commission_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  brand TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  terms TEXT NOT NULL,
  tracking_link TEXT,
  bonus TEXT,
  rate_label TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX commission_campaigns_status_idx ON commission_campaigns (status, created_at);

CREATE TABLE commission_campaign_interest (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX commission_interest_once ON commission_campaign_interest (campaign_id, creator_id);
CREATE INDEX commission_interest_created_idx ON commission_campaign_interest (campaign_id, created_at);
