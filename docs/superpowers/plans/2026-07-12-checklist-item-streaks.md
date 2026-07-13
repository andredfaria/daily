# Streaks (sequências) por item de checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Para cada item de um checklist, calcular e exibir a sequência atual de dias consecutivos marcado e o recorde histórico, dentro do "Ranking de Itens" já existente na aba Checklist de `/analise`.

**Architecture:** Uma função pura nova (`computeItemStreaks`, irmã de `computeItemStats` já existente) calcula sequências a partir do histórico completo de `checklist_daily_polls` em ordem cronológica. A rota `GET /checklists/dashboard` busca esse histórico completo (query nova, sem corte de 30 dias) e funde o resultado com o `itemStats` já calculado. O frontend só precisa dos 2 campos novos no tipo `ChecklistItemStat` e de uma linha extra de texto no componente `ChecklistItemRanking`.

**Tech Stack:** Express + MySQL2 + Jest (backend), React + TypeScript (frontend).

## Global Constraints

- Todo código, comentário e mensagem visível em **português (pt-BR)**.
- Dia contabilizado = linha de `checklist_daily_polls` com `status IN ('sent', 'completed')`. Dias sem envio (fora da recorrência do checklist) não têm linha na tabela e ficam automaticamente fora do cálculo — não reconstruir calendário nem replicar lógica de recorrência.
- Sequência é por **item individual**, não pelo checklist como um todo.
- Sem limite de paginação na query de histórico completo (volume de dados de app pessoal é pequeno).
- Não modificar `computeItemStats` nem a query de 30 dias já existente — a nova função e a nova query são adições, não substituições.
- Segue o padrão já estabelecido: funções puras (sem I/O) ganham teste Jest (`backend/src/services/__tests__/checklistStats.test.ts`); funções com I/O direto em `pool.query` não têm teste automatizado neste projeto.

---

## Task 1: Backend — função pura `computeItemStreaks`

