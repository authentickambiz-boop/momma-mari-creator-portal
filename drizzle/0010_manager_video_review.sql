-- Manager review of uploaded videos. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE draft_reviews (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  actor_email TEXT NOT NULL,
  approval_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX draft_reviews_draft_idx ON draft_reviews (draft_id, created_at);
CREATE INDEX draft_reviews_deal_idx ON draft_reviews (deal_id, created_at);

CREATE TABLE creator_notifications (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  deal_id TEXT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX creator_notifications_unread_idx ON creator_notifications (creator_id, read_at, created_at);
