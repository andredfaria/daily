# Carteira de Ativos com Alerta de Preço-Alvo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar ações da B3, FIIs e cripto com quantidade e preço médio, e receber uma mensagem no WhatsApp às 11h quando a cotação atingir o preço-alvo ou o stop definidos.

**Architecture:** Terceiro módulo do BillSync, no mesmo molde dos existentes. Uma tabela `assets`, um cliente isolado da API brapi.dev, um serviço de regra de alerta chamado pelo tick horário já existente do `scheduler.ts`, uma rota REST `/api/assets` e uma página React `/ativos`. Toda a matemática e a formatação de mensagem vivem em um módulo puro sem I/O, que é o que a suíte jest cobre.

**Tech Stack:** TypeScript, Express, MySQL 8, axios, node-cron, jest + ts-jest, React 18, React Router v6, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-30-carteira-ativos-alerta-preco-design.md`

## Global Constraints

- Todo código, comentário, log e texto de UI em **português (pt-BR)**.
- Logs seguem o prefixo de módulo entre colchetes: `[assetAlert]`, `[brapi]`, `[migrate]`.
- Serviços de funções puras **não importam `pool` nem axios** — é o que mantém a suíte jest sem banco e sem rede (ver `services/checklistInactivity.ts` como referência).
- Migrations são incrementais em `backend/src/migrate.ts`, registradas em `migration_log`, e nomeadas com prefixo numérico sequencial. A última existente é `013_checklists_last_miss_poll_date`.
- Rotas ficam sob `authMiddleware` e **toda query filtra por `req.userId`**.
- Timezone de referência: `America/Sao_Paulo`.
- Preços e quantidades em `DECIMAL(18,8)`; no TypeScript sempre convertidos com `Number()` antes de calcular (o driver mysql2 devolve DECIMAL como string).
- Visual segue `design-system/billsync/MASTER.md`.
- Falha da API externa nunca aborta o tick do scheduler nem derruba o processo.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/migrate.ts` (modificar) | Migrations `014_assets` e `015_users_asset_alerts` |
| `backend/src/services/assetMath.ts` (criar) | Funções puras: L/P, gatilhos, formatação da mensagem |
| `backend/src/services/__tests__/assetMath.test.ts` (criar) | Cobertura das funções puras |
| `backend/src/services/brapi.ts` (criar) | Única fronteira com a API brapi.dev; cache em memória |
| `backend/src/services/__tests__/brapi.test.ts` (criar) | Parsing e cache, com axios mockado |
| `backend/src/services/assetAlertService.ts` (criar) | Orquestração: lê banco, busca cotação, decide, envia |
| `backend/src/scheduler.ts` (modificar) | Bloco de disparo no tick horário |
| `backend/src/routes/assets.ts` (criar) | CRUD REST + rearm |
| `backend/src/index.ts` (modificar) | Monta o router em `/api/assets` |
| `src/types/index.ts` (modificar) | `Asset`, `AssetKind`, `AssetWithQuote` |
| `src/api/assets.ts` (criar) | Client HTTP no padrão de `src/api/bills.ts` |
| `src/pages/Ativos.tsx` (criar) | Lista, formulário e ações |
| `src/App.tsx` (modificar) | Rota `/ativos` |
| `src/components/Layout/Sidebar.tsx` (modificar) | Item de navegação |
| `src/components/Layout/Layout.tsx` (modificar) | Bottom nav rolável (ver Task 8, nota de touch target) |
| `src/components/Layout/Header.tsx` (modificar) | Título da página |
| `src/pages/Configuracoes.tsx` (modificar) | Toggle de alertas e seletor de hora |
| `.env.example` (modificar) | `BRAPI_TOKEN` |
| `CLAUDE.md` (modificar) | Documenta o módulo e corrige a nota sobre testes |

---

## Task 1: Migrations

**Files:**
- Modify: `backend/src/migrate.ts` (array `MIGRATIONS`, após `013_checklists_last_miss_poll_date`)

**Interfaces:**
- Consumes: helpers `splitStatements` e `addColumnIfNotExists`, já definidos no topo do arquivo.
- Produces: tabela `assets` e as colunas `users.asset_alerts_enabled`, `users.asset_alert_hour`.

- [ ] **Step 1: Adicionar as duas migrations ao array**

Em `backend/src/migrate.ts`, dentro de `const MIGRATIONS: Migration[] = [ ... ]`, logo depois do objeto `013_checklists_last_miss_poll_date` e antes do `]` de fechamento:

```ts
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
```

Atenção: o SQL de `014_assets` não pode conter `;` internos — `splitStatements` quebra a string nesse caractere. O bloco acima é um único statement, então está correto como está.

- [ ] **Step 2: Rodar o backend e conferir o log**

Run: `cd backend && npm run dev`
Expected: aparecem no stdout as linhas `[migrate] executando 014_assets...`, `[migrate] 014_assets concluida`, `[migrate] executando 015_users_asset_alerts...`, `[migrate] 015_users_asset_alerts concluida`. Nenhum erro. Encerre com Ctrl+C.

- [ ] **Step 3: Conferir o schema no banco**

Run: `mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE assets; SHOW COLUMNS FROM users LIKE 'asset%';"`
Expected: as 15 colunas de `assets` e as 2 novas colunas de `users`.

- [ ] **Step 4: Reiniciar e confirmar idempotência**

Run: `cd backend && npm run dev`
Expected: `[migrate] 014_assets ja executada — pulando` e o mesmo para `015`. Encerre com Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add backend/src/migrate.ts
git commit -m "feat(assets): migrations da tabela assets e das preferencias de alerta"
```

---

## Task 2: Módulo de cálculo puro (`assetMath.ts`)

**Files:**
- Create: `backend/src/services/assetMath.ts`
- Test: `backend/src/services/__tests__/assetMath.test.ts`

**Interfaces:**
- Consumes: nada. Este módulo **não importa nada** — é o que o mantém testável sem banco nem rede.
- Produces:
  - `type AssetKind = 'stock' | 'fii' | 'crypto'`
  - `interface AlertHit { ticker: string; reason: 'target' | 'stop'; price: number; threshold: number; quantity: number; avgPrice: number }`
  - `investedValue(quantity: number, avgPrice: number): number`
  - `currentValue(quantity: number, price: number): number`
  - `profitLoss(quantity: number, avgPrice: number, price: number): number`
  - `profitLossPct(avgPrice: number, price: number): number`
  - `isTargetHit(price: number, target: number | null, triggeredAt: Date | string | null): boolean`
  - `isStopHit(price: number, stop: number | null, triggeredAt: Date | string | null): boolean`
  - `formatBRL(value: number): string`
  - `buildAlertMessage(hits: AlertHit[]): string`
  - `formatDateSaoPaulo(date: Date): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/services/__tests__/assetMath.test.ts`:

```ts
import {
  investedValue,
  currentValue,
  profitLoss,
  profitLossPct,
  isTargetHit,
  isStopHit,
  formatBRL,
  buildAlertMessage,
  formatDateSaoPaulo,
  AlertHit,
} from '../assetMath'

