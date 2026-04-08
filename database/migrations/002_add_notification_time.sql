-- =============================================================================
-- BillSync — Add notification_time column to users table
-- Date: 2026-04-07
-- =============================================================================

ALTER TABLE users
  ADD COLUMN notification_time TINYINT UNSIGNED NOT NULL DEFAULT 8
  COMMENT 'Hora do dia para envio de notificações (7,8,9,10,12,18) em America/Sao_Paulo';
