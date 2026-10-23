-- Worlds character looks. One row per signed-in user or roster bot.
-- The document is versioned JSON (body, face, and item slots).
-- Item ids are a catalog so later items can be added. This table stores looks only.

CREATE TABLE office_characters (
  id TEXT PRIMARY KEY NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  document TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX office_characters_subject ON office_characters (subject_kind, subject_id);