describe('cálculos de posição', () => {
  it('calcula valor investido como quantidade vezes preço médio', () => {
    expect(investedValue(100, 35)).toBe(3500)
  })

  it('calcula valor atual como quantidade vezes cotação', () => {
    expect(currentValue(100, 42.3)).toBe(4230)
  })

  it('calcula lucro em reais', () => {
    expect(profitLoss(100, 35, 42.3)).toBeCloseTo(730, 2)
  })

  it('calcula prejuízo em reais como valor negativo', () => {
    expect(profitLoss(100, 35, 30)).toBeCloseTo(-500, 2)
  })

  it('calcula variação percentual sobre o preço médio', () => {
    expect(profitLossPct(35, 42.3)).toBeCloseTo(20.857, 2)
  })

  it('retorna 0% quando o preço médio é zero, sem dividir por zero', () => {
    expect(profitLossPct(0, 42.3)).toBe(0)
  })

  it('lida com quantidade fracionária de cripto', () => {
    expect(investedValue(0.005, 350000)).toBeCloseTo(1750, 6)
  })
})

describe('isTargetHit', () => {
  it('dispara quando o preço ultrapassa o alvo', () => {
    expect(isTargetHit(42.3, 42, null)).toBe(true)
  })

  it('dispara quando o preço é exatamente igual ao alvo', () => {
    expect(isTargetHit(42, 42, null)).toBe(true)
  })

  it('não dispara quando o preço está abaixo do alvo', () => {
    expect(isTargetHit(41.99, 42, null)).toBe(false)
  })

  it('não dispara quando não há alvo definido', () => {
    expect(isTargetHit(42.3, null, null)).toBe(false)
  })

  it('não redispara quando o alerta já foi disparado', () => {
    expect(isTargetHit(42.3, 42, new Date('2026-08-30T14:00:00Z'))).toBe(false)
  })

  it('aceita triggered_at vindo do banco como string', () => {
    expect(isTargetHit(42.3, 42, '2026-08-30 14:00:00')).toBe(false)
  })
})

describe('isStopHit', () => {
  it('dispara quando o preço cai abaixo do stop', () => {
    expect(isStopHit(9.1, 9.2, null)).toBe(true)
  })

  it('dispara quando o preço é exatamente igual ao stop', () => {
    expect(isStopHit(9.2, 9.2, null)).toBe(true)
  })

  it('não dispara quando o preço está acima do stop', () => {
    expect(isStopHit(9.21, 9.2, null)).toBe(false)
  })

  it('não dispara quando não há stop definido', () => {
    expect(isStopHit(9.1, null, null)).toBe(false)
  })

  it('não redispara quando o stop já foi disparado', () => {
    expect(isStopHit(9.1, 9.2, new Date('2026-08-30T14:00:00Z'))).toBe(false)
  })
})

describe('formatBRL', () => {
  it('formata com duas casas e separador de milhar brasileiro', () => {
    expect(formatBRL(4230.5)).toBe('4.230,50')
  })

  it('formata valor negativo preservando o sinal', () => {
    expect(formatBRL(-45)).toBe('-45,00')
  })
})

describe('buildAlertMessage', () => {
  const alvo: AlertHit = {
    ticker: 'PETR4', reason: 'target', price: 42.3, threshold: 42, quantity: 100, avgPrice: 35,
  }
  const stop: AlertHit = {
    ticker: 'MXRF11', reason: 'stop', price: 9.1, threshold: 9.2, quantity: 50, avgPrice: 10,
  }

  it('inclui o cabeçalho do alerta', () => {
    expect(buildAlertMessage([alvo])).toContain('📈 *Alerta de Ativos — BillSync*')
  })

  it('descreve o ticker e a cotação que atingiu o alvo', () => {
    const msg = buildAlertMessage([alvo])
    expect(msg).toContain('🎯 *PETR4* atingiu o alvo')
    expect(msg).toContain('Cotação: R$ 42,30 (alvo R$ 42,00)')
  })

  it('mostra a posição e o lucro quando há quantidade', () => {
    const msg = buildAlertMessage([alvo])
    expect(msg).toContain('Posição: 100 un. · pago R$ 35,00')
    expect(msg).toContain('Lucro: +R$ 730,00 (+20,9%)')
  })

  it('usa a palavra prejuízo e sinal negativo quando o resultado é negativo', () => {
    const msg = buildAlertMessage([stop])
    expect(msg).toContain('🛑 *MXRF11* atingiu o stop')
    expect(msg).toContain('Prejuízo: -R$ 45,00 (-9,0%)')
  })

  it('omite posição e resultado quando a quantidade é zero', () => {
    const msg = buildAlertMessage([{ ...alvo, quantity: 0 }])
    expect(msg).not.toContain('Posição:')
    expect(msg).not.toContain('Lucro:')
    expect(msg).toContain('Cotação: R$ 42,30')
  })

  it('consolida vários ativos em uma única mensagem', () => {
    const msg = buildAlertMessage([alvo, stop])
    expect(msg).toContain('PETR4')
    expect(msg).toContain('MXRF11')
    expect((msg.match(/Alerta de Ativos/g) || []).length).toBe(1)
  })

  it('encerra com o aviso de que os alertas ficam pausados', () => {
    expect(buildAlertMessage([alvo])).toContain('_Alertas pausados até você reativar no app._')
  })
})

