# Reestruturação da tela de Análise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/analise` numa tela de métricas aprofundadas com duas abas (Financeiro e Checklist), movendo o dashboard de checklist (heatmap/ranking) de `/checklists` para lá e adicionando orçamento, histórico e top contas ao lado financeiro.

**Architecture:** 3 novas rotas de leitura no backend (`/analytics/budget`, `/analytics/history`, `/analytics/top-occurrences`) reaproveitando o padrão já existente em `financialAnalytics.ts`/`routes/analytics.ts`. No frontend, `Analise.tsx` vira uma página com abas — a aba Financeiro busca 5 blocos em paralelo (`Promise.allSettled`), a aba Checklist reaproveita componentes já existentes de `components/checklist/`. `Checklists.tsx` perde as seções que migraram, mantendo só gestão + progresso de hoje.

**Tech Stack:** Express + MySQL2 (backend), React + TypeScript + Recharts + Tailwind (frontend). Sem framework de teste E2E; funções de serviço que tocam o banco (como as irmãs `gastosPorCategoria`/`projecaoMensal`/`fechamentoMensal` já existentes) não têm teste unitário no repo — verificação é manual via curl/browser. Funções puras (sem I/O) usariam Jest (já configurado no backend, ver `backend/src/services/__tests__/`), mas nenhuma função pura nova é introduzida aqui.

## Global Constraints

- Todo código, comentário e mensagem de log em **português (pt-BR)** (CLAUDE.md).
- Nenhuma mudança em `gastosPorCategoria`, `projecaoMensal` ou `fechamentoMensal` já existentes — só reaproveitadas.
- `monthly_budget_limit` pode ser `null` — o card de orçamento precisa tratar esse caso sem dividir por zero nem quebrar.
- Datas de `bill_occurrences.due_date` voltam do MySQL2 como `Date` — sempre normalizar para string `YYYY-MM-DD` antes de devolver no JSON (padrão já usado em `backend/src/routes/occurrences.ts:152-154`).
- Reaproveitar componentes/estilos existentes (`glass-card`, `StatCard`, `ProgressBar`, `ChecklistHeatmap`, `ChecklistItemRanking`, `categoryColor`/`categoryLabel`, `formatBRL`, `formatDate`, `getBillIcon`) — não recriar.

---

## Task 1: Backend — histórico mensal (últimos N meses, incluindo o atual)

**Files:**
- Modify: `backend/src/services/financialAnalytics.ts`
- Modify: `backend/src/routes/analytics.ts`

**Interfaces:**
- Consumes: `pool` de `backend/src/db.ts` (já importado em `financialAnalytics.ts`); `MesProjecao` interface já existente no mesmo arquivo.
- Produces: `historicoMensal(userId: string, meses: number): Promise<MesProjecao[]>`, exportada de `financialAnalytics.ts`. Rota `GET /api/analytics/history?months=6` retornando `{ meses: Array<{ ano, mes, label, total }> }` (mesmo shape de `/api/analytics/projection`).

- [ ] **Step 1: Adicionar `historicoMensal` em `financialAnalytics.ts`**

Adicione logo após a função `projecaoMensal` (depois da linha 81, antes de `fechamentoMensal`):

```ts
// Soma das ocorrências por mês para os últimos N meses, incluindo o mês corrente (parcial)
export async function historicoMensal(
  userId: string,
  meses: number
): Promise<MesProjecao[]> {
  const n = Math.min(Math.max(meses, 1), 12)
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [rows]: any = await pool.query(
    `SELECT YEAR(o.due_date) AS ano, MONTH(o.due_date) AS mes, SUM(o.amount) AS total
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      GROUP BY YEAR(o.due_date), MONTH(o.due_date)
      ORDER BY ano, mes`,
    [userId, toStr(first), toStr(last)]
  )

  const mapa = new Map<string, number>()
  for (const r of rows) mapa.set(`${r.ano}-${r.mes}`, Number(r.total) || 0)

  const resultado: MesProjecao[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    resultado.push({ ano, mes, total: mapa.get(`${ano}-${mes}`) ?? 0 })
  }
  return resultado
}
```

- [ ] **Step 2: Adicionar rota `GET /history` em `routes/analytics.ts`**

Importe `historicoMensal` na linha 2 (junto com os outros imports):

```ts
import { gastosPorCategoria, projecaoMensal, historicoMensal, fechamentoMensal } from '../services/financialAnalytics'
```

