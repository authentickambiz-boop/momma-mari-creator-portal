-- Owner kanban for brand deals. Seeding copies from deals, contacts, and the deal inbox.
-- It does not change those rows, and it does not send email.

CREATE TABLE brand_pipeline_cards (
  id TEXT PRIMARY KEY NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  creator_id TEXT,
  contact_email TEXT,
  stage TEXT NOT NULL,
  value_cents INTEGER,
  next_follow_up TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
