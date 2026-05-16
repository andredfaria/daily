# Phone Normalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que login com número brasileiro com ou sem o dígito 9 (ex: `5511987654321` e `551187654321`) sempre acesse o mesmo perfil de usuário, e mesclar duplicatas já existentes no banco.

**Architecture:** (1) Nova função `buildPhoneCandidates` em `waha.ts` produz todos os candidatos de busca a partir do número digitado + resolved + variante — sem dependência do WAHA. (2) `verify-otp` usa essa função para buscar usuários em vez de `IN (digits, resolvedNumber)`. (3) `runMigrations` é refatorado para usar tabela `migration_log` por migration, então migration `004` roda a mesclagem de duplicatas na inicialização.

**Tech Stack:** TypeScript, Express, MySQL2, Jest + ts-jest (adicionado neste plano)

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `backend/package.json` | Adicionar Jest + ts-jest como devDependencies e script `test` |
| `backend/src/services/waha.ts` | Exportar nova função `buildPhoneCandidates` |
| `backend/src/services/__tests__/waha.test.ts` | Criar — testes unitários de `generatePhoneVariant` e `buildPhoneCandidates` |
| `backend/src/routes/auth.ts` | Usar `buildPhoneCandidates` no `verify-otp` |
| `backend/src/migrate.ts` | Refatorar `runMigrations` + adicionar migration `004` |

---

## Task 1: Configurar Jest no backend

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Instalar dependências**

```bash
cd backend && npm install --save-dev jest ts-jest @types/jest
```

- [ ] **Step 2: Atualizar `backend/package.json`**

Adicione o script `test` e a config `jest` (preservando todo o restante do arquivo):

```json
{
  "name": "billsync-backend",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn src/index.ts",
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.ts"]
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^17.3.1",
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.3",
    "mysql2": "^3.9.0",
    "node-cron": "^4.2.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jest": "^29.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.11",
    "@types/uuid": "^9.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Verificar que Jest está acessível**

```bash
cd backend && npx jest --version
```

Esperado: `29.x.x`

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add jest + ts-jest for unit tests"
```

---

## Task 2: Escrever testes que falham para `buildPhoneCandidates`

**Files:**
- Create: `backend/src/services/__tests__/waha.test.ts`

- [ ] **Step 1: Criar arquivo de teste**

Crie `backend/src/services/__tests__/waha.test.ts` com o conteúdo:

```typescript
import { generatePhoneVariant, buildPhoneCandidates } from '../waha'

describe('generatePhoneVariant', () => {
  it('adiciona 9 a numero de 12 digitos', () => {
    expect(generatePhoneVariant('551187654321')).toBe('5511987654321')
  })

  it('remove 9 de numero de 13 digitos', () => {
    expect(generatePhoneVariant('5511987654321')).toBe('551187654321')
  })

  it('retorna null para numero com menos de 12 digitos', () => {
    expect(generatePhoneVariant('12345678901')).toBeNull()
  })

  it('retorna null para numero com mais de 13 digitos', () => {
    expect(generatePhoneVariant('55119876543210')).toBeNull()
  })
})

describe('buildPhoneCandidates', () => {
  it('inclui digits, resolvedNumber e variante quando WAHA resolve diferente', () => {
    const result = buildPhoneCandidates('551187654321', '5511987654321')
    expect(result).toContain('551187654321')
    expect(result).toContain('5511987654321')
    expect(result.length).toBe(2) // resolvedNumber e variant são o mesmo, sem duplicata
  })

  it('deduplica e inclui variante quando WAHA falha (resolvedNumber == digits)', () => {
    const result = buildPhoneCandidates('5511987654321', '5511987654321')
    expect(result).toContain('5511987654321')
    expect(result).toContain('551187654321') // variante gerada por string
    expect(result.filter(n => n === '5511987654321').length).toBe(1) // sem duplicata
  })

  it('nao duplica quando digits e resolved e variant sao todos iguais (numero nao-BR)', () => {
    // 11 digitos — generatePhoneVariant retorna null
    expect(buildPhoneCandidates('12345678901', '12345678901')).toEqual(['12345678901'])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
cd backend && npm test
```

