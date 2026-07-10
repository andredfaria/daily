# Melhoria do Dashboard de Checklists

## Contexto

Hoje a tela `/checklists` (`src/pages/Checklists.tsx`) tem duas partes:
1. Uma lista de cards (`ChecklistCard`), um por checklist, com nome, itens, horário e recorrência.
2. Um painel de "dashboard" fixo abaixo da lista, que sempre mostra dados do **checklist mais recentemente ativo** (`getMostRecentChecklist` no backend) — progresso de hoje e uma lista dos últimos 14 dias com barras de progresso finas.

Limitações que motivam esta mudança:
- Não há como saber, olhando a lista, quantas vezes cada checklist foi de fato concluído na semana, no mês, ou no total.
- O painel de detalhe só mostra um checklist por vez (o mais recente), sem forma de escolher outro quando o usuário tem mais de um.
- Não existe nenhuma visão por item — não dá pra saber quais itens do checklist a pessoa cumpre sempre e quais costuma pular.
- A visualização de histórico (lista de barrinhas) não deixa padrões (ex: falha sempre no fim de semana) fáceis de enxergar.

## Objetivo

1. Mostrar, para cada checklist na lista, quantas vezes ele foi **concluído** (100% dos itens marcados) na última semana, no último mês e no total histórico.
2. Permitir escolher qual checklist ver em detalhe (hoje só mostra o mais recente).
3. Melhorar a visualização do histórico com um mapa de calor (estilo GitHub).
4. Adicionar uma visão por item: quantas vezes cada item foi marcado vs não marcado, para identificar itens sempre cumpridos vs sempre pulados.

## Definições

- **Dia concluído**: `completion_pct = 100` no `checklist_daily_polls` daquele dia (todos os itens marcados). Dias parciais continuam aparecendo no histórico/heatmap, mas não contam nos contadores de semana/mês/total.
- **Semana**: janela móvel dos últimos 7 dias corridos (não semana de calendário).
- **Mês**: janela móvel dos últimos 30 dias corridos (não mês de calendário).
- **Total**: todo o histórico do checklist.
- **Taxa de item**: para cada item (comparado por texto, mesma lógica já usada para `selected_options`), quantas vezes o texto apareceu em `selected_options` dos polls enviados/completados nos últimos 30 dias, dividido pelo total de polls enviados no período.

## Mudanças no Backend

### Novo endpoint: `GET /api/checklists/stats`

Retorna, para **todos** os checklists do usuário autenticado, um array de:

```ts
interface ChecklistStatsEntry {
  checklist_id: string
  week_count: number   // dias 100% concluídos nos últimos 7 dias (0-7)
  month_count: number  // dias 100% concluídos nos últimos 30 dias (0-30)
  total_count: number  // dias 100% concluídos em todo o histórico
}
```

Query: agregação em `checklist_daily_polls` filtrando `status IN ('sent','completed')` e `completion_pct = 100`, com `LEFT JOIN` a partir de `checklists` para incluir checklists sem nenhum registro ainda (retornam zeros). Agrupado por `checklist_id`.

### `GET /api/checklists/dashboard` — extensão

- Novo query param opcional `checklistId`. Se ausente, mantém o comportamento atual (usa `getMostRecentChecklist`). Se presente, valida ownership (checklist pertence ao `req.userId`) e usa esse checklist.
- `history`: janela ampliada de 14 para **84 dias** (12 semanas), para alimentar o heatmap. Cada entrada mantém o formato atual (`poll_date, completed_count, total_count, completion_pct, status`); dias sem registro simplesmente não aparecem no array (o frontend trata a ausência como "sem envio").
- Novo campo `itemStats`:

```ts
interface ChecklistItemStat {
  text: string
  marked_count: number   // quantas vezes esse texto apareceu em selected_options, últimos 30 dias
  total_polls: number    // quantos polls enviados/completados no período
  pct: number             // marked_count / total_polls * 100, arredondado; 0 se total_polls = 0
}
```

Calculado a partir dos itens atuais do checklist (`checklist_items`) cruzados com `selected_options` dos `checklist_daily_polls` dos últimos 30 dias com `status IN ('sent','completed')`.

