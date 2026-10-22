-- Filed 1099-NEC PDFs uploaded by the owner, encrypted at rest.
-- The portal does not create a 1099. Existing rows stay in place. Nothing here moves money.

CREATE TABLE creator_filed_1099s (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
