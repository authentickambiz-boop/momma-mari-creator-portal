-- In-game currency. One wallet per signed-in user or roster bot.
-- Credits and debits are inserted and never revised.
-- No running total is stored. No real-money account is stored.

CREATE TABLE game_wallets (
  id TEXT PRIMARY KEY NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX game_wallets_subject ON game_wallets (subject_kind, subject_id);

CREATE TABLE game_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  wallet_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX game_ledger_idempotency ON game_ledger (idempotency_key);

CREATE TABLE game_inventory (
  id TEXT PRIMARY KEY NOT NULL,
  wallet_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);

CREATE UNIQUE INDEX game_inventory_sku ON game_inventory (wallet_id, sku);

CREATE TABLE game_earn_rates (
  earn_type TEXT PRIMARY KEY NOT NULL,
  amount_cents INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
