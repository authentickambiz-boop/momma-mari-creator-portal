-- Contract versions. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,
  sha256 TEXT,
  drive_file_id TEXT,
  drive_file_url TEXT,
  drive_folder_id TEXT,
  source TEXT NOT NULL,
  signing_format TEXT NOT NULL,
  countersign INTEGER NOT NULL,
  status TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  approval_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contracts_deal_idx ON contracts (deal_id, version);

CREATE TABLE contract_checks (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contract_checks_contract_idx ON contract_checks (contract_id);
