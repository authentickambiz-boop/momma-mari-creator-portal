-- Niche list and streamer fields. Existing profile rows stay as they are.
-- New columns start empty. Nothing here deletes data, sends mail, or turns payments on.

ALTER TABLE creator_profiles ADD COLUMN niche_other TEXT;
ALTER TABLE creator_profiles ADD COLUMN avg_viewers INTEGER;
ALTER TABLE creator_profiles ADD COLUMN hours_per_week INTEGER;
ALTER TABLE creator_profiles ADD COLUMN stream_categories TEXT;
ALTER TABLE creator_profiles ADD COLUMN analytics_proof TEXT;
ALTER TABLE creator_profiles ADD COLUMN meets_bar INTEGER NOT NULL DEFAULT 0;

ALTER TABLE live_posts ADD COLUMN proof_kind TEXT;
