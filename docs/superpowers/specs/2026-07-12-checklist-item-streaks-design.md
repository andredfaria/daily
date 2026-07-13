# Streaks (sequências) por item de checklist

## Contexto

O dashboard de checklists (`ChecklistItemRanking`, usado hoje na aba Checklist de `/analise`) mostra, para cada item, a taxa de conclusão dos últimos 30 dias (`marked_count / total_polls`). A spec anterior do dashboard (`docs/superpowers/specs/2026-07-10-checklist-dashboard-design.md`) considerou streaks e deixou explicitamente fora de escopo: *"Não implementa streaks (sequências consecutivas) — pode ser um seed para depois, mas não faz parte deste escopo."*

Este é esse seed: adicionar, por item, a sequência atual de dias consecutivos marcado e o recorde histórico — um gancho de gamificação simples em cima do que já existe (`checklist_daily_polls.selected_options`).

## Objetivo

Para cada item de um checklist, calcular e exibir:
1. **Sequência atual**: quantos dias consecutivos (mais recentes) o item foi marcado, terminando no último poll enviado/concluído.
2. **Recorde**: a maior sequência já alcançada por esse item em todo o histórico do checklist.

## Definições

- **Unidade da sequência**: o **item** (não o checklist inteiro — um checklist pode estar em 60% hoje e ainda assim um item específico estar numa sequência de 10 dias).
- **Dia contabilizado**: uma linha de `checklist_daily_polls` com `status IN ('sent', 'completed')`. Como uma linha só existe para dias em que o checklist foi de fato enviado (a recorrência — diária/dias úteis/customizada — já filtra isso antes do envio), dias sem envio ficam automaticamente fora do cálculo, sem precisar reconstruir calendário ou replicar a lógica de recorrência.
- **Sequência quebrada**: qualquer dia contabilizado em que o texto do item não aparece em `selected_options` zera a contagem corrente.
- **Sequência atual**: a sequência que termina no poll mais recente contabilizado (não exige que esse poll seja de hoje — se o último envio foi há alguns dias, a sequência "atual" reflete esse último envio, mesma convenção de imediatismo já usada pelo restante do dashboard).
- **Recorde**: o maior valor de sequência observado em qualquer ponto do histórico completo do checklist (pode ser igual à sequência atual, se ela for a maior já vista).

## Mudanças no Backend

### `backend/src/services/checklistStats.ts`

Nova função pura, irmã de `computeItemStats` já existente no mesmo arquivo:

```ts
export interface ChecklistItemStreak {
  text: string
  current: number
  best: number
}

export function computeItemStreaks(
  itemTexts: string[],
  pollsSelectedOptionsChronological: string[][],
): ChecklistItemStreak[]
```

Diferença chave em relação a `computeItemStats`: os polls devem vir em **ordem cronológica ascendente** (mais antigo primeiro) — a ordem importa para detectar sequências, ao contrário de `computeItemStats` que só soma ocorrências sem se importar com ordem.

Para cada item: percorre a lista de polls, mantém um contador de sequência corrente (incrementa se o item está em `selected_options`, zera se não está), e um contador de recorde (`Math.max` a cada passo). Ao final, `current` é o valor da sequência corrente no último poll da lista; `best` é o maior valor visto.

Lista vazia → `{ text, current: 0, best: 0 }` para cada item.

### `GET /checklists/dashboard` (`backend/src/routes/checklists.ts`)

A rota já busca `itemStats` (últimos 30 dias) via `computeItemStats`. Adiciona uma segunda query buscando **todo o histórico** de polls do checklist (sem corte de 30 dias, já que o recorde pode ser mais antigo):

```sql
SELECT selected_options
  FROM checklist_daily_polls
 WHERE checklist_id = ?
   AND status IN ('sent', 'completed')
 ORDER BY poll_date ASC
```

Chama `computeItemStreaks(itemTexts, pollsChronological)` com o resultado e funde (`by text`) com o `itemStats` já calculado, adicionando `streak_current` e `streak_best` a cada entrada.

### Tipos compartilhados (`src/types/index.ts`)

`ChecklistItemStat` ganha dois campos:

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

## Mudanças no Frontend

### `src/components/checklist/ChecklistItemRanking.tsx`

Abaixo da barra de progresso de cada item, uma linha compacta de texto:

```
🔥 3 dias · recorde 12
```

- Se `streak_current === 0` e `streak_best === 0` (item nunca foi marcado, ou não tem streak relevante), a linha não aparece — mantém só a barra de %, como hoje.
- Se `streak_current === streak_best` (sequência atual é o próprio recorde), mostra só `🔥 {current} dias` sem repetir o recorde (evita redundância tipo "5 dias · recorde 5").
- Itens com `total_polls === 0` (já tratados hoje como "sem dados ainda") continuam sem mudança — não mostram streak.

Nenhuma mudança em `Analise.tsx`: o componente já é consumido na aba Checklist e passa a receber os campos novos automaticamente via `checklistDashboard.itemStats`.

## Testes

`computeItemStreaks` é função pura (sem I/O) → testes Jest em `backend/src/services/__tests__/checklistStats.test.ts` (mesmo arquivo de `computeItemStats`, seguindo o padrão já estabelecido):
- Sequência simples sem quebras (item marcado em todos os polls).
- Sequência quebrada no meio (item marcado, depois não marcado, depois marcado de novo) — `current` reflete só a última sequência, `best` reflete a maior de todas.
- `current === best` quando a sequência mais recente é a maior já vista.
- Lista de polls vazia → `current: 0, best: 0`.

Não há teste automatizado para a query em si (função com I/O em `pool.query`), consistente com o padrão já estabelecido no projeto (`gastosPorCategoria`, `projecaoMensal`, `historicoMensal`, `topOcorrencias` também não têm).

## Fora de escopo

- Streak do checklist como um todo (soma de todos os itens 100% num dia) — só streak por item individual, conforme pedido.
- Notificação, toast ou celebração ao bater recorde.
- Exibir streak em `/checklists` — fica só na aba Checklist de `/analise`, já que é métrica aprofundada (mesma divisão de responsabilidade estabelecida na reestruturação anterior da tela de Análise).
- Qualquer limite de paginação/corte na query de histórico completo — para o volume de dados de um app pessoal (um usuário, um checklist, no máximo alguns milhares de polls ao longo de anos), buscar tudo é aceitável.
