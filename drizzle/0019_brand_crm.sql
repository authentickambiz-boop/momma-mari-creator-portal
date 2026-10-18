-- Extra brand contacts and responses for the CRM.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE brand_crm_entries (
  id TEXT PRIMARY KEY NOT NULL,
  brand_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  response TEXT,
  note TEXT,
  actor_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