describe('formatDateSaoPaulo', () => {
  it('formata em YYYY-MM-DD no fuso de São Paulo', () => {
    expect(formatDateSaoPaulo(new Date('2026-08-31T12:00:00Z'))).toBe('2026-08-31')
  })

  it('usa o dia anterior quando o UTC já virou mas São Paulo não', () => {
    expect(formatDateSaoPaulo(new Date('2026-09-01T02:00:00Z'))).toBe('2026-08-31')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest assetMath -v`
Expected: FAIL — `Cannot find module '../assetMath'`.

- [ ] **Step 3: Implementar o módulo**

Criar `backend/src/services/assetMath.ts`:

```ts
export type AssetKind = 'stock' | 'fii' | 'crypto'

export interface AlertHit {
  ticker: string
  reason: 'target' | 'stop'
  price: number
  threshold: number
  quantity: number
  avgPrice: number
}

export function investedValue(quantity: number, avgPrice: number): number {
  return quantity * avgPrice
}

export function currentValue(quantity: number, price: number): number {
  return quantity * price
}

export function profitLoss(quantity: number, avgPrice: number, price: number): number {
  return currentValue(quantity, price) - investedValue(quantity, avgPrice)
}

// Preço médio zero significa posição sem custo registrado — não há percentual a calcular.
export function profitLossPct(avgPrice: number, price: number): number {
  if (!avgPrice) return 0
  return ((price - avgPrice) / avgPrice) * 100
}

export function isTargetHit(
  price: number,
  target: number | null,
  triggeredAt: Date | string | null,
): boolean {
  if (target === null || target === undefined) return false
  if (triggeredAt) return false
  return price >= target
}

export function isStopHit(
  price: number,
  stop: number | null,
  triggeredAt: Date | string | null,
): boolean {
  if (stop === null || stop === undefined) return false
  if (triggeredAt) return false
  return price <= stop
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Percentual sempre com uma casa decimal: 20.857 -> "20,9", -9 -> "9,0".
function formatPct(value: number): string {
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
}

function buildHitBlock(hit: AlertHit): string {
  const isTarget = hit.reason === 'target'
  const lines = [
    `${isTarget ? '🎯' : '🛑'} *${hit.ticker}* atingiu o ${isTarget ? 'alvo' : 'stop'}`,
    `Cotação: R$ ${formatBRL(hit.price)} (${isTarget ? 'alvo' : 'stop'} R$ ${formatBRL(hit.threshold)})`,
  ]

  // Quantidade zero é watchlist — não há posição nem resultado a mostrar.
  if (hit.quantity > 0) {
    lines.push(`Posição: ${formatQuantity(hit.quantity)} un. · pago R$ ${formatBRL(hit.avgPrice)}`)
    const pl = profitLoss(hit.quantity, hit.avgPrice, hit.price)
    const pct = profitLossPct(hit.avgPrice, hit.price)
    const label = pl >= 0 ? 'Lucro' : 'Prejuízo'
    const sign = pl >= 0 ? '+' : '-'
    lines.push(`${label}: ${sign}R$ ${formatBRL(Math.abs(pl))} (${sign}${formatPct(pct)}%)`)
  }

  return lines.join('\n')
}

export function buildAlertMessage(hits: AlertHit[]): string {
  return [
    '📈 *Alerta de Ativos — BillSync*',
    '',
    hits.map(buildHitBlock).join('\n\n'),
    '',
    '_Alertas pausados até você reativar no app._',
  ].join('\n')
}

export function formatDateSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const p: Record<string, string> = {}
  parts.forEach(({ type, value }) => { p[type] = value })
  return `${p.year}-${p.month}-${p.day}`
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest assetMath -v`
Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/assetMath.ts backend/src/services/__tests__/assetMath.test.ts
git commit -m "feat(assets): funcoes puras de calculo de posicao e montagem da mensagem"
```

---

## Task 3: Cliente da API brapi.dev

**Files:**
- Create: `backend/src/services/brapi.ts`
- Test: `backend/src/services/__tests__/brapi.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `AssetKind` de `./assetMath`.
- Produces:
  - `interface Quote { ticker: string; price: number; shortName: string; quotedAt: Date }`
  - `fetchQuote(ticker: string, kind: AssetKind): Promise<Quote | null>`
  - `validateTicker(ticker: string, kind: AssetKind): Promise<boolean>`
  - `clearQuoteCache(): void` (usado só nos testes)

- [ ] **Step 1: Verificar o formato real da resposta da API**

Antes de escrever o parser, confirme a forma dos dois endpoints. Sem token, PETR4 responde; para cripto pode ser necessário o token.

```bash
curl -s 'https://brapi.dev/api/quote/PETR4' | head -c 1200
echo
curl -s 'https://brapi.dev/api/v2/crypto?coin=BTC&currency=BRL' | head -c 1200
```

Anote os nomes reais dos campos de preço (`regularMarketPrice`) e de horário (`regularMarketTime`), e se a raiz é `results` (ações) ou `coins` (cripto). **Se divergirem do que este plano assume, ajuste os seletores no Step 3 e os fixtures do Step 2 para o formato real** — o resto da estrutura continua válida.

- [ ] **Step 2: Escrever o teste que falha**

Criar `backend/src/services/__tests__/brapi.test.ts`:

```ts
import axios from 'axios'
import { fetchQuote, validateTicker, clearQuoteCache } from '../brapi'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const getMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  clearQuoteCache()
  getMock.mockReset()
  mockedAxios.create = jest.fn(() => ({ get: getMock })) as any
})

const acaoOk = {
  data: {
    results: [
      {
        symbol: 'PETR4',
        shortName: 'PETROBRAS PN',
        regularMarketPrice: 42.3,
        regularMarketTime: '2026-08-31T20:00:00.000Z',
      },
    ],
  },
}

const criptoOk = {
  data: {
    coins: [
      {
        coin: 'BTC',
        coinName: 'Bitcoin',
        regularMarketPrice: 350000,
        regularMarketTime: '2026-08-31T20:00:00.000Z',
      },
    ],
  },
}

describe('fetchQuote', () => {
  it('extrai ticker, preço, nome e horário de uma ação', async () => {
    getMock.mockResolvedValue(acaoOk)
    const quote = await fetchQuote('PETR4', 'stock')
    expect(quote).toEqual({
      ticker: 'PETR4',
      price: 42.3,
      shortName: 'PETROBRAS PN',
      quotedAt: new Date('2026-08-31T20:00:00.000Z'),
    })
  })

  it('usa o mesmo endpoint de ações para FII', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('MXRF11', 'fii')
    expect(getMock.mock.calls[0][0]).toContain('/quote/')
  })

  it('usa o endpoint de cripto para kind crypto', async () => {
    getMock.mockResolvedValue(criptoOk)
    const quote = await fetchQuote('BTC', 'crypto')
    expect(getMock.mock.calls[0][0]).toContain('/v2/crypto')
    expect(quote?.price).toBe(350000)
    expect(quote?.ticker).toBe('BTC')
  })

  it('retorna null quando a API responde sem resultados', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await fetchQuote('XPTO99', 'stock')).toBeNull()
  })

  it('retorna null e não lança quando a requisição falha', async () => {
    getMock.mockRejectedValue(new Error('timeout of 10000ms exceeded'))
    await expect(fetchQuote('PETR4', 'stock')).resolves.toBeNull()
  })

  it('normaliza o ticker para maiúsculas antes de consultar', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('petr4', 'stock')
    expect(getMock.mock.calls[0][0]).toContain('PETR4')
  })
})

