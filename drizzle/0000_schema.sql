-- Momma Mari creator portal. Applied by Webflow Cloud from wrangler.json migrations_dir.
-- Local `next dev` applies this file to data/portal.sqlite on startup.

CREATE TABLE creators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  handles TEXT,
  kids_ages TEXT,
  payout_method TEXT,
  split_percent REAL,
  monthly_goal_cents INTEGER,
  drive_folder_id TEXT,
  initials TEXT NOT NULL,
  tiktok_status TEXT NOT NULL DEFAULT 'disconnected',
  instagram_status TEXT NOT NULL DEFAULT 'disconnected',
  facebook_status TEXT NOT NULL DEFAULT 'disconnected',
  youtube_status TEXT NOT NULL DEFAULT 'disconnected',
  email_status TEXT NOT NULL DEFAULT 'disconnected',
  tiktok_connect_url TEXT,
  instagram_connect_url TEXT,
  facebook_connect_url TEXT,
  youtube_connect_url TEXT,
  list_note TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  subtitle TEXT,
  contact TEXT,
  gmail_thread_id TEXT,
  status TEXT NOT NULL,
  amount_display TEXT,
  rate_label TEXT,
  rate_cents INTEGER,
  pipeline_cents INTEGER,
  pipeline_name TEXT,
  deliverables_json TEXT NOT NULL DEFAULT '[]',
  usage_rights TEXT,
  brief TEXT,
  brief_url TEXT,
  draft_due TEXT,
  post_date TEXT,
  payment_terms TEXT,
  visible_to_creator INTEGER NOT NULL DEFAULT 0,
  kamron_notes TEXT,
  next_step TEXT,
  bot_message TEXT,
  stage INTEGER,
  upload_enabled INTEGER NOT NULL DEFAULT 0,
  upload_label TEXT,
  chips_json TEXT NOT NULL DEFAULT '[]',
  earnings_chip_text TEXT,
  earnings_chip_tone TEXT,
  needs_creator INTEGER NOT NULL DEFAULT 0,
  drive_folder_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX deals_creator_idx ON deals (creator_id);

CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  drive_file_id TEXT,
  drive_file_url TEXT,
  drive_folder_id TEXT,
  upload_session_url TEXT,
  status TEXT NOT NULL,
  gmail_thread_id TEXT,
  uploaded_at TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX drafts_deal_idx ON drafts (deal_id);
CREATE INDEX drafts_uploaded_idx ON drafts (uploaded_at);

CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  draft_id TEXT,
  occurred_label TEXT NOT NULL,
  occurred_at TEXT,
  source TEXT NOT NULL,
  summary TEXT NOT NULL,
  email_url TEXT,
  sort_order INTEGER NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX revisions_deal_idx ON revisions (deal_id, sort_order);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  amount_owed_cents INTEGER,
  amount_label TEXT,
  due_date TEXT,
  due_label TEXT,
  landed_date TEXT,
  landed_amount_cents INTEGER,
  creator_split_percent REAL,
  agency_split_percent REAL,
  creator_payout_cents INTEGER,
  payout_approved_on TEXT,
  paid_out_date TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX payments_deal_idx ON payments (deal_id);

CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  source TEXT NOT NULL,
  amount_label TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE analytics_daily (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  followers INTEGER,
  new_followers INTEGER,
  views INTEGER,
  engagement_rate REAL,
  saves INTEGER,
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX analytics_daily_key ON analytics_daily (creator_id, platform, metric_date);

CREATE TABLE analytics_posts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  views INTEGER,
  saves INTEGER,
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  creator_id TEXT,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_email_idx ON sessions (email);
