-- Creator Gmail connection and onboarding. The refresh token is stored only as
-- ciphertext (see TOKEN_ENCRYPTION_KEY). This does not change deal stages or
-- who can see a deal. MariClare's seeded email_status is left as it was; a
-- mailbox counts as connected only after a real token is saved.

ALTER TABLE creators ADD COLUMN gmail_refresh_token TEXT;
ALTER TABLE creators ADD COLUMN gmail_email TEXT;
ALTER TABLE creators ADD COLUMN gmail_connected_at TEXT;

-- How she wants brand mail handled: business (new Gmail), personal, or hosted.
-- hosted_email_address is the address she asked Momma Mari to set up.
ALTER TABLE creators ADD COLUMN email_setup TEXT;
ALTER TABLE creators ADD COLUMN hosted_email_address TEXT;

CREATE TABLE creator_onboarding (
  creator_id TEXT PRIMARY KEY,
  bot_name TEXT,
  niche TEXT,
  kids_ages TEXT,
  content_style TEXT,
  rates TEXT,
  favorite_brands TEXT,
  platforms_json TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  creator_id TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX admin_notifications_unread_idx ON admin_notifications (read_at, created_at);
