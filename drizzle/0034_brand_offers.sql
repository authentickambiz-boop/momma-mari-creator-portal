-- Brand offer inbox fields, brand list follow-up columns, and seeded creator minimums.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
-- INSERT OR IGNORE leaves a creator's saved rules alone if a row is already there.

ALTER TABLE campaigns ADD COLUMN contact_name TEXT;
ALTER TABLE campaigns ADD COLUMN contact_email TEXT;
ALTER TABLE campaigns ADD COLUMN offer_flag TEXT;
ALTER TABLE campaigns ADD COLUMN next_follow_up TEXT;
ALTER TABLE campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'campaign';

ALTER TABLE campaign_allocations ADD COLUMN response TEXT;
ALTER TABLE campaign_allocations ADD COLUMN question TEXT;
ALTER TABLE campaign_allocations ADD COLUMN responded_at TEXT;

ALTER TABLE brand_crm_entries ADD COLUMN rate_paid_cents INTEGER;
ALTER TABLE brand_crm_entries ADD COLUMN outcome TEXT;
ALTER TABLE brand_crm_entries ADD COLUMN next_follow_up TEXT;
ALTER TABLE brand_crm_entries ADD COLUMN creator_id TEXT;

INSERT OR IGNORE INTO creator_deal_rules (creator_id, rules_json, updated_at) VALUES
  ('mariclare', '{"minRates":{},"targetRates":{},"minDealCents":100000,"typicalRateCents":250000,"blockedCategories":[],"acceptedCategories":[],"blockedBrands":[],"maxDealsPerMonth":null,"turnaround":"","exclusivityMaxDays":null,"usageMinDays":null,"kidsOnCamera":"","kidsLimits":"","acceptGifted":false,"acceptCommissionOnly":false}', '2026-10-19T17:00:00.000Z'),
  ('authentickam', '{"minRates":{},"targetRates":{},"minDealCents":25000,"typicalRateCents":null,"blockedCategories":[],"acceptedCategories":[],"blockedBrands":[],"maxDealsPerMonth":null,"turnaround":"","exclusivityMaxDays":null,"usageMinDays":null,"kidsOnCamera":"","kidsLimits":"","acceptGifted":false,"acceptCommissionOnly":false}', '2026-10-19T17:00:00.000Z'),
  ('abby', '{"minRates":{},"targetRates":{},"minDealCents":5000,"typicalRateCents":null,"blockedCategories":[],"acceptedCategories":[],"blockedBrands":[],"maxDealsPerMonth":null,"turnaround":"","exclusivityMaxDays":null,"usageMinDays":null,"kidsOnCamera":"","kidsLimits":"","acceptGifted":false,"acceptCommissionOnly":false}', '2026-10-19T17:00:00.000Z');
