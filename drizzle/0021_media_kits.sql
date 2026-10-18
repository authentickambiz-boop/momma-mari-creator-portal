-- A creator's shareable media kit. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE media_kits (
  creator_id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  published INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  bio TEXT,
  followers INTEGER,
  avg_views INTEGER,
  engagement TEXT,
  niches TEXT,
  updated_at TEXT NOT NULL
);
