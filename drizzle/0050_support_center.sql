-- Support tickets, threaded replies, and manual status incidents.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  requester_email TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  creator_id TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX support_tickets_email_idx ON support_tickets (requester_email, status);

CREATE TABLE support_ticket_replies (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX support_ticket_replies_ticket_idx ON support_ticket_replies (ticket_id, created_at);

CREATE TABLE status_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
