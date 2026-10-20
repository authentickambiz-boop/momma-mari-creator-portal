-- Stripe customer, subscription, and one-time kit purchases on the creator account.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creator_accounts ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE creator_accounts ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE creator_accounts ADD COLUMN subscription_status TEXT;
ALTER TABLE creator_accounts ADD COLUMN subscription_plan TEXT;
ALTER TABLE creator_accounts ADD COLUMN subscription_interval TEXT;
ALTER TABLE creator_accounts ADD COLUMN subscription_event_at INTEGER;

CREATE INDEX creator_accounts_stripe_customer ON creator_accounts (stripe_customer_id);

CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE creator_purchases (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
