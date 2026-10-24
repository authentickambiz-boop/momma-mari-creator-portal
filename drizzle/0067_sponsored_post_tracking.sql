-- Sponsored post performance. One row per delivered post, and one row per checkpoint
-- (24 hours, 7 days, 30 days, or a later window). Existing tables are not altered.
-- Nothing here drops a table, deletes a row, sends mail, or changes a price.

CREATE TABLE sponsored_posts (
  id TEXT PRIMARY KEY NOT NULL,
  brand TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  deal_id TEXT,
  campaign_id TEXT,
  platform TEXT NOT NULL,
  post_url TEXT NOT NULL,
  posted_on TEXT NOT NULL,
  deliverable_terms TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX sponsored_posts_brand ON sponsored_posts (brand);
CREATE INDEX sponsored_posts_creator ON sponsored_posts (creator_id);
CREATE INDEX sponsored_posts_deal ON sponsored_posts (deal_id);
CREATE INDEX sponsored_posts_campaign ON sponsored_posts (campaign_id);

CREATE TABLE sponsored_post_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  clicks INTEGER,
  promo_code_uses INTEGER,
  installs INTEGER,
  note TEXT,
  entered_by TEXT NOT NULL,
  entered_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX sponsored_post_snapshots_post_checkpoint ON sponsored_post_snapshots (post_id, checkpoint);
CREATE INDEX sponsored_post_snapshots_post ON sponsored_post_snapshots (post_id);