Esperado: FAIL — `buildPhoneCandidates is not a function` (ou similar, pois ainda não existe)

- [ ] **Step 3: Commit do arquivo de teste**

```bash
git add backend/src/services/__tests__/waha.test.ts
git commit -m "test(waha): add failing tests for buildPhoneCandidates"
```

---

## Task 3: Implementar `buildPhoneCandidates` e corrigir `verify-otp`

**Files:**
- Modify: `backend/src/services/waha.ts`
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Adicionar `buildPhoneCandidates` em `waha.ts`**

Adicione logo após a função `generatePhoneVariant` existente (linha ~47 de `backend/src/services/waha.ts`):

```typescript
/**
 * Constrói a lista de candidatos de whatsapp_number para busca no banco.
 * Sempre inclui digits, resolvedNumber e a variante com/sem 9 — sem duplicatas.
 * Funciona sem WAHA disponível (usa apenas manipulação de string).
 */
export function buildPhoneCandidates(digits: string, resolvedNumber: string): string[] {
  const variant = generatePhoneVariant(digits)
  return [...new Set([digits, resolvedNumber, ...(variant ? [variant] : [])])]
}
```

- [ ] **Step 2: Rodar os testes e confirmar que passam**

```bash
cd backend && npm test
```

Esperado: PASS em todos os testes de `generatePhoneVariant` e `buildPhoneCandidates`

- [ ] **Step 3: Corrigir `verify-otp` em `backend/src/routes/auth.ts`**

Adicione `buildPhoneCandidates` ao import de `waha.ts` na linha 5:

```typescript
import { fetchWhatsAppName, resolveWhatsAppNumber, sendWhatsAppText, WhatsAppNumberNotFoundError, buildPhoneCandidates } from '../services/waha'
```

Substitua o bloco de busca de usuários (atualmente linhas ~121–148) pela versão abaixo:

```typescript
    // Resolve numero correto no WhatsApp (com ou sem o 9)
    let resolvedNumber = digits
    try {
      resolvedNumber = await resolveWhatsAppNumber(digits)
    } catch {
      // WAHA indisponível — fallback por variante de string
    }

    // Busca usuario por todos os candidatos: digits, resolved e variante com/sem 9
    const candidates = buildPhoneCandidates(digits, resolvedNumber)
    const placeholders = candidates.map(() => '?').join(', ')
    const [userRows]: any = await pool.query(
      `SELECT * FROM users WHERE whatsapp_number IN (${placeholders}) LIMIT 1`,
      candidates
    )

    let user: any
    if (userRows.length) {
      user = userRows[0]
    } else {
      const newId = uuidv4()
      await pool.query(
        `INSERT INTO users (id, name, whatsapp_number, timezone, is_active) VALUES (?, NULL, ?, 'America/Sao_Paulo', TRUE)`,
        [newId, resolvedNumber]
      )
      const [newUserRows]: any = await pool.query(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [newId]
      )
      user = newUserRows[0]
    }
```

