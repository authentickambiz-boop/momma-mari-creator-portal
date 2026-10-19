-- Make sure community chat tables exist even if an earlier file did not finish.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE IF NOT EXISTS community_channels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  creator_id TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  muted_until TEXT,
  guidelines_at TEXT,
  last_seen_at TEXT,
  last_post_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_member_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT,
  photo_id TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  held INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS community_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS community_reactions_once ON community_reactions (message_id, member_id, emoji);
CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  reporter_member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE TABLE IF NOT EXISTS community_audit (
  id TEXT PRIMARY KEY,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_name TEXT,
  message_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_photos (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes_base64 TEXT,
  r2_key TEXT,
  held INTEGER NOT NULL,
  approved INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_filter_hits (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_settings (
  id TEXT PRIMARY KEY,
  read_only INTEGER NOT NULL,
  slow_seconds INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_state (
  id TEXT PRIMARY KEY,
  cursor TEXT NOT NULL
);
INSERT OR IGNORE INTO community_channels (id, slug, name, kind, created_at) VALUES
  ('announcements', 'announcements', 'Announcements', 'announcements', '2026-10-18T00:00:00.000Z'),
  ('everyone', 'everyone', 'everyone', 'everyone', '2026-10-18T00:00:00.000Z'),
  ('wins', 'wins', 'wins', 'wins', '2026-10-18T00:00:00.000Z');
INSERT OR IGNORE INTO community_settings (id, read_only, slow_seconds) VALUES ('default', 0, 0);
INSERT OR IGNORE INTO community_state (id, cursor) VALUES ('last', '0');
