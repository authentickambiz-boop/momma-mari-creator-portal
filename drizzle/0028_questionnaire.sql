-- First-sign-in questionnaire. Answers stay on the creator.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE creator_questionnaires (
  creator_id TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  paused_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);