- [ ] **Step 4: Verificar que o TypeScript compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/waha.ts backend/src/routes/auth.ts
git commit -m "fix(auth): include phone variant in user lookup to prevent duplicate profiles"
```

---

## Task 4: Refatorar `runMigrations` para usar `migration_log`

**Files:**
- Modify: `backend/src/migrate.ts`

O sistema atual usa um guard global baseado na existência da tabela `checklist_daily_polls`. Isso impede que novas migrations rodem em bancos existentes. Precisamos trocar para um log por migration.

- [ ] **Step 1: Substituir o conteúdo de `backend/src/migrate.ts`**

Reescreva o arquivo completo com o novo sistema:

```typescript
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

        // Se ambos tiverem checklist, remove o do duplicado antes (unique key)
        const [clRows]: any = await pool.query(
          `SELECT COUNT(*) AS cnt FROM checklists WHERE user_id IN (?, ?)`,
          [keepId, dropId]
        )
        if (clRows[0].cnt === 2) {
          await pool.query(`DELETE FROM checklists WHERE user_id = ?`, [dropId])
        }

        await pool.query(`UPDATE bills                SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
        await pool.query(`UPDATE notifications        SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
        await pool.query(`UPDATE checklists           SET user_id      = ? WHERE user_id      = ?`, [keepId,  dropId])
        await pool.query(`UPDATE checklist_daily_polls SET user_id     = ? WHERE user_id      = ?`, [keepId,  dropId])
        await pool.query(`UPDATE otp_codes            SET phone_number = ? WHERE phone_number = ?`, [keepNum, dropNum])
        await pool.query(`DELETE FROM users WHERE id = ?`, [dropId])

        console.log(`[migrate] mesclado ${dropNum} → ${keepNum}`)
      }

      console.log(`[migrate] 004: ${pairs.length} par(es) processado(s)`)
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
```

- [ ] **Step 2: Verificar compilação TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 3: Rodar os testes unitários (não devem ter regressão)**

```bash
cd backend && npm test
```

Esperado: todos PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrate.ts
git commit -m "refactor(migrate): switch to per-migration migration_log tracking

Adds migration_log table. Bootstraps existing 003_checklists entries.
Enables future migrations to run independently on already-initialized DBs."
```

---

## Task 5: Verificação manual em dev

Esses passos não têm como ser automatizados (sem banco de teste), mas são obrigatórios antes de considerar a tarefa concluída.

- [ ] **Step 1: Subir o backend em dev**

```bash
cd backend && npm run dev
```

Observe o log de startup. Esperado em banco **sem** duplicatas:

```
[migrate] migration_log criada (ou ja existia)
[migrate] 003_checklists ja executada — pulando
[migrate] executando 004_merge_duplicate_phones...
[migrate] 004: 0 par(es) processado(s)
[migrate] 004_merge_duplicate_phones concluida
```

- [ ] **Step 2: Verificar idempotência — reiniciar o backend**

```bash
# Ctrl+C e npm run dev novamente
```

Esperado no segundo start:

```
[migrate] 003_checklists ja executada — pulando
[migrate] 004_merge_duplicate_phones ja executada — pulando
```

- [ ] **Step 3: Testar login com variantes (DEV_OTP_BYPASS=true)**

Com `DEV_OTP_BYPASS=true` no `.env`:

1. Faça request-otp com `5511987654321` → anote o OTP no log
2. Faça verify-otp com `5511987654321` → deve logar e criar usuário
3. Faça request-otp com `551187654321` → anote o OTP
4. Faça verify-otp com `551187654321` → deve retornar **o mesmo usuário** (mesmo `id`)

```bash
# request-otp
curl -s -X POST http://localhost:4000/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone": "5511987654321"}' | jq .

# verify-otp (substitua CODE pelo código no log)
curl -s -X POST http://localhost:4000/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone": "5511987654321", "code": "CODE"}' | jq .id

# Repita com a variante
curl -s -X POST http://localhost:4000/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone": "551187654321"}' | jq .

curl -s -X POST http://localhost:4000/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone": "551187654321", "code": "CODE2"}' | jq .id
```

Esperado: ambos os `.id` retornados são **idênticos**.

---

## Critérios de Conclusão

- [ ] `npm test` passa com 7 testes (4 de `generatePhoneVariant` + 3 de `buildPhoneCandidates`)
- [ ] `npx tsc --noEmit` sem erros
- [ ] Login com variante com e sem 9 retorna o mesmo `user.id` em dev
- [ ] Segunda inicialização do backend não re-executa nenhuma migration
