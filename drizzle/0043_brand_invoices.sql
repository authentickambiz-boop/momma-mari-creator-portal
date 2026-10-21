-- Local brand invoices and reminder drafts. Nothing here sends email or charges a card.
-- Existing deal rows are left as they are. MariClare's KOSBLING deal is not updated.

CREATE TABLE brand_invoices (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  net_days INTEGER NOT NULL,
  issued_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  po_number TEXT,
  status TEXT NOT NULL,
  stripe_invoice_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE invoice_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_on TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX invoice_reminders_invoice_kind ON invoice_reminders (invoice_id, kind);
