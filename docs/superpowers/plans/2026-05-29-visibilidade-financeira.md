# Visibilidade Financeira — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar visibilidade financeira ao BillSync — gastos por categoria (F1), projeção dos próximos meses (F2) e sumário mensal por WhatsApp (F4) — e consertar resumo semanal/alerta de orçamento quebrados pela remoção de `status`.

**Architecture:** Uma camada de agregação única (`financialAnalytics.ts`) faz `GROUP BY` em `bill_occurrences JOIN bills`, consumida tanto por endpoints REST (`/api/analytics/*`) quanto pelos disparos de WhatsApp. Frontend ganha uma página **Análise** com gráficos recharts. Sem novas tabelas de cache.

**Tech Stack:** Node + Express + TypeScript + MySQL2 (backend); React + React Router v6 + recharts + Tailwind (frontend).

> **Nota sobre testes:** este repositório não possui suíte de testes (ver CLAUDE.md). A verificação de cada task usa `npm run build` (typecheck via `tsc`) e checagens de runtime com `curl`/observação manual, em vez de testes unitários formais.

> **Paralelização (execução multi-agente):** as tasks se agrupam em 3 streams independentes:
> - **Stream A (backend dados):** Tasks 1, 2
> - **Stream B (backend WhatsApp):** Tasks 3, 4 — Task 4 depende da Task 1 (Stream A) e Task 3
> - **Stream C (frontend):** Tasks 5, 6, 7 — Task 6 e 7 dependem da Task 5
> Ordem de dispatch sugerida: Tasks 1 e 3 e 5 em paralelo → depois 2, 4, 6, 7.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `backend/src/services/financialAnalytics.ts` | Agregação por categoria/mês | Criar |
| `backend/src/routes/analytics.ts` | Endpoints REST de análise | Criar |
| `backend/src/index.ts` | Wiring da rota analytics | Modificar |
| `backend/src/migrate.ts` | Migração 011 (`monthly_summary_enabled`) | Modificar |
| `backend/src/routes/users.ts` | Aceitar `monthly_summary_enabled` no update | Modificar |
| `backend/src/services/summaryService.ts` | Resumo semanal (conserto) + mensal (novo) | Modificar |
| `backend/src/services/budgetAlertService.ts` | Alerta de orçamento (conserto) | Modificar |
| `backend/src/scheduler.ts` | Hook de sumário mensal (dia 1, 8h) | Modificar |
| `src/types/index.ts` | Tipo `User.monthly_summary_enabled` + tipos analytics | Modificar |
| `src/api/analytics.ts` | Cliente REST de análise | Criar |
| `src/pages/Analise.tsx` | Página com donut + barras | Criar |
| `src/utils/categoryColors.ts` | Mapa de cores/labels por categoria | Criar |
| `src/components/Layout/Sidebar.tsx` | Item de nav "Análise" | Modificar |
| `src/App.tsx` | Rota `/analise` | Modificar |
| `src/pages/Configuracoes.tsx` | Toggle "Resumo mensal" | Modificar |
| `package.json` (root) | Dependência `recharts` | Modificar |

---

## Task 1: Service de agregação financeira

**Files:**
- Create: `backend/src/services/financialAnalytics.ts`

- [ ] **Step 1: Criar o service com as três funções de agregação**

Create `backend/src/services/financialAnalytics.ts`:

