ALTER TABLE users
  ADD COLUMN IF NOT EXISTS summary_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER whatsapp_alerts_enabled,
  ADD COLUMN IF NOT EXISTS summary_day_of_week TINYINT UNSIGNED DEFAULT 1 AFTER summary_enabled,
  ADD COLUMN IF NOT EXISTS monthly_budget_limit DECIMAL(10,2) DEFAULT NULL AFTER summary_day_of_week;
