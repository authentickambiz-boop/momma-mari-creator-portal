-- Click-to-sign. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creators ADD COLUMN signer_is_minor INTEGER NOT NULL DEFAULT 0;

CREATE TABLE contract_files (
  contract_id TEXT PRIMARY KEY,
  bytes_base64 TEXT NOT NULL
);

CREATE TABLE contract_signatures (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  signer_name TEXT,
  signer_email TEXT,
  signed_at TEXT,
  ip TEXT,
  user_agent TEXT,
  document_sha256 TEXT,
  signature_kind TEXT,
  consent_esign INTEGER,
  consent_read INTEGER,
  guardian INTEGER NOT NULL,
  signed_sha256 TEXT,
  signed_filename TEXT,
  drive_file_id TEXT,
  drive_file_url TEXT,
  approval_id TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contract_signatures_deal_idx ON contract_signatures (deal_id, created_at);
CREATE INDEX contract_signatures_contract_idx ON contract_signatures (contract_id, status);

CREATE TABLE signature_files (
  signature_id TEXT PRIMARY KEY,
  bytes_base64 TEXT NOT NULL
);
