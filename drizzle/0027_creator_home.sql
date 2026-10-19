-- Creator account preferences, placeholder billing, and in-portal support notes.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE creator_accounts (
  creator_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  ai_tier TEXT NOT NULL,
  ai_credits_used INTEGER NOT NULL,
  add_ons TEXT NOT NULL,
  email_notices INTEGER NOT NULL,
  push_notices INTEGER NOT NULL,
  quiet_hours INTEGER NOT NULL,
  community_visible INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE support_messages (
  id TEXT PRIMARY KEY,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  creator_id TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