**Files:**
- Modify: `backend/src/services/checklistStats.ts`
- Modify: `backend/src/services/__tests__/checklistStats.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependências externas).
- Produces: `export interface ChecklistItemStreak { text: string; current: number; best: number }` e `export function computeItemStreaks(itemTexts: string[], pollsSelectedOptionsChronological: string[][]): ChecklistItemStreak[]`, exportadas de `checklistStats.ts`, consumidas pelo Task 2.

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final de `backend/src/services/__tests__/checklistStats.test.ts` (mantendo o `describe('computeItemStats', ...)` já existente intacto acima) e atualize o import do topo do arquivo:

```ts
import { computeItemStats, computeItemStreaks } from '../checklistStats'
```

```ts
describe('computeItemStreaks', () => {
  it('conta sequência simples sem quebras', () => {
    const result = computeItemStreaks(['Tomar remédio'], [
      ['Tomar remédio'],
      ['Tomar remédio'],
      ['Tomar remédio'],
    ])
    expect(result).toEqual([{ text: 'Tomar remédio', current: 3, best: 3 }])
  })

  it('quebra a sequência quando o item não é marcado, mas mantém o recorde anterior', () => {
    const result = computeItemStreaks(['Item'], [
      ['Item'],
      ['Item'],
      [],
      ['Item'],
    ])
    expect(result).toEqual([{ text: 'Item', current: 1, best: 2 }])
  })

  it('recorde igual à sequência atual quando ela é a maior já vista', () => {
    const result = computeItemStreaks(['Item'], [
      ['Item'],
      [],
      ['Item'],
      ['Item'],
      ['Item'],
    ])
    expect(result).toEqual([{ text: 'Item', current: 3, best: 3 }])
  })

  it('retorna zero para lista de polls vazia', () => {
    const result = computeItemStreaks(['Item único'], [])
    expect(result).toEqual([{ text: 'Item único', current: 0, best: 0 }])
  })

  it('calcula sequências independentes para múltiplos itens no mesmo poll', () => {
    const result = computeItemStreaks(['A', 'B'], [
      ['A', 'B'],
      ['A'],
      ['A', 'B'],
    ])
    expect(result).toEqual([
      { text: 'A', current: 3, best: 3 },
      { text: 'B', current: 1, best: 1 },
    ])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && npx jest checklistStats -t computeItemStreaks`
Expected: FAIL — `computeItemStreaks is not a function` (ou erro de import, já que a função ainda não existe).

- [ ] **Step 3: Implementar `computeItemStreaks`**

Adicione ao final de `backend/src/services/checklistStats.ts`:

```ts
export interface ChecklistItemStreak {
  text: string
  current: number
  best: number
}

export function computeItemStreaks(
  itemTexts: string[],
  pollsSelectedOptionsChronological: string[][],
): ChecklistItemStreak[] {
  return itemTexts.map((text) => {
    let current = 0
    let best = 0
    for (const options of pollsSelectedOptionsChronological) {
      if (options.includes(text)) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return { text, current, best }
  })
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest checklistStats`
Expected: PASS — todos os testes de `computeItemStats` (já existentes) e `computeItemStreaks` (novos) passando.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/checklistStats.ts backend/src/services/__tests__/checklistStats.test.ts
git commit -m "feat(checklist): adiciona computeItemStreaks para sequencias por item"
```

---

## Task 2: Backend — expõe streaks em `GET /checklists/dashboard`

**Files:**
- Modify: `backend/src/routes/checklists.ts`

**Interfaces:**
- Consumes: `computeItemStreaks` e `ChecklistItemStreak` de `../services/checklistStats` (Task 1).
- Produces: cada entrada de `itemStats` na resposta de `GET /checklists/dashboard` ganha `streak_current: number` e `streak_best: number`, consumidos pelo Task 3.

- [ ] **Step 1: Atualizar o import de `checklistStats`**

No topo de `backend/src/routes/checklists.ts`, troque:

```ts
import { computeItemStats } from '../services/checklistStats'
```

por:

```ts
import { computeItemStats, computeItemStreaks } from '../services/checklistStats'
```

- [ ] **Step 2: Buscar o histórico completo e calcular os streaks**

Na rota `GET /dashboard`, logo depois do bloco que calcula `itemStats` (após a linha `const itemStats = computeItemStats(items.map((i: any) => i.text), pollsSelectedOptions)` e antes do `res.json(...)`), adicione:

```ts
    const [streakPollRows]: any = await pool.query(
      `SELECT selected_options
         FROM checklist_daily_polls
        WHERE checklist_id = ? AND status IN ('sent', 'completed')
        ORDER BY poll_date ASC`,
      [checklist.id],
    )
    const pollsChronological: string[][] = streakPollRows.map((r: any) => {
      const raw = r.selected_options
      return Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : [])
    })
    const itemStreaks = computeItemStreaks(items.map((i: any) => i.text), pollsChronological)
    const streaksByText = new Map(itemStreaks.map((s) => [s.text, s]))
    const itemStatsWithStreak = itemStats.map((stat) => {
      const streak = streaksByText.get(stat.text)
      return {
        ...stat,
        streak_current: streak?.current ?? 0,
        streak_best: streak?.best ?? 0,
      }
    })
```

- [ ] **Step 3: Usar `itemStatsWithStreak` na resposta**

Troque a linha final da rota:

```ts
    res.json({ checklist: { ...checklist, items }, today: todayPoll, history, itemStats })
```

por:

```ts
    res.json({ checklist: { ...checklist, items }, today: todayPoll, history, itemStats: itemStatsWithStreak })
```

- [ ] **Step 4: Type-check o backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar a suíte de testes do backend**

Run: `cd backend && npm test`
Expected: todos os testes existentes continuam passando (nenhuma mudança de comportamento em `computeItemStats` ou nas rotas já testadas).

- [ ] **Step 6: Verificar manualmente com curl**

Com o backend rodando (`cd backend && npm run dev`) e `DEV_OTP_BYPASS=true` no `.env`, obtenha um token (mesmo fluxo usado em specs anteriores: `POST /api/auth/request-otp`, ler o código no log, `POST /api/auth/verify-otp`) e então:

```bash
curl -s "http://localhost:4000/api/checklists/dashboard" -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200, `itemStats` é um array onde cada entrada tem `text`, `marked_count`, `total_polls`, `pct`, `streak_current` e `streak_best` (os dois últimos números, `0` se o checklist não tiver histórico).

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/checklists.ts
git commit -m "feat(checklist): expoe streak_current e streak_best no dashboard"
```

---

## Task 3: Frontend — tipo e exibição do streak no Ranking de Itens

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/checklist/ChecklistItemRanking.tsx`

**Interfaces:**
- Consumes: `ChecklistItemStat` (com os 2 campos novos) vindo de `checklistDashboard.itemStats`, já buscado por `checklistsApi.dashboard()` — nenhuma mudança necessária no API client, já que o tipo de retorno é o mesmo, só com campos adicionais.
- Produces: nenhuma interface nova — mudança de exibição isolada no componente já consumido por `src/pages/Analise.tsx` (aba Checklist).

- [ ] **Step 1: Adicionar os campos ao tipo `ChecklistItemStat`**

Em `src/types/index.ts`, troque:

```ts
export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
}
```

por:

```ts
export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
  streak_current: number
  streak_best: number
}
```

- [ ] **Step 2: Exibir o streak em `ChecklistItemRanking.tsx`**

Substitua o conteúdo do arquivo por:

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
          <div key={stat.text} className="space-y-1">
            <div className="flex items-center gap-3">
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
            {(stat.streak_current > 0 || stat.streak_best > 0) && (
              <p className="text-[11px] text-on-surface-variant pl-[8.75rem]">
                🔥 {stat.streak_current} {stat.streak_current === 1 ? 'dia' : 'dias'}
                {stat.streak_current !== stat.streak_best && ` · recorde ${stat.streak_best}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Notas sobre a mudança: cada linha de item vira uma coluna (`space-y-1`) contendo a linha original (label + barra + %) e, condicionalmente, uma segunda linha com o streak. `pl-[8.75rem]` alinha o texto do streak sob a barra (largura do label `w-32` = 8rem + `gap-3` = 0.75rem). A linha de streak só aparece se `streak_current` ou `streak_best` forem maiores que zero — itens com `total_polls === 0` (sem dados) naturalmente têm `streak_current`/`streak_best` iguais a zero também, então já ficam de fora sem precisar de checagem extra. Quando a sequência atual é igual ao recorde, omite o "· recorde N" repetido.

- [ ] **Step 3: Type-check o frontend**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificar no browser**

Com backend e frontend rodando e pelo menos um checklist com alguns dias de histórico marcado, navegue para `/analise`, aba Checklist. Confirme:
- Itens com sequência ativa mostram `🔥 N dias` (e `· recorde M` quando o recorde é maior que a sequência atual).
- Itens sem histórico (`sem dados ainda`) não mostram linha de streak.
- Texto do streak alinhado visualmente sob a barra de progresso, não quebrando o layout em mobile.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/components/checklist/ChecklistItemRanking.tsx
git commit -m "feat(checklist): exibe streak atual e recorde no ranking de itens"
```

---

## Self-Review Notes

- **Cobertura da spec:** cálculo por item (Task 1), exposição via API sem corte de 30 dias (Task 2), exibição condicional com omissão de recorde redundante (Task 3) — todos os pontos da spec têm task correspondente.
- **Placeholders:** nenhum. Todo código é completo e pronto para uso.
- **Consistência de tipos:** `ChecklistItemStreak { text, current, best }` (Task 1) é mapeado para `streak_current`/`streak_best` no merge da Task 2, e esses mesmos nomes (`streak_current`, `streak_best`) são usados no tipo `ChecklistItemStat` e no componente da Task 3 — sem divergência de nomes entre as tasks.
