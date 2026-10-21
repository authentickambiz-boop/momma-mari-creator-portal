-- Creator intake for applications and existing roster profiles.
-- Additive only. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- creator_applications rows are not updated, deleted, or rewritten.
-- current_rates is private. Non-admin queries must omit it.
-- Nothing here deletes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE creator_intake (
  id TEXT PRIMARY KEY NOT NULL,
  application_id TEXT,
  creator_id TEXT,
  legal_name TEXT,
  preferred_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  address_state TEXT,
  zip TEXT,
  country TEXT,
  state_of_residence TEXT,
  niches_json TEXT NOT NULL DEFAULT '[]',
  goals_json TEXT NOT NULL DEFAULT '[]',
  goals_text TEXT,
  current_rates TEXT,
  kids_in_content INTEGER,
  kids_count INTEGER,
  kids_ages TEXT,
  family_notes TEXT,
  analytics_mode TEXT,
  consent_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX creator_intake_email_idx ON creator_intake (email);
CREATE INDEX creator_intake_creator_idx ON creator_intake (creator_id);
CREATE UNIQUE INDEX creator_intake_application_idx ON creator_intake (application_id) WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX creator_intake_one_creator_idx ON creator_intake (creator_id) WHERE creator_id IS NOT NULL;
CREATE UNIQUE INDEX creator_intake_draft_email_idx ON creator_intake (email) WHERE status = 'draft';

CREATE TABLE creator_platforms (
  id TEXT PRIMARY KEY NOT NULL,
  intake_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  url TEXT,
  followers INTEGER,
  avg_views INTEGER,
  captured_at TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX creator_platforms_intake_idx ON creator_platforms (intake_id);

CREATE TABLE intake_files (
  id TEXT PRIMARY KEY NOT NULL,
  intake_id TEXT NOT NULL,
  platform_id TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX intake_files_intake_idx ON intake_files (intake_id);
