-- Pricing waitlist. This does not change any existing deal row.
-- Nothing here deletes data, sends mail, or turns payments on.

CREATE TABLE pricing_waitlist (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
