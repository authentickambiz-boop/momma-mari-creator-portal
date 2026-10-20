-- Public creator applications. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE creator_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  handles TEXT NOT NULL,
  followers TEXT NOT NULL,
  niche TEXT NOT NULL,
  rates TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  creator_id TEXT,
  invited_at TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE UNIQUE INDEX creator_applications_pending_email ON creator_applications (email) WHERE status = 'pending';