```ts
import pool from '../db'

export interface CategoriaTotal {
  category: string
  total: number
  count: number
}

export interface MesProjecao {
  ano: number
  mes: number
  total: number
}

export interface FechamentoMensal {
  total: number
  porCategoria: Array<{ category: string; total: number }>
  orcamento: number | null
  qtdContas: number
}

// Gastos por categoria num intervalo [from, to] (datas YYYY-MM-DD, inclusivas)
export async function gastosPorCategoria(
  userId: string,
  from: string,
  to: string
): Promise<CategoriaTotal[]> {
  const [rows]: any = await pool.query(
    `SELECT COALESCE(b.category, 'outro') AS category,
            SUM(o.amount) AS total,
            COUNT(*) AS count
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      GROUP BY COALESCE(b.category, 'outro')
      ORDER BY total DESC`,
    [userId, from, to]
  )
  return rows.map((r: any) => ({
    category: r.category,
    total: Number(r.total) || 0,
    count: Number(r.count) || 0,
  }))
}

// Soma das ocorrências por mês para os próximos N meses (inclui mês corrente)
export async function projecaoMensal(
  userId: string,
  meses: number
): Promise<MesProjecao[]> {
  const n = Math.min(Math.max(meses, 1), 12)
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + n, 0)
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

  // Preenche todos os N meses, mesmo os zerados
  const resultado: MesProjecao[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    resultado.push({ ano, mes, total: mapa.get(`${ano}-${mes}`) ?? 0 })
  }
  return resultado
}

// Fechamento de um mês específico (1-based)
export async function fechamentoMensal(
  userId: string,
  ano: number,
  mes: number
): Promise<FechamentoMensal> {
  const first = new Date(ano, mes - 1, 1)
  const last = new Date(ano, mes, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const porCategoria = await gastosPorCategoria(userId, toStr(first), toStr(last))
  const total = porCategoria.reduce((acc, c) => acc + c.total, 0)
  const qtdContas = porCategoria.reduce((acc, c) => acc + c.count, 0)

  const [[user]]: any = await pool.query(
    'SELECT monthly_budget_limit FROM users WHERE id = ?',
    [userId]
  )
  const orcamento = user?.monthly_budget_limit != null ? Number(user.monthly_budget_limit) : null

  return {
    total,
    porCategoria: porCategoria.map((c) => ({ category: c.category, total: c.total })),
    orcamento,
    qtdContas,
  }
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `cd backend && npm run build`
Expected: build conclui sem erros de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/financialAnalytics.ts
git commit -m "feat(analytics): service de agregação financeira por categoria e mês"
```

---

## Task 2: Endpoints REST de análise

**Files:**
- Create: `backend/src/routes/analytics.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar a rota analytics**

Create `backend/src/routes/analytics.ts`:

```ts
import { Router, Request, Response } from 'express'
import { gastosPorCategoria, projecaoMensal } from '../services/financialAnalytics'

const router = Router()

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

