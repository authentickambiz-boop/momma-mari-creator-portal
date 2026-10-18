-- Draft and post due dates, plus a record that a 3-day reminder already happened.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE deliverable_dates (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX deliverable_dates_deal_kind ON deliverable_dates (deal_id, kind);

CREATE TABLE deliverable_nudges (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_on TEXT NOT NULL,
  channel TEXT NOT NULL,
  approval_id TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX deliverable_nudges_once ON deliverable_nudges (deal_id, kind, due_on);

CREATE TABLE creator_calendars (
  creator_id TEXT PRIMARY KEY NOT NULL,
  connected INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
