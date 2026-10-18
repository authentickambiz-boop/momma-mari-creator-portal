-- Phase 2 approval queue. Outgoing brand emails wait here until an admin approves
-- them. The bot may insert a pending draft and may only read rows whose status
-- is approved. It cannot approve or reject. Mail goes out from
-- authentickambiz@gmail.com. Existing deals, creators, and video drafts are
-- not changed.

CREATE TABLE approval_emails (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  gate TEXT NOT NULL,
  status TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_note TEXT,
  attachment_url TEXT,
  from_email TEXT NOT NULL,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  sent_at TEXT,
  brand_contact_name TEXT,
  brand_contact_email TEXT,
  brand_contact_company TEXT,
  suggested_creator_id TEXT,
  suggested_plan TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX approval_emails_status_idx ON approval_emails (status, created_at);
CREATE INDEX approval_emails_deal_idx ON approval_emails (deal_id);

CREATE TABLE approval_events (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX approval_events_approval_idx ON approval_events (approval_id, created_at);

CREATE TABLE brand_contacts (
  id TEXT PRIMARY KEY,
  deal_id TEXT,
  approval_id TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  note TEXT,
  suggested_creator_id TEXT,
  suggested_plan TEXT,
  saved_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
