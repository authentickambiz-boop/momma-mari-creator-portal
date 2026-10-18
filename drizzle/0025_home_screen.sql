-- Home-screen notices. Quiet hours keep a row held. Nothing is sent to a push service from this table.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX push_subscriptions_endpoint ON push_subscriptions (endpoint);
CREATE TABLE push_notices (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
