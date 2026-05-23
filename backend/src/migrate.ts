import pool from './db'

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
}

type SqlMigration = { name: string; statements: string[] }
type JsMigration = { name: string; run: () => Promise<void> }
type Migration = SqlMigration | JsMigration

const MIGRATIONS: Migration[] = [
  {
    name: '003_checklists',
    statements: splitStatements(`
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
`),
  },
  {
    name: '004_merge_duplicate_phones',
    run: async () => {
      const [pairs]: any = await pool.query(`
        SELECT
          u13.id          AS id13,
          u13.whatsapp_number AS num13,
          u13.created_at  AS created13,
          u12.id          AS id12,
          u12.whatsapp_number AS num12,
          u12.created_at  AS created12
        FROM users u13
        JOIN users u12 ON (
          CHAR_LENGTH(u13.whatsapp_number) = 13
          AND CHAR_LENGTH(u12.whatsapp_number) = 12
          AND CONCAT(SUBSTRING(u13.whatsapp_number, 1, 4), SUBSTRING(u13.whatsapp_number, 6)) = u12.whatsapp_number
        )
      `)

      for (const pair of pairs) {
        const olderIsThe13 = new Date(pair.created13) <= new Date(pair.created12)
        const keepId  = olderIsThe13 ? pair.id13  : pair.id12
        const keepNum = olderIsThe13 ? pair.num13 : pair.num12
        const dropId  = olderIsThe13 ? pair.id12  : pair.id13
        const dropNum = olderIsThe13 ? pair.num12 : pair.num13

        const conn = await pool.getConnection()
        try {
          await conn.beginTransaction()

          // Se ambos tiverem checklist, remove o do duplicado antes (unique key)
          const [clRows]: any = await conn.query(
            `SELECT COUNT(*) AS cnt FROM checklists WHERE user_id IN (?, ?)`,
            [keepId, dropId]
          )
          if (clRows[0].cnt === 2) {
            await conn.query(`DELETE FROM checklists WHERE user_id = ?`, [dropId])
            console.warn(`[migrate] aviso: historico de checklist_daily_polls de ${dropNum} descartado (conflito de checklist unico)`)
          }

          // notifications nao tem user_id — segue via bills → bill_occurrences → notifications
          await conn.query(`UPDATE bills                 SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
          await conn.query(`UPDATE checklists            SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
          await conn.query(`UPDATE checklist_daily_polls SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
          await conn.query(`UPDATE otp_codes             SET phone_number = ? WHERE phone_number = ?`, [keepNum, dropNum])
          await conn.query(`DELETE FROM users WHERE id = ?`, [dropId])

          await conn.commit()
          console.log(`[migrate] mesclado ${dropNum} → ${keepNum}`)
        } catch (err) {
          await conn.rollback()
          throw err
        } finally {
          conn.release()
        }
      }

      console.log(`[migrate] 004: ${pairs.length} par(es) processado(s)`)
    },
  },
  {
    name: '005_notifications_status_processing',
    statements: splitStatements(`
ALTER TABLE notifications
  MODIFY COLUMN status ENUM('scheduled','processing','sent','failed','skipped') NOT NULL DEFAULT 'scheduled'
`),
  },
  {
    name: '006_bills_category',
    statements: splitStatements(`
ALTER TABLE bills ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT NULL AFTER name
`),
  },
  {
    name: '007_users_summary_budget',
    statements: splitStatements(`
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS summary_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER whatsapp_alerts_enabled,
  ADD COLUMN IF NOT EXISTS summary_day_of_week TINYINT UNSIGNED DEFAULT 1 AFTER summary_enabled,
  ADD COLUMN IF NOT EXISTS monthly_budget_limit DECIMAL(10,2) DEFAULT NULL AFTER summary_day_of_week
`),
  },
  {
    name: '008_checklists_multi',
    statements: splitStatements(`
ALTER TABLE checklists DROP INDEX IF EXISTS uq_checklists_user;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_type ENUM('daily','weekdays','custom') NOT NULL DEFAULT 'daily' AFTER send_time;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence_days JSON DEFAULT NULL AFTER recurrence_type
`),
  },
]

export async function runMigrations(): Promise<void> {
  // Garante que migration_log existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration_log (
      name    VARCHAR(100) NOT NULL,
      ran_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Bootstrap: se checklist_daily_polls ja existe mas 003 nao esta no log, registra
  try {
    const [tableExists]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'checklist_daily_polls'`,
      [process.env.DB_NAME || 'daily']
    )
    if (tableExists[0].cnt > 0) {
      await pool.query(
        `INSERT IGNORE INTO migration_log (name) VALUES ('003_checklists')`
      )
    }
  } catch {
    // ignora — tenta rodar mesmo assim
  }

  for (const migration of MIGRATIONS) {
    const [logRows]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM migration_log WHERE name = ?`,
      [migration.name]
    )
    if (logRows[0].cnt > 0) {
      console.log(`[migrate] ${migration.name} ja executada — pulando`)
      continue
    }

    console.log(`[migrate] executando ${migration.name}...`)

    if ('statements' in migration) {
      for (let i = 0; i < migration.statements.length; i++) {
        const stmt = migration.statements[i]
        try {
          await pool.query(stmt + ';')
        } catch (err: any) {
          console.error(`[migrate] erro na statement ${i + 1} de ${migration.name}:`, err.message)
          console.error(`[migrate] sql: ${stmt.slice(0, 80)}...`)
          throw err
        }
      }
    }

    if ('run' in migration) {
      await migration.run()
    }

    await pool.query(`INSERT INTO migration_log (name) VALUES (?)`, [migration.name])
    console.log(`[migrate] ${migration.name} concluida`)
  }
}
