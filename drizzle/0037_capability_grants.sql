-- Staged capabilities for managers and bots.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE capability_grants (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  level TEXT NOT NULL,
  training_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX capability_grants_subject ON capability_grants (subject_type, subject_id, capability);

CREATE TABLE capability_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  capability TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE capability_drafts (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  level TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  summary TEXT NOT NULL,
  effect_json TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE bot_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,
  reveal_once TEXT,
  active INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