(Já deixamos `fechamentoMensal` importado aqui pois o Task 3 também precisa dele — se este task rodar antes do 3, o import de `fechamentoMensal` fica sem uso até lá, o que é aceitável neste plano incremental.)

Adicione a rota logo após o bloco de `/projection` (antes do `export default router`):

```ts
// GET /api/analytics/history?months=6
router.get('/history', async (req: Request, res: Response) => {
  try {
    const months = Number(req.query.months) || 6
    const dados = await historicoMensal(req.userId!, months)
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const meses = dados.map((d) => ({
      ano: d.ano,
      mes: d.mes,
      label: `${nomes[d.mes - 1]}/${d.ano}`,
      total: d.total,
    }))
    res.json({ meses })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Step 3: Type-check o backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros (o import não usado de `fechamentoMensal` não gera erro de compilação em TS por padrão neste projeto — confirme rodando o comando; se `noUnusedLocals` estiver ativo no `tsconfig.json` e o comando falhar por isso, mova o import de `fechamentoMensal` para o Task 3 em vez de adiantá-lo aqui).

- [ ] **Step 4: Verificar manualmente com curl**

Com o backend rodando (`cd backend && npm run dev`) e `DEV_OTP_BYPASS=true` no `.env`:

```bash
curl -s -X POST http://localhost:4000/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"11999999999"}'
# olhe o log do backend: "[dev-otp] phone=11999999999 code=XXXXXX"

curl -s -X POST http://localhost:4000/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"11999999999","code":"XXXXXX"}'
# copie o campo "token" da resposta
TOKEN="<cole o token aqui>"

curl -s http://localhost:4000/api/analytics/history?months=6 \
  -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200 com `{"meses":[...]}`, 6 itens, cada um com `ano`, `mes`, `label` (ex: `"Fev/2026"`) e `total` (número).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/financialAnalytics.ts backend/src/routes/analytics.ts
git commit -m "feat(analytics): adiciona historicoMensal e rota GET /analytics/history"
```

---

## Task 2: Backend — top ocorrências por valor no período

**Files:**
- Modify: `backend/src/services/financialAnalytics.ts`
- Modify: `backend/src/routes/analytics.ts`

**Interfaces:**
- Consumes: `pool` já importado em `financialAnalytics.ts`.
- Produces: interface `OcorrenciaTop` e função `topOcorrencias(userId: string, from: string, to: string, limit: number): Promise<OcorrenciaTop[]>`, exportadas de `financialAnalytics.ts`. Rota `GET /api/analytics/top-occurrences?from=&to=&limit=5` retornando `{ ocorrencias: OcorrenciaTop[] }`.

- [ ] **Step 1: Adicionar `OcorrenciaTop` e `topOcorrencias` em `financialAnalytics.ts`**

Adicione no final do arquivo, depois de `fechamentoMensal`:

```ts
export interface OcorrenciaTop {
  id: string
  bill_id: string
  bill_name: string
  category: string
  amount: number
  due_date: string
}

// Maiores ocorrências (contas) por valor num intervalo [from, to]
export async function topOcorrencias(
  userId: string,
  from: string,
  to: string,
  limit: number
): Promise<OcorrenciaTop[]> {
  const lim = Math.min(Math.max(limit, 1), 20)
  const [rows]: any = await pool.query(
    `SELECT o.id, o.bill_id, b.name AS bill_name, COALESCE(b.category, 'outro') AS category,
            o.amount, o.due_date
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      ORDER BY o.amount DESC
      LIMIT ?`,
    [userId, from, to, lim]
  )
  return rows.map((r: any) => ({
    id: r.id,
    bill_id: r.bill_id,
    bill_name: r.bill_name,
    category: r.category,
    amount: Number(r.amount) || 0,
    due_date: r.due_date instanceof Date
      ? r.due_date.toISOString().slice(0, 10)
      : String(r.due_date).slice(0, 10),
  }))
}
```

- [ ] **Step 2: Adicionar rota `GET /top-occurrences` em `routes/analytics.ts`**

Atualize o import do topo do arquivo para incluir `topOcorrencias`:

```ts
import { gastosPorCategoria, projecaoMensal, historicoMensal, fechamentoMensal, topOcorrencias } from '../services/financialAnalytics'
```

Adicione a rota (antes do `export default router`):

```ts
// GET /api/analytics/top-occurrences?from=&to=&limit=5
router.get('/top-occurrences', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string }
    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' })
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)
    const ocorrencias = await topOcorrencias(req.userId!, from, to, limit)
    res.json({ ocorrencias })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Step 3: Type-check o backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente com curl**

