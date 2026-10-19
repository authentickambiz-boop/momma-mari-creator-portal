-- Creator ranks, shareable reports, manager pods, and reinvestment tracking.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE creator_rank_settings (
  id TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  cadence TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE creator_rank_inputs (
  creator_id TEXT PRIMARY KEY,
  inputs_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE creator_rank_history (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  rank INTEGER NOT NULL,
  recorded_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE rank_reports (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  subject_id TEXT,
  title TEXT NOT NULL,
  show_ranks INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE pods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  size_band TEXT NOT NULL,
  channel_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE pod_members (
  pod_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  PRIMARY KEY (pod_id, creator_id)
);

CREATE TABLE pod_dates (
  id TEXT PRIMARY KEY,
  pod_id TEXT NOT NULL,
  creator_id TEXT,
  title TEXT NOT NULL,
  on_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE collab_ideas (
  id TEXT PRIMARY KEY,
  pod_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  partner_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE pod_shoutouts (
  id TEXT PRIMARY KEY,
  pod_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE pod_goals (
  id TEXT PRIMARY KEY,
  pod_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE pod_metrics (
  id TEXT PRIMARY KEY,
  pod_id TEXT NOT NULL,
  month TEXT NOT NULL,
  followers INTEGER NOT NULL,
  collab_posts INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE reinvestment_settings (
  id TEXT PRIMARY KEY,
  target_percent INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE reinvestment_entries (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
