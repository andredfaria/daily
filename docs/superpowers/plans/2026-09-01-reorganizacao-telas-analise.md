# Reorganização de Telas com Análise por Domínio — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolver a página `/analise` em abas de análise dentro de Contas, Ativos e Checklists; transformar o Dashboard em Home com perfil do WhatsApp e pendências do dia; e persistir snapshots diários de ativos para alimentar o gráfico de evolução do patrimônio.

**Architecture:** Cada domínio vira um shell fino (barra de abas + `<Outlet/>`) com rotas aninhadas reais, de modo que a aba corrente é endereçável por URL. Os componentes de análise existentes são movidos de `components/analise/` para pastas por domínio. No backend, a coleta de cotação é extraída do serviço de alerta para um serviço próprio que também grava um snapshot diário por ativo, sem nenhuma requisição extra à brapi.

**Tech Stack:** React 18 + React Router 6.22 + TypeScript 5.2 + Vite 5.4 + Tailwind 3.4 + Recharts 3.8 (frontend); Express 4 + TypeScript + mysql2 + node-cron (backend); jest + ts-jest (testes backend), vitest (testes frontend, adicionado neste plano).

**Spec:** `docs/superpowers/specs/2026-09-01-reorganizacao-telas-analise-design.md`

## Global Constraints

