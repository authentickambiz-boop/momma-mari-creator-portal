-- Brand deposit tracking, approved Oct 21, 2026.
-- New brands pay 50% by manual invoice before filming. Net 30 is an owner switch
-- after one paid-on-time deal. Gifted deals are left out.
-- Adds tables only. Nothing here deletes data, sends mail, or turns payments on.

CREATE TABLE brand_billing_terms (
  brand_key TEXT PRIMARY KEY NOT NULL,
  terms TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deal_deposits (
  deal_id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER,
  invoiced_on TEXT,
  received_on TEXT,
  override_reason TEXT,
  override_by TEXT,
  override_at TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deal_deposit_events (
  id TEXT PRIMARY KEY NOT NULL,
  deal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX deal_deposit_events_deal ON deal_deposit_events (deal_id);

CREATE TABLE deal_payment_timing (
  deal_id TEXT PRIMARY KEY NOT NULL,
  due_on TEXT NOT NULL,
  paid_on TEXT NOT NULL,
  paid_on_time INTEGER NOT NULL,
  days_late INTEGER NOT NULL,
  marked_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
