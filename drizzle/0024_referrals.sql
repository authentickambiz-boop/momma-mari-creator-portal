-- Referral names and a placeholder perk. Nothing is paid from this table.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE referral_settings (
  id TEXT PRIMARY KEY,
  perk_cents INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  referrer_creator_id TEXT NOT NULL,
  referred_name TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
