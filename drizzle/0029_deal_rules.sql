-- Per-creator deal rules and the agency profit floor.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
ALTER TABLE managers ADD COLUMN can_price_deals INTEGER NOT NULL DEFAULT 0;

CREATE TABLE creator_deal_rules (
  creator_id TEXT PRIMARY KEY,
  rules_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE pricing_settings (
  id TEXT PRIMARY KEY,
  min_agency_profit_cents INTEGER NOT NULL,
  catalog_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
