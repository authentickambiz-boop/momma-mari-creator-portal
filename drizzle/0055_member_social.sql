-- Member profile photos, platforms, pins, and safety holds.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
ALTER TABLE creator_profiles ADD COLUMN cover_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN avatar_image TEXT;
ALTER TABLE creator_profiles ADD COLUMN avatar_mime TEXT;
ALTER TABLE creator_profiles ADD COLUMN avatar_filename TEXT;
ALTER TABLE creator_profiles ADD COLUMN cover_image TEXT;
ALTER TABLE creator_profiles ADD COLUMN cover_mime TEXT;
ALTER TABLE creator_profiles ADD COLUMN cover_filename TEXT;
ALTER TABLE creator_profiles ADD COLUMN platforms_json TEXT;
ALTER TABLE creator_profiles ADD COLUMN platforms_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN pins_json TEXT;
ALTER TABLE creator_profiles ADD COLUMN pins_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN snack TEXT;
ALTER TABLE creator_profiles ADD COLUMN snack_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN loving TEXT;
ALTER TABLE creator_profiles ADD COLUMN loving_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN weekend TEXT;
ALTER TABLE creator_profiles ADD COLUMN weekend_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN safety_kinds TEXT;
ALTER TABLE creator_profiles ADD COLUMN photo_hold INTEGER NOT NULL DEFAULT 0;
