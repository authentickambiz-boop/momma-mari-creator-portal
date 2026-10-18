-- Product shipping, live posts, and payment marks.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL UNIQUE,
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  received_at TEXT
);
CREATE TABLE live_posts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  meets_brief INTEGER,
  confirmed_at TEXT,
  confirmed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE payments ADD COLUMN payment_status TEXT;
