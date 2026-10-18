-- One queued monthly report email per creator. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE creator_report_drafts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  month TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX creator_report_drafts_creator_month ON creator_report_drafts (creator_id, month);
