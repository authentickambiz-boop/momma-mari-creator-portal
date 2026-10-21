-- Brand recap drafts. One row per deal per milestone (7 days and 30 days after go-live).
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments on.

ALTER TABLE brand_campaign_reports ADD COLUMN codes_label TEXT;

CREATE TABLE brand_recap_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  milestone TEXT NOT NULL,
  go_live_on TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (deal_id, milestone)
);
