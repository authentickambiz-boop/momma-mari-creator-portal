-- Brand recap reporting. Adds the kickoff goal, post log fields, metric snapshots,
-- and the owner's next-campaign note.
-- Existing recap rows stay as they are. New columns are empty until the owner fills them.
-- Nothing here deletes data, sends mail, or turns payments on.

ALTER TABLE campaigns ADD COLUMN goal_type TEXT;
ALTER TABLE campaigns ADD COLUMN goal_target TEXT;

ALTER TABLE live_posts ADD COLUMN posted_on TEXT;
ALTER TABLE live_posts ADD COLUMN deliverable_label TEXT;

ALTER TABLE brand_recap_drafts ADD COLUMN next_campaign_note TEXT;

CREATE TABLE brand_recap_goals (
  deal_id TEXT PRIMARY KEY NOT NULL,
  goal_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE brand_recap_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  post_id TEXT,
  window TEXT NOT NULL,
  metric TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX brand_recap_snapshots_deal ON brand_recap_snapshots (deal_id);