Reaproveite o `$TOKEN` do Task 1 (ou refaça o login se expirou):

```bash
curl -s "http://localhost:4000/api/analytics/top-occurrences?from=2026-07-01&to=2026-07-31&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200 com `{"ocorrencias":[...]}`, até 5 itens ordenados por `amount` decrescente, cada um com `id`, `bill_id`, `bill_name`, `category`, `amount`, `due_date` (string `YYYY-MM-DD`).

Também confirme o erro de validação:

```bash
curl -s "http://localhost:4000/api/analytics/top-occurrences" -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 400 com `{"error":"Parâmetros from e to são obrigatórios"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/financialAnalytics.ts backend/src/routes/analytics.ts
git commit -m "feat(analytics): adiciona topOcorrencias e rota GET /analytics/top-occurrences"
```

---

## Task 3: Backend — rota de orçamento do mês

**Files:**
- Modify: `backend/src/routes/analytics.ts`

**Interfaces:**
- Consumes: `fechamentoMensal(userId: string, ano: number, mes: number): Promise<FechamentoMensal>` já existente em `financialAnalytics.ts` (retorna `{ total, porCategoria, orcamento, qtdContas }`).
- Produces: rota `GET /api/analytics/budget` retornando o mesmo shape de `FechamentoMensal`, sempre para o mês corrente.

- [ ] **Step 1: Adicionar rota `GET /budget`**

O import de `fechamentoMensal` já foi adicionado no Task 1 (ou adicione agora se este task rodar isolado — confira o topo de `routes/analytics.ts`). Adicione a rota (antes do `export default router`):

```ts
// GET /api/analytics/budget — orçamento vs. gasto do mês corrente
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const dados = await fechamentoMensal(req.userId!, now.getFullYear(), now.getMonth() + 1)
    res.json(dados)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Step 2: Type-check o backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificar manualmente com curl**

```bash
curl -s http://localhost:4000/api/analytics/budget -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200 com `{"total": <number>, "porCategoria": [...], "orcamento": <number|null>, "qtdContas": <number>}`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/analytics.ts
git commit -m "feat(analytics): adiciona rota GET /analytics/budget"
```

---

## Task 4: Frontend — tipos e API client

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/analytics.ts`

**Interfaces:**
- Consumes: nenhum (tipos base).
- Produces: tipos `BudgetResponse`, `OcorrenciaTop`, `TopOccurrencesResponse` em `src/types/index.ts`; métodos `analyticsApi.budget()`, `analyticsApi.history(months)`, `analyticsApi.topOccurrences(from, to, limit)` em `src/api/analytics.ts`.

- [ ] **Step 1: Adicionar tipos em `src/types/index.ts`**

Adicione ao final do arquivo (depois de `ProjectionResponse`):

```ts
export interface BudgetResponse {
  total: number
  orcamento: number | null
  qtdContas: number
  porCategoria: Array<{ category: string; total: number }>
}

export interface OcorrenciaTop {
  id: string
  bill_id: string
  bill_name: string
  category: string
  amount: number
  due_date: string
}

export interface TopOccurrencesResponse {
  ocorrencias: OcorrenciaTop[]
}
```

- [ ] **Step 2: Adicionar métodos em `src/api/analytics.ts`**

Substitua o conteúdo do arquivo por:

```ts
import client from './client'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, TopOccurrencesResponse } from '../types'

export const analyticsApi = {
  byCategory: async (from?: string, to?: string): Promise<ByCategoryResponse> => {
    const res = await client.get<ByCategoryResponse>('/analytics/by-category', {
      params: { from, to },
    })
    return res.data
  },

  projection: async (months = 6): Promise<ProjectionResponse> => {
    const res = await client.get<ProjectionResponse>('/analytics/projection', {
      params: { months },
    })
    return res.data
  },

  history: async (months = 6): Promise<ProjectionResponse> => {
    const res = await client.get<ProjectionResponse>('/analytics/history', {
      params: { months },
    })
    return res.data
  },

  budget: async (): Promise<BudgetResponse> => {
    const res = await client.get<BudgetResponse>('/analytics/budget')
    return res.data
  },

  topOccurrences: async (from: string, to: string, limit = 5): Promise<TopOccurrencesResponse> => {
    const res = await client.get<TopOccurrencesResponse>('/analytics/top-occurrences', {
      params: { from, to, limit },
    })
    return res.data
  },
}
```

