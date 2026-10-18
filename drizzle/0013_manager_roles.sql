-- Manager roles. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE managers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  can_approve_email INTEGER NOT NULL DEFAULT 1,
  can_approve_video INTEGER NOT NULL DEFAULT 1,
  can_approve_contract INTEGER NOT NULL DEFAULT 0,
  can_countersign INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deactivated_at TEXT
);
ALTER TABLE creators ADD COLUMN primary_manager_id TEXT;
ALTER TABLE creators ADD COLUMN backup_manager_id TEXT;
ALTER TABLE admin_notifications ADD COLUMN manager_id TEXT;
