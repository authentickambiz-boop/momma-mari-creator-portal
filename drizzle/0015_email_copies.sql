-- Saved PDF copies of approved and sent emails.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
CREATE TABLE email_copies (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  drive_file_id TEXT,
  drive_file_url TEXT,
  drive_folder_id TEXT,
  stored TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX email_copies_approval_kind ON email_copies (approval_id, kind);
CREATE TABLE email_copy_files (
  copy_id TEXT PRIMARY KEY,
  bytes_base64 TEXT NOT NULL
);
