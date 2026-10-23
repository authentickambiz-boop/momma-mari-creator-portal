-- Bot office command queue. Kamron queues work from /worlds.
-- Bots read pending rows and write status with the bot API token.
-- This does not change deals, payments, signatures, mail, or any other table.

CREATE TABLE office_world_commands (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  bot_ids TEXT NOT NULL,
  office TEXT,
  note_id TEXT,
  todo_id TEXT,
  decision TEXT,
  topic TEXT,
  body TEXT NOT NULL,
  due TEXT,
  impact_dollars INTEGER,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
