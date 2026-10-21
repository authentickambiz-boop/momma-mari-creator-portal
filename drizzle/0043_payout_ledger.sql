-- Weekly payout ledger and encrypted W-9 files.
-- This does not send money, and it does not change any existing deal or payment row.

CREATE TABLE payout_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  deal_id TEXT,
  brand TEXT NOT NULL,
  gross_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  expense_cents INTEGER NOT NULL,
  creator_cents INTEGER NOT NULL,
  agency_cents INTEGER NOT NULL,
  brand_paid_on TEXT,
  payout_on TEXT,
  week_of TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE creator_w9s (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
