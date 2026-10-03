import pool from './db'
import { inferirCategoria } from './services/expenseCategories'

async function addColumnIfNotExists(table: string, column: string, definition: string, after?: string): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME || 'daily', table, column]
  )
  if (rows[0].cnt > 0) return
  const afterClause = after ? ` AFTER ${after}` : ''
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}${afterClause}`)
}

async function dropColumnIfExists(table: string, column: string): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME || 'daily', table, column]
  )
  if (rows[0].cnt === 0) return
  await pool.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
}

async function dropIndexIfExists(table: string, index: string): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [process.env.DB_NAME || 'daily', table, index]
  )
  if (rows[0].cnt === 0) return
  await pool.query(`ALTER TABLE ${table} DROP INDEX ${index}`)
}

async function addIndexIfNotExists(table: string, index: string, columns: string): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [process.env.DB_NAME || 'daily', table, index]
  )
  if (rows[0].cnt > 0) return
  await pool.query(`ALTER TABLE ${table} ADD INDEX ${index} (${columns})`)
}

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
    run: async () => {
      await addColumnIfNotExists('bills', 'category', 'VARCHAR(50) DEFAULT NULL', 'name')
    },
  },
  {
    name: '007_users_summary_budget',
    run: async () => {
      await addColumnIfNotExists('users', 'summary_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE', 'whatsapp_alerts_enabled')
      await addColumnIfNotExists('users', 'summary_day_of_week', 'TINYINT UNSIGNED DEFAULT 1', 'summary_enabled')
      await addColumnIfNotExists('users', 'monthly_budget_limit', 'DECIMAL(10,2) DEFAULT NULL', 'summary_day_of_week')
    },
  },
  {
    name: '008_checklists_multi',
    run: async () => {
      // A FK fk_checklists_user depende de um indice em user_id; no MySQL 8 o unico
      // indice e o uq_checklists_user, entao precisamos criar um indice nao-unico
      // substituto ANTES de dropar o unico (senao: "needed in a foreign key constraint").
      await addIndexIfNotExists('checklists', 'idx_checklists_user', 'user_id')
      await dropIndexIfExists('checklists', 'uq_checklists_user')
      await addColumnIfNotExists('checklists', 'recurrence_type', "ENUM('daily','weekdays','custom') NOT NULL DEFAULT 'daily'", 'send_time')
      await addColumnIfNotExists('checklists', 'recurrence_days', 'JSON DEFAULT NULL', 'recurrence_type')
    },
  },
  {
    name: '009_users_onboarding',
    run: async () => {
      await addColumnIfNotExists('users', 'onboarding_completed', 'BOOLEAN NOT NULL DEFAULT FALSE', 'is_active')
    },
  },
  {
    name: '010_remove_payment_fields',
    run: async () => {
      await dropIndexIfExists('bill_occurrences', 'idx_occ_status_due')
      await dropColumnIfExists('bill_occurrences', 'status')
      await dropColumnIfExists('bill_occurrences', 'paid_at')
      await dropColumnIfExists('bill_occurrences', 'confirmation_source')
    },
  },
  {
    name: '011_users_monthly_summary',
    run: async () => {
      await addColumnIfNotExists('users', 'monthly_summary_enabled', 'BOOLEAN NOT NULL DEFAULT TRUE', 'summary_day_of_week')
    },
  },
  {
    name: '012_checklists_consecutive_misses',
    run: async () => {
      await addColumnIfNotExists('checklists', 'consecutive_misses', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0', 'is_active')
    },
  },
  {
    name: '013_checklists_last_miss_poll_date',
    run: async () => {
      await addColumnIfNotExists('checklists', 'last_miss_poll_date', 'DATE DEFAULT NULL', 'consecutive_misses')
    },
  },
  {
    name: '014_assets',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS assets (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id             CHAR(36)      NOT NULL,
  ticker              VARCHAR(20)   NOT NULL,
  kind                ENUM('stock','fii','crypto') NOT NULL DEFAULT 'stock',
  quantity            DECIMAL(18,8) NOT NULL DEFAULT 0,
  avg_price           DECIMAL(18,8) NOT NULL DEFAULT 0,
  target_price        DECIMAL(18,8) DEFAULT NULL,
  stop_price          DECIMAL(18,8) DEFAULT NULL,
  target_triggered_at DATETIME      DEFAULT NULL,
  stop_triggered_at   DATETIME      DEFAULT NULL,
  last_price          DECIMAL(18,8) DEFAULT NULL,
  last_quote_at       DATETIME      DEFAULT NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_ticker (user_id, ticker),
  KEY idx_assets_user_active (user_id, is_active),
  CONSTRAINT fk_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    name: '015_users_asset_alerts',
    run: async () => {
      await addColumnIfNotExists('users', 'asset_alerts_enabled', 'BOOLEAN NOT NULL DEFAULT TRUE')
      await addColumnIfNotExists('users', 'asset_alert_hour', 'TINYINT UNSIGNED NOT NULL DEFAULT 11', 'asset_alerts_enabled')
    },
  },
  {
    name: '016_asset_snapshots',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id            CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)      NOT NULL,
  asset_id      CHAR(36)      NOT NULL,
  snapshot_date DATE          NOT NULL,
  price         DECIMAL(18,8) NOT NULL,
  quantity      DECIMAL(18,8) NOT NULL,
  avg_price     DECIMAL(18,8) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asset_date (asset_id, snapshot_date),
  KEY idx_user_date (user_id, snapshot_date),
  CONSTRAINT fk_snapshot_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    name: '017_message_claims',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS message_claims (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)    NOT NULL,
  kind       VARCHAR(40) NOT NULL,
  ref_key    VARCHAR(60) NOT NULL,
  claimed_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_message_claim (user_id, kind, ref_key),
  KEY idx_claim_claimed_at (claimed_at),
  CONSTRAINT fk_claim_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    // A coluna nasceu com ENUM('monthly','weekly','once') no 001_create_schema, mas
    // a tela, a validação do POST /api/bills e o occurrenceGenerator já tratam
    // quinzenal, trimestral, semestral e anual. Num banco criado do zero, salvar
    // "Trimestral" batia em ER_DATA_TRUNCATED e virava 500.
    name: '018_bills_recurrence_types',
    statements: splitStatements(`
