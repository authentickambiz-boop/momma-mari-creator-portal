-- Bot office live status. The seed (roles, verified wins, layout) stays in code.
-- Bots later write task, update, and status here with the bot API token.
-- This does not change deals, payments, signatures, mail, or any other table.

CREATE TABLE office_world_status (
  id TEXT PRIMARY KEY NOT NULL,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
