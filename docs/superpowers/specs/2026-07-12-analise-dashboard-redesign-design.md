# Reestruturação da tela de Análise

## Contexto

Hoje `/analise` (`src/pages/Analise.tsx`) é bem simples: um seletor "Mês atual / Próximo mês" que controla dois blocos — pizza de gastos por categoria e barras de projeção dos próximos meses. Não há nenhuma visão de checklist ali.

Enquanto isso, `/checklists` (`src/pages/Checklists.tsx`) acumulou um dashboard analítico completo (heatmap de 12 semanas, ranking de itens, grid de 4 stat cards) misturado com a gestão de checklists (criar/editar/excluir/enviar). `/` (`Dashboard.tsx`) já cobre bem a visão rápida do dia a dia (contas ativas, vencimentos da semana, conclusão do checklist hoje).

Falta um lugar único para dados **aprofundados** — tanto financeiros quanto de checklist — organizados e fáceis de ler.

## Objetivo

Reestruturar as responsabilidades das 3 telas:

- **`Dashboard.tsx`** (`/`) — visão rápida, dados principais do dia a dia. Sem mudanças.
- **`Analise.tsx`** (`/analise`) — vira o lugar de métricas e gráficos aprofundados, com duas abas: **Financeiro** e **Checklist**.
- **`Checklists.tsx`** (`/checklists`) — foca em gestão (criar/editar/excluir/enviar). Remove o heatmap, o ranking de itens e o grid de 4 stat cards (tudo isso passa a viver só em Análise), mantendo apenas o card "Progresso de Hoje" (tem os botões acionáveis de enviar/reenviar).

## Mudanças no Backend

### `backend/src/services/financialAnalytics.ts`

Nova função `historicoMensal(userId, meses)`, espelhando `projecaoMensal` mas olhando para trás: soma de `bill_occurrences.amount` por mês para os últimos N meses **incluindo o mês corrente** (parcial, até hoje).

```ts
export async function historicoMensal(
  userId: string,
  meses: number
): Promise<MesProjecao[]>
```

Mesma query de `projecaoMensal`, mas o range vai de `hoje - (N-1) meses, dia 1` até `último dia do mês corrente`. Reaproveita a interface `MesProjecao` já existente.

Nova função `topOcorrencias(userId, from, to, limit)`:

```ts
export interface OcorrenciaTop {
  id: string
  bill_id: string
  bill_name: string
  category: string
  amount: number
  due_date: string
}

export async function topOcorrencias(
  userId: string,
  from: string,
  to: string,
  limit: number
): Promise<OcorrenciaTop[]>
```

Query: `bill_occurrences` join `bills`, filtro `user_id` + `is_active = 1` + `due_date BETWEEN from AND to`, `ORDER BY amount DESC LIMIT ?`.

`fechamentoMensal` já existe e não precisa mudar — só passa a ser exposta via rota.

### `backend/src/routes/analytics.ts` — novas rotas

- `GET /api/analytics/budget` — sem parâmetros, sempre mês corrente. Chama `fechamentoMensal(userId, ano, mes)` do mês atual e retorna `{ total, orcamento, qtdContas, porCategoria }` (formato já retornado pela função).
- `GET /api/analytics/history?months=6` — chama `historicoMensal(userId, months)`, mesmo formato de resposta de `/projection` (`{ meses: [{ ano, mes, label, total }] }`), reaproveitando o mesmo mapeamento de nomes de mês.
- `GET /api/analytics/top-occurrences?from=&to=&limit=5` — `from`/`to` obrigatórios (`YYYY-MM-DD`), `limit` default 5, máximo 20. Retorna `{ ocorrencias: OcorrenciaTop[] }`.

`/by-category` e `/projection` continuam exatamente como estão hoje (nenhuma mudança de contrato) — o frontend só passa a chamá-las com período fixo em vez de deixar o usuário escolher.

### Tipos compartilhados (`src/types/index.ts`)

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

`ProjectionResponse` é reaproveitado como o formato de resposta de `/analytics/history` (mesmo shape `{ meses: [...] }`).

### `src/api/analytics.ts`

Novos métodos `budget()`, `history(months = 6)`, `topOccurrences(from, to, limit = 5)`, seguindo o mesmo padrão dos métodos existentes.

## Mudanças no Frontend

### `Analise.tsx` — abas no topo

