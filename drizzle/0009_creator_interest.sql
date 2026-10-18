-- Creator interest. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE offer_screenings (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  brand_email TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX offer_screenings_deal_idx ON offer_screenings (deal_id, created_at);

CREATE TABLE creator_interest (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  approval_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX creator_interest_deal_idx ON creator_interest (deal_id, created_at);
