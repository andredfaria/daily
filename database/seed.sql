-- =============================================================================
-- BillSync — Seed Data
-- Date: 2026-03-25
-- =============================================================================

-- Default admin user
-- INSERT IGNORE is idempotent: skips if the row already exists (PK or UNIQUE conflict)
INSERT IGNORE INTO users (id, name, whatsapp_number, timezone, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  '+5500000000000',
  'America/Sao_Paulo',
  1
);
