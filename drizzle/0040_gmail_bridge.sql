-- Per-creator brand threads read from Gmail. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE gmail_bridge_threads (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  mailbox TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  deal_id TEXT,
  brand TEXT NOT NULL,
  subject TEXT NOT NULL,
  snippet TEXT NOT NULL,
  from_email TEXT NOT NULL,
  classification TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX gmail_bridge_threads_creator_thread ON gmail_bridge_threads (creator_id, thread_id);

CREATE TABLE gmail_bridge_messages (
  message_id TEXT PRIMARY KEY,
  thread_row_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  snippet TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE gmail_bridge_audit (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  thread_row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
