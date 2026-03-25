-- =============================================================================
-- BillSync — Database Schema
-- Date: 2026-03-25
-- MySQL 8.0.13+ required (DEFAULT (UUID()) expression support)
-- =============================================================================

SET FOREIGN_KEY_CHECKS=0;

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                        CHAR(36)         NOT NULL DEFAULT (UUID()),
  name                      VARCHAR(255),
  whatsapp_number           VARCHAR(20)      NOT NULL,
  timezone                  VARCHAR(50)      NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active                 BOOLEAN          NOT NULL DEFAULT TRUE,

  -- Notification preferences (RF-32, RF-33)
  whatsapp_alerts_enabled   BOOLEAN          NOT NULL DEFAULT TRUE,
  weekly_summary_enabled    BOOLEAN          NOT NULL DEFAULT FALSE,
  default_days_before_alert TINYINT UNSIGNED NOT NULL DEFAULT 3,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_whatsapp (whatsapp_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: bills
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id                      CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id                 CHAR(36)      NOT NULL,
  name                    VARCHAR(255)  NOT NULL,
  description             TEXT,
  amount                  DECIMAL(10,2) NOT NULL,
  recurrence_type         ENUM('monthly','weekly','once') NOT NULL,
  recurrence_day_of_month TINYINT UNSIGNED,     -- 1-31, if recurrence_type = 'monthly'
  recurrence_day_of_week  TINYINT UNSIGNED,     -- 0-6 (0=Sun), if recurrence_type = 'weekly'
  due_date                DATE,                 -- exact date, if recurrence_type = 'once'
  days_before_alert       TINYINT UNSIGNED NOT NULL DEFAULT 3,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_bills_user_id     (user_id),
  KEY idx_bills_user_active (user_id, is_active),

  CONSTRAINT fk_bills_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: payment_methods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()),
  bill_id         CHAR(36)    NOT NULL,
  type            ENUM('pix','boleto') NOT NULL,

  -- PIX (RF-07)
  pix_key_type    ENUM('cpf','email','phone','random'),
  pix_key         VARCHAR(255),
  pix_beneficiary VARCHAR(255),

  -- Boleto (RF-08)
  boleto_code     TEXT,

  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_pm_bill_id      (bill_id),
  KEY idx_pm_bill_primary (bill_id, is_primary),

  CONSTRAINT fk_pm_bill FOREIGN KEY (bill_id)
    REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: bill_occurrences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_occurrences (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()),
  bill_id              CHAR(36)      NOT NULL,
  due_date             DATE          NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  status               ENUM('pending','paid','overdue','cancelled')
                         NOT NULL DEFAULT 'pending',

  -- Payment confirmation (RF-15, RF-24)
  paid_at              DATETIME,
  confirmation_source  ENUM('whatsapp','web','manual'),
  whatsapp_msg         TEXT,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_occ_bill_id    (bill_id),
  KEY idx_occ_due_date   (due_date),
  KEY idx_occ_status_due (status, due_date),
  KEY idx_occ_bill_due   (bill_id, due_date),

  CONSTRAINT fk_occ_bill FOREIGN KEY (bill_id)
    REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                  CHAR(36)    NOT NULL DEFAULT (UUID()),
  bill_occurrence_id  CHAR(36)    NOT NULL,
  type                ENUM('before_due','on_due_date') NOT NULL,
  scheduled_for       DATE        NOT NULL,
  status              ENUM('scheduled','sent','failed','skipped')
                        NOT NULL DEFAULT 'scheduled',

  -- Post-send fields (RF-19)
  sent_at             DATETIME,
  waha_message_id     VARCHAR(255),
  message_body        TEXT,
  error_detail        TEXT,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notif_occurrence_id     (bill_occurrence_id),
  KEY idx_notif_scheduled_status  (scheduled_for, status),
  KEY idx_notif_occurrence_status (bill_occurrence_id, status),

  CONSTRAINT fk_notif_occurrence FOREIGN KEY (bill_occurrence_id)
    REFERENCES bill_occurrences(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
