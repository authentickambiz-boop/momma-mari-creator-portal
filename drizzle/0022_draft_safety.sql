-- Kid-safety flags on a draft. The kind is stored. The matched words are not.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE draft_safety_flags (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  held INTEGER NOT NULL DEFAULT 1,
  cleared_by TEXT,
  cleared_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX draft_safety_flags_draft_kind ON draft_safety_flags (draft_id, kind);
