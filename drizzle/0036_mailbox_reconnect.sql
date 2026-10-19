-- Watched inbox reconnect state, and platform invite alerts.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creators ADD COLUMN gmail_reconnect_reason TEXT;

CREATE TABLE platform_invites (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_handle TEXT,
  action_needed TEXT NOT NULL,
  deadline_at TEXT,
  done_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
