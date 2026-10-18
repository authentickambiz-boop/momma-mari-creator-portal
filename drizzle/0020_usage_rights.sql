-- Usage windows for a deal. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE usage_rights (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
