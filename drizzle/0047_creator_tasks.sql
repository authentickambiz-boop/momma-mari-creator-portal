-- Per-creator to-dos, plus a review mode on offer cards.
-- Monthly-goal starter tasks are created without copying the dollar amount.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments, e-sign, or push on.

CREATE TABLE creator_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  deal_id TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  due_date TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX creator_tasks_creator_idx ON creator_tasks (creator_id, status, due_date);

ALTER TABLE creator_offer_reviews ADD COLUMN review_mode TEXT;

INSERT INTO creator_tasks (
  id, creator_id, deal_id, title, detail, due_date, category, status, created_by, created_at, updated_at
)
SELECT
  'goal-' || id || '-monthly',
  id,
  NULL,
  'Check your monthly goal',
  'A monthly goal is saved on your account. Keep the work that fits it moving.',
  NULL,
  'goal',
  'open',
  'seed',
  created_at,
  created_at
FROM creators
WHERE monthly_goal_cents IS NOT NULL;
