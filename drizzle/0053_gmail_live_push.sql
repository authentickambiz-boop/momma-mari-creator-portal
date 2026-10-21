-- Agency inbox token and the Gmail drafts this portal created.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here sends or deletes mail.

CREATE TABLE agency_mailboxes (
  mailbox TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  refresh_token TEXT,
  connected_at TEXT,
  reconnect_reason TEXT
);

CREATE TABLE gmail_portal_drafts (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  gmail_draft_id TEXT,
  deal_id TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX gmail_portal_drafts_thread ON gmail_portal_drafts (mailbox, thread_id);