// GET /api/analytics/by-category?from=&to=
router.get('/by-category', async (req: Request, res: Response) => {
  try {
    const def = mesAtualRange()
    const from = (req.query.from as string) || def.from
    const to = (req.query.to as string) || def.to

    const categorias = await gastosPorCategoria(req.userId!, from, to)
    const total = categorias.reduce((acc, c) => acc + c.total, 0)
    const comPct = categorias.map((c) => ({
      ...c,
      pct: total > 0 ? Math.round((c.total / total) * 1000) / 10 : 0,
    }))

    res.json({ from, to, total, categorias: comPct })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/analytics/projection?months=6
router.get('/projection', async (req: Request, res: Response) => {
  try {
    const months = Number(req.query.months) || 6
    const dados = await projecaoMensal(req.userId!, months)
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

export default router
```

- [ ] **Step 2: Importar e registrar a rota em `index.ts`**

In `backend/src/index.ts`, adicionar o import junto aos demais (após a linha `import checklistsRouter from './routes/checklists'`):

```ts
import analyticsRouter from './routes/analytics'
```

E registrar a rota após `app.use('/api/users', usersRouter)`:

```ts
app.use('/api/analytics', analyticsRouter)
```

- [ ] **Step 3: Verificar typecheck**

Run: `cd backend && npm run build`
Expected: build sem erros.

- [ ] **Step 4: Verificação de runtime (opcional, se ambiente local disponível)**

Com o backend rodando e um JWT válido em `$TOKEN`:
Run: `curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4000/api/analytics/by-category" | head`
Expected: JSON com `{ from, to, total, categorias: [...] }`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/analytics.ts backend/src/index.ts
git commit -m "feat(analytics): endpoints /by-category e /projection"
```

---

## Task 3: Migração 011 + campo no update de usuário

**Files:**
- Modify: `backend/src/migrate.ts`
- Modify: `backend/src/routes/users.ts`

- [ ] **Step 1: Adicionar a migração 011**

In `backend/src/migrate.ts`, adicionar ao final do array de migrações (após o objeto `010_remove_payment_fields`, antes do `]` que fecha o array):

```ts
  {
    name: '011_users_monthly_summary',
    statements: splitStatements(`
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER summary_day_of_week
`),
  },
```

- [ ] **Step 2: Aceitar o campo no update de preferências**

In `backend/src/routes/users.ts`, na lista de campos permitidos (linhas ~25-27), adicionar `'monthly_summary_enabled'`:

```ts
    'notification_time', 'whatsapp_alerts_enabled',
    'weekly_summary_enabled', 'default_days_before_alert',
    'summary_enabled', 'summary_day_of_week', 'monthly_budget_limit',
    'monthly_summary_enabled',
```

O valor booleano é tratado pelo branch genérico existente (`values.push(req.body[key])`), portanto não requer validação adicional.

- [ ] **Step 3: Verificar typecheck**

Run: `cd backend && npm run build`
Expected: build sem erros.

- [ ] **Step 4: Verificação de runtime (opcional)**

Com backend rodando: reiniciar dispara `runMigrations()`. Conferir log:
Expected: linha indicando `011_users_monthly_summary` aplicada (ou já no `migration_log`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/migrate.ts backend/src/routes/users.ts
git commit -m "feat(migrate): 011 — coluna monthly_summary_enabled + aceitar no update"
```

---

## Task 4: Sumário mensal + conserto do semanal e do alerta de orçamento

**Files:**
- Modify: `backend/src/services/summaryService.ts`
- Modify: `backend/src/services/budgetAlertService.ts`
- Modify: `backend/src/scheduler.ts`

**Depende de:** Task 1 (`financialAnalytics`) e Task 3 (coluna).

- [ ] **Step 1: Reescrever `summaryService.ts` (semanal sem `status` + mensal novo)**

Replace o conteúdo inteiro de `backend/src/services/summaryService.ts`:

```ts
import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fechamentoMensal } from './financialAnalytics'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NOMES_CATEGORIA: Record<string, string> = {
  moradia: 'Moradia',
  assinaturas: 'Assinaturas',
  'serviços': 'Serviços',
  'saúde': 'Saúde',
  'educação': 'Educação',
  transporte: 'Transporte',
  'alimentação': 'Alimentação',
  outro: 'Outro',
}

// --- Resumo semanal (consertado: sem coluna status) ---
export async function sendWeeklySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [[stats]]: any = await pool.query(
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, firstOfMonth, lastOfMonth]
  )

  const [upcoming]: any = await pool.query(
    `SELECT b.name, o.due_date, o.amount
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?
      ORDER BY o.due_date ASC LIMIT 5`,
    [userId, now, nextWeek]
  )

  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''
  let msg = `📊 *Resumo BillSync${firstName}*\n\n`
  msg += `*Total deste mês:* R$ ${formatBRL(Number(stats.total) || 0)}\n`

  if (upcoming.length) {
    msg += `\n*Próximos 7 dias:*\n`
    for (const o of upcoming) {
      const d = (o.due_date instanceof Date ? o.due_date : new Date(o.due_date)).toLocaleDateString('pt-BR')
      msg += `• ${o.name} — R$ ${formatBRL(Number(o.amount))} (${d})\n`
    }
  } else {
    msg += `\nNenhuma conta nos próximos 7 dias. 🎉\n`
  }

  await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  console.log(`[summary] resumo semanal enviado para ${userId}`)
}

// --- Sumário mensal (novo): fechamento do mês anterior ---
export async function sendMonthlySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ano = prev.getFullYear()
  const mes = prev.getMonth() + 1

  const fechamento = await fechamentoMensal(userId, ano, mes)
  if (fechamento.qtdContas === 0) return // nada a reportar

  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''

  let msg = `📅 *Fechamento de ${nomesMes[mes - 1]}${firstName}*\n\n`
  msg += `*Total:* R$ ${formatBRL(fechamento.total)} em ${fechamento.qtdContas} conta(s)\n`

  if (fechamento.porCategoria.length) {
    msg += `\n*Por categoria:*\n`
    for (const c of fechamento.porCategoria) {
      const nome = NOMES_CATEGORIA[c.category] ?? c.category
      msg += `• ${nome}: R$ ${formatBRL(c.total)}\n`
    }
  }

  if (fechamento.orcamento != null) {
    const diff = fechamento.total - fechamento.orcamento
    if (diff > 0) {
      msg += `\n⚠️ R$ ${formatBRL(diff)} acima do orçamento de R$ ${formatBRL(fechamento.orcamento)}.`
    } else {
      msg += `\n✅ Dentro do orçamento (R$ ${formatBRL(fechamento.orcamento)}).`
    }
  }

  await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  console.log(`[summary] sumário mensal enviado para ${userId}`)
}
```

- [ ] **Step 2: Consertar `budgetAlertService.ts` (remover `status`)**

Replace o conteúdo inteiro de `backend/src/services/budgetAlertService.ts`:

```ts
import pool from '../db'
import { sendWhatsAppText } from './waha'

export async function checkBudgetAlert(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, monthly_budget_limit FROM users WHERE id = ? AND is_active = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].monthly_budget_limit || !userRows[0].whatsapp_number) return

  const budget = Number(userRows[0].monthly_budget_limit)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [[stats]]: any = await pool.query(
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, firstOfMonth, lastOfMonth]
  )

  const total = Number(stats.total) || 0
  if (total > budget) {
    const msg =
      `⚠️ *Alerta de Orçamento — BillSync*\n\n` +
      `Suas contas deste mês somam *R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*, ` +
      `acima do limite configurado de *R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.`
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
    console.log(`[budgetAlert] alerta enviado para ${userId}`)
  }
}
```

- [ ] **Step 3: Adicionar hook do sumário mensal no scheduler**

In `backend/src/scheduler.ts`, adicionar o import junto aos demais (após `import { sendWeeklySummary } from './services/summaryService'`):

```ts
import { sendMonthlySummary } from './services/summaryService'
```

Adicionar uma função helper de dia do mês perto das outras helpers (após `getCurrentDayOfWeekSaoPaulo`):

```ts
function getCurrentDayOfMonthSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
  }).formatToParts(new Date())
  return parseInt(parts.find(p => p.type === 'day')?.value ?? '1', 10)
}
```

Dentro do callback do cron, após o bloco `if (hour === 8) { ... }` do resumo semanal, adicionar:

```ts
    // --- Sumário mensal (dia 1, 8h BRT) ---
    if (hour === 8 && getCurrentDayOfMonthSaoPaulo() === 1) {
      try {
        const [monthlyUsers]: any = await pool.query(
          `SELECT id FROM users WHERE monthly_summary_enabled = 1 AND is_active = 1 AND whatsapp_alerts_enabled = 1`
        )
        for (const { id } of monthlyUsers) {
          try { await sendMonthlySummary(id) } catch (e: any) { console.error('[scheduler] monthly summary erro:', e.message) }
        }
      } catch (e: any) { console.error('[scheduler] monthly summary tick erro:', e.message) }
    }
```

- [ ] **Step 4: Verificar typecheck**

Run: `cd backend && npm run build`
Expected: build sem erros.

- [ ] **Step 5: Verificação — confirmar que nenhuma referência a `status` restou nestes arquivos**

Run: `grep -n "o.status\|status IN\|status='pending'\|status = 'pending'" backend/src/services/summaryService.ts backend/src/services/budgetAlertService.ts`
Expected: nenhuma linha retornada.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/summaryService.ts backend/src/services/budgetAlertService.ts backend/src/scheduler.ts
git commit -m "feat(summary): sumário mensal + conserto de resumo semanal e alerta de orçamento (sem status)"
```

---

## Task 5: Dependência recharts + cliente API + tipos (frontend)

**Files:**
- Modify: `package.json` (root)
- Create: `src/api/analytics.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Instalar recharts**

Run: `npm install recharts`
Expected: `recharts` adicionado a `dependencies` no `package.json` da raiz.

- [ ] **Step 2: Adicionar tipos de análise e o campo no User**

In `src/types/index.ts`, na interface `User`, adicionar o campo após `summary_day_of_week`:

```ts
  monthly_summary_enabled: boolean
```

E adicionar ao final do arquivo os tipos de análise:

```ts
export interface CategoryBreakdown {
  category: string
  total: number
  count: number
  pct: number
}

export interface ByCategoryResponse {
  from: string
  to: string
  total: number
  categorias: CategoryBreakdown[]
}

export interface ProjectionMonth {
  ano: number
  mes: number
  label: string
  total: number
}

export interface ProjectionResponse {
  meses: ProjectionMonth[]
}
```

- [ ] **Step 3: Criar o cliente API**

Create `src/api/analytics.ts`:

```ts
import client from './client'
import type { ByCategoryResponse, ProjectionResponse } from '../types'

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
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run build`
Expected: build sem erros (o `Analise.tsx` ainda não existe; isso é esperado — esta task não o referencia).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/api/analytics.ts src/types/index.ts
git commit -m "feat(analytics): cliente API, tipos e dependência recharts"
```

---

## Task 6: Página Análise (donut + barras) + navegação

**Files:**
- Create: `src/utils/categoryColors.ts`
- Create: `src/pages/Analise.tsx`
- Modify: `src/components/Layout/Sidebar.tsx`
- Modify: `src/App.tsx`

**Depende de:** Task 5 (API + tipos).

- [ ] **Step 1: Criar mapa de cores/labels de categoria**

Create `src/utils/categoryColors.ts`:

```ts
// Cores e rótulos por categoria (alinhado ao type BillCategory)
export const CATEGORY_COLORS: Record<string, string> = {
  moradia: '#6750A4',
  assinaturas: '#7D5260',
  'serviços': '#386A20',
  'saúde': '#B3261E',
  'educação': '#1D6C73',
  transporte: '#7E5700',
  'alimentação': '#984061',
  outro: '#5C5F6E',
}

export const CATEGORY_LABELS: Record<string, string> = {
  moradia: 'Moradia',
  assinaturas: 'Assinaturas',
  'serviços': 'Serviços',
  'saúde': 'Saúde',
  'educação': 'Educação',
  transporte: 'Transporte',
  'alimentação': 'Alimentação',
  outro: 'Outro',
}

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.outro
}

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat
}
```

- [ ] **Step 2: Criar a página Análise**

Create `src/pages/Analise.tsx`:

```tsx
import React, { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import type { ByCategoryResponse, ProjectionResponse } from '../types'
import { categoryColor, categoryLabel } from '../utils/categoryColors'
import { formatBRL } from '../utils/format'
import { useToast } from '../context/ToastContext'

type Periodo = 'atual' | 'proximo'

function periodoRange(p: Periodo): { from: string; to: string } {
  const now = new Date()
  const offset = p === 'proximo' ? 1 : 0
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const Analise: React.FC = () => {
  const { showToast } = useToast()
  const [periodo, setPeriodo] = useState<Periodo>('atual')
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const { from, to } = periodoRange(periodo)
    Promise.all([analyticsApi.byCategory(from, to), analyticsApi.projection(6)])
      .then(([cat, proj]) => {
        if (!active) return
        setByCat(cat)
        setProjection(proj)
      })
      .catch(() => { if (active) showToast('Erro ao carregar análise', 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [periodo, showToast])

  const pieData = (byCat?.categorias ?? []).map((c) => ({
    name: categoryLabel(c.category),
    value: c.total,
    color: categoryColor(c.category),
    pct: c.pct,
  }))

  const barData = (projection?.meses ?? []).map((m) => ({ label: m.label, total: m.total }))
  const proximoMes = projection?.meses?.[1]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">Análise</h1>
        <p className="text-sm text-on-surface-variant">Visão dos seus gastos por categoria e projeção futura.</p>
      </header>

      {/* Seletor de período */}
      <div className="flex gap-2">
        {(['atual', 'proximo'] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              periodo === p ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {p === 'atual' ? 'Mês atual' : 'Próximo mês'}
          </button>
        ))}
      </div>

      {/* F1 — Gastos por categoria */}
      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-4">Gastos por categoria</h2>
        {loading ? (
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
                  <Tooltip formatter={(v: number) => `R$ ${formatBRL(v)}`} />
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
                  <span className="text-on-surface-variant">R$ {formatBRL(d.value)} · {d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* F2 — Projeção dos próximos meses */}
      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-1">Projeção dos próximos meses</h2>
        {proximoMes && (
          <p className="text-sm text-on-surface-variant mb-4">
            Você vai gastar ~R$ {formatBRL(proximoMes.total)} em {proximoMes.label}.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : barData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sem dados de projeção.</p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => `R$ ${formatBRL(v)}`} />
                <Bar dataKey="total" fill="#6750A4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

export default Analise
```

> **Nota:** confirme que `src/utils/format.ts` exporta `formatBRL` (usado no Dashboard). Se a assinatura aceitar `number` e retornar string formatada, nenhuma mudança é necessária.

- [ ] **Step 3: Adicionar item de navegação**

In `src/components/Layout/Sidebar.tsx`, adicionar ao array `navItems` (após o item de Contas):

```ts
  { path: '/analise', label: 'Análise', icon: 'monitoring' },
```

(O mesmo array é reutilizado pela navegação inferior mobile em `Layout.tsx`, então não há mudança adicional lá.)

- [ ] **Step 4: Registrar a rota em `App.tsx`**

In `src/App.tsx`, adicionar o import junto aos demais imports de página:

```tsx
import Analise from './pages/Analise'
```

E a rota dentro do `<Route element={<Layout />}>`, após a rota `/contas`:

```tsx
            <Route path="/analise" element={<Analise />} />
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: `tsc + vite build` concluem sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/utils/categoryColors.ts src/pages/Analise.tsx src/components/Layout/Sidebar.tsx src/App.tsx
git commit -m "feat(analise): página com donut de categorias e barras de projeção + navegação"
```

---

## Task 7: Toggle "Resumo mensal" em Configurações

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

**Depende de:** Task 5 (campo `monthly_summary_enabled` no tipo `User`).

- [ ] **Step 1: Adicionar estado e toggle**

In `src/pages/Configuracoes.tsx`, localizar o objeto de estado `summarySettings` (inicializado a partir do usuário, perto da linha 81 onde lê `u.summary_enabled`). Adicionar o campo ao estado inicial:

```ts
    monthly_summary_enabled: u.monthly_summary_enabled ?? true,
```

No JSX, próximo ao `ToggleRow` do resumo semanal/`summary_enabled`, adicionar um novo `ToggleRow`:

```tsx
            <ToggleRow
              label="Resumo mensal no WhatsApp"
              description="Receba um fechamento do mês anterior no dia 1, com total por categoria e comparação com o orçamento."
              checked={summarySettings.monthly_summary_enabled}
              onChange={(v: boolean) => setSummarySettings((s) => ({ ...s, monthly_summary_enabled: v }))}
            />
```

- [ ] **Step 2: Incluir o campo no payload de salvamento**

No handler que envia as preferências de resumo (onde já são enviados `summary_enabled`, `summary_day_of_week`, `monthly_budget_limit`), adicionar:

```ts
        monthly_summary_enabled: summarySettings.monthly_summary_enabled,
```

> **Nota:** os nomes exatos do handler/estado podem variar; siga o padrão já existente para `summary_enabled` no mesmo arquivo — onde ele aparece no estado, no `ToggleRow` e no payload, espelhe para `monthly_summary_enabled`.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Verificação manual (opcional)**

Abrir Configurações na UI, alternar "Resumo mensal", salvar, recarregar.
Expected: o toggle persiste o valor escolhido.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(config): toggle de resumo mensal no WhatsApp"
```

---

## Verificação final (após todas as tasks)

- [ ] **Backend build limpo:** `cd backend && npm run build` → sem erros.
- [ ] **Frontend build limpo:** `npm run build` → sem erros.
- [ ] **Sem refs a colunas removidas:** `grep -rn "o.status\|status IN\|confirmation_source\|paid_at" backend/src/services backend/src/routes` → apenas ocorrências esperadas (idealmente nenhuma nos arquivos tocados).
- [ ] **Critérios de sucesso da spec** (seção 9 do design) atendidos: página Análise com donut + barras, sumário mensal agendado, semanal/orçamento sem quebrar, toggle persistido.

> **Lembrete (fora do escopo):** `notificationMaterializer.ts` ainda faz query em `o.status = 'pending'` e continua quebrado — bug crítico a tratar em plano separado, conforme seção 8 do design.