describe('cache de cotações', () => {
  it('não repete a requisição para o mesmo ticker dentro do TTL', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    await fetchQuote('PETR4', 'stock')
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('refaz a requisição depois que o TTL expira', async () => {
    jest.useFakeTimers()
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    jest.advanceTimersByTime(11 * 60 * 1000)
    await fetchQuote('PETR4', 'stock')
    expect(getMock).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('mantém caches separados por ticker', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    await fetchQuote('VALE3', 'stock')
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('não guarda em cache uma falha', async () => {
    getMock.mockRejectedValueOnce(new Error('erro de rede'))
    getMock.mockResolvedValueOnce(acaoOk)
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect((await fetchQuote('PETR4', 'stock'))?.price).toBe(42.3)
  })
})

describe('validateTicker', () => {
  it('retorna true quando a cotação existe', async () => {
    getMock.mockResolvedValue(acaoOk)
    expect(await validateTicker('PETR4', 'stock')).toBe(true)
  })

  it('retorna false quando a cotação não existe', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await validateTicker('XPTO99', 'stock')).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest brapi -v`
Expected: FAIL — `Cannot find module '../brapi'`.

- [ ] **Step 4: Implementar o cliente**

Criar `backend/src/services/brapi.ts`:

```ts
import axios from 'axios'
import type { AssetKind } from './assetMath'

export interface Quote {
  ticker: string
  price: number
  shortName: string
  quotedAt: Date
}

const CACHE_TTL_MS = 10 * 60 * 1000

// A tela consulta cotações a cada carregamento; sem cache um F5 repetido
// queima o limite mensal de 15.000 requisições do plano gratuito.
const cache = new Map<string, { quote: Quote; expiresAt: number }>()

export function clearQuoteCache(): void {
  cache.clear()
}

function brapiClient() {
  const token = process.env.BRAPI_TOKEN
  if (!token) {
    console.warn('[brapi] BRAPI_TOKEN não definido — apenas PETR4, MGLU3, VALE3 e ITUB4 responderão')
  }
  return axios.create({
    baseURL: 'https://brapi.dev/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 10000,
  })
}

function parseQuotedAt(raw: unknown): Date {
  if (typeof raw === 'number') return new Date(raw * 1000)
  if (typeof raw === 'string') return new Date(raw)
  return new Date()
}

export async function fetchQuote(ticker: string, kind: AssetKind): Promise<Quote | null> {
  const symbol = ticker.trim().toUpperCase()
  const cached = cache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) return cached.quote

  try {
    const client = brapiClient()
    let quote: Quote | null = null

    if (kind === 'crypto') {
      const { data } = await client.get(`/v2/crypto?coin=${symbol}&currency=BRL`)
      const coin = data?.coins?.[0]
      if (coin) {
        quote = {
          ticker: coin.coin ?? symbol,
          price: Number(coin.regularMarketPrice),
          shortName: coin.coinName ?? symbol,
          quotedAt: parseQuotedAt(coin.regularMarketTime),
        }
      }
    } else {
      const { data } = await client.get(`/quote/${symbol}`)
      const result = data?.results?.[0]
      if (result) {
        quote = {
          ticker: result.symbol ?? symbol,
          price: Number(result.regularMarketPrice),
          shortName: result.shortName ?? result.longName ?? symbol,
          quotedAt: parseQuotedAt(result.regularMarketTime),
        }
      }
    }

    if (!quote || !Number.isFinite(quote.price)) {
      console.warn(`[brapi] sem cotação para ${symbol}`)
      return null
    }

    cache.set(symbol, { quote, expiresAt: Date.now() + CACHE_TTL_MS })
    return quote
  } catch (err: any) {
    // Falha de rede nunca sobe: o tick do scheduler precisa continuar.
    console.error(`[brapi] erro ao buscar ${symbol}:`, err.message)
    return null
  }
}

export async function validateTicker(ticker: string, kind: AssetKind): Promise<boolean> {
  return (await fetchQuote(ticker, kind)) !== null
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest brapi -v`
Expected: PASS.

- [ ] **Step 6: Documentar a variável de ambiente**

Adicionar ao final de `.env.example`:

```
# Cotação de ativos (brapi.dev) — token gratuito em https://brapi.dev/dashboard
# Sem token, apenas PETR4, MGLU3, VALE3 e ITUB4 respondem.
# Plano gratuito: 15.000 requisições/mês, 1 ticker por requisição.
BRAPI_TOKEN=
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/brapi.ts backend/src/services/__tests__/brapi.test.ts .env.example
git commit -m "feat(assets): cliente da brapi com cache de cotacoes"
```

---

## Task 4: Serviço de alerta

**Files:**
- Create: `backend/src/services/assetAlertService.ts`

**Interfaces:**
- Consumes: `pool` de `../db`; `sendWhatsAppText` de `./waha`; `fetchQuote` de `./brapi`; `AlertHit`, `isTargetHit`, `isStopHit`, `buildAlertMessage`, `formatDateSaoPaulo` de `./assetMath`.
- Produces: `checkAssetAlerts(userId: string): Promise<void>`

Sem teste automatizado próprio: este módulo é só orquestração de I/O, e toda a lógica que decide alguma coisa já está coberta em `assetMath.test.ts`. É o mesmo critério do `budgetAlertService.ts`. A verificação é manual, no Step 3.

- [ ] **Step 1: Implementar o serviço**

Criar `backend/src/services/assetAlertService.ts`:

```ts
import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fetchQuote } from './brapi'
import {
  AlertHit,
  isTargetHit,
  isStopHit,
  buildAlertMessage,
  formatDateSaoPaulo,
} from './assetMath'

export async function checkAssetAlerts(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    `SELECT whatsapp_number FROM users
      WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1 AND asset_alerts_enabled = 1`,
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const [assets]: any = await pool.query(
    `SELECT id, ticker, kind, quantity, avg_price, target_price, stop_price,
            target_triggered_at, stop_triggered_at
       FROM assets WHERE user_id = ? AND is_active = 1`,
    [userId]
  )
  if (!assets.length) return

  const hoje = formatDateSaoPaulo(new Date())
  const hits: AlertHit[] = []
  const marcarAlvo: string[] = []
  const marcarStop: string[] = []

  for (const asset of assets) {
    const quote = await fetchQuote(asset.ticker, asset.kind)
    if (!quote) continue

    await pool.query(
      'UPDATE assets SET last_price = ?, last_quote_at = ? WHERE id = ?',
      [quote.price, quote.quotedAt, asset.id]
    )

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

Nota sobre a ordem: os `*_triggered_at` só são marcados **depois** do envio bem-sucedido. Se o WhatsApp falhar, `sendWhatsAppText` lança, os alertas continuam armados e o próximo tick tenta de novo.

- [ ] **Step 2: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificar manualmente com um ativo real**

Com o backend rodando, insira um ativo com alvo já batido para o seu usuário e chame o serviço por um script pontual:

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
  "INSERT INTO assets (user_id, ticker, kind, quantity, avg_price, target_price)
   SELECT id, 'PETR4', 'stock', 100, 1.00, 1.00 FROM users LIMIT 1;"

cd backend && npx ts-node -e "
require('dotenv').config({ path: '../.env' });
const { checkAssetAlerts } = require('./src/services/assetAlertService');
const pool = require('./src/db').default;
pool.query('SELECT id FROM users LIMIT 1').then(async ([r]) => {
  await checkAssetAlerts(r[0].id);
  process.exit(0);
});
"
```

Expected: a mensagem chega no WhatsApp com PETR4, e `SELECT target_triggered_at FROM assets WHERE ticker='PETR4'` passa a ter data. Rodar de novo não envia nada (alerta pausado). Limpe depois com `DELETE FROM assets WHERE ticker='PETR4' AND avg_price = 1.00;`.

Se estiver testando fora do horário de pregão, o ativo será pulado com a mensagem `mercado fechado` — isso é o comportamento correto. Para testar mesmo assim, use `kind = 'crypto'` com `ticker = 'BTC'`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/assetAlertService.ts
git commit -m "feat(assets): servico de alerta de preco-alvo e stop"
```

---

## Task 5: Integração com o scheduler

**Files:**
- Modify: `backend/src/scheduler.ts`

**Interfaces:**
- Consumes: `checkAssetAlerts` de `./services/assetAlertService`.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Adicionar o import**

Em `backend/src/scheduler.ts`, junto aos demais imports de serviços (logo após a linha que importa `checkBudgetAlert`):

```ts
import { checkAssetAlerts } from './services/assetAlertService'
```

- [ ] **Step 2: Adicionar o bloco no tick**

Ainda em `backend/src/scheduler.ts`, dentro do callback do `cron.schedule`, logo após o bloco `// --- Alerta de orçamento (executa às 9h) ---` e antes do `}, { timezone: 'America/Sao_Paulo' })`:

```ts
    // --- Alerta de ativos (hora configurável por usuário, default 11h) ---
    try {
      const [assetUsers]: any = await pool.query(
        `SELECT id FROM users
          WHERE asset_alerts_enabled = 1 AND asset_alert_hour = ?
            AND whatsapp_alerts_enabled = 1 AND is_active = 1`,
        [hour]
      )
      for (const { id } of assetUsers) {
        try { await checkAssetAlerts(id) } catch (e: any) { console.error('[scheduler] asset erro:', e.message) }
      }
    } catch (e: any) { console.error('[scheduler] asset tick erro:', e.message) }
```

- [ ] **Step 3: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificar que o tick roda sem quebrar**

Temporariamente, para não esperar até as 11h, troque no seu ambiente `asset_alert_hour` para a hora atual:

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
  "UPDATE users SET asset_alert_hour = HOUR(CONVERT_TZ(NOW(),'UTC','America/Sao_Paulo'));"
```

Run: `cd backend && npm run dev` e aguarde a virada da hora, ou confirme pelo menos que o startup imprime `[scheduler] cron horário registrado`.
Expected: sem exceção no tick. Depois volte com `UPDATE users SET asset_alert_hour = 11;`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scheduler.ts
git commit -m "feat(assets): dispara alerta de ativos no tick horario"
```

---

## Task 6: Rotas REST

**Files:**
- Create: `backend/src/routes/assets.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `pool` de `../db`; `fetchQuote`, `validateTicker` de `../services/brapi`; `investedValue`, `currentValue`, `profitLoss`, `profitLossPct`, `AssetKind` de `../services/assetMath`.
- Produces: endpoints REST consumidos por `src/api/assets.ts` (Task 7). O JSON de `GET /api/assets` é o contrato do tipo `AssetWithQuote`.

- [ ] **Step 1: Criar o router**

Criar `backend/src/routes/assets.ts`:

```ts
import { Router, Request, Response } from 'express'
import pool from '../db'
import { fetchQuote, validateTicker } from '../services/brapi'
import {
  AssetKind,
  investedValue,
  currentValue,
  profitLoss,
  profitLossPct,
} from '../services/assetMath'

const router = Router()

const KINDS: AssetKind[] = ['stock', 'fii', 'crypto']

// Valida e normaliza os campos numéricos vindos do corpo da requisição.
// Devolve a mensagem de erro quando algo é inválido, ou null quando está tudo certo.
function validarCampos(body: any): string | null {
  if (body.quantity !== undefined && (isNaN(Number(body.quantity)) || Number(body.quantity) < 0)) {
    return 'quantidade deve ser um número maior ou igual a zero'
  }
  if (body.avg_price !== undefined && (isNaN(Number(body.avg_price)) || Number(body.avg_price) < 0)) {
    return 'preço médio deve ser um número maior ou igual a zero'
  }
  for (const campo of ['target_price', 'stop_price'] as const) {
    const valor = body[campo]
    if (valor !== undefined && valor !== null && (isNaN(Number(valor)) || Number(valor) <= 0)) {
      return `${campo === 'target_price' ? 'preço-alvo' : 'stop'} deve ser um número maior que zero`
    }
  }
  return null
}

// GET /api/assets — lista com cotação e resultado calculado
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE user_id = ? ORDER BY ticker ASC',
      [req.userId]
    )

    const comCotacao = await Promise.all(
      rows.map(async (a: any) => {
        const quote = await fetchQuote(a.ticker, a.kind)
        const quantity = Number(a.quantity)
        const avgPrice = Number(a.avg_price)
        const price = quote ? quote.price : (a.last_price === null ? null : Number(a.last_price))

        return {
          ...a,
          quantity,
          avg_price: avgPrice,
          target_price: a.target_price === null ? null : Number(a.target_price),
          stop_price: a.stop_price === null ? null : Number(a.stop_price),
          short_name: quote?.shortName ?? a.ticker,
          current_price: price,
          quote_stale: !quote,
          invested_value: investedValue(quantity, avgPrice),
          current_value: price === null ? null : currentValue(quantity, price),
          profit_loss: price === null ? null : profitLoss(quantity, avgPrice, price),
          profit_loss_pct: price === null ? null : profitLossPct(avgPrice, price),
        }
      })
    )

    res.json(comCotacao)
  } catch (err: any) {
    console.error('[assets] erro no GET /:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/assets
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      ticker, kind = 'stock', quantity = 0, avg_price = 0,
      target_price = null, stop_price = null,
    } = req.body

    if (!ticker || typeof ticker !== 'string' || !ticker.trim()) {
      return res.status(400).json({ error: 'ticker é obrigatório' })
    }
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: `tipo inválido — use um de: ${KINDS.join(', ')}` })
    }
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ error: erro })

    const symbol = ticker.trim().toUpperCase()

    const [existente]: any = await pool.query(
      'SELECT id FROM assets WHERE user_id = ? AND ticker = ?',
      [req.userId, symbol]
    )
    if (existente.length) {
      return res.status(409).json({ error: `${symbol} já está na sua carteira` })
    }

    if (!(await validateTicker(symbol, kind))) {
      return res.status(422).json({ error: `não encontrei cotação para ${symbol}` })
    }

    await pool.query(
      `INSERT INTO assets (user_id, ticker, kind, quantity, avg_price, target_price, stop_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, symbol, kind, Number(quantity), Number(avg_price),
       target_price === null ? null : Number(target_price),
       stop_price === null ? null : Number(stop_price)]
    )

    const [criado]: any = await pool.query(
      'SELECT * FROM assets WHERE user_id = ? AND ticker = ?',
      [req.userId, symbol]
    )
    res.status(201).json(criado[0])
  } catch (err: any) {
    console.error('[assets] erro no POST /:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/assets/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ error: erro })

    const campos: string[] = []
    const valores: any[] = []

    for (const campo of ['quantity', 'avg_price', 'target_price', 'stop_price'] as const) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`)
        valores.push(req.body[campo] === null ? null : Number(req.body[campo]))
      }
    }
    if (req.body.is_active !== undefined) {
      campos.push('is_active = ?')
      valores.push(req.body.is_active ? 1 : 0)
    }

    if (!campos.length) return res.status(400).json({ error: 'nenhum campo para atualizar' })

    valores.push(req.params.id, req.userId)
    const [result]: any = await pool.query(
      `UPDATE assets SET ${campos.join(', ')} WHERE id = ? AND user_id = ?`,
      valores
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })

    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error('[assets] erro no PATCH /:id:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/assets/:id/rearm — reativa os alertas pausados
router.post('/:id/rearm', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      `UPDATE assets SET target_triggered_at = NULL, stop_triggered_at = NULL
        WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })

    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error('[assets] erro no POST /:id/rearm:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/assets/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      'DELETE FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })
    res.status(204).send()
  } catch (err: any) {
    console.error('[assets] erro no DELETE /:id:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
```

- [ ] **Step 2: Montar o router**

Em `backend/src/index.ts`, junto aos demais imports de rotas (após `import analyticsRouter from './routes/analytics'`):

```ts
import assetsRouter from './routes/assets'
```

E junto às demais montagens, após a linha `app.use('/api/analytics', analyticsRouter)`:

```ts
app.use('/api/assets', assetsRouter)
```

- [ ] **Step 3: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Exercitar os endpoints**

Com o backend rodando e um JWT válido em `$TOKEN` (copie do `localStorage.billsync_token` no navegador):

```bash
# criar
curl -s -X POST localhost:4000/api/assets -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"petr4","kind":"stock","quantity":100,"avg_price":35,"target_price":42}'

# ticker inexistente -> 422
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:4000/api/assets \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ticker":"XPTO99","kind":"stock"}'

# duplicado -> 409
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:4000/api/assets \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ticker":"PETR4","kind":"stock"}'

# listar
curl -s localhost:4000/api/assets -H "Authorization: Bearer $TOKEN"
```

Expected: o POST devolve 201 com `ticker` gravado como `PETR4` (maiúsculas); os dois casos de erro devolvem `422` e `409`; o GET traz `current_price`, `invested_value`, `profit_loss` e `profit_loss_pct` preenchidos.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/assets.ts backend/src/index.ts
git commit -m "feat(assets): API REST de carteira de ativos"
```

---

## Task 7: Tipos e client HTTP no frontend

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/assets.ts`

**Interfaces:**
- Consumes: o JSON de `GET /api/assets` definido na Task 6.
- Produces: `assetsApi` e os tipos `Asset`, `AssetKind`, `AssetWithQuote`, consumidos pela página da Task 8.

- [ ] **Step 1: Adicionar os tipos**

Ao final de `src/types/index.ts`:

```ts
export type AssetKind = 'stock' | 'fii' | 'crypto'

export interface Asset {
  id: string
  user_id: string
  ticker: string
  kind: AssetKind
  quantity: number
  avg_price: number
  target_price: number | null
  stop_price: number | null
  target_triggered_at: string | null
  stop_triggered_at: string | null
  last_price: number | null
  last_quote_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssetWithQuote extends Asset {
  short_name: string
  current_price: number | null
  quote_stale: boolean
  invested_value: number
  current_value: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}
```

- [ ] **Step 2: Criar o client**

Criar `src/api/assets.ts`:

```ts
import client from './client'
import type { Asset, AssetKind, AssetWithQuote } from '../types'

export interface CreateAssetPayload {
  ticker: string
  kind: AssetKind
  quantity?: number
  avg_price?: number
  target_price?: number | null
  stop_price?: number | null
}

export interface UpdateAssetPayload extends Partial<Omit<CreateAssetPayload, 'ticker' | 'kind'>> {
  is_active?: boolean
}

export const assetsApi = {
  list: async (): Promise<AssetWithQuote[]> => {
    const res = await client.get<AssetWithQuote[]>('/assets')
    return res.data
  },

  create: async (payload: CreateAssetPayload): Promise<Asset> => {
    const res = await client.post<Asset>('/assets', payload)
    return res.data
  },

  update: async (id: string, payload: UpdateAssetPayload): Promise<Asset> => {
    const res = await client.patch<Asset>(`/assets/${id}`, payload)
    return res.data
  },

  rearm: async (id: string): Promise<Asset> => {
    const res = await client.post<Asset>(`/assets/${id}/rearm`)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/assets/${id}`)
  },
}
```

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/assets.ts
git commit -m "feat(assets): tipos e client HTTP da carteira no frontend"
```

