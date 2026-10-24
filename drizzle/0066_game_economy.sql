-- Each in-game credit names a source and a source id.
-- The same wallet cannot record that credit twice.
-- Rows are inserted and never revised.

ALTER TABLE game_ledger ADD COLUMN source_id TEXT NOT NULL DEFAULT '';

UPDATE game_ledger SET source_id = idempotency_key WHERE source_id = '';

CREATE UNIQUE INDEX game_ledger_credit_source ON game_ledger (wallet_id, source, source_id) WHERE direction = 'credit' AND source_id <> '';
