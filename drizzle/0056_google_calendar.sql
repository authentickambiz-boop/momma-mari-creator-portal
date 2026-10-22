-- Per-creator Google Calendar connection. The refresh token is encrypted.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creator_calendars ADD COLUMN refresh_token TEXT;
ALTER TABLE creator_calendars ADD COLUMN calendar_email TEXT;
ALTER TABLE creator_calendars ADD COLUMN status TEXT NOT NULL DEFAULT 'off';
