-- Staff notices for new brand briefs and gift-guide reservations.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here removes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE brief_notices (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  program TEXT NOT NULL,
  budget TEXT NOT NULL,
  email_status TEXT NOT NULL,
  email_detail TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE INDEX brief_notices_pending_idx ON brief_notices (delivered_at, created_at);
