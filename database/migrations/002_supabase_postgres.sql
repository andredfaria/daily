-- =============================================================================
-- BillSync — Supabase / PostgreSQL Schema
-- Converted from MySQL 001_create_schema.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Table: users
-- NOTE: id must match auth.uid() from Supabase Auth
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                        UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                      TEXT,
  whatsapp_number           TEXT          NOT NULL,
  timezone                  TEXT          NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active                 BOOLEAN       NOT NULL DEFAULT TRUE,
  whatsapp_alerts_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  weekly_summary_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
  default_days_before_alert SMALLINT      NOT NULL DEFAULT 3,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (whatsapp_number)
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Table: bills
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                    TEXT          NOT NULL,
  description             TEXT,
  amount                  NUMERIC(10,2) NOT NULL,
  recurrence_type         TEXT          NOT NULL CHECK (recurrence_type IN ('monthly','weekly','once')),
  recurrence_day_of_month SMALLINT      CHECK (recurrence_day_of_month BETWEEN 1 AND 31),
  recurrence_day_of_week  SMALLINT      CHECK (recurrence_day_of_week BETWEEN 0 AND 6),
  due_date                DATE,
  days_before_alert       SMALLINT      NOT NULL DEFAULT 3,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_user_id     ON bills (user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_active ON bills (user_id, is_active);

CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Table: payment_methods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id         UUID        NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('pix','boleto')),
  pix_key_type    TEXT        CHECK (pix_key_type IN ('cpf','email','phone','random')),
  pix_key         TEXT,
  pix_beneficiary TEXT,
  boleto_code     TEXT,
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_bill_id      ON payment_methods (bill_id);
CREATE INDEX IF NOT EXISTS idx_pm_bill_primary ON payment_methods (bill_id, is_primary);

-- -----------------------------------------------------------------------------
-- Table: bill_occurrences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_occurrences (
  id                   UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id              UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  due_date             DATE          NOT NULL,
  amount               NUMERIC(10,2) NOT NULL,
  status               TEXT          NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','paid','overdue','cancelled')),
  paid_at              TIMESTAMPTZ,
  confirmation_source  TEXT          CHECK (confirmation_source IN ('whatsapp','web','manual')),
  whatsapp_msg         TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occ_bill_id    ON bill_occurrences (bill_id);
CREATE INDEX IF NOT EXISTS idx_occ_due_date   ON bill_occurrences (due_date);
CREATE INDEX IF NOT EXISTS idx_occ_status_due ON bill_occurrences (status, due_date);
CREATE INDEX IF NOT EXISTS idx_occ_bill_due   ON bill_occurrences (bill_id, due_date);

CREATE TRIGGER trg_occurrences_updated_at
  BEFORE UPDATE ON bill_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- Table: notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_occurrence_id  UUID        NOT NULL REFERENCES bill_occurrences(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL CHECK (type IN ('before_due','on_due_date')),
  scheduled_for       DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','sent','failed','skipped')),
  sent_at             TIMESTAMPTZ,
  waha_message_id     TEXT,
  message_body        TEXT,
  error_detail        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_occurrence_id     ON notifications (bill_occurrence_id);
CREATE INDEX IF NOT EXISTS idx_notif_scheduled_status  ON notifications (scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_notif_occurrence_status ON notifications (bill_occurrence_id, status);

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- Frontend uses anon key — RLS ensures users only see their own data
-- Edge Functions use service_role key — bypass RLS automatically
-- =============================================================================

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_occurrences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- users: each user sees/edits only their own row
CREATE POLICY "users_self" ON users
  FOR ALL USING (id = auth.uid());

-- bills: user owns the bill
CREATE POLICY "bills_owner" ON bills
  FOR ALL USING (user_id = auth.uid());

-- payment_methods: user owns the parent bill
CREATE POLICY "payment_methods_owner" ON payment_methods
  FOR ALL USING (
    EXISTS (SELECT 1 FROM bills WHERE bills.id = payment_methods.bill_id AND bills.user_id = auth.uid())
  );

-- bill_occurrences: user owns the parent bill
CREATE POLICY "bill_occurrences_owner" ON bill_occurrences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_occurrences.bill_id AND bills.user_id = auth.uid())
  );

-- notifications: user owns the parent occurrence → bill
CREATE POLICY "notifications_owner" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bill_occurrences bo
      JOIN bills b ON b.id = bo.bill_id
      WHERE bo.id = notifications.bill_occurrence_id AND b.user_id = auth.uid()
    )
  );
