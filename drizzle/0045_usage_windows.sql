-- Usage tiers, channels, and renewal draft tracking.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments on.

ALTER TABLE usage_rights ADD COLUMN tier TEXT;
ALTER TABLE usage_rights ADD COLUMN channels_json TEXT;
ALTER TABLE usage_rights ADD COLUMN perpetual_override INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_rights ADD COLUMN renewal_fee_cents INTEGER;

CREATE TABLE usage_renewal_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  window_ends_on TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (deal_id, window_ends_on)
);

CREATE TABLE usage_renewal_fees (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  window_ends_on TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  creator_cents INTEGER NOT NULL,
  agency_cents INTEGER NOT NULL,
  payout_line_id TEXT,
  invoice_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (deal_id, window_ends_on)
);