- [ ] **Step 3: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/analytics.ts
git commit -m "feat(analytics): adiciona tipos e métodos de API para orçamento, histórico e top contas"
```

---

## Task 5: Frontend — componente `BudgetCard`

**Files:**
- Create: `src/components/analise/BudgetCard.tsx`

**Interfaces:**
- Consumes: `BudgetResponse` de `src/types/index.ts` (Task 4); `formatBRL` de `src/utils/format.ts`; `useNavigate` de `react-router-dom`.
- Produces: componente `BudgetCard: React.FC<{ data: BudgetResponse | null; loading: boolean }>`, usado pelo Task 7.

- [ ] **Step 1: Criar o componente**

```tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { BudgetResponse } from '../../types'
import { formatBRL } from '../../utils/format'

interface BudgetCardProps {
  data: BudgetResponse | null
  loading: boolean
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ data, loading }) => {
  const navigate = useNavigate()

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <h2 className="text-base font-semibold text-on-surface mb-4">Orçamento do mês</h2>
      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : !data ? (
        <p className="text-sm text-on-surface-variant">Erro ao carregar orçamento.</p>
      ) : data.orcamento === null ? (
        <div>
          <p className="text-2xl font-bold text-on-surface mb-1">{formatBRL(data.total)}</p>
          <p className="text-sm text-on-surface-variant mb-4">gastos neste mês</p>
          <button
            onClick={() => navigate('/configuracoes')}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Definir limite mensal →
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold text-on-surface">{formatBRL(data.total)}</span>
            <span className="text-sm text-on-surface-variant">de {formatBRL(data.orcamento)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-outline-variant/30 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                data.total > data.orcamento ? 'bg-error' : 'bg-primary'
              }`}
              style={{
                width: `${
                  data.orcamento > 0
                    ? Math.min((data.total / data.orcamento) * 100, 100)
                    : (data.total > 0 ? 100 : 0)
                }%`,
              }}
            />
          </div>
          <p className={`text-xs mt-2 ${data.total > data.orcamento ? 'text-error' : 'text-on-surface-variant'}`}>
            {data.total > data.orcamento
              ? `${formatBRL(data.total - data.orcamento)} acima do limite`
              : `${formatBRL(data.orcamento - data.total)} restantes`}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/analise/BudgetCard.tsx
git commit -m "feat(analise): adiciona componente BudgetCard"
```

---

## Task 6: Frontend — componente `TopOccurrencesList`

**Files:**
- Create: `src/components/analise/TopOccurrencesList.tsx`

**Interfaces:**
- Consumes: `OcorrenciaTop` de `src/types/index.ts` (Task 4); `formatBRL`, `formatDate`, `getBillIcon` de `src/utils/format.ts`.
- Produces: componente `TopOccurrencesList: React.FC<{ occurrences: OcorrenciaTop[]; loading: boolean }>`, usado pelo Task 7.

- [ ] **Step 1: Criar o componente**

```tsx
import React from 'react'
import type { OcorrenciaTop } from '../../types'
import { formatBRL, formatDate, getBillIcon } from '../../utils/format'

interface TopOccurrencesListProps {
  occurrences: OcorrenciaTop[]
  loading: boolean
}

export const TopOccurrencesList: React.FC<TopOccurrencesListProps> = ({ occurrences, loading }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
    <h2 className="text-base font-semibold text-on-surface mb-4">Maiores contas do mês</h2>
    {loading ? (
      <p className="text-sm text-on-surface-variant">Carregando…</p>
    ) : occurrences.length === 0 ? (
      <p className="text-sm text-on-surface-variant">Nenhuma conta neste período.</p>
    ) : (
      <ul className="space-y-3">
        {occurrences.map((o) => (
          <li key={o.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">{getBillIcon(o.bill_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">{o.bill_name}</p>
              <p className="text-xs text-on-surface-variant">{formatDate(o.due_date)}</p>
            </div>
            <span className="text-sm font-bold text-on-surface flex-shrink-0">{formatBRL(o.amount)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
```

- [ ] **Step 2: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/analise/TopOccurrencesList.tsx
git commit -m "feat(analise): adiciona componente TopOccurrencesList"
```

---

## Task 7: Frontend — `Analise.tsx` com abas e aba Financeiro completa

**Files:**
- Modify: `src/pages/Analise.tsx` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: `analyticsApi` (Task 4), `BudgetCard` (Task 5), `TopOccurrencesList` (Task 6), tipos `ByCategoryResponse`/`ProjectionResponse`/`BudgetResponse`/`OcorrenciaTop` (Task 4), `categoryColor`/`categoryLabel`, `formatBRL`, `useToast`.
- Produces: página `Analise` com estado `activeTab: 'financeiro' | 'checklist'` (default `'financeiro'`). A aba Checklist é um placeholder neste task (`renderChecklistTab()` retorna uma mensagem simples) — implementada de fato no Task 8, que assume esse nome de função.

- [ ] **Step 1: Reescrever `src/pages/Analise.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, OcorrenciaTop } from '../types'
import { categoryColor, categoryLabel } from '../utils/categoryColors'
import { formatBRL } from '../utils/format'
import { useToast } from '../context/ToastContext'
import { BudgetCard } from '../components/analise/BudgetCard'
import { TopOccurrencesList } from '../components/analise/TopOccurrencesList'

type AnaliseTab = 'financeiro' | 'checklist'

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const Analise: React.FC = () => {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<AnaliseTab>('financeiro')

  // --- Aba Financeiro ---
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [topOcc, setTopOcc] = useState<OcorrenciaTop[]>([])
  const [history, setHistory] = useState<ProjectionResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true)
  const [financeiroLoaded, setFinanceiroLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'financeiro' || financeiroLoaded) return
    let active = true
    setLoadingFinanceiro(true)
    const { from, to } = mesAtualRange()
    Promise.allSettled([
      analyticsApi.byCategory(from, to),
      analyticsApi.budget(),
      analyticsApi.topOccurrences(from, to, 5),
      analyticsApi.history(6),
      analyticsApi.projection(6),
    ]).then(([catR, budR, topR, histR, projR]) => {
      if (!active) return
      if (catR.status === 'fulfilled') setByCat(catR.value)
      if (budR.status === 'fulfilled') setBudget(budR.value)
      if (topR.status === 'fulfilled') setTopOcc(topR.value.ocorrencias)
      if (histR.status === 'fulfilled') setHistory(histR.value)
      if (projR.status === 'fulfilled') setProjection(projR.value)
      const anyFailed = [catR, budR, topR, histR, projR].some((r) => r.status === 'rejected')
      if (anyFailed) showToast('Alguns dados financeiros não puderam ser carregados', 'error')
      setLoadingFinanceiro(false)
      setFinanceiroLoaded(true)
    })
    return () => { active = false }
  }, [activeTab, financeiroLoaded, showToast])

  const pieData = (byCat?.categorias ?? []).map((c) => ({
    name: categoryLabel(c.category),
    value: c.total,
    color: categoryColor(c.category),
    pct: c.pct,
  }))

  const historyData = (history?.meses ?? []).map((m, i, arr) => ({
    label: i === arr.length - 1 ? `${m.label} (parcial)` : m.label,
    total: m.total,
    isCurrent: i === arr.length - 1,
  }))

  const projectionData = (projection?.meses ?? []).map((m) => ({ label: m.label, total: m.total }))

  const renderFinanceiroTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BudgetCard data={budget} loading={loadingFinanceiro} />
        <TopOccurrencesList occurrences={topOcc} loading={loadingFinanceiro} />
      </div>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-4">Gastos por categoria (mês atual)</h2>
        {loadingFinanceiro ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : pieData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhuma conta neste período.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:w-1/2 space-y-2">
              {pieData.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-on-surface">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-on-surface-variant">{formatBRL(d.value)} · {d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-1">Histórico (últimos 6 meses)</h2>
        <p className="text-xs text-on-surface-variant mb-4">O último mês está em andamento (parcial).</p>
        {loadingFinanceiro ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : historyData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sem dados de histórico.</p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {historyData.map((d, i) => (
                    <Cell key={i} fill={d.isCurrent ? '#6750A466' : '#6750A4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-1">Projeção dos próximos meses</h2>
        {projection?.meses?.[1] && (
          <p className="text-sm text-on-surface-variant mb-4">
            Você vai gastar ~{formatBRL(projection.meses[1].total)} em {projection.meses[1].label}.
          </p>
        )}
        {loadingFinanceiro ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : projectionData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sem dados de projeção.</p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                <Bar dataKey="total" fill="#6750A4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )

  const renderChecklistTab = () => (
    <p className="text-sm text-on-surface-variant">Em breve.</p>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">Análise</h1>
        <p className="text-sm text-on-surface-variant">Métricas aprofundadas de contas e checklist.</p>
      </header>

      <div className="flex gap-2">
        {(['financeiro', 'checklist'] as AnaliseTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {t === 'financeiro' ? 'Financeiro' : 'Checklist'}
          </button>
        ))}
      </div>

      {activeTab === 'financeiro' ? renderFinanceiroTab() : renderChecklistTab()}
    </div>
  )
}

export default Analise
```

- [ ] **Step 2: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificar no browser**

Com backend (`cd backend && npm run dev`) e frontend (`npm run dev`) rodando, faça login (OTP via bypass) e navegue para `/analise`. Confirme:
- A aba "Financeiro" vem selecionada por padrão.
- Os 5 blocos aparecem na ordem: Orçamento + Top Contas (lado a lado), Categoria, Histórico, Projeção.
- Clicar em "Checklist" mostra "Em breve." sem erros no console.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Analise.tsx
git commit -m "feat(analise): reestrutura aba Financeiro com orçamento, top contas e histórico"
```

---

## Task 8: Frontend — aba Checklist em `Analise.tsx`

**Files:**
- Modify: `src/pages/Analise.tsx`

**Interfaces:**
- Consumes: `checklistsApi.get()`, `checklistsApi.dashboard(checklistId?)`, `checklistsApi.stats()` de `src/api/checklists.ts`; tipos `Checklist`, `ChecklistDashboardData`, `ChecklistStatsEntry` de `src/types/index.ts`; componentes `StatCard`, `ChecklistHeatmap`, `ChecklistItemRanking` de `src/components/checklist/`; `useNavigate` de `react-router-dom`.
- Produces: `renderChecklistTab()` totalmente funcional (substitui o placeholder do Task 7).

- [ ] **Step 1: Adicionar imports**

No topo de `src/pages/Analise.tsx`, adicione:

```ts
import { useNavigate } from 'react-router-dom'
import { checklistsApi } from '../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistStatsEntry } from '../types'
import { StatCard } from '../components/checklist/StatCard'
import { ChecklistHeatmap } from '../components/checklist/ChecklistHeatmap'
import { ChecklistItemRanking } from '../components/checklist/ChecklistItemRanking'
```

(Combine com a linha `import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, OcorrenciaTop } from '../types'` já existente do Task 7, ou deixe como import separado — ambos funcionam em TS.)

- [ ] **Step 2: Adicionar estado e efeito de fetch da aba Checklist**

Dentro do componente `Analise`, logo após os estados da aba Financeiro (Task 7), adicione:

```tsx
  const navigate = useNavigate()

  // --- Aba Checklist ---
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [checklistDashboard, setChecklistDashboard] = useState<ChecklistDashboardData | null>(null)
  const [checklistStats, setChecklistStats] = useState<ChecklistStatsEntry[]>([])
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
  const [loadingChecklist, setLoadingChecklist] = useState(true)
  const [checklistLoaded, setChecklistLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'checklist' || checklistLoaded) return
    let active = true
    setLoadingChecklist(true)
    Promise.all([checklistsApi.get(), checklistsApi.dashboard(), checklistsApi.stats()])
      .then(([list, dash, stats]) => {
        if (!active) return
        setChecklists(list)
        setChecklistDashboard(dash)
        setChecklistStats(stats)
        if (dash.checklist) setSelectedChecklistId(dash.checklist.id)
      })
      .catch(() => { if (active) showToast('Erro ao carregar dados do checklist', 'error') })
      .finally(() => { if (active) { setLoadingChecklist(false); setChecklistLoaded(true) } })
    return () => { active = false }
  }, [activeTab, checklistLoaded, showToast])

  const handleSelectChecklist = async (id: string) => {
    if (id === selectedChecklistId) return
    setSelectedChecklistId(id)
    try {
      const dash = await checklistsApi.dashboard(id)
      setChecklistDashboard(dash)
    } catch {
      showToast('Erro ao carregar dados do checklist', 'error')
    }
  }
```

- [ ] **Step 3: Substituir `renderChecklistTab` pelo conteúdo completo**

Troque a função placeholder do Task 7:

```tsx
  const renderChecklistTab = () => (
    <p className="text-sm text-on-surface-variant">Em breve.</p>
  )
```

por:

```tsx
  const renderChecklistTab = () => {
    if (loadingChecklist) {
      return <p className="text-sm text-on-surface-variant">Carregando…</p>
    }
    if (checklists.length === 0) {
      return (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">checklist</span>
          <p className="text-on-surface font-semibold mb-1">Nenhum checklist cadastrado</p>
          <p className="text-sm text-on-surface-variant mb-4">Crie um checklist para ver as estatísticas aqui.</p>
          <button onClick={() => navigate('/checklists')} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            Criar Checklist
          </button>
        </div>
      )
    }

    const dashChecklist = checklistDashboard?.checklist
    const today = checklistDashboard?.today
    const history = checklistDashboard?.history ?? []

    return (
      <div className="space-y-6">
        {checklists.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {checklists.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectChecklist(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedChecklistId === c.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {dashChecklist && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon="checklist" label="Itens" value={dashChecklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
            <StatCard
              icon="schedule"
              label="Horário de Envio"
              value={`${String(dashChecklist.send_time).padStart(2, '0')}h`}
              iconColor="text-yellow-400"
              iconBg="bg-yellow-400/15"
            />
            <StatCard
              icon="today"
              label="Conclusão Hoje"
              value={today ? `${today.completion_pct}%` : '—'}
              iconColor={today && today.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
              iconBg={today && today.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
            />
            <StatCard icon="bar_chart" label="Dias Registrados" value={history.length} iconColor="text-primary" iconBg="bg-primary/15" />
          </div>
        )}

        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
          <h3 className="text-base font-semibold text-on-surface mb-4">Histórico (12 semanas)</h3>
          <ChecklistHeatmap history={history} />
        </div>

        <ChecklistItemRanking itemStats={checklistDashboard?.itemStats ?? []} />
      </div>
    )
  }
```

`checklistStats` fica disponível no estado mas não é usado dentro desta aba (as mini-estatísticas semana/mês/total continuam só nos cards de `/checklists`) — mantenha o `setChecklistStats` do Step 2 mesmo assim, é o retorno de `checklistsApi.stats()` já buscado junto (evita uma segunda chamada futura caso a aba precise dele).

- [ ] **Step 4: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `checklistStats` for reportado como "declared but never read" por um linter (não pelo `tsc` padrão), isso é esperado e aceitável — não é consumido nesta aba por design.

- [ ] **Step 5: Verificar no browser**

Com pelo menos um checklist cadastrado com histórico (se não tiver, crie um em `/checklists` e clique "Enviar Agora" um par de vezes em dias diferentes, ou aceite ver o estado vazio de heatmap):
- Navegue para `/analise`, clique na aba "Checklist".
- Confirme que aparecem: seletor de checklists (só se houver mais de um), 4 stat cards, heatmap de 12 semanas, ranking de itens.
- Se não houver nenhum checklist, confirme o estado vazio com botão "Criar Checklist" navegando para `/checklists`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Analise.tsx
git commit -m "feat(analise): implementa aba Checklist com heatmap e ranking de itens"
```

---

## Task 9: Frontend — simplificar `Checklists.tsx`

**Files:**
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: nada novo — só remove código.
- Produces: `Checklists.tsx` sem o grid de 4 `StatCard`s, sem o seletor multi-checklist, sem `ChecklistHeatmap`/`ChecklistItemRanking`. Mantém a lista de `ChecklistCard`s, o formulário de criar/editar, e `renderTodaySection()` (progresso de hoje com os botões de enviar/reenviar).

- [ ] **Step 1: Remover imports não usados**

Remova as linhas (imports de `StatCard`, `ChecklistHeatmap`, `ChecklistItemRanking`):

```ts
import { StatCard } from '../components/checklist/StatCard'
```
```ts
import { ChecklistHeatmap } from '../components/checklist/ChecklistHeatmap'
import { ChecklistItemRanking } from '../components/checklist/ChecklistItemRanking'
```

- [ ] **Step 2: Remover estado e handler de seleção de checklist**

Remova a linha do estado:

```ts
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
```

Em `fetchData`, remova a linha:

```ts
      if (dash.checklist) setSelectedChecklistId(dash.checklist.id)
```

Remova a função inteira:

```ts
  const handleSelectChecklist = async (id: string) => {
    if (id === selectedChecklistId) return
    setSelectedChecklistId(id)
    try {
      const dash = await checklistsApi.dashboard(id)
      setDashboard(dash)
    } catch {
      showError('Erro ao carregar dados do checklist.')
    }
  }
```

- [ ] **Step 3: Remover `history` e `renderHistory`**

Remova a linha (dentro do corpo do componente, logo após `const dashChecklist = dashboard?.checklist` / `const today = dashboard?.today`):

```ts
  const history = dashboard?.history ?? []
```

Remova a função inteira `renderHistory`:

```ts
  // -------- History --------
  const renderHistory = () => {
    if (!dashChecklist) return null
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Histórico (12 semanas)</h3>
        <ChecklistHeatmap history={history} />
      </div>
    )
  }
```

- [ ] **Step 4: Remover o grid de 4 StatCards e o painel de detalhes, manter o progresso de hoje**

No `return` principal, troque este bloco:

```tsx
          {/* Stats from most recent checklist with activity */}
          {dashChecklist && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon="checklist" label="Itens" value={dashChecklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
              <StatCard
                icon="schedule"
                label="Horario de Envio"
                value={`${String(dashChecklist.send_time).padStart(2, '0')}h`}
                iconColor="text-yellow-400"
                iconBg="bg-yellow-400/15"
              />
              <StatCard
                icon="today"
                label="Conclusao Hoje"
                value={today ? `${today.completion_pct}%` : '—'}
                iconColor={today && today.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
                iconBg={today && today.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
              />
              <StatCard
                icon="bar_chart"
                label="Dias Registrados"
                value={history.length}
                iconColor="text-primary"
                iconBg="bg-primary/15"
              />
            </div>
          )}

          {/* Checklist cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {checklists.map((c) => (
              <ChecklistCard
                key={c.id}
                checklist={c}
                stats={statsMap.get(c.id)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                sending={sendingId === c.id}
              />
            ))}
          </div>

          {/* Painel de detalhes do checklist selecionado */}
          {dashChecklist && (
            <div className="space-y-4">
              {checklists.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {checklists.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChecklist(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        selectedChecklistId === c.id
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  {renderTodaySection()}
                  {renderHistory()}
                  <ChecklistItemRanking itemStats={dashboard?.itemStats ?? []} />
                </div>
              </div>
            </div>
          )}
```

por:

```tsx
          {/* Checklist cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {checklists.map((c) => (
              <ChecklistCard
                key={c.id}
                checklist={c}
                stats={statsMap.get(c.id)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                sending={sendingId === c.id}
              />
            ))}
          </div>

          {/* Progresso de hoje do checklist mais recente */}
          {dashChecklist && renderTodaySection()}
```

- [ ] **Step 5: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros (nenhuma variável ou import não usado deve sobrar — `today`, `dashChecklist`, `statsMap` continuam usados por `renderTodaySection`/`ChecklistCard`).

- [ ] **Step 6: Verificar no browser**

Navegue para `/checklists`:
- Confirme que a lista de cards e o formulário de criar/editar continuam funcionando normalmente.
- Confirme que "Progresso de Hoje" (com os botões Enviar Agora / Reenviar) ainda aparece abaixo da lista.
- Confirme que o heatmap, o ranking de itens e o grid de 4 stat cards **não aparecem mais** aqui (foram para `/analise`).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Checklists.tsx
git commit -m "refactor(checklist): remove dashboard aprofundado de /checklists (migrado para /analise)"
```

---

## Self-Review Notes

- **Cobertura da spec:** orçamento (Task 3/5), top contas (Task 2/6), histórico com mês parcial marcado (Task 1/7), categoria e projeção mantidos (Task 7), abas com padrão Financeiro/Checklist (Task 7), reuso dos componentes de checklist (Task 8), simplificação de `/checklists` (Task 9). Todos os itens do spec têm uma task correspondente.
- **Placeholders:** nenhum "TBD"/"implementar depois" — o único placeholder textual ("Em breve.") é temporário e explicitamente substituído no Task 8, Step 3.
- **Consistência de tipos:** `BudgetResponse`, `OcorrenciaTop`, `TopOccurrencesResponse` definidos no Task 4 são usados com os mesmos nomes em `analytics.ts` (Task 4), `BudgetCard`/`TopOccurrencesList` (Tasks 5–6) e `Analise.tsx` (Task 7). `historicoMensal`/`topOcorrencias` (Tasks 1–2) usam a interface `MesProjecao` já existente e a nova `OcorrenciaTop`, consumida igual no backend e no frontend.
