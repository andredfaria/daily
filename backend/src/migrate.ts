import pool from './db'

const MIGRATIONS = [
  {
    name: '003_checklists',
    sql: `
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS checklists (
  id          CHAR(36)         NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)         NOT NULL,
  name        VARCHAR(100)     NOT NULL DEFAULT 'Checklist Diário',
  send_time   TINYINT UNSIGNED NOT NULL DEFAULT 9,
  timezone    VARCHAR(50)      NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checklists_user (user_id),
  KEY idx_checklists_send (send_time, is_active),
  CONSTRAINT fk_checklists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checklist_items (
  id           CHAR(36)         NOT NULL DEFAULT (UUID()),
  checklist_id CHAR(36)         NOT NULL,
  text         VARCHAR(255)     NOT NULL,
  sort_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_checklist (checklist_id),
  CONSTRAINT fk_items_checklist FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checklist_daily_polls (
  id                  CHAR(36)         NOT NULL DEFAULT (UUID()),
  checklist_id        CHAR(36)         NOT NULL,
  user_id             CHAR(36)         NOT NULL,
  poll_date           DATE             NOT NULL,
  waha_poll_id        VARCHAR(255)     DEFAULT NULL,
  selected_options    JSON             DEFAULT NULL,
  completed_count     TINYINT UNSIGNED DEFAULT 0,
  total_count         TINYINT UNSIGNED DEFAULT 0,
  completion_pct      DECIMAL(5,2)     DEFAULT 0.00,
  last_vote_timestamp BIGINT           DEFAULT NULL,
  status              ENUM('pending','sent','completed') NOT NULL DEFAULT 'pending',
  created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_poll (checklist_id, poll_date),
  KEY idx_daily_polls_user_date (user_id, poll_date),
  KEY idx_daily_polls_waha (waha_poll_id),
  CONSTRAINT fk_daily_polls_checklist FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
  CONSTRAINT fk_daily_polls_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
`,
  },
]

export async function runMigrations(): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'checklists'`,
    [process.env.DB_NAME || 'daily'],
  )

  if (rows[0].cnt > 0) {
    console.log('[migrate] checklists ja existe — pulando')
    return
  }

  for (const migration of MIGRATIONS) {
    try {
      console.log(`[migrate] executando ${migration.name}...`)
      await pool.query(migration.sql)
      console.log(`[migrate] ${migration.name} concluida`)
    } catch (err: any) {
      console.error(`[migrate] erro em ${migration.name}:`, err.message)
      throw err
    }
  }
}