---

## Task 8: Página de Ativos e navegação

**Files:**
- Create: `src/pages/Ativos.tsx`
- Modify: `src/App.tsx`, `src/components/Layout/Sidebar.tsx`, `src/components/Layout/Layout.tsx`, `src/components/Layout/Header.tsx`

**Interfaces:**
- Consumes: `assetsApi` e os tipos da Task 7; `useToast` de `../context/ToastContext`.
- Produces: rota `/ativos`.

**Nota de touch target:** a `BottomNav` em `Layout.tsx` distribui os itens com `flex-1`. Hoje são 6 itens + Sair = 7 células. Com Ativos passam a 8, o que em uma tela de 360px dá ~45px por célula — abaixo do mínimo de 48px exigido pelo `design-system/billsync/MASTER.md`. O Step 4 resolve isso tornando a barra rolável horizontalmente com largura mínima por célula, o que preserva todos os itens sem espremer nenhum.

- [ ] **Step 1: Criar a página**

Criar `src/pages/Ativos.tsx`:

```tsx
import React, { useEffect, useState } from 'react'
import { assetsApi, CreateAssetPayload } from '../api/assets'
import type { AssetKind, AssetWithQuote } from '../types'
import { useToast } from '../context/ToastContext'

const KIND_LABELS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const FORM_INICIAL: CreateAssetPayload = {
  ticker: '', kind: 'stock', quantity: 0, avg_price: 0, target_price: null, stop_price: null,
}

const Ativos: React.FC = () => {
  const { showToast } = useToast()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CreateAssetPayload>(FORM_INICIAL)

  const carregar = async () => {
    setCarregando(true)
    try {
      setAtivos(await assetsApi.list())
    } catch {
      showToast('Não consegui carregar seus ativos', 'error')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await assetsApi.create({
        ...form,
        target_price: form.target_price || null,
        stop_price: form.stop_price || null,
      })
      showToast(`${form.ticker.toUpperCase()} adicionado à carteira`, 'success')
      setForm(FORM_INICIAL)
      setFormAberto(false)
      carregar()
    } catch (err: any) {
      showToast(err.response?.data?.error ?? 'Não consegui salvar o ativo', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const reativar = async (id: string, ticker: string) => {
    try {
      await assetsApi.rearm(id)
      showToast(`Alertas de ${ticker} reativados`, 'success')
      carregar()
    } catch {
      showToast('Não consegui reativar os alertas', 'error')
    }
  }

  const remover = async (id: string, ticker: string) => {
    if (!confirm(`Remover ${ticker} da carteira?`)) return
    try {
      await assetsApi.delete(id)
      showToast(`${ticker} removido`, 'success')
      carregar()
    } catch {
      showToast('Não consegui remover o ativo', 'error')
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          {ativos.length === 0
            ? 'Nenhum ativo na carteira'
            : `${ativos.length} ativo${ativos.length > 1 ? 's' : ''} monitorado${ativos.length > 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setFormAberto((v) => !v)}
          className="flex items-center gap-1.5 px-4 min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[20px]">{formAberto ? 'close' : 'add'}</span>
          {formAberto ? 'Cancelar' : 'Novo ativo'}
        </button>
      </div>

      {formAberto && (
        <form onSubmit={salvar} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Ticker
              <input
                required
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="PETR4"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Tipo
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              >
                <option value="stock">Ação</option>
                <option value="fii">FII</option>
                <option value="crypto">Cripto</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Quantidade
              <input
                type="number" step="any" min="0"
                value={form.quantity ?? 0}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Preço médio pago (R$)
              <input
                type="number" step="any" min="0"
                value={form.avg_price ?? 0}
                onChange={(e) => setForm({ ...form, avg_price: Number(e.target.value) })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Preço-alvo de venda (R$)
              <input
                type="number" step="any" min="0"
                value={form.target_price ?? ''}
                onChange={(e) => setForm({ ...form, target_price: e.target.value ? Number(e.target.value) : null })}
                placeholder="opcional"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Stop (R$)
              <input
                type="number" step="any" min="0"
                value={form.stop_price ?? ''}
                onChange={(e) => setForm({ ...form, stop_price: e.target.value ? Number(e.target.value) : null })}
                placeholder="opcional"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Adicionar à carteira'}
          </button>
        </form>
      )}

      {ativos.length === 0 && !formAberto && (
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-8 text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant text-4xl">trending_up</span>
          <p className="text-sm font-medium text-on-surface">Sua carteira está vazia</p>
          <p className="text-xs text-on-surface-variant">
            Cadastre um ativo com preço-alvo e receba um aviso no WhatsApp quando a cotação chegar lá.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {ativos.map((a) => {
          const pausado = !!a.target_triggered_at || !!a.stop_triggered_at
          const lucro = a.profit_loss ?? 0
          const positivo = lucro >= 0
          return (
            <div key={a.id} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-on-surface">{a.ticker}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                      {KIND_LABELS[a.kind]}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">{a.short_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-on-surface">
                    {a.current_price === null ? '—' : `R$ ${brl(a.current_price)}`}
                  </p>
                  {a.quote_stale && (
                    <p className="text-[10px] text-on-surface-variant">cotação indisponível</p>
                  )}
                </div>
              </div>

              {a.quantity > 0 && a.profit_loss !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">
                    {a.quantity} un. · pago R$ {brl(a.avg_price)}
                  </span>
                  <span className={`font-semibold ${positivo ? 'text-green-600' : 'text-error'}`}>
                    {positivo ? '+' : '-'}R$ {brl(Math.abs(lucro))} ({positivo ? '+' : '-'}
                    {Math.abs(a.profit_loss_pct ?? 0).toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
                {a.target_price !== null && <span>🎯 alvo R$ {brl(a.target_price)}</span>}
                {a.stop_price !== null && <span>🛑 stop R$ {brl(a.stop_price)}</span>}
              </div>

              {pausado && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2">
                  <span className="text-xs text-on-surface">
                    {a.target_triggered_at ? 'Alvo atingido' : 'Stop atingido'} — alertas pausados
                  </span>
                  <button
                    onClick={() => reativar(a.id, a.ticker)}
                    className="text-xs font-medium text-primary px-3 min-h-[48px]"
                  >
                    Reativar
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => remover(a.id, a.ticker)}
                  className="flex items-center gap-1 text-xs text-error px-3 min-h-[48px]"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Remover
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Ativos
```

Se a assinatura de `useToast` no projeto não for `showToast(mensagem, tipo)`, ajuste as chamadas para a assinatura real — confira em `src/context/ToastContext.tsx` antes de rodar.

- [ ] **Step 2: Registrar a rota**

Em `src/App.tsx`, junto aos demais imports de páginas:

```tsx
import Ativos from './pages/Ativos'
```

E dentro do bloco `<Route element={<Layout />}>`, logo após a linha da rota `/analise`:

```tsx
<Route path="/ativos" element={<Ativos />} />
```

- [ ] **Step 3: Adicionar ao menu**

Em `src/components/Layout/Sidebar.tsx`, no array `navItems`, entre o item de Análise e o de Checklists:

```ts
  { path: '/ativos', label: 'Ativos', icon: 'trending_up' },
```

Em `src/components/Layout/Header.tsx`, no objeto `pageTitles`:

```ts
  '/ativos': 'Meus Ativos',
```

- [ ] **Step 4: Tornar a bottom nav rolável**

Em `src/components/Layout/Layout.tsx`, no `<nav>` do `BottomNav`, troque a lista de classes:

```tsx
className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-outline-variant/50 flex items-stretch overflow-x-auto"
```

E em cada célula (o `NavLink` e o `<button>` de Sair), troque `flex-1` por `flex-1 min-w-[64px] shrink-0` para que nenhuma célula fique abaixo do alvo de toque mínimo:

```tsx
// no NavLink:
`flex-1 min-w-[64px] shrink-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition-colors min-h-[56px] ${
  isActive ? 'text-primary' : 'text-on-surface-variant'
}`

// no button de Sair:
className="flex-1 min-w-[64px] shrink-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium text-error min-h-[56px]"
```

- [ ] **Step 5: Compilar e conferir no navegador**

Run: `npx tsc --noEmit && npm run dev`
Expected: compila sem erros. Em `http://localhost:5173/ativos`: o estado vazio aparece; cadastrar PETR4 com quantidade 100, preço médio 35 e alvo 42 mostra o card com cotação e o resultado colorido; um ticker inválido mostra o toast de erro vindo do backend. Em viewport de 360px, a barra inferior rola horizontalmente e cada item mantém pelo menos 64px de largura.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Ativos.tsx src/App.tsx src/components/Layout/Sidebar.tsx src/components/Layout/Layout.tsx src/components/Layout/Header.tsx
git commit -m "feat(assets): pagina de carteira de ativos e entrada no menu"
```

---

## Task 9: Preferências de alerta em Configurações

**Files:**
- Modify: `src/pages/Configuracoes.tsx`, `backend/src/routes/users.ts`

**Interfaces:**
- Consumes: o endpoint de atualização de preferências já existente em `routes/users.ts`.
- Produces: controle de `asset_alerts_enabled` e `asset_alert_hour`.

- [ ] **Step 1: Permitir os dois campos no PATCH**

Em `backend/src/routes/users.ts`, dentro de `router.patch('/me', ...)`, no array `allowed`, acrescente os dois campos logo após `'monthly_summary_enabled',`:

```ts
      'asset_alerts_enabled', 'asset_alert_hour',
```

`asset_alerts_enabled` é booleano e cai no tratamento genérico do laço, como `whatsapp_alerts_enabled`. `asset_alert_hour` precisa de validação de faixa: acrescente este bloco logo após o bloco `if (key === 'notification_time') { ... }`, seguindo exatamente a mesma forma:

```ts
      if (key === 'asset_alert_hour') {
        const h = Number(req.body[key])
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          return res.status(400).json({ error: 'asset_alert_hour deve ser um inteiro entre 0 e 23' })
        }
        fields.push(`${key} = ?`)
        values.push(h)
        continue
      }
```

- [ ] **Step 2: Conferir que o GET devolve os campos**

Run: `grep -n "SELECT" backend/src/routes/users.ts | head -5`

Se o handler `GET /me` usa `SELECT *`, os campos novos já vêm juntos e não há nada a fazer. Se ele lista colunas explicitamente, acrescente `asset_alerts_enabled` e `asset_alert_hour` a essa lista.

- [ ] **Step 3: Adicionar os controles na tela**

Em `src/pages/Configuracoes.tsx`, localize o controle de `notification_time`:

Run: `grep -n "notification_time" src/pages/Configuracoes.tsx`

Na mesma seção de alertas de WhatsApp, replique a estrutura visual daquele controle para os dois campos novos: um toggle rotulado `Alertas de ativos` ligado a `asset_alerts_enabled`, e um `<select>` de hora (0 a 23, default 11) rotulado `Horário do alerta de ativos` ligado a `asset_alert_hour`. Use os mesmos componentes, classes e handler de salvamento que o controle vizinho já usa — não introduza um mecanismo próprio de estado ou de submit.

Texto de apoio abaixo do seletor:

```
Você recebe um aviso quando algum ativo atingir o preço-alvo ou o stop.
```

- [ ] **Step 4: Compilar e conferir**

Run: `npx tsc --noEmit && cd backend && npx tsc --noEmit`
Expected: sem erros nos dois.

Em `http://localhost:5173/configuracoes`: alterar a hora para 14 e recarregar a página mantém 14. Confirme no banco:

Run: `mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT asset_alerts_enabled, asset_alert_hour FROM users;"`
Expected: reflete o que foi salvo na tela. Devolva para 11 depois.

Confirme também a validação de faixa:

Run: `curl -s -o /dev/null -w '%{http_code}\n' -X PATCH localhost:4000/api/users/me -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"asset_alert_hour":25}'`
Expected: `400`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Configuracoes.tsx backend/src/routes/users.ts
git commit -m "feat(assets): preferencias de alerta de ativos em configuracoes"
```

---

## Task 10: Documentação

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Documentar o módulo**

Em `CLAUDE.md`, na seção `### Environment`, acrescente à lista de variáveis:

```
- `BRAPI_TOKEN` — token gratuito da [brapi.dev](https://brapi.dev) para cotação de ativos. Sem ele, apenas PETR4, MGLU3, VALE3 e ITUB4 respondem. Plano gratuito: 15.000 req/mês, 1 ticker por requisição.
```

Na seção `### Backend (backend/src/)`, na lista de `services/`, acrescente:
`brapi.ts` (cliente de cotações com cache de 10 min), `assetAlertService.ts` (alerta de preço-alvo e stop), `assetMath.ts` (cálculos puros de posição).

Na seção `### Database`, acrescente `assets` à lista de tabelas.

Na seção `## Key conventions`, acrescente:

```
- Alertas de ativos rodam no tick horário conforme `users.asset_alert_hour` (default 11). Disparam uma vez e pausam (`target_triggered_at` / `stop_triggered_at`), até serem reativados no app.
- Ações e FIIs são pulados quando a cotação não é do dia corrente (fim de semana e feriado); cripto roda todo dia.
```

- [ ] **Step 2: Corrigir a nota sobre testes**

Ainda em `CLAUDE.md`, substitua a linha `- No test suite currently exists in this repo.` por:

```
- Testes com jest + ts-jest em `backend/src/services/__tests__/`, cobrindo funções puras sem banco nem rede. Rodar com `cd backend && npm test`.
```

- [ ] **Step 3: Rodar a suíte inteira**

Run: `cd backend && npm test`
Expected: todos os arquivos de teste passam, incluindo `assetMath.test.ts` e `brapi.test.ts`.

- [ ] **Step 4: Build completo**

Run: `npm run build && cd backend && npm run build`
Expected: os dois builds terminam sem erro.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta o modulo de ativos e a suite de testes existente"
```
