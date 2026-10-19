-- Gmail watch cursors and a new-mail flag for the drafting bot.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE deals ADD COLUMN offer_allocation_id TEXT;
-- Existing rows pick up these defaults. This is not an UPDATE, so KOSBLING is left exactly as it is.
ALTER TABLE deals ADD COLUMN review_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE deals ADD COLUMN product_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deals ADD COLUMN rate_ready INTEGER NOT NULL DEFAULT 0;
ALTER TABLE deals ADD COLUMN rate_confirmed_at TEXT;
ALTER TABLE deals ADD COLUMN rush_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brand_crm_entries ADD COLUMN domain TEXT;

CREATE TABLE brand_reply_drafts (
  deal_id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE gmail_watches (
  mailbox TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  history_id TEXT,
  expiration TEXT,
  topic TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE gmail_seen_messages (
  message_id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  thread_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE inbox_events (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  deal_id TEXT,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
