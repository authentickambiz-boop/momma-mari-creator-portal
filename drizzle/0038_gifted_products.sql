-- Gifted product offers. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE gifted_offers (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  product TEXT NOT NULL,
  photos_json TEXT NOT NULL,
  deliverable TEXT NOT NULL,
  due_on TEXT NOT NULL,
  retail_value_cents INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE gifted_applications (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  creator_id TEXT,
  bench_id TEXT,
  status TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  post_url TEXT,
  applied_at TEXT NOT NULL,
  approved_at TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  posted_at TEXT,
  overdue_at TEXT,
  charged_at TEXT,
  amount_owed_cents INTEGER,
  finders_fee_cents INTEGER,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX gifted_applications_creator ON gifted_applications (offer_id, creator_id) WHERE creator_id IS NOT NULL;
CREATE UNIQUE INDEX gifted_applications_bench ON gifted_applications (offer_id, bench_id) WHERE bench_id IS NOT NULL;
