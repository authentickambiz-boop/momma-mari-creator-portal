-- Bot office vault. A name, a type, and a balance.
-- No account numbers, routing numbers, cards, or payment credentials.

CREATE TABLE office_wallets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