ALTER TABLE bills
  MODIFY COLUMN recurrence_type
    ENUM('monthly','weekly','once','biweekly','quarterly','semiannual','annual') NOT NULL
    `),
  },
  {
    // Gasto avulso do dia a dia (mercado, café), anotado pelo /gasto do WhatsApp
    // ou pelo app. Fica fora de bills: não tem recorrência nem lembrete.
    name: '019_expenses',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS expenses (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)      NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  description VARCHAR(120)  NOT NULL,
  spent_on    DATE          NOT NULL,
  source      ENUM('whatsapp','app') NOT NULL DEFAULT 'app',
  message_ref VARCHAR(40)   DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_user_date (user_id, spent_on),
  UNIQUE KEY uk_expenses_message (user_id, message_ref),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    // Itens marcados por /marcar. Ficam separados de selected_options porque o
    // voto da enquete chega com a seleção inteira e sobrescreveria a marcação.
    name: '020_checklist_polls_command_marked',
    run: async () => {
      await addColumnIfNotExists('checklist_daily_polls', 'command_marked', 'JSON DEFAULT NULL', 'selected_options')
    },
  },
  {
    // Categoria do gasto avulso. Os que já existem recebem a deduzida pela
    // descrição, a mesma regra do /gasto.
    name: '021_expenses_category',
    run: async () => {
      await addColumnIfNotExists('expenses', 'category', "VARCHAR(30) NOT NULL DEFAULT 'outro'", 'description')
      const [rows]: any = await pool.query('SELECT id, description FROM expenses')
      for (const r of rows) {
        const categoria = inferirCategoria(r.description)
        if (categoria !== 'outro') {
          await pool.query('UPDATE expenses SET category = ? WHERE id = ?', [categoria, r.id])
        }
      }
      console.log(`[migrate] 021: ${rows.length} gasto(s) categorizado(s)`)
    },
  },
  {
    // Categorias de gasto do usuário. base_key preenchido = ajuste numa padrão
    // (nome, ícone, oculta); vazio = categoria criada por ele, cuja chave em
    // expenses.category é o id — daí o VARCHAR(36).
    name: '022_expense_categories',
    statements: splitStatements(`
ALTER TABLE expenses MODIFY COLUMN category VARCHAR(36) NOT NULL DEFAULT 'outro';
CREATE TABLE IF NOT EXISTS expense_categories (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)    NOT NULL,
  base_key   VARCHAR(30) DEFAULT NULL,
  name       VARCHAR(30) NOT NULL,
  icon       VARCHAR(40) NOT NULL,
  hidden     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_expense_cat_base (user_id, base_key),
  KEY idx_expense_cat_user (user_id),
  CONSTRAINT fk_expense_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    // Um registro por tick horário executado. Se o container estava fora no
    // minuto 0, o boot vê que a hora não rodou e roda — sem isso o tick sumia.
    name: '023_scheduler_ticks',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS scheduler_ticks (
  tick_key VARCHAR(13) NOT NULL,
  ran_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tick_key),
  KEY idx_tick_ran_at (ran_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    // Sessão por dispositivo, no lugar do JWT de 30 dias: prazo de 90 dias sem
    // uso renovado a cada acesso, e revogável (sair, encerrar outro aparelho).
    // Guarda o hash do token, nunca o token.
    name: '024_sessions',
    statements: splitStatements(`
CREATE TABLE IF NOT EXISTS sessions (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id      CHAR(36)     NOT NULL,
  token_hash   CHAR(64)     NOT NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  },
  {
    // Conta fixa x variável: na variável (luz, água) bills.amount é estimativa e
    // o valor real de cada mês vai na ocorrência, marcada com amount_is_actual.
    // Gastos ganham limite próprio: monthly_budget_limit passa a ser só de contas.
    name: '025_bills_fixed_expense_budget',
    run: async () => {
      await addColumnIfNotExists('bills', 'is_fixed', 'BOOLEAN NOT NULL DEFAULT TRUE', 'amount')
      await addColumnIfNotExists('bill_occurrences', 'amount_is_actual', 'BOOLEAN NOT NULL DEFAULT FALSE', 'amount')
      await addColumnIfNotExists('users', 'monthly_expense_budget_limit', 'DECIMAL(10,2) DEFAULT NULL', 'monthly_budget_limit')
    },
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
