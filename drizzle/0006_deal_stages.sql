-- Phase 1 deal stages. Maps the old coarse status, and the old 5-step video
-- number when one was stored, onto the new stage list. Does not change who can
-- see a deal. MariClare, Abby, and AuthenticKam rows are not edited except for
-- the new stage column on their deals.

ALTER TABLE deals ADD COLUMN workflow_stage TEXT;

CREATE TABLE deal_stage_events (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX deal_stage_events_deal_idx ON deal_stage_events (deal_id, created_at);

UPDATE deals
SET workflow_stage = CASE
  WHEN status = 'paid' THEN 'paid'
  WHEN status = 'delivered' THEN 'scheduled_posted'
  WHEN status = 'pitch' THEN 'offer_received'
  WHEN status = 'negotiating' THEN 'contract_review'
  WHEN status = 'active' AND stage = 1 THEN 'manager_review'
  WHEN status = 'active' AND stage = 2 THEN 'brand_revisions'
  WHEN status = 'active' AND stage = 3 THEN 'brand_approved'
  WHEN status = 'active' AND stage >= 4 THEN 'scheduled_posted'
  WHEN status = 'active' THEN 'draft_due'
  ELSE 'offer_received'
END;

INSERT INTO deal_stage_events (id, deal_id, from_stage, to_stage, actor_email, actor_role, note, created_at)
SELECT
  'stage-migrate-' || id,
  id,
  NULL,
  workflow_stage,
  'migration',
  'system',
  'Mapped from the previous status and video step.',
  '2026-10-17T18:00:00.000Z'
FROM deals
WHERE workflow_stage IS NOT NULL;
