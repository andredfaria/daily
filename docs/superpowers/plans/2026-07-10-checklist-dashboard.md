# Melhoria do Dashboard de Checklists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, para cada checklist, contadores de conclusão (semana/mês/total) na lista, um seletor para ver detalhes de qualquer checklist, um mapa de calor de 12 semanas no lugar da lista de "últimos 14 dias", e um ranking por item (marcado vs não marcado).

**Architecture:** Duas novas rotas/extensões no backend Express existente (`backend/src/routes/checklists.ts`) reaproveitando `checklist_daily_polls` e `checklist_items` sem mudança de schema. No frontend, extração dos componentes hoje embutidos em `src/pages/Checklists.tsx` para `src/components/checklist/`, com dois componentes novos (heatmap e ranking) construídos só com Tailwind, sem lib de gráficos.

**Tech Stack:** Express + MySQL2 (backend), React + TypeScript + Tailwind (frontend), Jest (testes de funções puras do backend — não há test runner de frontend configurado neste repo).

## Global Constraints

- Todo texto, comentário e log em pt-BR.
- "Concluído" = `completion_pct = 100` no `checklist_daily_polls` daquele dia.
- Semana = últimos 7 dias corridos; Mês = últimos 30 dias corridos; Total = todo o histórico. Não são janelas de calendário.
- Ranking de itens é calculado sobre os últimos 30 dias, comparando o texto do item com as strings em `selected_options` (mesma lógica já usada para `today.selected_options`).
- `history` do endpoint `/checklists/dashboard` passa de 14 para 84 dias (12 semanas), para alimentar o heatmap.
- Não introduzir novas dependências. `recharts` já existe no projeto mas não deve ser usado aqui — heatmap e ranking são grids/barras simples em Tailwind, consistentes com o `ProgressBar` já existente.
- Não existe test runner de frontend configurado — verificação de componentes React é manual via navegador (`npm run dev` + checar em `/checklists`). O backend tem Jest configurado (`backend/package.json` → `npm test`); use-o apenas para funções puras novas, seguindo o padrão de `backend/src/services/__tests__/waha.test.ts` (testa funções exportadas, sem mock de banco).
- `tsconfig.app.json` tem `noUnusedLocals` e `noUnusedParameters` ativos — `npm run build` falha se sobrar import/variável não utilizada após mover código entre arquivos. Rode `npm run build` como parte da verificação de cada task de frontend.
- Sem mudança de schema de banco — todas as colunas necessárias (`completion_pct`, `selected_options`, `status`, `poll_date`) já existem em `checklist_daily_polls`.

---

### Task 1: Função pura `computeItemStats` (backend)

**Files:**
- Create: `backend/src/services/checklistStats.ts`
- Test: `backend/src/services/__tests__/checklistStats.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependências de banco).
- Produces: `export interface ChecklistItemStat { text: string; marked_count: number; total_polls: number; pct: number }` e `export function computeItemStats(itemTexts: string[], pollsSelectedOptions: string[][]): ChecklistItemStat[]`. Ordena por `pct` decrescente. `total_polls` é igual para todos os itens (é o número de polls no período, não por item). Usado por Task 3.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/services/__tests__/checklistStats.test.ts`:

```ts
import { computeItemStats } from '../checklistStats'

describe('computeItemStats', () => {
  it('calcula marked_count, total_polls e pct de cada item', () => {
    const items = ['Tomar remédio', 'Beber água']
    const polls = [
      ['Tomar remédio', 'Beber água'],
      ['Tomar remédio'],
      ['Beber água'],
      ['Tomar remédio'],
    ]
    const result = computeItemStats(items, polls)
    expect(result).toEqual([
      { text: 'Tomar remédio', marked_count: 3, total_polls: 4, pct: 75 },
      { text: 'Beber água', marked_count: 2, total_polls: 4, pct: 50 },
    ])
  })

  it('ordena por pct decrescente', () => {
    const items = ['A', 'B', 'C']
    const polls = [['B'], ['B'], ['C']]
    const result = computeItemStats(items, polls)
    expect(result.map((r) => r.text)).toEqual(['B', 'C', 'A'])
  })

  it('retorna pct 0 e marked_count 0 quando não há polls no período', () => {
    const result = computeItemStats(['Item único'], [])
    expect(result).toEqual([{ text: 'Item único', marked_count: 0, total_polls: 0, pct: 0 }])
  })

  it('arredonda pct para o inteiro mais próximo', () => {
    const result = computeItemStats(['X'], [['X'], [], []])
    expect(result[0].pct).toBe(33) // 1/3 = 33.33... -> 33
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest src/services/__tests__/checklistStats.test.ts`
Expected: FAIL com `Cannot find module '../checklistStats'`

- [ ] **Step 3: Implementar a função**

Criar `backend/src/services/checklistStats.ts`:

```ts
export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
}

export function computeItemStats(
  itemTexts: string[],
  pollsSelectedOptions: string[][],
): ChecklistItemStat[] {
  const totalPolls = pollsSelectedOptions.length
  const stats: ChecklistItemStat[] = itemTexts.map((text) => {
    const markedCount = pollsSelectedOptions.filter((options) => options.includes(text)).length
    const pct = totalPolls === 0 ? 0 : Math.round((markedCount / totalPolls) * 100)
    return { text, marked_count: markedCount, total_polls: totalPolls, pct }
  })
  return stats.sort((a, b) => b.pct - a.pct)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && npx jest src/services/__tests__/checklistStats.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/checklistStats.ts backend/src/services/__tests__/checklistStats.test.ts
git commit -m "feat(checklist): adiciona computeItemStats para ranking de itens"
```

---

### Task 2: Rota `GET /api/checklists/stats` (backend)

**Files:**
- Modify: `backend/src/routes/checklists.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: rota `GET /api/checklists/stats` (autenticada via `req.userId`), retorna `Array<{ checklist_id: string; week_count: number; month_count: number; total_count: number }>`, um item por checklist do usuário (checklists sem nenhum poll aparecem com zeros). Consumido por Task 5/7 no frontend.

- [ ] **Step 1: Adicionar a rota**

Em `backend/src/routes/checklists.ts`, logo após o bloco da rota `GET /polls` (antes do comentário `// -------- GET /api/checklists/dashboard ...`), adicionar:

```ts
// -------- GET /api/checklists/stats - contadores de conclusão por checklist --------
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT c.id AS checklist_id,
              SUM(CASE WHEN cdp.completion_pct = 100 AND cdp.poll_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN 1 ELSE 0 END) AS week_count,
              SUM(CASE WHEN cdp.completion_pct = 100 AND cdp.poll_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN 1 ELSE 0 END) AS month_count,
              SUM(CASE WHEN cdp.completion_pct = 100 THEN 1 ELSE 0 END) AS total_count
       FROM checklists c
       LEFT JOIN checklist_daily_polls cdp
         ON cdp.checklist_id = c.id AND cdp.status IN ('sent', 'completed')
       WHERE c.user_id = ?
       GROUP BY c.id`,
      [req.userId!],
    )

    const stats = rows.map((r: any) => ({
      checklist_id: r.checklist_id,
      week_count: Number(r.week_count) || 0,
      month_count: Number(r.month_count) || 0,
      total_count: Number(r.total_count) || 0,
    }))

    res.json(stats)
  } catch (err: any) {
    console.error('[checklists] GET /stats', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

Atenção: essa rota deve ficar **antes** de qualquer rota `/:id` no arquivo (já é o caso — `/:id` só aparece em `PUT`/`DELETE`, que usam métodos diferentes de `GET`, então não há conflito de roteamento mesmo assim, mas mantenha a rota `/stats` no mesmo bloco das outras rotas `GET` fixas como `/polls` e `/dashboard` para legibilidade).

- [ ] **Step 2: Verificar manualmente**

Rodar o backend: `cd backend && npm run dev`

Com o frontend rodando e logado (`npm run dev` na raiz, login normal), abrir o DevTools do navegador na aba `/checklists` e rodar no console:

```js
fetch('/api/checklists/stats', { headers: { Authorization: 'Bearer ' + localStorage.getItem('billsync_token') } })
  .then((r) => r.json())
  .then(console.log)
```

Expected: array com um objeto por checklist existente, cada um com `checklist_id`, `week_count`, `month_count`, `total_count` (números, não strings). Um checklist recém-criado sem envios deve aparecer com todos os contadores em `0` (não `null`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/checklists.ts
git commit -m "feat(checklist): adiciona rota GET /checklists/stats"
```

---

### Task 3: Estender `GET /api/checklists/dashboard` (backend)

**Files:**
- Modify: `backend/src/routes/checklists.ts`

**Interfaces:**
- Consumes: `computeItemStats` de `backend/src/services/checklistStats.ts` (Task 1).
- Produces: `GET /api/checklists/dashboard` aceita `?checklistId=<uuid>` opcional (default: checklist mais recente, comportamento atual preservado). Resposta ganha o campo `itemStats: ChecklistItemStat[]` e `history` passa a ter até 84 entradas em vez de 14. Consumido por Task 5/9/10 no frontend.

- [ ] **Step 1: Adicionar o import**

No topo de `backend/src/routes/checklists.ts`, junto aos outros imports:

```ts
import { computeItemStats } from '../services/checklistStats'
```

- [ ] **Step 2: Substituir a rota `/dashboard`**

Localizar o bloco atual (comentário `// -------- GET /api/checklists/dashboard - dados do dashboard do checklist --------`) e substituir todo o corpo da rota por:

```ts
// -------- GET /api/checklists/dashboard - dados do dashboard do checklist --------
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { checklistId } = req.query

    let checklist
    if (checklistId) {
      checklist = await getChecklistById(String(checklistId), req.userId!)
      if (!checklist) return res.status(404).json({ error: 'Checklist não encontrado.' })
    } else {
      checklist = await getMostRecentChecklist(req.userId!)
    }
    if (!checklist) return res.json({ checklist: null, today: null, history: [], itemStats: [] })

    const today = getTodaySaoPaulo()

    const [todayRows]: any = await pool.query(
      `SELECT id, poll_date, waha_poll_id, selected_options,
              completed_count, total_count, completion_pct, status, created_at
       FROM checklist_daily_polls
       WHERE checklist_id = ? AND poll_date = ?`,
      [checklist.id, today],
    )

    const rawOpts = todayRows[0]?.selected_options
    const selectedOptions = Array.isArray(rawOpts) ? rawOpts : (rawOpts ? JSON.parse(rawOpts) : [])

    const todayPoll = todayRows.length > 0 ? {
      ...todayRows[0],
      selected_options: selectedOptions,
    } : null

    const [historyRows]: any = await pool.query(
      `SELECT poll_date, completed_count, total_count, completion_pct, status
       FROM checklist_daily_polls
       WHERE checklist_id = ?
       ORDER BY poll_date DESC
       LIMIT 84`,
      [checklist.id],
    )

    const history = historyRows.map((r: any) => ({
      ...r,
      selected_options: undefined,
    }))

    const items = await getItems(checklist.id)

    const [itemPollRows]: any = await pool.query(
      `SELECT selected_options
       FROM checklist_daily_polls
       WHERE checklist_id = ? AND status IN ('sent', 'completed')
         AND poll_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`,
      [checklist.id],
    )
    const pollsSelectedOptions: string[][] = itemPollRows.map((r: any) => {
      const raw = r.selected_options
      return Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : [])
    })
    const itemStats = computeItemStats(items.map((i: any) => i.text), pollsSelectedOptions)

    res.json({ checklist: { ...checklist, items }, today: todayPoll, history, itemStats })
  } catch (err: any) {
    console.error('[checklists] GET /dashboard', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Step 3: Verificar manualmente**

Com backend e frontend rodando e logado, no console do navegador:

```js
fetch('/api/checklists/dashboard', { headers: { Authorization: 'Bearer ' + localStorage.getItem('billsync_token') } })
  .then((r) => r.json())
  .then((d) => { console.log(d.itemStats); console.log(d.history.length) })
```

Expected: `itemStats` é um array com um objeto `{text, marked_count, total_polls, pct}` por item do checklist mais recente; `history.length` reflete os dias de envio existentes, no máximo 84.

Testar o parâmetro `checklistId`: pegue o `id` de outro checklist na resposta de `GET /checklists` (ou crie um segundo checklist pela UI) e rode:

```js
fetch('/api/checklists/dashboard?checklistId=<id-do-outro-checklist>', { headers: { Authorization: 'Bearer ' + localStorage.getItem('billsync_token') } })
  .then((r) => r.json())
  .then((d) => console.log(d.checklist?.name))
```

Expected: retorna o checklist correspondente ao `checklistId` passado. Testar também com um `checklistId` inválido/inexistente (ex: `checklistId=00000000-0000-0000-0000-000000000000`): deve retornar status 404 com `{error: 'Checklist não encontrado.'}`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/checklists.ts
git commit -m "feat(checklist): dashboard aceita checklistId, retorna itemStats e historico de 84 dias"
```

---

### Task 4: Tipos de frontend

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ChecklistStatsEntry`, `ChecklistItemStat`, e `ChecklistDashboardData` estendido com `itemStats`. Usados por Tasks 5–10.

- [ ] **Step 1: Adicionar os novos tipos e estender `ChecklistDashboardData`**

Em `src/types/index.ts`, localizar o bloco:

```ts
export interface ChecklistDashboardData {
  checklist: Checklist | null
  today: DailyPoll | null
  history: Array<{
    poll_date: string
    completed_count: number
    total_count: number
    completion_pct: number
    status: string
  }>
}
```

Substituir por:

```ts
export interface ChecklistStatsEntry {
  checklist_id: string
  week_count: number
  month_count: number
  total_count: number
}

export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
}

export interface ChecklistDashboardData {
  checklist: Checklist | null
  today: DailyPoll | null
  history: Array<{
    poll_date: string
    completed_count: number
    total_count: number
    completion_pct: number
    status: string
  }>
  itemStats: ChecklistItemStat[]
}
```

- [ ] **Step 2: Verificar que o projeto ainda compila**

Run: `npm run build`
Expected: falha por enquanto é aceitável apenas se for erro de tipo em `src/pages/Checklists.tsx` relacionado a `ChecklistDashboardData` faltando `itemStats` num objeto construído manualmente — **isso não deveria acontecer**, pois `ChecklistDashboardData` só é produzido pela API, nunca construído inline no frontend. Confirme rodando o build: deve passar sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(checklist): adiciona tipos ChecklistStatsEntry e ChecklistItemStat"
```

---

### Task 5: Cliente de API (frontend)

**Files:**
- Modify: `src/api/checklists.ts`

**Interfaces:**
- Consumes: `ChecklistStatsEntry`, `ChecklistDashboardData` de `src/types/index.ts` (Task 4).
- Produces: `checklistsApi.stats(): Promise<ChecklistStatsEntry[]>` e `checklistsApi.dashboard(checklistId?: string): Promise<ChecklistDashboardData>`. Usados por Tasks 7–10.

- [ ] **Step 1: Atualizar o import de tipos**

Em `src/api/checklists.ts`, trocar:

```ts
import type { Checklist, ChecklistDashboardData, ChecklistPollNotif, ChecklistRecurrenceType } from '../types'
```

por:

```ts
import type { Checklist, ChecklistDashboardData, ChecklistPollNotif, ChecklistRecurrenceType, ChecklistStatsEntry } from '../types'
```

- [ ] **Step 2: Atualizar `dashboard` e adicionar `stats`**

Trocar:

```ts
  dashboard: async (): Promise<ChecklistDashboardData> => {
    const res = await client.get<ChecklistDashboardData>('/checklists/dashboard')
    return res.data
  },
```

por:

```ts
  dashboard: async (checklistId?: string): Promise<ChecklistDashboardData> => {
    const res = await client.get<ChecklistDashboardData>('/checklists/dashboard', {
      params: checklistId ? { checklistId } : undefined,
    })
    return res.data
  },

  stats: async (): Promise<ChecklistStatsEntry[]> => {
    const res = await client.get<ChecklistStatsEntry[]>('/checklists/stats')
    return res.data
  },
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: PASS (nenhum código ainda chama `stats()` ou `dashboard(id)`, então não há erros de uso, só de definição).

- [ ] **Step 4: Commit**

```bash
git add src/api/checklists.ts
git commit -m "feat(checklist): adiciona checklistsApi.stats e checklistId em dashboard()"
```

---

### Task 6: Extrair `ProgressBar` e `StatCard`

**Files:**
- Create: `src/components/checklist/ProgressBar.tsx`
- Create: `src/components/checklist/StatCard.tsx`
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `ProgressBar` (props `{ pct: number; size?: 'sm' | 'lg' }`) e `StatCard` (props `{ icon: string; label: string; value: string | number; iconColor: string; iconBg: string }`), ambos named exports. Usados por Tasks 7, 9, 10 e pelo restante de `Checklists.tsx`.

- [ ] **Step 1: Criar `src/components/checklist/ProgressBar.tsx`**

```tsx
import React from 'react'

export const ProgressBar: React.FC<{ pct: number; size?: 'sm' | 'lg' }> = ({ pct, size = 'lg' }) => {
  const h = size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={`w-full ${h} rounded-full bg-outline-variant/30 overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/checklist/StatCard.tsx`**

```tsx
import React from 'react'

interface StatCardProps {
  icon: string
  label: string
  value: string | number
  iconColor: string
  iconBg: string
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-on-surface mb-0.5">{value}</div>
    <div className="text-xs text-on-surface-variant font-medium">{label}</div>
  </div>
)
```

- [ ] **Step 3: Remover as definições locais e importar em `src/pages/Checklists.tsx`**

Trocar o topo do arquivo (imports + helper + as duas definições de componente), de:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { checklistsApi, CreateChecklistPayload, UpdateChecklistPayload } from '../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistRecurrenceType } from '../types'
import { useToast } from '../context/ToastContext'
import { SkeletonStatCard } from '../components/ui/Skeleton'

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

const RECURRENCE_LABELS: Record<ChecklistRecurrenceType, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  custom: 'Personalizado',
}

const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// -------- Progress Bar --------
const ProgressBar: React.FC<{ pct: number; size?: 'sm' | 'lg' }> = ({ pct, size = 'lg' }) => {
  const h = size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={`w-full ${h} rounded-full bg-outline-variant/30 overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// -------- Stat Card --------
interface StatCardProps {
  icon: string
  label: string
  value: string | number
  iconColor: string
  iconBg: string
}
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-on-surface mb-0.5">{value}</div>
    <div className="text-xs text-on-surface-variant font-medium">{label}</div>
  </div>
)
```

por:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { checklistsApi, CreateChecklistPayload, UpdateChecklistPayload } from '../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistRecurrenceType } from '../types'
import { useToast } from '../context/ToastContext'
import { SkeletonStatCard } from '../components/ui/Skeleton'
import { ProgressBar } from '../components/checklist/ProgressBar'
import { StatCard } from '../components/checklist/StatCard'

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

const RECURRENCE_LABELS: Record<ChecklistRecurrenceType, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  custom: 'Personalizado',
}

const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
```

Não altere mais nada no restante do arquivo nesta task (o `ChecklistCard` continua definido localmente, será tratado na Task 7).

- [ ] **Step 4: Verificar build e visual**

Run: `npm run build`
Expected: PASS, sem erros de import não utilizado.

Rodar `npm run dev`, abrir `/checklists` no navegador: a tela deve estar visualmente idêntica a antes (cards, barras de progresso, stat cards) — nenhuma mudança de comportamento nesta task.

- [ ] **Step 5: Commit**

```bash
git add src/components/checklist/ProgressBar.tsx src/components/checklist/StatCard.tsx src/pages/Checklists.tsx
git commit -m "refactor(checklist): extrai ProgressBar e StatCard para components/checklist"
```

---

### Task 7: Extrair `ChecklistCard` e adicionar mini-estatísticas semana/mês/total

**Files:**
- Create: `src/components/checklist/constants.ts`
- Create: `src/components/checklist/ChecklistCard.tsx`
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: `ChecklistStatsEntry` de `src/types/index.ts` (Task 4), `checklistsApi.stats()` de `src/api/checklists.ts` (Task 5).
- Produces: `RECURRENCE_LABELS`, `DAYS_LABELS` exportados de `src/components/checklist/constants.ts`; `ChecklistCard` de `src/components/checklist/ChecklistCard.tsx` com nova prop opcional `stats?: ChecklistStatsEntry`. `Checklists.tsx` passa a manter um state `stats: ChecklistStatsEntry[]` carregado no `fetchData`.

- [ ] **Step 1: Criar `src/components/checklist/constants.ts`**

```ts
import type { ChecklistRecurrenceType } from '../../types'

export const RECURRENCE_LABELS: Record<ChecklistRecurrenceType, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  custom: 'Personalizado',
}

export const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
```

- [ ] **Step 2: Criar `src/components/checklist/ChecklistCard.tsx`**

```tsx
import React from 'react'
import type { Checklist, ChecklistStatsEntry } from '../../types'
import { RECURRENCE_LABELS, DAYS_LABELS } from './constants'

interface ChecklistCardProps {
  checklist: Checklist
  stats?: ChecklistStatsEntry
  onEdit: (c: Checklist) => void
  onDelete: (c: Checklist) => void
  onClearHistory: (c: Checklist) => void
  onSendNow: (c: Checklist) => void
  sending: boolean
}

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <div className="text-sm font-bold text-on-surface">{value}</div>
    <div className="text-[10px] text-on-surface-variant">{label}</div>
  </div>
)

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, stats, onEdit, onDelete, onClearHistory, onSendNow, sending }) => {
  const recLabel = RECURRENCE_LABELS[checklist.recurrence_type] ?? 'Todos os dias'
  const customDays = checklist.recurrence_type === 'custom' && checklist.recurrence_days
    ? checklist.recurrence_days.map((d) => DAYS_LABELS[d]).join(', ')
    : null

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-on-surface truncate">{checklist.name}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {checklist.items.length} itens · às <strong>{String(checklist.send_time).padStart(2, '0')}h</strong>
          </p>
          <p className="text-xs text-on-surface-variant">
            {customDays ?? recLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onSendNow(checklist)}
            disabled={sending}
            title="Enviar agora"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {sending ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base">send</span>
            )}
          </button>
          <button
            onClick={() => onEdit(checklist)}
            title="Editar"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={() => onClearHistory(checklist)}
            title="Limpar histórico"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
          </button>
          <button
            onClick={() => onDelete(checklist)}
            title="Excluir"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-around py-3 mb-3 rounded-xl bg-surface-container/60 border border-outline-variant/30">
        <MiniStat label="Semana" value={stats ? `${stats.week_count}/7` : '–/7'} />
        <MiniStat label="Mês" value={stats ? `${stats.month_count}/30` : '–/30'} />
        <MiniStat label="Total" value={stats ? `${stats.total_count}` : '0'} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {checklist.items.slice(0, 4).map((item) => (
          <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            {item.text}
          </span>
        ))}
        {checklist.items.length > 4 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            +{checklist.items.length - 4} mais
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Remover `ChecklistCard`, `RECURRENCE_LABELS` e `DAYS_LABELS` locais de `src/pages/Checklists.tsx`**

Trocar:

```tsx
import { ProgressBar } from '../components/checklist/ProgressBar'
import { StatCard } from '../components/checklist/StatCard'

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

const RECURRENCE_LABELS: Record<ChecklistRecurrenceType, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  custom: 'Personalizado',
}

const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
```

por:

```tsx
import { ProgressBar } from '../components/checklist/ProgressBar'
import { StatCard } from '../components/checklist/StatCard'
import { ChecklistCard } from '../components/checklist/ChecklistCard'
import { RECURRENCE_LABELS, DAYS_LABELS } from '../components/checklist/constants'

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}
```

Em seguida, remover por completo o bloco `// -------- Checklist Card (list view) --------` com a interface `ChecklistCardProps` e o componente `ChecklistCard` (o que sobrar entre o fim do `StatCard` — já removido na Task 6 — e o comentário `// -------- Checklist Page --------`).

Note que `ChecklistRecurrenceType` continua sendo usado em `Checklists.tsx` (no state `formRecurrenceType` e no `select`), então **mantenha** esse import de `'../types'`.

- [ ] **Step 4: Adicionar state de `stats` e buscar via API**

Adicionar o import do tipo (no import de tipos já existente, adicionar `ChecklistStatsEntry`):

```tsx
import type { Checklist, ChecklistDashboardData, ChecklistRecurrenceType, ChecklistStatsEntry } from '../types'
```

Adicionar o state, logo após `const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)`:

```tsx
  const [stats, setStats] = useState<ChecklistStatsEntry[]>([])
```

Trocar `fetchData`:

```tsx
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [list, dash] = await Promise.all([
        checklistsApi.get(),
        checklistsApi.dashboard(),
      ])
      setChecklists(list)
      setDashboard(dash)
    } catch {
      showError('Erro ao carregar dados dos checklists.')
    } finally {
      setLoading(false)
    }
  }, [showError])
```

por:

```tsx
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [list, dash, statsList] = await Promise.all([
        checklistsApi.get(),
        checklistsApi.dashboard(),
        checklistsApi.stats(),
      ])
      setChecklists(list)
      setDashboard(dash)
      setStats(statsList)
    } catch {
      showError('Erro ao carregar dados dos checklists.')
    } finally {
      setLoading(false)
    }
  }, [showError])
```

- [ ] **Step 5: Montar o mapa de stats e passar para os cards**

Localizar (perto do início do corpo de renderização, junto com `const dashChecklist = dashboard?.checklist`):

```tsx
  const dashChecklist = dashboard?.checklist
  const today = dashboard?.today
  const history = dashboard?.history ?? []
```

Adicionar logo abaixo:

```tsx
  const statsMap = new Map(stats.map((s) => [s.checklist_id, s]))
```

Localizar o bloco de renderização da lista de cards:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {checklists.map((c) => (
              <ChecklistCard
                key={c.id}
                checklist={c}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                sending={sendingId === c.id}
              />
            ))}
          </div>
```

Trocar por:

```tsx
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
```

- [ ] **Step 6: Verificar build e visual**

Run: `npm run build`
Expected: PASS.

Rodar `npm run dev`, abrir `/checklists`: cada card deve mostrar a linha "Semana / Mês / Total" com números reais (compare com a resposta manual de `GET /checklists/stats` da Task 2). Um checklist sem nenhum envio deve mostrar `–/7`, `–/30`, `0`.

- [ ] **Step 7: Commit**

```bash
git add src/components/checklist/constants.ts src/components/checklist/ChecklistCard.tsx src/pages/Checklists.tsx
git commit -m "feat(checklist): extrai ChecklistCard e adiciona mini-estatisticas semana/mes/total"
```

---

### Task 8: Seletor de checklist no painel de detalhes

**Files:**
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: `checklistsApi.dashboard(checklistId?: string)` de `src/api/checklists.ts` (Task 5).
- Produces: state `selectedChecklistId: string | null` e função `handleSelectChecklist(id: string): Promise<void>` em `Checklists.tsx`. O painel de detalhe (`renderTodaySection`, `renderHistory`, os 4 `StatCard`s do topo) passa a refletir o checklist escolhido nas abas.

- [ ] **Step 1: Adicionar state de seleção**

Logo após o state `stats` adicionado na Task 7:

```tsx
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
```

- [ ] **Step 2: Atualizar `fetchData` para definir a seleção inicial**

Trocar:

```tsx
      setChecklists(list)
      setDashboard(dash)
      setStats(statsList)
```

por:

```tsx
      setChecklists(list)
      setDashboard(dash)
      setStats(statsList)
      if (dash.checklist) setSelectedChecklistId(dash.checklist.id)
```

- [ ] **Step 3: Adicionar o handler de troca de checklist**

Adicionar logo após a definição de `fetchData` (antes do `useEffect` que a chama):

```tsx
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

- [ ] **Step 4: Renderizar as abas acima do painel de detalhes**

Localizar o bloco final de renderização:

```tsx
          {/* Dashboard activity for most recent */}
          {dashChecklist && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                {renderTodaySection()}
                {renderHistory()}
              </div>
            </div>
          )}
```

Trocar por:

```tsx
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
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm run build` — Expected: PASS.

No navegador, crie um segundo checklist (pode ter só 2 itens, horário qualquer). Volte para a lista: as abas devem aparecer com os nomes dos dois checklists. Clicar em cada aba deve trocar o conteúdo de "Progresso de Hoje" e dos 4 `StatCard`s do topo para refletir o checklist clicado (compare o nome/itens exibidos com o card correspondente na lista).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Checklists.tsx
git commit -m "feat(checklist): adiciona seletor de checklist no painel de detalhes"
```

---

### Task 9: Componente `ChecklistHeatmap`

**Files:**
- Create: `src/components/checklist/ChecklistHeatmap.tsx`
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: `history` (`ChecklistDashboardData['history']`, até 84 entradas) vindo de `dashboard` no state de `Checklists.tsx`.
- Produces: `ChecklistHeatmap` com props `{ history: Array<{ poll_date: string; completion_pct: number }>; days?: number }` (default `days=84`). Substitui `renderHistory()` em `Checklists.tsx`.

- [ ] **Step 1: Criar `src/components/checklist/ChecklistHeatmap.tsx`**

```tsx
import React from 'react'

interface HistoryDay {
  poll_date: string
  completion_pct: number
}

interface ChecklistHeatmapProps {
  history: HistoryDay[]
  days?: number
}

type Bucket = 'empty' | 'zero' | 'low' | 'mid' | 'full'

const DAY_ROWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const BUCKET_CLASS: Record<Bucket, string> = {
  empty: 'bg-surface-container',
  zero: 'bg-primary/15',
  low: 'bg-primary/40',
  mid: 'bg-primary/70',
  full: 'bg-tertiary',
}

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function pctToBucket(pct: number | undefined): Bucket {
  if (pct === undefined) return 'empty'
  if (pct === 0) return 'zero'
  if (pct < 51) return 'low'
  if (pct < 100) return 'mid'
  return 'full'
}

export const ChecklistHeatmap: React.FC<ChecklistHeatmapProps> = ({ history, days = 84 }) => {
  const pctByDate = new Map<string, number>()
  history.forEach((h) => pctByDate.set(toDateStr(h.poll_date), h.completion_pct))

  // Gera os últimos `days` dias corridos (mais antigo primeiro), ancorados em hoje.
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  // Alinha a primeira coluna ao domingo anterior à data mais antiga, pra grade ficar retangular.
  const firstDate = new Date(dates[0] + 'T00:00:00')
  const leadingBlanks = firstDate.getDay() // 0=Dom
  const cells: Array<string | null> = [...Array(leadingBlanks).fill(null), ...dates]
  const weekCount = Math.ceil(cells.length / 7)
  while (cells.length < weekCount * 7) cells.push(null)

  const columns: Array<Array<string | null>> = []
  for (let w = 0; w < weekCount; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7))
  }

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(dateStr + 'T00:00:00'))

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex flex-col gap-1 mr-1 flex-shrink-0">
          {DAY_ROWS.map((label) => (
            <div key={label} className="h-3.5 w-7 text-[9px] text-on-surface-variant flex items-center justify-end pr-1">
              {label}
            </div>
          ))}
        </div>
        {columns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
            {week.map((dateStr, di) => {
              if (!dateStr) return <div key={di} className="h-3.5 w-3.5" />
              const pct = pctByDate.get(dateStr)
              const bucket = pctToBucket(pct)
              return (
                <div
                  key={di}
                  title={`${formatDate(dateStr)} — ${pct !== undefined ? `${pct}%` : 'sem envio'}`}
                  className={`h-3.5 w-3.5 rounded-sm ${BUCKET_CLASS[bucket]}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-on-surface-variant flex-wrap">
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.empty}`} /> Sem envio</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.zero}`} /> 0%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.low}`} /> 1–50%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.mid}`} /> 51–99%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.full}`} /> 100%</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Trocar `renderHistory` em `src/pages/Checklists.tsx`**

Adicionar o import:

```tsx
import { ChecklistHeatmap } from '../components/checklist/ChecklistHeatmap'
```

Trocar:

```tsx
  // -------- History --------
  const renderHistory = () => {
    if (!history.length) return null
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Ultimos 14 Dias</h3>
        <div className="space-y-3">
          {history.map((day) => {
            const dateStr = toDateStr(day.poll_date)
            const dateLabel = dateStr
              ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(dateStr + 'T00:00:00'))
              : '—'
            return (
              <div key={dateStr} className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant w-24 flex-shrink-0">{dateLabel}</span>
                <div className="flex-1"><ProgressBar pct={day.completion_pct} size="sm" /></div>
                <span className="text-xs font-medium text-on-surface-variant w-10 text-right">{day.completion_pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
```

por:

```tsx
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

- [ ] **Step 3: Remover o helper `toDateStr` agora não utilizado**

Após o Step 2, `toDateStr` (definido no topo de `Checklists.tsx`) não é mais usado no arquivo — foi movido para dentro de `ChecklistHeatmap.tsx`. Remover do topo de `src/pages/Checklists.tsx`:

```tsx
// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}
```

- [ ] **Step 4: Verificar build e visual**

Run: `npm run build`
Expected: PASS (se `toDateStr` não for removido, o build falha por `noUnusedLocals`).

No navegador, abrir `/checklists`: a seção antes chamada "Últimos 14 Dias" agora mostra o mapa de calor de 12 semanas. Passar o mouse sobre uma célula deve mostrar a data e o percentual (ou "sem envio") via tooltip nativo. Trocar de aba (checklist) deve atualizar o heatmap.

- [ ] **Step 5: Commit**

```bash
git add src/components/checklist/ChecklistHeatmap.tsx src/pages/Checklists.tsx
git commit -m "feat(checklist): substitui lista de 14 dias por heatmap de 12 semanas"
```

---

### Task 10: Componente `ChecklistItemRanking`

**Files:**
- Create: `src/components/checklist/ChecklistItemRanking.tsx`
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: `itemStats` (`ChecklistItemStat[]`) vindo de `dashboard` no state de `Checklists.tsx` (Task 3 no backend, Task 4 no tipo).
- Produces: `ChecklistItemRanking` com props `{ itemStats: ChecklistItemStat[] }`. Renderizado abaixo do heatmap em `Checklists.tsx`.

- [ ] **Step 1: Criar `src/components/checklist/ChecklistItemRanking.tsx`**

```tsx
import React from 'react'
import type { ChecklistItemStat } from '../../types'

interface ChecklistItemRankingProps {
  itemStats: ChecklistItemStat[]
}

export const ChecklistItemRanking: React.FC<ChecklistItemRankingProps> = ({ itemStats }) => {
  if (!itemStats.length) return null

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-1">Ranking de Itens</h3>
      <p className="text-xs text-on-surface-variant mb-4">Taxa de conclusão de cada item nos últimos 30 dias</p>
      <div className="space-y-3">
        {itemStats.map((stat) => (
          <div key={stat.text} className="flex items-center gap-3">
            <span className="text-xs text-on-surface w-32 flex-shrink-0 truncate" title={stat.text}>{stat.text}</span>
            {stat.total_polls === 0 ? (
              <span className="text-xs text-on-surface-variant italic">sem dados ainda</span>
            ) : (
              <>
                <div className="flex-1 h-2.5 rounded-full bg-outline-variant/30 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${stat.pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
                    style={{ width: `${Math.min(stat.pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-on-surface-variant w-10 text-right">{stat.pct}%</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar a seção em `src/pages/Checklists.tsx`**

Adicionar o import:

```tsx
import { ChecklistItemRanking } from '../components/checklist/ChecklistItemRanking'
```

Trocar:

```tsx
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  {renderTodaySection()}
                  {renderHistory()}
                </div>
              </div>
```

por:

```tsx
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  {renderTodaySection()}
                  {renderHistory()}
                  <ChecklistItemRanking itemStats={dashboard?.itemStats ?? []} />
                </div>
              </div>
```

- [ ] **Step 3: Verificar build e visual**

Run: `npm run build`
Expected: PASS.

No navegador, abrir `/checklists`: abaixo do heatmap deve aparecer "Ranking de Itens" com uma barra por item do checklist selecionado, ordenadas da maior para a menor taxa de conclusão. Um checklist recém-criado (sem envios ainda) deve mostrar "sem dados ainda" em vez de barras. Trocar de aba (checklist) deve atualizar o ranking.

- [ ] **Step 4: Commit**

```bash
git add src/components/checklist/ChecklistItemRanking.tsx src/pages/Checklists.tsx
git commit -m "feat(checklist): adiciona ranking de itens marcado vs nao marcado"
```

---

### Task 11: Verificação manual de ponta a ponta

**Files:** nenhum (apenas verificação).

**Interfaces:** nenhuma nova — valida a integração de todas as tasks anteriores.

- [ ] **Step 1: Rodar a stack completa**

```bash
cd backend && npm run dev
```

Em outro terminal:

```bash
npm run dev
```

- [ ] **Step 2: Roteiro de verificação no navegador**

Em `/checklists`, com pelo menos 2 checklists cadastrados (um com histórico de envios via "Enviar Agora" repetido em dias diferentes se possível, outro recém-criado sem envios):

1. Cada card da lista mostra "Semana / Mês / Total" com números plausíveis (não `NaN`, não `undefined`).
2. O checklist recém-criado mostra `–/7`, `–/30`, `0`.
3. As abas do painel de detalhes mostram os nomes de todos os checklists; clicar troca "Progresso de Hoje", os 4 `StatCard`s do topo, o heatmap e o ranking de itens.
4. O heatmap mostra 12 colunas de 7 dias, com tooltip ao passar o mouse, e a legenda de cores abaixo.
5. O ranking de itens está ordenado do item mais cumprido para o menos cumprido; um checklist sem envios mostra "sem dados ainda" em todos os itens.
6. "Limpar Histórico" (botão já existente no card) zera os contadores semana/mês/total daquele checklist após recarregar a página.

- [ ] **Step 3: Rodar a suíte de testes do backend**

```bash
cd backend && npm test
```

Expected: todos os testes passam, incluindo os 4 novos de `checklistStats.test.ts`.

- [ ] **Step 4: Build final de produção**

```bash
npm run build && cd backend && npm run build
```

Expected: ambos completam sem erros de TypeScript.

Nenhum commit nesta task — é só verificação. Se algo falhar, volte à task correspondente, corrija, e commite a correção lá.
