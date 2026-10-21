-- Usage exclusivity, brand campaign reports, and creator deal-review offers.
-- This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
-- Nothing here deletes data, sends mail, or turns payments on.

ALTER TABLE usage_rights ADD COLUMN usage_type TEXT;
ALTER TABLE usage_rights ADD COLUMN territory TEXT;
ALTER TABLE usage_rights ADD COLUMN exclusivity_category TEXT;
ALTER TABLE usage_rights ADD COLUMN exclusivity_ends_on TEXT;

CREATE TABLE creator_offer_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  offer_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  decision TEXT,
  counter_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX creator_offer_reviews_creator_idx ON creator_offer_reviews (creator_id, created_at);

INSERT INTO creator_offer_reviews (
  id, creator_id, brand, contact_email, offer_label, summary, decision, counter_note, decided_at, created_at
) VALUES
  (
    'review-persona',
    'mariclare',
    'Persona',
    'sameer@yourpersona.com',
    '$450 per post',
    '4 posts over 30 days, starting in 1-2 weeks.',
    NULL,
    NULL,
    NULL,
    '2026-10-20T16:00:00.000Z'
  ),
  (
    'review-bld',
    'mariclare',
    'bld.co',
    'jamie@bld.co',
    '$2,000',
    '4 Facebook Reels synced to Instagram and 4 Instagram Story sets. No usage. No exclusivity. Net 30/15.',
    NULL,
    NULL,
    NULL,
    '2026-10-20T16:00:00.000Z'
  );

CREATE TABLE brand_campaign_reports (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  deal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  views_label TEXT,
  engagement_label TEXT,
  clicks_label TEXT,
  comments_label TEXT,
  content_links TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX brand_campaign_reports_deal_idx ON brand_campaign_reports (deal_id);
