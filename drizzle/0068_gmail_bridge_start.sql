-- Per-creator Gmail bridge start, recorded once.
-- Adds tables only. Nothing here drops, deletes, or rewrites existing rows.
-- Nothing here sends mail.

CREATE TABLE creator_portal_logins (
  creator_id TEXT PRIMARY KEY NOT NULL,
  first_login_at TEXT NOT NULL,
  login_count INTEGER NOT NULL
);

CREATE TABLE gmail_bridge_starts (
  creator_id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  mailbox TEXT NOT NULL
);
