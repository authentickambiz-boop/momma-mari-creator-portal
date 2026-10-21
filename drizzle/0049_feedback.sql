-- Public and signed-in feedback. Stored in the portal only.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE feedback_notes (
  id TEXT PRIMARY KEY NOT NULL,
  author_email TEXT,
  author_name TEXT,
  audience TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  follow_up INTEGER NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX feedback_notes_created_idx ON feedback_notes (created_at);
