-- Holiday Gift Guide 2026 reservations.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE gift_guide_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  brand_crm_id TEXT NOT NULL,
  brand_contact_id TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  retail_price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  package_id TEXT NOT NULL,
  promo_code TEXT,
  notes TEXT,
  ack_paid INTEGER NOT NULL,
  ack_approval INTEGER NOT NULL,
  ack_kids INTEGER NOT NULL,
  ack_upfront INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX gift_guide_reservations_status_idx ON gift_guide_reservations (status, created_at);