Duas abas (`'financeiro' | 'checklist'`), mesmo padrão visual de pill buttons já usado no seletor de período atual. Aba ativa por padrão: `'financeiro'`. Estado da aba ativa em `useState`, sem persistir em URL (`?tab=`) — escopo mínimo. Cada aba busca seus próprios dados só quando é selecionada pela primeira vez (fetch lazy, resultado cacheado em estado local enquanto a página estiver montada).

### Aba Financeiro

Cinco blocos, sem seletor de período global — cada um usa o range mais adequado ao seu conteúdo:

**Grid 2 colunas (lado a lado em telas ≥ sm, empilhados em mobile):**

1. **Card Orçamento** — busca `analyticsApi.budget()`. Mês corrente.
   - Se `orcamento` não for `null`: barra de progresso `total / orcamento`, cor muda pra `error` se `total > orcamento`.
   - Se `orcamento` for `null`: mostra só o `total` gasto no mês + link "Definir limite mensal →" para `/configuracoes`.
2. **Card Top Contas** — busca `analyticsApi.topOccurrences(from, to, 5)` com `from`/`to` = mês corrente (mesmo cálculo de `periodoRange('atual')` já existente). Lista compacta: ícone da conta (reaproveita `getBillIcon`), nome, valor, data. Estado vazio: "Nenhuma conta neste período."

**Full-width, empilhados:**

3. **Gastos por Categoria** — pizza, exatamente como hoje, mas fixo no mês corrente (sem mais alternar pra "próximo mês" — essa opção sai da aba Financeiro).
4. **Histórico** — barras dos últimos 6 meses (`analyticsApi.history(6)`), incluindo o mês corrente parcial. A última barra (mês corrente) usa opacidade reduzida ou um padrão visual diferente (ex: hachurado/cor mais clara) com um rótulo "(parcial)" ao lado do label do mês, deixando claro que não é comparável 1:1 com os meses fechados.
5. **Projeção** — barras dos próximos 6 meses, exatamente como hoje (`analyticsApi.projection(6)`).

Cada bloco carrega e falha independentemente (`Promise.allSettled`), com skeleton individual durante o loading e mensagem de erro/vazio inline se a chamada falhar — uma falha não derruba os outros blocos.

### Aba Checklist

Reaproveita os componentes que hoje vivem em `Checklists.tsx`, movidos para dentro de `Analise.tsx`:

- Seletor de checklist (pill buttons), só aparece se o usuário tiver mais de 1 checklist — mesma lógica de `selectedChecklistId` já existente.
- Grid de 4 `StatCard`s (Itens, Horário de Envio, Conclusão Hoje, Dias Registrados).
- `ChecklistHeatmap` (12 semanas).
- `ChecklistItemRanking`.

Dados vêm de `checklistsApi.dashboard(checklistId)` e `checklistsApi.stats()`, mesmas chamadas que `Checklists.tsx` já faz hoje. Estado vazio (nenhum checklist cadastrado): mensagem + botão "Criar checklist →" navegando pra `/checklists`, mesmo padrão do estado vazio já usado no Dashboard.

### `Checklists.tsx` — simplificação

Remove:
- O grid de 4 `StatCard`s (Itens, Horário de Envio, Conclusão Hoje, Dias Registrados) que hoje aparece acima da lista de cards.
- O seletor de checklist + `renderHistory()` (heatmap) + `ChecklistItemRanking` do "painel de detalhes".

Mantém:
- Lista de cards (`ChecklistCard`) com as mini-estatísticas semana/mês/total que já têm.
- Formulário de criar/editar.
- O card "Progresso de Hoje" (`renderTodaySection`), incluindo os botões "Enviar Agora"/"Reenviar" — continua vinculado ao checklist mais recente (`dashboard()` sem `checklistId`, comportamento atual). Se o usuário quiser ver o progresso de outro checklist específico, vai pra aba Checklist em Análise.
- Modais de exclusão e limpeza de histórico.

`fetchData()` em `Checklists.tsx` não precisa mais chamar `checklistsApi.stats()` para o painel de detalhes (só é usado pelos cards da lista, que continuam).

## Fora de escopo

- Não adiciona filtro de data customizado (date picker) em nenhum bloco — janelas fixas conforme descrito acima.
- Não persiste a aba ativa de Análise na URL.
- Não muda o cálculo de `fechamentoMensal`, `gastosPorCategoria` ou `projecaoMensal` já existentes.
- Não adiciona rastreamento de status pago/pendente/atrasado por ocorrência — esse campo não existe hoje no schema e está fora do escopo desta mudança.
- Não altera o fluxo de criação/edição/envio de checklist.
