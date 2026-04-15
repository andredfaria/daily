-- =============================================================================
-- BillSync — Auth Migration
-- Date: 2026-04-15
-- Creates otp_codes table for phone-based OTP authentication
-- =============================================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id           CHAR(36)         NOT NULL DEFAULT (UUID()),
  phone_number VARCHAR(20)      NOT NULL,
  code         CHAR(6)          NOT NULL,
  expires_at   DATETIME         NOT NULL,
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used         BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_otp_phone_expires (phone_number, expires_at),
  KEY idx_otp_cleanup       (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