- Todo código, comentário, log e texto de UI em **português (pt-BR)**. Sem exceção.
- Mensagens de commit em pt-BR, no formato do repositório: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, com escopo opcional (`feat(ativos):`).
- **Todo commit deve terminar com estas duas linhas**, precedidas de uma linha em branco:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
  ```
- Cores e espaçamentos saem dos tokens Tailwind do design system (`design-system/billsync/MASTER.md`): `background`, `surface-container`, `surface-container-lowest`, `surface-container-high`, `primary`, `on-primary`, `on-surface`, `on-surface-variant`, `outline-variant`, `tertiary`, `error`. **Nunca hex literal em className.**
- Alvo de toque mínimo: `min-h-[44px]` em qualquer elemento clicável novo.
- `tsconfig.json` do frontend tem `strict`, `noUnusedLocals` e `noUnusedParameters` ligados — variável ou import não usado quebra o `npm run build`.
- Ícones são Material Symbols via `<span className="material-symbols-outlined">nome_do_icone</span>`.
- O backend roda migrations sozinho no boot via `runMigrations()`. **Não existe script SQL para rodar à mão.**
- Nenhuma tabela nova além de `asset_snapshots`. Nenhum endpoint novo além de `GET /api/assets/history`.

---

### Task 1: Baseline — commitar trabalho em andamento e instalar vitest

O repositório tem componentes de análise não commitados que as tasks seguintes vão mover de pasta. Commitar antes separa "escrevi o arquivo" de "movi o arquivo" em diffs distintos e legíveis.

**Files:**
- Commit: `src/components/analise/*`, `src/components/checklist/*`, `src/pages/Analise.tsx`, `src/pages/Contas.tsx`, `src/index.css`, `backend/src/dispatcher.ts`, `dist/index.html`
- Create: `vitest.config.ts`
- Create: `src/utils/__tests__/smoke.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.node.json`

**Interfaces:**
- Consumes: nada.
- Produces: comando `npm test` no frontend, executando arquivos `src/**/__tests__/*.test.ts`.

- [ ] **Step 1: Inspecionar o que está pendente**

```bash
git status --short
```

Esperado: modificados `backend/src/dispatcher.ts`, `dist/index.html`, `src/components/analise/BudgetCard.tsx`, `src/components/checklist/ChecklistHeatmap.tsx`, `src/components/checklist/ChecklistItemRanking.tsx`, `src/index.css`, `src/pages/Analise.tsx`, `src/pages/Contas.tsx`; não rastreados `src/components/analise/CategoryBreakdown.tsx`, `RadialGauge.tsx`, `SpendingTrendChart.tsx`, `SummaryStats.tsx`, `src/components/checklist/WeeklyTrendSparkline.tsx`.

Ignorar `.claude-flow/`, `backend/.claude-flow/`, `ruvector.db`, `backend/ruvector.db` e `backend/src/pending-migrations/009_users_onboarding.sql` — não entram em nenhum commit deste plano.

- [ ] **Step 2: Commitar o trabalho em andamento**

```bash
git add src/components/analise src/components/checklist src/pages/Analise.tsx src/pages/Contas.tsx src/index.css backend/src/dispatcher.ts dist/index.html
git commit -m "$(cat <<'EOF'
feat(analise): componentes de gráfico de gastos e de histórico de checklist

Adiciona SummaryStats, SpendingTrendChart, CategoryBreakdown e RadialGauge na
análise financeira, e WeeklyTrendSparkline no checklist, com ajustes em
BudgetCard, ChecklistHeatmap e ChecklistItemRanking.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

- [ ] **Step 3: Instalar o vitest**

Vite é `^5.4.21`; a linha compatível do vitest é a 2.x.

```bash
npm install --save-dev vitest@^2.1.9
```

- [ ] **Step 4: Criar `vitest.config.ts`**

Arquivo separado do `vite.config.ts` de propósito: `defineConfig` de `vite` não tipa o bloco `test`, e mexer na tipagem do config de build para acomodar teste é troca ruim.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // As funções testadas são puras (agregação de ativos) — não tocam DOM.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Registrar o config no tsconfig.node.json e o script no package.json**

Em `tsconfig.node.json`, trocar a linha `include`:

```json
  "include": ["vite.config.ts", "vitest.config.ts"]
```

Em `package.json`, adicionar o script `test` logo após `preview`:

```json
    "preview": "vite preview",
    "test": "vitest run"
```

- [ ] **Step 6: Escrever um teste de fumaça que prova o runner**

Criar `src/utils/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatBRL } from '../format'

describe('runner de testes do frontend', () => {
  it('carrega um módulo de src e roda a asserção', () => {
    expect(formatBRL(1234.5)).toContain('1.234,50')
  })
})
```

- [ ] **Step 7: Rodar e verificar que passa**

Run: `npm test`
Expected: PASS, 1 teste.

- [ ] **Step 8: Verificar que o build continua íntegro**

Run: `npm run build`
Expected: sucesso, sem erro de TypeScript.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.node.json src/utils/__tests__/smoke.test.ts
git commit -m "$(cat <<'EOF'
test: adiciona vitest para as funções puras do frontend

Config separado do vite.config.ts para não misturar tipagem de build com
tipagem de teste. Ambiente node — as funções cobertas não tocam DOM.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 2: Backend — funções puras do snapshot

Isola as duas decisões do snapshot que têm borda de verdade: qual preço usar e quando desistir do ativo no dia. Mesma separação que `assetAlertService.ts` já mantém com `assetMath.ts`.

**Files:**
- Create: `backend/src/services/assetSnapshotMath.ts`
- Test: `backend/src/services/__tests__/assetSnapshotMath.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface SnapshotInput { id: string; user_id: string; quantity: number | string; avg_price: number | string; last_price: number | string | null }`
  - `interface SnapshotRow { assetId: string; userId: string; snapshotDate: string; price: number; quantity: number; avgPrice: number }`
  - `resolveSnapshotPrice(quotePrice: number | null, lastPrice: number | null): number | null`
  - `buildSnapshotRow(asset: SnapshotInput, quotePrice: number | null, snapshotDate: string): SnapshotRow | null`

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/services/__tests__/assetSnapshotMath.test.ts`:

```ts
import {
  resolveSnapshotPrice,
  buildSnapshotRow,
  SnapshotInput,
} from '../assetSnapshotMath'

const ativo: SnapshotInput = {
  id: 'a1',
  user_id: 'u1',
  quantity: '10.00000000',
  avg_price: '30.50000000',
  last_price: '28.00000000',
}

describe('resolveSnapshotPrice', () => {
  it('prefere a cotação do dia quando ela existe', () => {
    expect(resolveSnapshotPrice(32.4, 28)).toBe(32.4)
  })

  it('cai para o último preço conhecido quando a cotação falha', () => {
    expect(resolveSnapshotPrice(null, 28)).toBe(28)
  })

  it('devolve null quando não há cotação nem último preço', () => {
    expect(resolveSnapshotPrice(null, null)).toBeNull()
  })

  it('trata preço zero ou negativo como ausente', () => {
    expect(resolveSnapshotPrice(0, 28)).toBe(28)
    expect(resolveSnapshotPrice(-5, 28)).toBe(28)
    expect(resolveSnapshotPrice(0, 0)).toBeNull()
  })

  it('trata Infinity como ausente', () => {
    expect(resolveSnapshotPrice(Infinity, 28)).toBe(28)
  })
})

describe('buildSnapshotRow', () => {
  it('monta a linha convertendo os DECIMAL string do mysql2 para number', () => {
    const row = buildSnapshotRow(ativo, 32.4, '2026-09-01')
    expect(row).toEqual({
      assetId: 'a1',
      userId: 'u1',
      snapshotDate: '2026-09-01',
      price: 32.4,
      quantity: 10,
      avgPrice: 30.5,
    })
  })

  it('congela quantidade e preço médio do momento, não os lê depois', () => {
    const row = buildSnapshotRow({ ...ativo, quantity: '3', avg_price: '99' }, 10, '2026-09-01')
    expect(row?.quantity).toBe(3)
    expect(row?.avgPrice).toBe(99)
  })

  it('usa o último preço quando a cotação do dia falhou', () => {
    const row = buildSnapshotRow(ativo, null, '2026-09-01')
    expect(row?.price).toBe(28)
  })

  it('devolve null quando o ativo não tem preço algum', () => {
    const row = buildSnapshotRow({ ...ativo, last_price: null }, null, '2026-09-01')
    expect(row).toBeNull()
  })

  it('registra watchlist normalmente — quantidade zero soma zero no total', () => {
    const row = buildSnapshotRow({ ...ativo, quantity: '0' }, 32.4, '2026-09-01')
    expect(row?.quantity).toBe(0)
    expect(row?.price).toBe(32.4)
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `cd backend && npm test -- assetSnapshotMath`
Expected: FAIL — `Cannot find module '../assetSnapshotMath'`.

- [ ] **Step 3: Implementar**

Criar `backend/src/services/assetSnapshotMath.ts`:

```ts
// Linha de um ativo vinda do banco, com os DECIMAL ainda como string (mysql2).
export interface SnapshotInput {
  id: string
  user_id: string
  quantity: number | string
  avg_price: number | string
  last_price: number | string | null
}

export interface SnapshotRow {
  assetId: string
  userId: string
  snapshotDate: string
  price: number
  quantity: number
  avgPrice: number
}

function precoValido(valor: number | null): boolean {
  return valor !== null && Number.isFinite(valor) && valor > 0
}

// A cotação do dia é a preferida. Quando a brapi falha, o último preço conhecido
// evita um degrau falso no gráfico — um ticker fora do ar por um dia não pode
// parecer uma queda de patrimônio. Sem nenhum dos dois, não há o que registrar.
export function resolveSnapshotPrice(
  quotePrice: number | null,
  lastPrice: number | null,
): number | null {
  if (precoValido(quotePrice)) return quotePrice
  if (precoValido(lastPrice)) return lastPrice
  return null
}

// Quantidade e preço médio são copiados para dentro do snapshot, não lidos de
// assets na hora da consulta: comprar mais de um ativo amanhã não pode alterar
// o patrimônio de ontem.
export function buildSnapshotRow(
  asset: SnapshotInput,
  quotePrice: number | null,
  snapshotDate: string,
): SnapshotRow | null {
  const lastPrice = asset.last_price === null ? null : Number(asset.last_price)
  const price = resolveSnapshotPrice(quotePrice, lastPrice)
  if (price === null) return null

  return {
    assetId: asset.id,
    userId: asset.user_id,
    snapshotDate,
    price,
    quantity: Number(asset.quantity),
    avgPrice: Number(asset.avg_price),
  }
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `cd backend && npm test -- assetSnapshotMath`
Expected: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/assetSnapshotMath.ts backend/src/services/__tests__/assetSnapshotMath.test.ts
git commit -m "$(cat <<'EOF'
feat(ativos): funções puras do snapshot diário de posição

Resolve o preço do dia com fallback para o último preço conhecido e monta a
linha do snapshot congelando quantidade e preço médio do momento.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 3: Backend — migration `016_asset_snapshots`

**Files:**
- Modify: `backend/src/migrate.ts` (array `MIGRATIONS`, após o item `015_users_asset_alerts`, por volta da linha 261-264)

**Interfaces:**
- Consumes: nada.
- Produces: tabela `asset_snapshots` com `UNIQUE KEY uk_asset_date (asset_id, snapshot_date)`.

- [ ] **Step 1: Adicionar a migration ao array**

Em `backend/src/migrate.ts`, o array `MIGRATIONS` termina com o objeto `{ name: '015_users_asset_alerts', run: async () => { ... } }`. Adicionar **depois dele**, ainda dentro do array:

```ts
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
```

`ON DELETE CASCADE` é deliberado: apagar um ativo apaga o histórico dele. Quem só quer parar de acompanhar usa `is_active = 0`, que preserva o passado e interrompe a coleta dali em diante.

- [ ] **Step 2: Compilar**

Run: `cd backend && npm run build`
Expected: sucesso.

- [ ] **Step 3: Subir o backend e conferir o log da migration**

Run: `cd backend && npm run dev`
Expected no stdout: `[migrate] executando 016_asset_snapshots...` seguido de `[migrate] 016_asset_snapshots concluida`. Derrubar o processo depois (Ctrl+C).

Se aparecer `[migrate] 016_asset_snapshots ja executada — pulando` numa primeira execução, a migration foi registrada sem rodar — investigar `migration_log` antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrate.ts
git commit -m "$(cat <<'EOF'
feat(ativos): migration da tabela asset_snapshots

Uma linha por ativo por dia, com quantidade e preço médio congelados no
momento da coleta. Chave única (asset_id, snapshot_date) torna a coleta
idempotente.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 4: Backend — separar coleta de cotação do disparo de alerta

Hoje `checkAssetAlerts` busca cotação, grava `last_price` e decide o alerta no mesmo laço (`assetAlertService.ts:32-70`). A coleta sai para um serviço próprio que também grava o snapshot; o alerta passa a receber as cotações prontas.

**Files:**
- Create: `backend/src/services/assetQuoteSync.ts`
- Modify: `backend/src/services/assetAlertService.ts` (assinatura e laço)
- Modify: `backend/src/scheduler.ts:124-136`

**Interfaces:**
- Consumes: `buildSnapshotRow`, `SnapshotInput` (Task 2); `fetchQuote`, `Quote` de `./brapi`; `formatDateSaoPaulo` de `./assetMath`.
- Produces:
  - `interface SyncedAsset { asset: any; quote: Quote | null }`
  - `syncUserAssets(userId: string): Promise<SyncedAsset[]>`
  - `checkAssetAlerts(userId: string, synced: SyncedAsset[]): Promise<void>` (assinatura alterada)

- [ ] **Step 1: Criar o serviço de coleta**

Criar `backend/src/services/assetQuoteSync.ts`:

```ts
import pool from '../db'
import { fetchQuote, Quote } from './brapi'
import { buildSnapshotRow } from './assetSnapshotMath'
import { formatDateSaoPaulo } from './assetMath'

export interface SyncedAsset {
  asset: any
  quote: Quote | null
}

// Busca a cotação de cada ativo ativo do usuário, atualiza o último preço e
// grava o snapshot do dia. Devolve as cotações para quem precisar decidir
// alerta em cima delas — assim a brapi é consultada uma vez só por ativo.
export async function syncUserAssets(userId: string): Promise<SyncedAsset[]> {
  const [assets]: any = await pool.query(
    `SELECT id, user_id, ticker, kind, quantity, avg_price, target_price, stop_price,
            target_triggered_at, stop_triggered_at, last_price
       FROM assets WHERE user_id = ? AND is_active = 1`,
    [userId]
  )
  if (!assets.length) return []

  const hoje = formatDateSaoPaulo(new Date())
  const synced: SyncedAsset[] = []

  for (const asset of assets) {
    let quote: Quote | null = null

    // Um ticker quebrado não pode abortar o laço nem impedir o snapshot dos outros.
    try {
      quote = await fetchQuote(asset.ticker, asset.kind)

      if (quote) {
        await pool.query(
          'UPDATE assets SET last_price = ?, last_quote_at = ? WHERE id = ?',
          [quote.price, quote.quotedAt, asset.id]
        )
      }

      // A trava de cotação velha (fim de semana, feriado) vale só para o alerta.
      // Aqui não: num sábado, cripto teria preço e ação não, e o total do dia
      // despencaria sem nada ter acontecido. O fechamento de sexta é o valor da
      // carteira no sábado.
      const row = buildSnapshotRow(asset, quote ? quote.price : null, hoje)
      if (row) {
        await pool.query(
          `INSERT INTO asset_snapshots (user_id, asset_id, snapshot_date, price, quantity, avg_price)
                VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE price = VALUES(price),
                                   quantity = VALUES(quantity),
                                   avg_price = VALUES(avg_price)`,
          [row.userId, row.assetId, row.snapshotDate, row.price, row.quantity, row.avgPrice]
        )
      }
    } catch (e: any) {
      console.error(`[assetSync] erro no ativo ${asset.ticker}:`, e.message)
    }

    synced.push({ asset, quote })
  }

  console.log(`[assetSync] ${synced.length} ativo(s) sincronizado(s) para ${userId}`)
  return synced
}
```

- [ ] **Step 2: Reescrever `checkAssetAlerts` para consumir as cotações prontas**

Substituir o corpo de `backend/src/services/assetAlertService.ts` inteiro por:

```ts
import pool from '../db'
import { sendWhatsAppText } from './waha'
import { SyncedAsset } from './assetQuoteSync'
import {
  AlertHit,
  isTargetHit,
  isStopHit,
  buildAlertMessage,
  formatDateSaoPaulo,
} from './assetMath'

export async function checkAssetAlerts(userId: string, synced: SyncedAsset[]): Promise<void> {
  if (!synced.length) return

  const [userRows]: any = await pool.query(
    `SELECT whatsapp_number FROM users
      WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1 AND asset_alerts_enabled = 1`,
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const hoje = formatDateSaoPaulo(new Date())
  const hits: AlertHit[] = []
  const marcarAlvo: string[] = []
  const marcarStop: string[] = []

  for (const { asset, quote } of synced) {
    // Um ativo sem cotação do dia não gera alerta — os hits dos outros seguem.
    try {
      if (!quote) continue

      // Em fim de semana e feriado a brapi devolve o fechamento anterior.
      // Disparar com preço velho seria alerta falso — cripto não tem pregão.
      if (asset.kind !== 'crypto' && formatDateSaoPaulo(quote.quotedAt) !== hoje) {
        console.log(`[assetAlert] ${asset.ticker} com cotação de ${formatDateSaoPaulo(quote.quotedAt)} — mercado fechado, pulando`)
        continue
      }

      const quantity = Number(asset.quantity)
      const avgPrice = Number(asset.avg_price)
      const target = asset.target_price === null ? null : Number(asset.target_price)
      const stop = asset.stop_price === null ? null : Number(asset.stop_price)

      if (isTargetHit(quote.price, target, asset.target_triggered_at)) {
        hits.push({ ticker: asset.ticker, reason: 'target', price: quote.price, threshold: target!, quantity, avgPrice })
        marcarAlvo.push(asset.id)
      }

      if (isStopHit(quote.price, stop, asset.stop_triggered_at)) {
        hits.push({ ticker: asset.ticker, reason: 'stop', price: quote.price, threshold: stop!, quantity, avgPrice })
        marcarStop.push(asset.id)
      }
    } catch (e: any) {
      console.error(`[assetAlert] erro no ativo ${asset.ticker}:`, e.message)
      continue
    }
  }

  if (!hits.length) return

  await sendWhatsAppText(userRows[0].whatsapp_number, buildAlertMessage(hits))

  if (marcarAlvo.length) {
    await pool.query('UPDATE assets SET target_triggered_at = NOW() WHERE id IN (?)', [marcarAlvo])
  }
  if (marcarStop.length) {
    await pool.query('UPDATE assets SET stop_triggered_at = NOW() WHERE id IN (?)', [marcarStop])
  }

  console.log(`[assetAlert] ${hits.length} alerta(s) enviado(s) para ${userId}`)
}
```

- [ ] **Step 3: Atualizar o scheduler**

Em `backend/src/scheduler.ts`, adicionar o import junto dos outros no topo:

```ts
import { syncUserAssets } from './services/assetQuoteSync'
```

Substituir o bloco de ativos (`scheduler.ts:124-136`, do comentário `// --- Alerta de ativos ...` até o `catch` que fecha o bloco) por:

```ts
    // --- Ativos: coleta diária de cotação + alerta (hora configurável, default 11h) ---
    // A coleta roda para todo mundo que tem ativo, mesmo com alerta desligado —
    // senão quem desliga alerta fica sem histórico de patrimônio.
    try {
      const [assetUsers]: any = await pool.query(
        `SELECT u.id, u.asset_alerts_enabled, u.whatsapp_alerts_enabled
           FROM users u
          WHERE u.is_active = 1 AND u.asset_alert_hour = ?
            AND EXISTS (SELECT 1 FROM assets a WHERE a.user_id = u.id AND a.is_active = 1)`,
        [hour]
      )
      for (const u of assetUsers) {
        try {
          const synced = await syncUserAssets(u.id)
          if (u.asset_alerts_enabled && u.whatsapp_alerts_enabled) {
            await checkAssetAlerts(u.id, synced)
          }
        } catch (e: any) { console.error('[scheduler] asset erro:', e.message) }
      }
    } catch (e: any) { console.error('[scheduler] asset tick erro:', e.message) }
```

- [ ] **Step 4: Verificar que nenhum outro chamador ficou com a assinatura antiga**

```bash
grep -rn "checkAssetAlerts" backend/src
```

Esperado: apenas a definição em `assetAlertService.ts`, o import em `scheduler.ts` e a chamada dentro do bloco novo. Se aparecer chamada com um argumento só em outro arquivo, corrigir para passar o `synced`.

- [ ] **Step 5: Compilar e rodar a suíte inteira**

Run: `cd backend && npm run build && npm test`
Expected: build sem erro; todos os testes existentes passando (`assetMath`, `brapi`, `checklistInactivity`, `checklistStats`, `waha`, `assetSnapshotMath`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/assetQuoteSync.ts backend/src/services/assetAlertService.ts backend/src/scheduler.ts
git commit -m "$(cat <<'EOF'
refactor(ativos): separa coleta de cotação do disparo de alerta

syncUserAssets busca a cotação, atualiza o último preço e grava o snapshot do
dia; checkAssetAlerts passa a receber as cotações prontas. A coleta roda para
todo usuário com ativo, mesmo com alerta desligado, sem requisição extra à
brapi. A trava de cotação velha continua valendo só para o alerta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 5: Backend + cliente — `GET /api/assets/history`

**Files:**
- Modify: `backend/src/routes/assets.ts` (nova rota logo após o `GET /`, que começa na linha 57)
- Modify: `src/api/assets.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: tabela `asset_snapshots` (Task 3).
- Produces:
  - `GET /api/assets/history?days=90` → `{ pontos: { date: string; current_value: number; invested_value: number }[] }`
  - `interface AssetHistoryPoint { date: string; current_value: number; invested_value: number }`
  - `interface AssetHistoryResponse { pontos: AssetHistoryPoint[] }`
  - `assetsApi.history(days?: number): Promise<AssetHistoryResponse>`

- [ ] **Step 1: Adicionar a rota**

Em `backend/src/routes/assets.ts`, **imediatamente após o fechamento do handler `GET /`** e antes de qualquer rota com `/:id`. A ordem importa: registrada depois, o Express casaria `history` como id.

```ts
// GET /api/assets/history — evolução diária do patrimônio a partir dos snapshots.
// Precisa vir antes de qualquer rota /:id, senão "history" é lido como id.
router.get('/history', async (req: Request, res: Response) => {
  try {
    const bruto = Number(req.query.days)
    const days = Number.isFinite(bruto) ? Math.min(Math.max(Math.trunc(bruto), 1), 365) : 90

    const desde = new Date()
    desde.setDate(desde.getDate() - days)

    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date,
              SUM(price * quantity)     AS current_value,
              SUM(avg_price * quantity) AS invested_value
         FROM asset_snapshots
        WHERE user_id = ? AND snapshot_date >= ?
        GROUP BY snapshot_date
        ORDER BY snapshot_date`,
      [req.userId, desde]
    )

    res.json({
      pontos: rows.map((r: any) => ({
        date: r.date,
        current_value: Number(r.current_value),
        invested_value: Number(r.invested_value),
      })),
    })
  } catch (err: any) {
    console.error('[assets] erro ao buscar histórico:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Step 2: Adicionar os tipos no frontend**

Em `src/types/index.ts`, após a interface `AssetWithQuote` (que termina por volta da linha 250):

```ts
export interface AssetHistoryPoint {
  date: string
  current_value: number
  invested_value: number
}

export interface AssetHistoryResponse {
  pontos: AssetHistoryPoint[]
}
```

- [ ] **Step 3: Adicionar o método no cliente**

Em `src/api/assets.ts`, ampliar o import de tipos e adicionar o método dentro de `assetsApi`, logo após `list`:

```ts
import type { Asset, AssetKind, AssetWithQuote, AssetHistoryResponse } from '../types'
```

```ts
  history: async (days = 90): Promise<AssetHistoryResponse> => {
    const res = await client.get<AssetHistoryResponse>('/assets/history', { params: { days } })
    return res.data
  },
```

- [ ] **Step 4: Compilar os dois lados**

Run: `cd backend && npm run build`
Expected: sucesso.

Run: `npm run build` (na raiz)
Expected: sucesso.

- [ ] **Step 5: Verificar a rota com o backend de pé**

Com `cd backend && npm run dev` rodando e um JWT válido em `$TOKEN`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:4000/api/assets/history?days=90'
```

Expected: `{"pontos":[]}` num banco sem snapshot ainda — resposta 200 com array vazio, **não** 404 nem erro de id inválido. Um 404 ou erro de UUID significa que a rota foi registrada depois de `/:id`; mover para cima.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/assets.ts src/api/assets.ts src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(ativos): endpoint de evolução diária do patrimônio

GET /api/assets/history agrega os snapshots por dia em duas séries, patrimônio
e custo. Registrado antes das rotas /:id para não ser lido como id.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 6: Frontend — agregação pura da análise de ativos

**Files:**
- Create: `src/utils/assetAnalytics.ts`
- Test: `src/utils/__tests__/assetAnalytics.test.ts`
- Delete: `src/utils/__tests__/smoke.test.ts` (cumpriu o papel na Task 1)

**Interfaces:**
- Consumes: `AssetWithQuote`, `AssetKind` de `src/types`.
- Produces:
  - `interface PosicaoAgregada { patrimonio: number; investido: number; resultado: number; resultadoPct: number; comPosicao: number; watchlist: number; semCotacao: number }`
  - `interface FatiaAlocacao { kind: AssetKind; valor: number; pct: number }`
  - `interface ResultadoAtivo { ticker: string; resultado: number; resultadoPct: number }`
  - `agregarPosicao(ativos: AssetWithQuote[]): PosicaoAgregada`
  - `alocacaoPorTipo(ativos: AssetWithQuote[]): FatiaAlocacao[]`
  - `resultadoPorAtivo(ativos: AssetWithQuote[]): ResultadoAtivo[]`
  - `progressoAlvoStop(ativo: AssetWithQuote): number | null`
  - `rotuloTipo(kind: AssetKind): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/utils/__tests__/assetAnalytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AssetWithQuote } from '../../types'
import {
  agregarPosicao,
  alocacaoPorTipo,
  resultadoPorAtivo,
  progressoAlvoStop,
  rotuloTipo,
} from '../assetAnalytics'

// Base mínima: os testes sobrescrevem só o que cada caso exercita.
function ativo(over: Partial<AssetWithQuote> = {}): AssetWithQuote {
  return {
    id: 'a1',
    user_id: 'u1',
    ticker: 'PETR4',
    kind: 'stock',
    quantity: 10,
    avg_price: 30,
    target_price: null,
    stop_price: null,
    target_triggered_at: null,
    stop_triggered_at: null,
    last_price: 33,
    last_quote_at: '2026-09-01T14:00:00Z',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    short_name: 'Petrobras PN',
    current_price: 33,
    quote_stale: false,
    invested_value: 300,
    current_value: 330,
    profit_loss: 30,
    profit_loss_pct: 10,
    ...over,
  }
}

describe('agregarPosicao', () => {
  it('soma patrimônio, investido e resultado dos ativos com posição', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'VALE3', invested_value: 700, current_value: 770, profit_loss: 70 }),
    ])
    expect(r.patrimonio).toBe(1100)
    expect(r.investido).toBe(1000)
    expect(r.resultado).toBe(100)
    expect(r.resultadoPct).toBeCloseTo(10)
    expect(r.comPosicao).toBe(2)
  })

  it('exclui watchlist dos agregados e a conta à parte', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'ITUB4', quantity: 0, invested_value: 0, current_value: 0, profit_loss: 0 }),
    ])
    expect(r.patrimonio).toBe(330)
    expect(r.comPosicao).toBe(1)
    expect(r.watchlist).toBe(1)
  })

  it('exclui ativo sem cotação e o conta à parte', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'XPTO3', current_price: null, current_value: null, profit_loss: null }),
    ])
    expect(r.patrimonio).toBe(330)
    expect(r.investido).toBe(300)
    expect(r.semCotacao).toBe(1)
  })

  it('devolve zeros sem estourar quando não há ativo algum', () => {
    const r = agregarPosicao([])
    expect(r).toEqual({
      patrimonio: 0, investido: 0, resultado: 0, resultadoPct: 0,
      comPosicao: 0, watchlist: 0, semCotacao: 0,
    })
  })

  it('não divide por zero quando o investido é zero', () => {
    const r = agregarPosicao([ativo({ avg_price: 0, invested_value: 0, current_value: 330, profit_loss: 330 })])
    expect(r.resultadoPct).toBe(0)
  })
})

describe('alocacaoPorTipo', () => {
  it('agrupa por tipo e calcula o percentual sobre o patrimônio', () => {
    const fatias = alocacaoPorTipo([
      ativo({ kind: 'stock', current_value: 600 }),
      ativo({ id: 'a2', ticker: 'HGLG11', kind: 'fii', current_value: 300 }),
      ativo({ id: 'a3', ticker: 'BTC', kind: 'crypto', current_value: 100 }),
    ])
    expect(fatias).toEqual([
      { kind: 'stock', valor: 600, pct: 60 },
      { kind: 'fii', valor: 300, pct: 30 },
      { kind: 'crypto', valor: 100, pct: 10 },
    ])
  })

  it('omite tipo sem nenhum ativo', () => {
    const fatias = alocacaoPorTipo([ativo({ kind: 'stock', current_value: 500 })])
    expect(fatias.map((f) => f.kind)).toEqual(['stock'])
  })

  it('devolve lista vazia quando só há watchlist', () => {
    expect(alocacaoPorTipo([ativo({ quantity: 0, current_value: 0 })])).toEqual([])
  })
})

describe('resultadoPorAtivo', () => {
  it('ordena do maior para o menor percentual', () => {
    const r = resultadoPorAtivo([
      ativo({ ticker: 'A', profit_loss: 10, profit_loss_pct: 2 }),
      ativo({ id: 'a2', ticker: 'B', profit_loss: 50, profit_loss_pct: 12 }),
      ativo({ id: 'a3', ticker: 'C', profit_loss: -20, profit_loss_pct: -5 }),
    ])
    expect(r.map((x) => x.ticker)).toEqual(['B', 'A', 'C'])
  })

  it('ignora watchlist e ativo sem cotação', () => {
    const r = resultadoPorAtivo([
      ativo({ ticker: 'A' }),
      ativo({ id: 'a2', ticker: 'W', quantity: 0 }),
      ativo({ id: 'a3', ticker: 'S', current_price: null, profit_loss: null, profit_loss_pct: null }),
    ])
    expect(r.map((x) => x.ticker)).toEqual(['A'])
  })
})

describe('progressoAlvoStop', () => {
  it('mede a posição do preço entre stop e alvo', () => {
    const p = progressoAlvoStop(ativo({ current_price: 35, stop_price: 30, target_price: 40 }))
    expect(p).toBe(50)
  })

  it('limita em 0 e 100 quando o preço passou dos extremos', () => {
    expect(progressoAlvoStop(ativo({ current_price: 45, stop_price: 30, target_price: 40 }))).toBe(100)
    expect(progressoAlvoStop(ativo({ current_price: 25, stop_price: 30, target_price: 40 }))).toBe(0)
  })

  it('devolve null sem alvo, sem stop ou sem cotação', () => {
    expect(progressoAlvoStop(ativo({ stop_price: 30, target_price: null }))).toBeNull()
    expect(progressoAlvoStop(ativo({ stop_price: null, target_price: 40 }))).toBeNull()
    expect(progressoAlvoStop(ativo({ current_price: null, stop_price: 30, target_price: 40 }))).toBeNull()
  })

  it('devolve null quando o alvo não é maior que o stop', () => {
    expect(progressoAlvoStop(ativo({ current_price: 35, stop_price: 40, target_price: 40 }))).toBeNull()
  })
})

describe('rotuloTipo', () => {
  it('traduz o tipo para o rótulo em português', () => {
    expect(rotuloTipo('stock')).toBe('Ação')
    expect(rotuloTipo('fii')).toBe('FII')
    expect(rotuloTipo('crypto')).toBe('Cripto')
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test`
Expected: FAIL — não resolve `../assetAnalytics`.

- [ ] **Step 3: Implementar**

Criar `src/utils/assetAnalytics.ts`:

```ts
import type { AssetKind, AssetWithQuote } from '../types'

export interface PosicaoAgregada {
  patrimonio: number
  investido: number
  resultado: number
  resultadoPct: number
  comPosicao: number
  watchlist: number
  semCotacao: number
}

export interface FatiaAlocacao {
  kind: AssetKind
  valor: number
  pct: number
}

export interface ResultadoAtivo {
  ticker: string
  resultado: number
  resultadoPct: number
}

const ORDEM_TIPOS: AssetKind[] = ['stock', 'fii', 'crypto']

const ROTULOS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

export function rotuloTipo(kind: AssetKind): string {
  return ROTULOS[kind]
}

// Quantidade zero é watchlist, não posição — a mesma regra que o alerta aplica
// em buildHitBlock. Cotação ausente também fica de fora: somar o valor
// investido no lugar do atual inventaria um patrimônio que não existe.
function temPosicaoAvaliada(a: AssetWithQuote): boolean {
  return a.quantity > 0 && a.current_value !== null
}

export function agregarPosicao(ativos: AssetWithQuote[]): PosicaoAgregada {
  const base: PosicaoAgregada = {
    patrimonio: 0, investido: 0, resultado: 0, resultadoPct: 0,
    comPosicao: 0, watchlist: 0, semCotacao: 0,
  }

  const agregado = ativos.reduce((acc, a) => {
    if (a.quantity <= 0) {
      acc.watchlist += 1
      return acc
    }
    if (a.current_value === null) {
      acc.semCotacao += 1
      return acc
    }
    acc.patrimonio += a.current_value
    acc.investido += a.invested_value
    acc.resultado += a.profit_loss ?? 0
    acc.comPosicao += 1
    return acc
  }, base)

  // Investido zero é posição sem custo registrado — não há percentual a calcular.
  agregado.resultadoPct = agregado.investido > 0
    ? (agregado.resultado / agregado.investido) * 100
    : 0

  return agregado
}

export function alocacaoPorTipo(ativos: AssetWithQuote[]): FatiaAlocacao[] {
  const avaliados = ativos.filter(temPosicaoAvaliada)
  const total = avaliados.reduce((s, a) => s + (a.current_value ?? 0), 0)
  if (total <= 0) return []

  return ORDEM_TIPOS.map((kind) => {
    const valor = avaliados
      .filter((a) => a.kind === kind)
      .reduce((s, a) => s + (a.current_value ?? 0), 0)
    return { kind, valor, pct: (valor / total) * 100 }
  }).filter((f) => f.valor > 0)
}

export function resultadoPorAtivo(ativos: AssetWithQuote[]): ResultadoAtivo[] {
  return ativos
    .filter(temPosicaoAvaliada)
    .map((a) => ({
      ticker: a.ticker,
      resultado: a.profit_loss ?? 0,
      resultadoPct: a.profit_loss_pct ?? 0,
    }))
    .sort((x, y) => y.resultadoPct - x.resultadoPct)
}

// Posição do preço atual entre o stop e o alvo, de 0 a 100. Sem os dois limites
// não há régua a desenhar — a tela mostra o outro formato nesse caso.
export function progressoAlvoStop(ativo: AssetWithQuote): number | null {
  const preco = ativo.current_price
  const stop = ativo.stop_price
  const alvo = ativo.target_price

  if (preco === null || stop === null || alvo === null) return null
  if (alvo <= stop) return null

  const pct = ((preco - stop) / (alvo - stop)) * 100
  return Math.max(0, Math.min(100, pct))
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test`
Expected: PASS — os 15 testes de `assetAnalytics` mais o de fumaça.

- [ ] **Step 5: Remover o teste de fumaça**

Ele existia só para provar o runner na Task 1; agora há cobertura real.

```bash
rm src/utils/__tests__/smoke.test.ts
```

Run: `npm test`
Expected: PASS, só os testes de `assetAnalytics`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/assetAnalytics.ts src/utils/__tests__
git commit -m "$(cat <<'EOF'
feat(ativos): agregação pura para a análise de carteira

Patrimônio, alocação por tipo, resultado por ativo e régua de alvo/stop.
Watchlist (quantidade zero) e ativo sem cotação ficam fora dos agregados e
são contados à parte.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 7: Frontend — `TabNav` e promoção do `StatCard`

`StatCard` hoje vive em `components/checklist/` mas será usado pelas três análises, e há uma cópia interna no `Dashboard.tsx:41-54`. Uma versão só, em `components/ui/`.

**Files:**
- Create: `src/components/ui/TabNav.tsx`
- Create: `src/components/ui/StatCard.tsx` (movido de `src/components/checklist/StatCard.tsx`)
- Modify: `src/pages/Analise.tsx`, `src/pages/Checklists.tsx` (imports de `StatCard`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface TabItem { to: string; label: string; icon: string }`
  - `TabNav` (default export) com prop `tabs: TabItem[]`
  - `StatCard` (named export) com props `{ icon: string; label: string; value: string | number; iconColor: string; iconBg: string; sub?: string }`

- [ ] **Step 1: Mover o StatCard preservando o histórico**

```bash
git mv src/components/checklist/StatCard.tsx src/components/ui/StatCard.tsx
```

- [ ] **Step 2: Acrescentar a prop `sub` ao StatCard**

O `StatCard` do checklist não tem linha secundária; o do Dashboard tinha. A versão única precisa das duas. Em `src/components/ui/StatCard.tsx`, adicionar `sub?: string` à interface de props, incluir `sub` no destructuring do componente, e renderizar após a linha do label:

```tsx
    {sub && <div className="text-xs text-on-surface-variant/70 mt-0.5">{sub}</div>}
```

- [ ] **Step 3: Corrigir os imports quebrados**

```bash
grep -rn "checklist/StatCard" src/
```

Em cada arquivo listado (`src/pages/Analise.tsx:15` e `src/pages/Checklists.tsx`), trocar o caminho para `'../components/ui/StatCard'`.

- [ ] **Step 4: Criar o `TabNav`**

Criar `src/components/ui/TabNav.tsx`:

```tsx
import React from 'react'
import { NavLink } from 'react-router-dom'

export interface TabItem {
  to: string
  label: string
  icon: string
}

// Barra de abas das páginas com análise. O estado ativo vem da URL via NavLink —
// sem useState, e por isso sobrevive a recarregar a página.
const TabNav: React.FC<{ tabs: TabItem[] }> = ({ tabs }) => (
  <nav className="flex gap-2 overflow-x-auto no-scrollbar" aria-label="Seções da página">
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        className={({ isActive }) =>
          `flex items-center gap-1.5 flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
            isActive
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`
        }
      >
        <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
        {tab.label}
      </NavLink>
    ))}
  </nav>
)

export default TabNav
```

- [ ] **Step 5: Verificar o build**

Run: `npm run build`
Expected: sucesso. Erro de import não resolvido significa que o Step 3 deixou algum caminho para trás.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/TabNav.tsx src/components/ui/StatCard.tsx src/pages/Analise.tsx src/pages/Checklists.tsx
git commit -m "$(cat <<'EOF'
feat(ui): TabNav compartilhado e StatCard promovido para components/ui

TabNav deriva a aba ativa da URL via NavLink. StatCard sai de checklist/ para
ui/ com a prop sub, já que as três análises vão usá-lo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 8: Frontend — Contas em shell com abas

**Files:**
- Create: `src/pages/contas/ContasShell.tsx`
- Create: `src/pages/contas/ContasLista.tsx` (movido de `src/pages/Contas.tsx`)
- Create: `src/pages/contas/ContasAnalise.tsx`
- Move: `src/components/analise/` → `src/components/contas/analise/`
- Modify: `src/App.tsx`
- Modify: `src/pages/Analise.tsx` (imports, para não quebrar o build antes da Task 12)

**Interfaces:**
- Consumes: `TabNav` (Task 7).
- Produces: rotas `/contas/lista` e `/contas/analise`; componentes de análise financeira em `src/components/contas/analise/`.

- [ ] **Step 1: Mover os arquivos preservando o histórico**

```bash
mkdir -p src/pages/contas src/components/contas
git mv src/pages/Contas.tsx src/pages/contas/ContasLista.tsx
git mv src/components/analise src/components/contas/analise
```

- [ ] **Step 2: Corrigir os caminhos relativos do arquivo movido**

`ContasLista.tsx` desceu um nível: todo import `'../algo'` vira `'../../algo'`. As linhas afetadas são as do topo do arquivo (`../api/bills`, `../types`, `../utils/format`, `../components/ui/Modal`, `../components/ui/Skeleton`, `../context/ToastContext`).

```bash
grep -n "from '\.\./" src/pages/contas/ContasLista.tsx
```

Trocar cada `from '../` por `from '../../` nesse arquivo. Renomear também a constante do componente e o export: `const Contas` → `const ContasLista`, `export default Contas` → `export default ContasLista`.

- [ ] **Step 3: Remover o título de página do ContasLista**

O `<h2>Minhas Contas</h2>` (por volta da linha 267) some: o Header já titula a página e a `TabNav` já rotula a aba. O chip de total permanece. O bloco do header vira:

```tsx
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold self-start">
          TOTAL {formatBRL(totalAmount)}
        </span>
        <button onClick={() => navigate('/contas/nova')} className="btn-primary justify-center w-full md:w-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Conta
        </button>
      </div>
```

- [ ] **Step 4: Corrigir os imports do Analise.tsx que apontavam para components/analise**

`src/pages/Analise.tsx` ainda existe até a Task 12 e importa de `'../components/analise/…'`. Trocar por `'../components/contas/analise/…'` nas cinco linhas (`BudgetCard`, `TopOccurrencesList`, `SpendingTrendChart`, `CategoryBreakdown`, `SummaryStats`). Dentro de `src/components/contas/analise/BudgetCard.tsx`, o import `'./RadialGauge'` continua válido — os dois se moveram juntos.

- [ ] **Step 5: Criar o shell**

Criar `src/pages/contas/ContasShell.tsx`:

```tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const ContasShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'lista', label: 'Contas', icon: 'receipt_long' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default ContasShell
```

- [ ] **Step 6: Criar a aba de análise**

Criar `src/pages/contas/ContasAnalise.tsx`. É a aba Financeiro de `Analise.tsx:33-120`, sem o flag `financeiroLoaded` (com aba virando rota, o React desmonta o componente de qualquer forma) e com erro no lugar do bloco em vez de toast:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analytics'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, OcorrenciaTop } from '../../types'
import { BudgetCard } from '../../components/contas/analise/BudgetCard'
import { TopOccurrencesList } from '../../components/contas/analise/TopOccurrencesList'
import { SpendingTrendChart } from '../../components/contas/analise/SpendingTrendChart'
import { CategoryBreakdown } from '../../components/contas/analise/CategoryBreakdown'
import { SummaryStats } from '../../components/contas/analise/SummaryStats'

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const ContasAnalise: React.FC = () => {
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [topOcc, setTopOcc] = useState<OcorrenciaTop[]>([])
  const [history, setHistory] = useState<ProjectionResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    const { from, to } = mesAtualRange()
    const [catR, budR, topR, histR, projR] = await Promise.allSettled([
      analyticsApi.byCategory(from, to),
      analyticsApi.budget(),
      analyticsApi.topOccurrences(from, to, 5),
      analyticsApi.history(6),
      analyticsApi.projection(6),
    ])
    if (catR.status === 'fulfilled') setByCat(catR.value)
    if (budR.status === 'fulfilled') setBudget(budR.value)
    if (topR.status === 'fulfilled') setTopOcc(topR.value.ocorrencias)
    if (histR.status === 'fulfilled') setHistory(histR.value)
    if (projR.status === 'fulfilled') setProjection(projR.value)
    setErro([catR, budR, topR, histR, projR].some((r) => r.status === 'rejected'))
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="space-y-6">
      {erro && (
        <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-error">error</span>
          <p className="text-sm text-on-surface flex-1">Alguns dados não puderam ser carregados.</p>
          <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
        </div>
      )}

      <SummaryStats byCat={byCat} history={history} projection={projection} loading={loading} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BudgetCard data={budget} loading={loading} />
        <TopOccurrencesList occurrences={topOcc} loading={loading} />
      </div>

      <SpendingTrendChart history={history} projection={projection} loading={loading} />

      <CategoryBreakdown data={byCat} loading={loading} />
    </div>
  )
}

export default ContasAnalise
```

- [ ] **Step 7: Trocar as rotas de contas no App.tsx**

Em `src/App.tsx`, remover o import `import Contas from './pages/Contas'` e adicionar:

```tsx
import ContasShell from './pages/contas/ContasShell'
import ContasLista from './pages/contas/ContasLista'
import ContasAnalise from './pages/contas/ContasAnalise'
```

Substituir a linha `<Route path="/contas" element={<Contas />} />` por:

```tsx
                <Route path="/contas" element={<ContasShell />}>
                  <Route index element={<Navigate to="lista" replace />} />
                  <Route path="lista" element={<ContasLista />} />
                  <Route path="analise" element={<ContasAnalise />} />
                </Route>
```

As rotas `/contas/nova` e `/contas/:id/editar` continuam como estão, irmãs e fora do shell — são formulários de tela cheia.

- [ ] **Step 8: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 9: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/contas`
Expected: redireciona para `/contas/lista`, mostra a barra com "Contas" e "Análise", e a lista de contas abaixo. Clicar em Análise leva a `/contas/analise` com os gráficos. Recarregar (F5) em `/contas/analise` volta na aba Análise. O botão voltar do navegador retorna para a lista.

- [ ] **Step 10: Commit**

```bash
git add src/pages/contas src/components/contas src/App.tsx src/pages/Analise.tsx
git commit -m "$(cat <<'EOF'
feat(contas): aba de análise dentro da página de contas

Contas vira shell com rotas aninhadas /contas/lista e /contas/analise. Os
componentes de análise financeira saem de components/analise para
components/contas/analise, já que "análise" sozinho deixou de identificar o
domínio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 9: Frontend — Checklists em shell com abas

**Files:**
- Create: `src/pages/checklists/ChecklistsShell.tsx`
- Create: `src/pages/checklists/ChecklistsLista.tsx` (movido de `src/pages/Checklists.tsx`)
- Create: `src/pages/checklists/ChecklistsAnalise.tsx`
- Move: `ChecklistHeatmap.tsx`, `ChecklistItemRanking.tsx`, `WeeklyTrendSparkline.tsx` → `src/components/checklist/analise/`
- Modify: `src/App.tsx`
- Modify: `src/pages/Analise.tsx` (imports)

**Interfaces:**
- Consumes: `TabNav` (Task 7), `StatCard` de `components/ui/StatCard` (Task 7).
- Produces: rotas `/checklists/lista` e `/checklists/analise`.

- [ ] **Step 1: Mover os arquivos**

```bash
mkdir -p src/pages/checklists src/components/checklist/analise
git mv src/pages/Checklists.tsx src/pages/checklists/ChecklistsLista.tsx
git mv src/components/checklist/ChecklistHeatmap.tsx src/components/checklist/analise/ChecklistHeatmap.tsx
git mv src/components/checklist/ChecklistItemRanking.tsx src/components/checklist/analise/ChecklistItemRanking.tsx
git mv src/components/checklist/WeeklyTrendSparkline.tsx src/components/checklist/analise/WeeklyTrendSparkline.tsx
```

`ChecklistCard.tsx`, `ProgressBar.tsx` e `constants.ts` ficam onde estão — são da lista, não da análise.

- [ ] **Step 2: Corrigir os caminhos relativos**

Em `src/pages/checklists/ChecklistsLista.tsx`, todo `from '../` vira `from '../../`. Renomear `const Checklists` → `const ChecklistsLista` e o export default.

```bash
grep -n "from '\.\./" src/pages/checklists/ChecklistsLista.tsx
```

Nos três componentes movidos para `analise/`, os imports de `'../../types'` viram `'../../../types'` e os de `'../ui/…'` ou `'./constants'` precisam subir um nível:

```bash
grep -n "from '\.\." src/components/checklist/analise/*.tsx
grep -n "from '\./" src/components/checklist/analise/*.tsx
```

- [ ] **Step 3: Corrigir os imports do Analise.tsx**

Trocar `'../components/checklist/ChecklistHeatmap'`, `'../components/checklist/ChecklistItemRanking'` e `'../components/checklist/WeeklyTrendSparkline'` por `'../components/checklist/analise/…'`.

- [ ] **Step 4: Remover o título de página do ChecklistsLista**

Os dois `<h2 className="text-lg font-bold text-on-surface">Checklists</h2>` (no estado de loading, por volta da linha 197, e no render principal, por volta da linha 425) saem — o Header e a `TabNav` já dizem onde o usuário está.

- [ ] **Step 5: Criar o shell**

Criar `src/pages/checklists/ChecklistsShell.tsx`:

```tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const ChecklistsShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'lista', label: 'Checklists', icon: 'checklist' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default ChecklistsShell
```

- [ ] **Step 6: Criar a aba de análise**

Criar `src/pages/checklists/ChecklistsAnalise.tsx`. É a aba Checklist de `Analise.tsx:122-200`, **sem** a chamada `checklistsApi.stats()` (cujo resultado era descartado em `Analise.tsx:76`):

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checklistsApi } from '../../api/checklists'
import type { Checklist, ChecklistDashboardData } from '../../types'
import { StatCard } from '../../components/ui/StatCard'
import { ChecklistHeatmap } from '../../components/checklist/analise/ChecklistHeatmap'
import { ChecklistItemRanking } from '../../components/checklist/analise/ChecklistItemRanking'
import { WeeklyTrendSparkline } from '../../components/checklist/analise/WeeklyTrendSparkline'

const ChecklistsAnalise: React.FC = () => {
  const navigate = useNavigate()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    try {
      const [lista, dash] = await Promise.all([checklistsApi.get(), checklistsApi.dashboard()])
      setChecklists(lista)
      setDashboard(dash)
      if (dash.checklist) setSelecionado(dash.checklist.id)
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const trocarChecklist = async (id: string) => {
    if (id === selecionado) return
    setSelecionado(id)
    try {
      setDashboard(await checklistsApi.dashboard(id))
    } catch {
      setErro(true)
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>
  }

  if (erro) {
    return (
      <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-error">error</span>
        <p className="text-sm text-on-surface flex-1">Erro ao carregar dados do checklist.</p>
        <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
      </div>
    )
  }

  if (checklists.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">checklist</span>
        <p className="text-on-surface font-semibold mb-1">Nenhum checklist cadastrado</p>
        <p className="text-sm text-on-surface-variant mb-4">Crie um checklist para ver as estatísticas aqui.</p>
        <button onClick={() => navigate('/checklists/lista')} className="btn-primary mx-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Criar Checklist
        </button>
      </div>
    )
  }

  const checklist = dashboard?.checklist
  const hoje = dashboard?.today
  const historico = dashboard?.history ?? []
  const itemStats = dashboard?.itemStats ?? []
  const melhorSequencia = itemStats.reduce((max, s) => Math.max(max, s.streak_current), 0)

  return (
    <div className="space-y-6">
      {checklists.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {checklists.map((c) => (
            <button
              key={c.id}
              onClick={() => trocarChecklist(c.id)}
              className={`px-3 min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                selecionado === c.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {checklist && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon="checklist" label="Itens" value={checklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
          <StatCard
            icon="schedule"
            label="Horário de Envio"
            value={`${String(checklist.send_time).padStart(2, '0')}h`}
            iconColor="text-yellow-400"
            iconBg="bg-yellow-400/15"
          />
          <StatCard
            icon="today"
            label="Conclusão Hoje"
            value={hoje ? `${hoje.completion_pct}%` : '—'}
            iconColor={hoje && hoje.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
            iconBg={hoje && hoje.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
          />
          <StatCard
            icon="local_fire_department"
            label="Melhor Sequência"
            value={melhorSequencia > 0 ? `${melhorSequencia} ${melhorSequencia === 1 ? 'dia' : 'dias'}` : '—'}
            iconColor="text-orange-400"
            iconBg="bg-orange-400/15"
          />
          <StatCard icon="bar_chart" label="Dias Registrados" value={historico.length} iconColor="text-primary" iconBg="bg-primary/15" />
        </div>
      )}

      <WeeklyTrendSparkline history={historico} />

      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Histórico (12 semanas)</h3>
        <ChecklistHeatmap history={historico} />
      </div>

      <ChecklistItemRanking itemStats={itemStats} />
    </div>
  )
}

export default ChecklistsAnalise
```

- [ ] **Step 7: Trocar as rotas de checklists no App.tsx**

Remover `import Checklists from './pages/Checklists'` e adicionar:

```tsx
import ChecklistsShell from './pages/checklists/ChecklistsShell'
import ChecklistsLista from './pages/checklists/ChecklistsLista'
import ChecklistsAnalise from './pages/checklists/ChecklistsAnalise'
```

Substituir `<Route path="/checklists" element={<Checklists />} />` por:

```tsx
                <Route path="/checklists" element={<ChecklistsShell />}>
                  <Route index element={<Navigate to="lista" replace />} />
                  <Route path="lista" element={<ChecklistsLista />} />
                  <Route path="analise" element={<ChecklistsAnalise />} />
                </Route>
```

- [ ] **Step 8: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 9: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/checklists`
Expected: redireciona para `/checklists/lista`; a aba Análise mostra os StatCards, o sparkline, o heatmap e o ranking.

- [ ] **Step 10: Commit**

```bash
git add src/pages/checklists src/components/checklist src/App.tsx src/pages/Analise.tsx
git commit -m "$(cat <<'EOF'
feat(checklists): aba de análise dentro da página de checklists

Checklists vira shell com rotas aninhadas. Heatmap, ranking e sparkline vão
para components/checklist/analise. Remove a chamada a checklists/stats cujo
resultado era descartado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 10: Frontend — Ativos em shell com abas

Só a estrutura; o conteúdo da análise vem na Task 11.

**Files:**
- Create: `src/pages/ativos/AtivosShell.tsx`
- Create: `src/pages/ativos/AtivosCarteira.tsx` (movido de `src/pages/Ativos.tsx`)
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `TabNav` (Task 7).
- Produces: rota `/ativos/carteira`; `AtivosShell` já declarando a aba `analise`, cuja rota entra na Task 11.

- [ ] **Step 1: Mover o arquivo**

```bash
mkdir -p src/pages/ativos
git mv src/pages/Ativos.tsx src/pages/ativos/AtivosCarteira.tsx
```

- [ ] **Step 2: Corrigir caminhos e nomes**

```bash
grep -n "from '\.\./" src/pages/ativos/AtivosCarteira.tsx
```

Todo `from '../` vira `from '../../`. Renomear `const Ativos` → `const AtivosCarteira` e o export default.

- [ ] **Step 3: Criar o shell**

Criar `src/pages/ativos/AtivosShell.tsx`:

```tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const AtivosShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'carteira', label: 'Carteira', icon: 'account_balance_wallet' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default AtivosShell
```

- [ ] **Step 4: Trocar as rotas de ativos no App.tsx**

Remover `import Ativos from './pages/Ativos'` e adicionar:

```tsx
import AtivosShell from './pages/ativos/AtivosShell'
import AtivosCarteira from './pages/ativos/AtivosCarteira'
```

Substituir `<Route path="/ativos" element={<Ativos />} />` por:

```tsx
                <Route path="/ativos" element={<AtivosShell />}>
                  <Route index element={<Navigate to="carteira" replace />} />
                  <Route path="carteira" element={<AtivosCarteira />} />
                </Route>
```

- [ ] **Step 5: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 6: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/ativos`
Expected: redireciona para `/ativos/carteira` com a carteira funcionando. A aba "Análise" aparece mas ainda não navega para lugar nenhum útil — será ligada na próxima task.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ativos src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ativos): estrutura de abas na página de ativos

Ativos vira shell com rota aninhada /ativos/carteira. A aba de análise já
aparece na barra; o conteúdo entra na sequência.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 11: Frontend — a aba de análise de Ativos

**Files:**
- Create: `src/components/ativos/analise/AlocacaoPorTipo.tsx`
- Create: `src/components/ativos/analise/ResultadoPorAtivo.tsx`
- Create: `src/components/ativos/analise/EvolucaoPatrimonio.tsx`
- Create: `src/components/ativos/analise/ReguaAlvoStop.tsx`
- Create: `src/pages/ativos/AtivosAnalise.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `agregarPosicao`, `alocacaoPorTipo`, `resultadoPorAtivo`, `progressoAlvoStop`, `rotuloTipo` (Task 6); `assetsApi.list`, `assetsApi.history` (Task 5); `StatCard` (Task 7).
- Produces: rota `/ativos/analise`.

- [ ] **Step 1: Criar o gráfico de alocação**

Criar `src/components/ativos/analise/AlocacaoPorTipo.tsx`:

```tsx
import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { FatiaAlocacao } from '../../../utils/assetAnalytics'
import { rotuloTipo } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

// Cores dos tokens do design system: primary, tertiary e o amarelo de destaque
// já usado nos StatCards de vencimento.
const CORES: Record<string, string> = {
  stock: '#c0c1ff',
  fii: '#7fd8a0',
  crypto: '#facc15',
}

export const AlocacaoPorTipo: React.FC<{ fatias: FatiaAlocacao[] }> = ({ fatias }) => {
  if (fatias.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Alocação</h3>
        <p className="text-sm text-on-surface-variant">Nenhuma posição com cotação para alocar.</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Alocação por tipo</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={fatias} dataKey="valor" nameKey="kind" innerRadius={38} outerRadius={62} stroke="none">
                {fatias.map((f) => (
                  <Cell key={f.kind} fill={CORES[f.kind]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(valor: number) => `R$ ${formatBRL(valor)}`}
                labelFormatter={() => ''}
                contentStyle={{ background: '#1f1f25', border: 'none', borderRadius: 12, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 min-w-0">
          {fatias.map((f) => (
            <li key={f.kind} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CORES[f.kind] }} />
              <span className="text-on-surface flex-1 truncate">{rotuloTipo(f.kind)}</span>
              <span className="text-on-surface-variant text-xs">{f.pct.toFixed(0)}%</span>
              <span className="text-on-surface font-semibold text-xs">R$ {formatBRL(f.valor)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar as barras de resultado por ativo**

Criar `src/components/ativos/analise/ResultadoPorAtivo.tsx`:

```tsx
import React from 'react'
import type { ResultadoAtivo } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

// Barra divergente: a maior variação absoluta da lista define a escala, para
// que a menor não vire um traço invisível quando há um destaque muito grande.
export const ResultadoPorAtivo: React.FC<{ resultados: ResultadoAtivo[] }> = ({ resultados }) => {
  if (resultados.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Resultado por ativo</h3>
        <p className="text-sm text-on-surface-variant">Nenhuma posição com cotação para comparar.</p>
      </div>
    )
  }

  const escala = Math.max(...resultados.map((r) => Math.abs(r.resultadoPct)), 1)

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Resultado por ativo</h3>
      <ul className="space-y-3">
        {resultados.map((r) => {
          const positivo = r.resultado >= 0
          const largura = (Math.abs(r.resultadoPct) / escala) * 50
          return (
            <li key={r.ticker} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">{r.ticker}</span>
                <span className={positivo ? 'text-tertiary' : 'text-error'}>
                  {positivo ? '+' : '−'}R$ {formatBRL(Math.abs(r.resultado))} ({positivo ? '+' : '−'}{Math.abs(r.resultadoPct).toFixed(1)}%)
                </span>
              </div>
              <div className="relative h-2 bg-surface-container rounded-full">
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant" />
                <span
                  className={`absolute top-0 bottom-0 rounded-full ${positivo ? 'bg-tertiary' : 'bg-error'}`}
                  style={positivo
                    ? { left: '50%', width: `${largura}%` }
                    : { right: '50%', width: `${largura}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Criar o gráfico de evolução**

Criar `src/components/ativos/analise/EvolucaoPatrimonio.tsx`:

```tsx
import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { AssetHistoryPoint } from '../../../types'
import { formatBRL, formatDate } from '../../../utils/format'

interface Props {
  pontos: AssetHistoryPoint[]
  desde: string | null
}

export const EvolucaoPatrimonio: React.FC<Props> = ({ pontos, desde }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
    <h3 className="text-base font-semibold text-on-surface mb-4">Evolução do patrimônio</h3>

    {/* Um ponto só não é uma linha. Até acumular dias, dizer isso é mais útil
        que desenhar um gráfico degenerado. */}
    {pontos.length < 2 ? (
      <div className="py-10 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">timeline</span>
        <p className="text-sm text-on-surface-variant">
          {desde
            ? `Coletando desde ${formatDate(desde)} · volte em alguns dias`
            : 'A coleta começa no próximo horário de alerta de ativos'}
        </p>
      </div>
    ) : (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0c1ff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c0c1ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#35343a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d, 'dd/MM')}
              tick={{ fontSize: 11, fill: '#a9a8b3' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: '#a9a8b3' }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              formatter={(valor: number, nome: string) => [`R$ ${formatBRL(valor)}`, nome === 'current_value' ? 'Patrimônio' : 'Custo']}
              labelFormatter={(d: string) => formatDate(d)}
              contentStyle={{ background: '#1f1f25', border: 'none', borderRadius: 12, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="invested_value" stroke="#7a7986" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area type="monotone" dataKey="current_value" stroke="#c0c1ff" fill="url(#gradPatrimonio)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
)
```

- [ ] **Step 4: Criar a régua de alvo e stop**

Criar `src/components/ativos/analise/ReguaAlvoStop.tsx`:

```tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssetWithQuote } from '../../../types'
import { progressoAlvoStop } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

export const ReguaAlvoStop: React.FC<{ ativos: AssetWithQuote[] }> = ({ ativos }) => {
  const navigate = useNavigate()
  const comLimite = ativos.filter((a) => a.target_price !== null || a.stop_price !== null)
  const semLimite = ativos.length - comLimite.length

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Alvo e stop</h3>

      {comLimite.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum ativo com alvo ou stop definido.</p>
      ) : (
        <ul className="space-y-4">
          {comLimite.map((a) => {
            const progresso = progressoAlvoStop(a)
            const disparado = a.target_triggered_at !== null || a.stop_triggered_at !== null
            return (
              <li key={a.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">{a.ticker}</span>
                  <span className="text-on-surface-variant">
                    {a.current_price !== null ? `R$ ${formatBRL(a.current_price)}` : 'sem cotação'}
                    {disparado && <span className="ml-2 text-yellow-400">· alerta pausado</span>}
                  </span>
                </div>

                {progresso !== null ? (
                  <>
                    <div className="relative h-2 bg-surface-container rounded-full">
                      <span
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background"
                        style={{ left: `${progresso}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-on-surface-variant">
                      <span>stop R$ {formatBRL(a.stop_price!)}</span>
                      <span>alvo R$ {formatBRL(a.target_price!)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-on-surface-variant">
                    {a.target_price !== null ? `alvo R$ ${formatBRL(a.target_price)}` : `stop R$ ${formatBRL(a.stop_price!)}`}
                    {' · '}defina os dois limites para ver a régua
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {semLimite > 0 && (
        <button
          onClick={() => navigate('/ativos/carteira')}
          className="mt-4 text-xs text-primary hover:text-primary/80 font-medium min-h-[44px]"
        >
          {semLimite} {semLimite === 1 ? 'ativo sem alvo definido' : 'ativos sem alvo definido'} → definir
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Criar a página da aba**

Criar `src/pages/ativos/AtivosAnalise.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assetsApi } from '../../api/assets'
import type { AssetHistoryPoint, AssetWithQuote } from '../../types'
import { agregarPosicao, alocacaoPorTipo, resultadoPorAtivo } from '../../utils/assetAnalytics'
import { StatCard } from '../../components/ui/StatCard'
import { AlocacaoPorTipo } from '../../components/ativos/analise/AlocacaoPorTipo'
import { ResultadoPorAtivo } from '../../components/ativos/analise/ResultadoPorAtivo'
import { EvolucaoPatrimonio } from '../../components/ativos/analise/EvolucaoPatrimonio'
import { ReguaAlvoStop } from '../../components/ativos/analise/ReguaAlvoStop'
import { formatBRL, formatDate } from '../../utils/format'

const AtivosAnalise: React.FC = () => {
  const navigate = useNavigate()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [pontos, setPontos] = useState<AssetHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    const [listaR, histR] = await Promise.allSettled([assetsApi.list(), assetsApi.history(90)])
    if (listaR.status === 'fulfilled') setAtivos(listaR.value)
    if (histR.status === 'fulfilled') setPontos(histR.value.pontos)
    setErro(listaR.status === 'rejected')
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-error">error</span>
        <p className="text-sm text-on-surface flex-1">Erro ao carregar a carteira.</p>
        <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
      </div>
    )
  }

  if (ativos.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">trending_up</span>
        <p className="text-on-surface font-semibold mb-1">Carteira vazia</p>
        <p className="text-sm text-on-surface-variant mb-4">Cadastre um ativo para ver a análise aqui.</p>
        <button onClick={() => navigate('/ativos/carteira')} className="btn-primary mx-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Adicionar Ativo
        </button>
      </div>
    )
  }

  const posicao = agregarPosicao(ativos)
  const positivo = posicao.resultado >= 0
  const desatualizados = ativos.filter((a) => a.quote_stale && a.last_quote_at !== null)

  return (
    <div className="space-y-6">
      {desatualizados.length > 0 && (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400 text-lg">schedule</span>
          <p className="text-xs text-on-surface-variant">
            {desatualizados.length === 1 ? 'Uma cotação é' : `${desatualizados.length} cotações são`} de{' '}
            {formatDate(desatualizados[0].last_quote_at!)} — mercado fechado.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="account_balance_wallet"
          label="Patrimônio"
          value={`R$ ${formatBRL(posicao.patrimonio)}`}
          iconColor="text-primary"
          iconBg="bg-primary/15"
        />
        <StatCard
          icon="payments"
          label="Investido"
          value={`R$ ${formatBRL(posicao.investido)}`}
          iconColor="text-on-surface-variant"
          iconBg="bg-surface-container-high"
        />
        <StatCard
          icon={positivo ? 'trending_up' : 'trending_down'}
          label="Resultado"
          value={`${positivo ? '+' : '−'}R$ ${formatBRL(Math.abs(posicao.resultado))}`}
          sub={`${positivo ? '+' : '−'}${Math.abs(posicao.resultadoPct).toFixed(1)}%`}
          iconColor={positivo ? 'text-tertiary' : 'text-error'}
          iconBg={positivo ? 'bg-tertiary/15' : 'bg-error/15'}
        />
        <StatCard
          icon="inventory_2"
          label="Ativos"
          value={posicao.comPosicao}
          sub={[
            posicao.watchlist > 0 ? `${posicao.watchlist} em observação` : null,
            posicao.semCotacao > 0 ? `${posicao.semCotacao} sem cotação` : null,
          ].filter(Boolean).join(' · ') || undefined}
          iconColor="text-primary"
          iconBg="bg-primary/15"
        />
      </div>

      <EvolucaoPatrimonio pontos={pontos} desde={pontos.length > 0 ? pontos[0].date : null} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlocacaoPorTipo fatias={alocacaoPorTipo(ativos)} />
        <ResultadoPorAtivo resultados={resultadoPorAtivo(ativos)} />
      </div>

      <ReguaAlvoStop ativos={ativos} />
    </div>
  )
}

export default AtivosAnalise
```

- [ ] **Step 6: Ligar a rota**

Em `src/App.tsx`, adicionar o import e a rota filha dentro do bloco `/ativos`:

```tsx
import AtivosAnalise from './pages/ativos/AtivosAnalise'
```

```tsx
                  <Route path="analise" element={<AtivosAnalise />} />
```

- [ ] **Step 7: Verificar o build e os testes**

Run: `npm run build && npm test`
Expected: build sem erro; testes de `assetAnalytics` passando.

- [ ] **Step 8: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/ativos/analise`
Expected: com carteira cadastrada, os quatro StatCards batem com a soma da aba Carteira; o gráfico de evolução mostra "Coletando desde…" enquanto não há dois dias de snapshot; alocação e resultado renderizam; a régua aparece para quem tem alvo e stop. Com carteira vazia, o CTA de adicionar ativo.

- [ ] **Step 9: Commit**

```bash
git add src/components/ativos src/pages/ativos/AtivosAnalise.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ativos): aba de análise da carteira

Patrimônio, investido e resultado em StatCards; evolução do patrimônio contra
custo; alocação por tipo; resultado por ativo em barra divergente; e régua de
alvo/stop. Watchlist e ativo sem cotação ficam fora dos agregados e aparecem
contados à parte.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 12: Frontend — navegação e remoção das telas mortas

**Files:**
- Modify: `src/components/Layout/Sidebar.tsx`
- Modify: `src/components/Layout/Layout.tsx` (BottomNav)
- Modify: `src/components/Layout/Header.tsx`
- Modify: `src/pages/Configuracoes.tsx` (botão Sair)
- Modify: `src/App.tsx`
- Delete: `src/pages/Analise.tsx`, `src/pages/Historico.tsx`

**Interfaces:**
- Consumes: rotas das Tasks 8, 9, 10.
- Produces: `navItems` com seis entradas e sem ação de logout no bottom nav.

- [ ] **Step 1: Atualizar `navItems`**

Em `src/components/Layout/Sidebar.tsx`, o array vira (item Análise removido, Dashboard renomeado para Home):

```tsx
const navItems = [
  { path: '/', label: 'Home', icon: 'home', exact: true },
  { path: '/contas', label: 'Contas', icon: 'receipt_long' },
  { path: '/ativos', label: 'Ativos', icon: 'trending_up' },
  { path: '/checklists', label: 'Checklists', icon: 'checklist' },
  { path: '/notificacoes', label: 'Notificações', icon: 'notifications' },
  { path: '/configuracoes', label: 'Configurações', icon: 'settings' },
]
```

O botão Sair do rodapé da Sidebar (desktop) **permanece** — lá há espaço e ele não disputa com abas.

- [ ] **Step 2: Remover o Sair do bottom nav**

Em `src/components/Layout/Layout.tsx`, apagar o `<button>` de logout dentro de `BottomNav` (linhas 32-40) e o `const { logout } = useAuth()` que ficará sem uso — `noUnusedLocals` quebra o build se ficar. Remover também o import `useAuth` se nenhum outro trecho do arquivo o usar:

```bash
grep -n "useAuth\|logout" src/components/Layout/Layout.tsx
```

- [ ] **Step 3: Adicionar o Sair em Configurações**

Em `src/pages/Configuracoes.tsx`, ao final do conteúdo da página (após o último card da seção), adicionar um card de saída. Se o arquivo ainda não importa `useAuth`, adicionar `import { useAuth } from '../context/AuthContext'` e obter `const { logout } = useAuth()` junto dos outros hooks do componente:

```tsx
          <div className="section-card">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 min-h-[48px] rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Sair da conta
            </button>
          </div>
```

- [ ] **Step 4: Fazer o Header resolver por prefixo**

Em `src/components/Layout/Header.tsx`, substituir o mapa e o cálculo do título. A ordem da lista importa: `/contas/nova` precisa vir antes de `/contas`.

```tsx
// Resolvido por prefixo porque as páginas com aba têm sub-rota (/contas/lista).
// A aba corrente não entra no título — a TabNav logo abaixo já a mostra.
const pageTitles: { prefix: string; title: string }[] = [
  { prefix: '/contas/nova', title: 'Nova Conta' },
  { prefix: '/contas', title: 'Minhas Contas' },
  { prefix: '/ativos', title: 'Meus Ativos' },
  { prefix: '/checklists', title: 'Checklists' },
  { prefix: '/notificacoes', title: 'Notificações' },
  { prefix: '/configuracoes', title: 'Configurações' },
]

const Header: React.FC = () => {
  const location = useLocation()

  const title =
    location.pathname === '/'
      ? 'Home'
      : location.pathname.includes('/editar')
        ? 'Editar Conta'
        : pageTitles.find((p) => location.pathname.startsWith(p.prefix))?.title ?? 'BillSync'
```

A entrada `'/historico'` some junto — a página nunca teve rota.

- [ ] **Step 5: Remover a rota e a página de Análise, e a página órfã de Histórico**

Em `src/App.tsx`, remover `import Analise from './pages/Analise'` e a linha `<Route path="/analise" element={<Analise />} />`. Sem redirect: a página deixou de existir conceitualmente e apontá-la para uma das duas abas seria arbitrário.

```bash
git rm src/pages/Analise.tsx src/pages/Historico.tsx
```

- [ ] **Step 6: Confirmar que nada mais referencia o que foi removido**

```bash
grep -rn "pages/Analise\|pages/Historico\|/analise\"\|'/historico'" src/
```

Esperado: nenhuma ocorrência. (Os caminhos `/contas/analise`, `/ativos/analise` e `/checklists/analise` são outros e devem continuar aparecendo em `App.tsx` e nos shells.)

- [ ] **Step 7: Verificar o build**

Run: `npm run build`
Expected: sucesso. Erro de variável não usada aponta um `logout` ou `useAuth` esquecido no Step 2.

- [ ] **Step 8: Conferir no navegador, inclusive no mobile**

Run: `npm run dev`
Expected:
- Sidebar (desktop, ≥768px) com seis itens e Sair no rodapé.
- Bottom nav (estreitar a janela para menos de 768px) com seis abas e **sem** o botão Sair.
- Sair funcionando dentro de `/configuracoes`.
- `/analise` cai no `<Route path="*">` e redireciona para `/`.
- Os títulos do Header: `Home`, `Minhas Contas`, `Meus Ativos`, `Checklists`, `Nova Conta` em `/contas/nova`, `Editar Conta` em `/contas/:id/editar`.

- [ ] **Step 9: Commit**

```bash
git add src/components/Layout src/pages/Configuracoes.tsx src/App.tsx src/pages/Analise.tsx src/pages/Historico.tsx
git commit -m "$(cat <<'EOF'
refactor(nav): remove a página de análise e reorganiza a navegação

navItems fica com seis entradas e Dashboard vira Home. O botão Sair sai do
bottom nav mobile e passa a viver em Configurações, liberando largura para as
abas. Header resolve o título por prefixo, já que as páginas com aba têm
sub-rota. Remove a página órfã Historico.tsx, sem import nem rota.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 13: Frontend — `WhatsAppProfileCard` compartilhado

Componente apresentacional puro: quem busca os dados é a página. Assim Configurações mantém seu botão de atualizar sem duplicar lógica de fetch.

**Files:**
- Create: `src/components/whatsapp/WhatsAppProfileCard.tsx`
- Modify: `src/pages/Configuracoes.tsx` (linhas 369-425, o card "Perfil WhatsApp")

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface WhatsAppProfile { name: string | null; about: string | null; profilePicUrl: string | null }`
  - `WhatsAppProfileCard` (named export) com props `{ profile: WhatsAppProfile | null; whatsappNumber: string | null; loading: boolean; error: string | null; connected?: boolean | null; compact?: boolean; onRefresh?: () => void }`

- [ ] **Step 1: Criar o componente**

Criar `src/components/whatsapp/WhatsAppProfileCard.tsx`:

```tsx
import React from 'react'

export interface WhatsAppProfile {
  name: string | null
  about: string | null
  profilePicUrl: string | null
}

interface Props {
  profile: WhatsAppProfile | null
  whatsappNumber: string | null
  loading: boolean
  error: string | null
  connected?: boolean | null
  compact?: boolean
  onRefresh?: () => void
}

const StatusConexao: React.FC<{ connected: boolean | null }> = ({ connected }) => {
  if (connected === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-outline animate-pulse" />
        Verificando…
      </span>
    )
  }
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${connected ? 'text-tertiary' : 'text-error'}`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-tertiary' : 'bg-error'}`} />
      {connected ? 'conectado' : 'desconectado'}
    </span>
  )
}

export const WhatsAppProfileCard: React.FC<Props> = ({
  profile, whatsappNumber, loading, error, connected, compact, onRefresh,
}) => (
  <div className={compact ? 'glass-card rounded-2xl border border-outline-variant/50 p-4' : 'section-card'}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">account_circle</span>
        <h3 className="text-base font-semibold text-on-surface">Perfil WhatsApp</h3>
      </div>
      <div className="flex items-center gap-3">
        {connected !== undefined && <StatusConexao connected={connected ?? null} />}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-ghost text-xs min-h-[44px]"
            aria-label="Atualizar perfil"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        )}
      </div>
    </div>

    {loading ? (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-10 shimmer-bg rounded-xl" />
        ))}
      </div>
    ) : error ? (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">wifi_off</span>
        <p className="text-sm text-on-surface-variant leading-relaxed">{error}</p>
      </div>
    ) : (
      <div className="flex items-start gap-4">
        {profile?.profilePicUrl ? (
          <img
            src={profile.profilePicUrl}
            alt="Foto de perfil"
            className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-outline-variant/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="material-symbols-outlined text-6xl text-on-surface-variant flex-shrink-0">
            account_circle
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-on-surface truncate">
            {profile?.name ?? whatsappNumber ?? '-'}
          </p>
          <p className="text-xs text-on-surface-variant">{whatsappNumber ?? '-'}</p>
          {profile?.about && (
            <p className="text-xs text-on-surface-variant italic leading-relaxed mt-1">
              "{profile.about}"
            </p>
          )}
        </div>
      </div>
    )}
  </div>
)
```

- [ ] **Step 2: Usar o componente em Configurações**

Em `src/pages/Configuracoes.tsx`, adicionar o import:

```tsx
import { WhatsAppProfileCard } from '../components/whatsapp/WhatsAppProfileCard'
```

Substituir todo o bloco `{/* WhatsApp Profile Card */}` (o `<div className="section-card">` das linhas 369-425, até o fechamento correspondente) por:

```tsx
          {/* WhatsApp Profile Card */}
          <WhatsAppProfileCard
            profile={wahaProfile}
            whatsappNumber={user?.whatsapp_number ?? null}
            loading={loadingProfile}
            error={profileError}
            onRefresh={fetchWahaProfile}
          />
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: sucesso. Se acusar variável não usada, algum estado que só o bloco antigo consumia ficou órfão — conferir com `grep -n "wahaProfile\|profileError\|loadingProfile" src/pages/Configuracoes.tsx`.

- [ ] **Step 4: Conferir no navegador**

Run: `npm run dev` e abrir `/configuracoes`
Expected: o card Perfil WhatsApp igual ao de antes — foto (ou fallback), nome, número, recado, botão de atualizar girando durante a busca, e a mensagem com ícone `wifi_off` quando o WAHA está fora.

- [ ] **Step 5: Commit**

```bash
git add src/components/whatsapp src/pages/Configuracoes.tsx
git commit -m "$(cat <<'EOF'
refactor(whatsapp): extrai WhatsAppProfileCard de Configurações

Componente apresentacional, com a página responsável pelo fetch. A Home vai
reusá-lo — duplicar o fallback de foto quebrada e o estado de erro em duas
telas é o começo de uma divergência.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 14: Frontend — Home

**Files:**
- Create: `src/pages/Home.tsx`
- Modify: `src/App.tsx`
- Delete: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `WhatsAppProfileCard`, `WhatsAppProfile` (Task 13); `assetsApi.list` (Task 5).
- Produces: rota `/` renderizando `Home`.

- [ ] **Step 1: Criar a Home**

Criar `src/pages/Home.tsx`. `OccurrenceRow` vem de `Dashboard.tsx:57-83` sem alteração; o `StatCard` local e o `WahaStatusBadge` do Dashboard não são reaproveitados (o primeiro virou `components/ui/StatCard`, o segundo foi absorvido pelo card de perfil):

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { occurrencesApi } from '../api/occurrences'
import { checklistsApi } from '../api/checklists'
import { assetsApi } from '../api/assets'
import { notificationsApi } from '../api/notifications'
import wahaApi from '../api/waha'
import type { BillOccurrence, ChecklistDashboardData, AssetWithQuote } from '../types'
import { formatBRL, formatDate, formatRelativeDate, getBillIcon } from '../utils/format'
import { SkeletonRow } from '../components/ui/Skeleton'
import { WhatsAppProfileCard, WhatsAppProfile } from '../components/whatsapp/WhatsAppProfileCard'
import { useAuth } from '../context/AuthContext'
import { parseISO, isToday, isTomorrow } from 'date-fns'

interface Pendencia {
  icone: string
  texto: string
  destino: string
}

const OccurrenceRow: React.FC<{ occurrence: BillOccurrence }> = ({ occurrence }) => {
  const { label, color } = formatRelativeDate(occurrence.due_date)
  const icon = getBillIcon(occurrence.bill_name ?? occurrence.bill?.name ?? '')
  const billName = occurrence.bill_name ?? occurrence.bill?.name ?? 'Sem nome'

  return (
    <div className="p-3 sm:p-4 rounded-xl border bg-surface-container/50 hover:bg-surface-container transition-all duration-200 border-outline-variant/40">
      <div className="flex items-center gap-3">
        <div className="w-1 h-10 rounded-full flex-shrink-0 bg-primary/40" />
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{billName}</p>
          <p className={`text-xs ${color} font-medium`}>
            {formatDate(occurrence.due_date)} · {label}
          </p>
        </div>
        <p className="text-sm font-bold text-on-surface flex-shrink-0">{formatBRL(occurrence.amount)}</p>
      </div>
    </div>
  )
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([])
  const [checklist, setChecklist] = useState<ChecklistDashboardData | null>(null)
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    setLoadingProfile(true)
    setProfileError(null)

    // allSettled em tudo: o WAHA fora do ar não pode esconder os vencimentos.
    const [occR, checkR, ativosR, profileR, conexaoR] = await Promise.allSettled([
      occurrencesApi.upcoming(30),
      checklistsApi.dashboard(),
      assetsApi.list(),
      notificationsApi.getWhatsAppProfile(),
      wahaApi.getStatus(),
    ])

    if (occR.status === 'fulfilled') setOccurrences(occR.value)
    if (checkR.status === 'fulfilled') setChecklist(checkR.value)
    if (ativosR.status === 'fulfilled') setAtivos(ativosR.value)

    if (profileR.status === 'fulfilled') {
      setProfile(profileR.value)
    } else {
      const err: any = profileR.reason
      setProfileError(err?.response?.data?.error ?? err?.message ?? 'Erro ao buscar perfil WhatsApp.')
    }

    // getStatus devolve { connected, status } — o booleano está no campo connected.
    setConnected(conexaoR.status === 'fulfilled' ? conexaoR.value.connected : false)
    setLoadingProfile(false)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Não há estado de pagamento em bill_occurrences (migration 010 removeu
  // status/paid_at), então a pendência de conta é apenas a data de vencimento.
  const pendencias: Pendencia[] = []

  for (const occ of occurrences) {
    const vencimento = parseISO(occ.due_date)
    if (isToday(vencimento) || isTomorrow(vencimento)) {
      pendencias.push({
        icone: getBillIcon(occ.bill_name ?? ''),
        texto: `${occ.bill_name ?? 'Conta'} · ${formatBRL(occ.amount)} · vence ${isToday(vencimento) ? 'hoje' : 'amanhã'}`,
        destino: '/contas/lista',
      })
    }
  }

  const hoje = checklist?.today
  if (checklist?.checklist && hoje && hoje.completion_pct < 100) {
    pendencias.push({
      icone: 'checklist',
      texto: `Checklist de hoje em ${hoje.completion_pct}%`,
      destino: '/checklists/lista',
    })
  }

  for (const a of ativos) {
    if (a.target_triggered_at !== null || a.stop_triggered_at !== null) {
      pendencias.push({
        icone: a.target_triggered_at !== null ? 'flag' : 'shield',
        texto: `${a.ticker} bateu o ${a.target_triggered_at !== null ? 'alvo' : 'stop'} · alerta pausado`,
        destino: '/ativos/carteira',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <WhatsAppProfileCard
        profile={profile}
        whatsappNumber={user?.whatsapp_number ?? null}
        loading={loadingProfile}
        error={profileError}
        connected={connected}
        compact
      />

      {!loading && pendencias.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary">priority_high</span>
            Precisa de você hoje
          </p>
          <div className="space-y-2">
            {pendencias.map((p, i) => (
              <button
                key={`${p.destino}-${i}`}
                onClick={() => navigate(p.destino)}
                className="w-full flex items-center gap-3 p-3 min-h-[56px] rounded-xl bg-surface-container/50 hover:bg-surface-container border border-outline-variant/40 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-lg flex-shrink-0">{p.icone}</span>
                <span className="text-sm text-on-surface flex-1 min-w-0 truncate">{p.texto}</span>
                <span className="material-symbols-outlined text-on-surface-variant text-lg flex-shrink-0">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-on-surface">Próximos Vencimentos</h3>
          <button
            onClick={() => navigate('/notificacoes')}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors min-h-[44px]"
          >
            Ver notificações →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : occurrences.length === 0 ? (
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">celebration</span>
            <p className="text-on-surface font-semibold mb-1">Tudo em dia!</p>
            <p className="text-sm text-on-surface-variant">Nenhum vencimento próximo.</p>
            <button onClick={() => navigate('/contas/nova')} className="btn-primary mx-auto mt-4">
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar Conta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {occurrences.map((occ) => <OccurrenceRow key={occ.id} occurrence={occ} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
```

- [ ] **Step 2: Trocar a rota raiz**

Em `src/App.tsx`, remover `import Dashboard from './pages/Dashboard'`, adicionar `import Home from './pages/Home'`, e trocar:

```tsx
                <Route path="/" element={<Home />} />
```

```bash
git rm src/pages/Dashboard.tsx
```

- [ ] **Step 3: Verificar o build e os testes**

Run: `npm run build && npm test`
Expected: ambos passando.

- [ ] **Step 4: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/`
Expected: card do WhatsApp no topo com foto, nome, número e bolinha de status; o bloco "Precisa de você hoje" só quando há conta vencendo hoje/amanhã, checklist incompleto ou ativo com alerta disparado, cada linha navegando para a página certa; a lista de próximos vencimentos abaixo. Derrubar o WAHA (ou apontar `WAHA_URL` para um host inválido) e recarregar: o card mostra o erro e **os vencimentos continuam aparecendo**.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx src/App.tsx src/pages/Dashboard.tsx
git commit -m "$(cat <<'EOF'
feat(home): substitui o Dashboard por Home com perfil e pendências

Perfil do WhatsApp em destaque, bloco do que exige ação hoje (conta vencendo,
checklist incompleto, ativo com alerta disparado) e os próximos vencimentos.
Os StatCards agregados saíram — cada número agora mora na aba de análise do
seu domínio, e a chamada a occurrences/dashboard-stats deixa de ser feita.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```

---

### Task 15: Verificação de ponta a ponta e atualização do CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tudo.
- Produces: documentação do projeto refletindo a estrutura nova.

- [ ] **Step 1: Rodar tudo**

```bash
npm run build && npm test
cd backend && npm run build && npm test && cd ..
```

Expected: quatro comandos verdes. Qualquer falha aqui é regressão de uma task anterior — corrigir antes de seguir.

- [ ] **Step 2: Conferir que não sobrou referência morta**

```bash
grep -rn "pages/Dashboard\|pages/Analise\|pages/Contas'\|pages/Ativos'\|pages/Checklists'\|pages/Historico" src/
grep -rn "components/analise/" src/
grep -rn "getDashboardStats" src/
```

Esperado: nenhuma ocorrência nos três comandos. `getDashboardStats` pode permanecer definido em `src/api/occurrences.ts` (o endpoint continua existindo no backend), mas não deve ter mais nenhum chamador.

- [ ] **Step 3: Percorrer a aplicação inteira no navegador**

Run: `npm run dev`

Percorrer e confirmar cada item:
- `/` — Home com perfil, pendências e vencimentos.
- `/contas` → redireciona para `/contas/lista`; aba Análise carrega os gráficos; F5 em `/contas/analise` permanece na análise.
- `/contas/nova` e editar uma conta — sem barra de abas, título correto no Header.
- `/ativos` → `/ativos/carteira`; aba Análise com StatCards, alocação, resultado e régua.
- `/checklists` → `/checklists/lista`; aba Análise com heatmap e ranking.
- `/notificacoes` e `/configuracoes` — inalteradas, com o botão Sair novo em Configurações.
- `/analise` — redireciona para `/`.
- Janela abaixo de 768px: bottom nav com seis abas, sem Sair.

- [ ] **Step 4: Confirmar a coleta de snapshot com o backend rodando**

Ajustar temporariamente `asset_alert_hour` do usuário para a hora corrente em São Paulo, deixar o backend rodando até virar a hora (ou reiniciar dentro da hora certa), e verificar:

```bash
grep "assetSync" backend-logs   # ou observar o stdout do npm run dev
```

Expected no log: `[assetSync] N ativo(s) sincronizado(s) para <user_id>`. Depois, com o backend de pé:

```bash
curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:4000/api/assets/history?days=90'
```

Expected: `pontos` com uma entrada da data de hoje, `current_value` batendo com o patrimônio mostrado na aba de análise. Restaurar `asset_alert_hour` ao valor original depois do teste.

- [ ] **Step 5: Atualizar o CLAUDE.md**

Três trechos ficam desatualizados. Em `## Architecture` → `### Frontend (src/)`, trocar a linha de páginas por:

```markdown
- `src/pages/` — Home, Contas (`contas/`: lista + análise), Ativos (`ativos/`: carteira + análise), Checklists (`checklists/`: lista + análise), BillForm (create/edit), Notificacoes, Configuracoes, Login. Páginas com análise usam shell + rotas aninhadas: `/contas/lista` e `/contas/analise` são rotas reais, e a aba ativa vem da URL via `TabNav` (`src/components/ui/TabNav.tsx`).
```

Em `### Backend (backend/src/)`, na linha de `services/`, acrescentar ao final da lista: `assetQuoteSync.ts` (coleta diária de cotação + snapshot) e `assetSnapshotMath.ts` (decisões puras do snapshot).

Em `### Database`, acrescentar `asset_snapshots` à lista de tabelas.

Em `## Key conventions`, corrigir a linha obsoleta sobre confirmação de pagamento — a migration `010_remove_payment_fields` removeu `status`, `paid_at` e `confirmation_source` de `bill_occurrences`:

```markdown
- WAHA webhook hits `/api/webhooks`; a resposta do usuário alimenta os checklists. Não há estado de pagamento em `bill_occurrences` — `status`, `paid_at` e `confirmation_source` foram removidos pela migration `010_remove_payment_fields`.
```

E acrescentar:

```markdown
- Snapshot diário de ativos: `syncUserAssets` roda no tick de `asset_alert_hour` para todo usuário com ativo ativo, mesmo com alerta desligado, e grava uma linha por ativo em `asset_snapshots`. A trava de cotação velha vale só para o alerta — o snapshot registra o preço como veio, senão o total do sábado despencaria por falta das ações.
- Testes do frontend com vitest em `src/**/__tests__/`, cobrindo funções puras. Rodar com `npm test` na raiz.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: atualiza CLAUDE.md para a estrutura de telas nova

Páginas com shell e rotas aninhadas, serviços de snapshot de ativos, tabela
asset_snapshots e vitest no frontend. Corrige a afirmação sobre confirmação de
pagamento, obsoleta desde a migration 010_remove_payment_fields.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011u8C6mfnHTW7P9JpMTCiwf
EOF
)"
```
