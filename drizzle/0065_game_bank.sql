-- In-game bank buckets on the currency ledger.
-- Existing rows stay in the spendable wallet bucket.
-- The bank bucket is protected. Uncollected earnings wait there until a visit.

ALTER TABLE game_ledger ADD COLUMN bucket TEXT NOT NULL DEFAULT 'wallet';

CREATE TABLE game_interest_rates (
  id TEXT PRIMARY KEY NOT NULL,
  weekly_bps INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE game_bank_marks (
  wallet_id TEXT PRIMARY KEY NOT NULL,
  accrued_through TEXT NOT NULL
);
