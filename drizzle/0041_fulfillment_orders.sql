-- One-time purchase fulfillment. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE fulfillment_orders (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL UNIQUE,
  creator_id TEXT NOT NULL,
  product TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  due_on TEXT NOT NULL,
  claimed_at TEXT,
  delivered_at TEXT,
  delivery_url TEXT,
  delivery_filename TEXT,
  delivery_body TEXT
);