### Tipos compartilhados (`src/types/index.ts`)

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

### API client (`src/api/checklists.ts`)

- Novo método `stats(): Promise<ChecklistStatsEntry[]>` → `GET /checklists/stats`.
- `dashboard(checklistId?: string): Promise<ChecklistDashboardData>` → `GET /checklists/dashboard` com `checklistId` como query param quando informado.

## Mudanças no Frontend

### 1. Cards da lista (`ChecklistCard`)

Recebe uma nova prop opcional `stats?: ChecklistStatsEntry`. Abaixo da linha de recorrência, uma linha compacta com 3 mini-estatísticas lado a lado:

```
  Semana    Mês     Total
   5/7     18/30      42
```

- `Semana` mostra `week_count/7`, `Mês` mostra `month_count/30`, `Total` mostra `total_count`.
- Se `stats` for `undefined` (checklist sem nenhum registro ainda), mostra `–/7`, `–/30`, `0`.
- `Checklists.tsx` busca `checklistsApi.stats()` em paralelo com `get()` e `dashboard()` dentro do `fetchData()` já existente, e monta um `Map<checklist_id, ChecklistStatsEntry>` para passar a stats certa a cada card.

### 2. Seletor de checklist no painel de detalhes

Acima da seção "Progresso de Hoje", uma linha de abas (pill buttons, mesmo padrão visual dos botões de dias da semana no formulário) com o nome de cada checklist. Clicar troca o `selectedChecklistId` em estado local, que dispara um novo fetch de `checklistsApi.dashboard(selectedChecklistId)`.

- Seleção inicial: primeiro checklist retornado por `dashboard()` sem parâmetro (comportamento atual — o mais recente).
- Se o usuário só tem 1 checklist, as abas não aparecem (evita redundância visual).
- Os 4 `StatCard`s no topo (Itens, Horário de Envio, Conclusão Hoje, Dias Registrados) passam a refletir o checklist selecionado na aba.

### 3. Heatmap de histórico (substitui "Últimos 14 Dias")

Novo componente `ChecklistHeatmap`, grade de 12 colunas (semanas) × 7 linhas (dias, ordem `Dom, Seg, Ter, Qua, Qui, Sex, Sáb` — mesma convenção de índice 0=domingo já usada em `recurrence_days`/`DAYS_LABELS`). Constrói a grade no frontend a partir do array `history` retornado pelo backend (84 dias), preenchendo os dias sem registro como "sem envio".

Cada célula tem 5 estados visuais:
- sem registro para o dia → cor neutra/apagada (`bg-surface-container`)
- `completion_pct = 0` → tom mais claro de `primary`
- `1-50%` → tom claro-médio
- `51-99%` → tom médio-forte
- `100%` → `tertiary` cheio (mesma cor que o `ProgressBar` já usa para 100%; os tons de `0-99%` usam variações de `primary`)

Tooltip nativo (`title`) em cada célula com data formatada + percentual. Legenda abaixo da grade com as 5 cores rotuladas.

### 4. Ranking de itens (nova seção)

Novo componente `ChecklistItemRanking`, abaixo do heatmap, dentro do mesmo `glass-card` ou em um card próprio. Usa `itemStats` do `dashboard()`. Uma linha por item, ordenada por `pct` decrescente:

```
Tomar remédio      ██████████████░  93%
Beber água         ███████████░░░░░  73%
Exercício          ███████░░░░░░░░  47%
```

Barra horizontal (mesmo componente `ProgressBar` já existente, ou uma variante), label do item à esquerda truncado, percentual à direita. Itens com `total_polls = 0` (checklist muito novo ou item recém-adicionado) vão para o fim da lista com "sem dados ainda" no lugar da barra.

## Fora de escopo

- Não altera o fluxo de criação/edição de checklist, nem o envio via WAHA.
- Não adiciona exportação de dados ou filtros de data customizados — janelas fixas de 7/30 dias e histórico total.
- Não implementa streaks (sequências consecutivas) — pode ser um seed para depois, mas não faz parte deste escopo.
- Não muda a definição de "concluído" usada em `today.completion_pct` (já existente); só introduz o corte de 100% para os contadores de semana/mês/total.
