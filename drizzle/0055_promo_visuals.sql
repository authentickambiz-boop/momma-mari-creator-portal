-- Product photos for deals, offers, and free products.
-- Additive only. No existing row is changed or removed.

CREATE TABLE IF NOT EXISTS promo_visuals (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  product_name TEXT,
  product_page_url TEXT,
  owner_image_url TEXT,
  website_image_url TEXT,
  website_checked_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_visuals_subject ON promo_visuals(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS promo_image_files (
  visual_id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  bytes_base64 TEXT NOT NULL
);
