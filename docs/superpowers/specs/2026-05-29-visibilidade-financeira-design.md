# Design — Visibilidade Financeira (BillSync)

**Data:** 2026-05-29
**Status:** Aprovado para planejamento
**Escopo:** F1 (gastos por categoria), F2 (projeção dos próximos meses), F4 (sumário mensal no WhatsApp)
**Adiado:** F3 (alerta de variação de valor) — épico separado, depende de captura de valor real por ocorrência
**Execução:** preferência do usuário por execução com múltiplos agentes em paralelo

---

## 1. Contexto e motivação

O BillSync será disponibilizado ao público (modelo freemium, perfil pessoa física comum).
Duas áreas foram identificadas como incompletas para lançamento: **visibilidade financeira** e
**confiabilidade/controle**. Esta spec cobre a primeira.

### Estado atual relevante

- A funcionalidade de pagamento foi **removida** recentemente (commits `f1aed67`..`074f14d`).
  A migração 010 derrubou as colunas `status`, `paid_at` e `confirmation_source` de
  `bill_occurrences`.
- **Fonte de dados financeira:** `bill_occurrences` (id, bill_id, due_date, amount, whatsapp_msg).
  As ocorrências já são **pré-geradas com ~12 meses de antecedência** por
  `occurrenceGenerator.ts`, com `amount` copiado do valor fixo da conta (`bills.amount`).
- `bills` tem `category VARCHAR(50)` (migração 006) — valores no front: `moradia`,
  `assinaturas`, `serviços`, `saúde`, `educação`, `transporte`, `alimentação`, `outro`.
- Infra reutilizável: scheduler horário (cron, America/Sao_Paulo) com hooks às 8h (resumo)
  e 9h (orçamento); `sendWhatsAppText` em `services/waha.ts`; página Dashboard com
  componentes `StatCard` e estética `glass-card`.
- **Não existe biblioteca de gráficos** no projeto (o `DonutChart` foi deletado). Decisão:
  adicionar `recharts`.

### Bugs pré-existentes detectados (relevantes ao escopo)

Após a migração 010, três arquivos ainda fazem query em `o.status`, o que **gera erro de SQL
em runtime**:

1. `services/summaryService.ts` (`sendWeeklySummary`) — soma por `status` pago/pendente/atrasado.
2. `services/budgetAlertService.ts` (`checkBudgetAlert`) — `status IN ('pending','overdue')`.
3. `services/notificationMaterializer.ts` (`materializeForUser`) — `o.status = 'pending'`.

Os itens **1 e 2** entram nesta spec (a F4 reescreve a lógica de resumo e a agregação é
compartilhada com o alerta de orçamento). O item **3** (envio de notificações de contas) está
**fora** de Visibilidade Financeira e é registrado como **bug crítico separado** a tratar
fora desta spec — ver seção 8.

---

## 2. Princípio de arquitetura

Toda visibilidade financeira deriva de **valores devidos** (ocorrências), não de valores pagos
(esse conceito não existe mais). A agregação é feita **on-the-fly via SQL** (`GROUP BY` em
`bill_occurrences JOIN bills`), sem nova tabela de cache — consistente e suficiente para a
escala de finanças pessoais.

Um único service concentra a agregação e é consumido tanto pelos endpoints REST (UI) quanto
pelo disparo de WhatsApp (sumário).

---

## 3. Camada de dados compartilhada

**Arquivo novo:** `backend/src/services/financialAnalytics.ts`

Funções (todas escopadas por `user_id`, sem referência a `status`):

```ts
// Gastos agregados por categoria num período [from, to]
gastosPorCategoria(userId: string, from: string, to: string):
  Promise<Array<{ category: string; total: number; count: number }>>

// Soma das ocorrências por mês, para os próximos N meses (inclui mês corrente)
projecaoMensal(userId: string, meses: number):
  Promise<Array<{ ano: number; mes: number; total: number }>>

// Fechamento de um mês específico: total, quebra por categoria, orçamento e nº de contas
fechamentoMensal(userId: string, ano: number, mes: number):
  Promise<{ total: number; porCategoria: Array<{ category: string; total: number }>;
            orcamento: number | null; qtdContas: number }>
```

Regras de agregação:
- Categoria nula/ausente é agrupada como `'outro'` (`COALESCE(b.category, 'outro')`).
- Apenas contas ativas contam para projeção e categoria: `b.is_active = 1`.
- `fechamentoMensal` lê `users.monthly_budget_limit` para o campo `orcamento`.
- Períodos usam intervalo de datas em `due_date` (inclusivo nas pontas).

---

## 4. F1 — Gastos por categoria

### Backend
`GET /api/analytics/by-category?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Sem parâmetros → default = mês atual (1º ao último dia, America/Sao_Paulo).
- Resposta: `{ from, to, total, categorias: [{ category, total, count, pct }] }`
  (`pct` calculado no backend para evitar divergência de arredondamento na UI).
- Rota registrada em novo `backend/src/routes/analytics.ts`, sob `authMiddleware`.

### Frontend
- **Nova página `src/pages/Analise.tsx`**, protegida, acessível por novo item de navegação
  "Análise" (mantém o Dashboard enxuto e dá espaço para crescimento futuro).
- Donut **recharts** + legenda com nome da categoria, valor em BRL e %.
- Seletor de período: **Mês atual** / **Próximo mês** (toggle simples).
- Mapa de cores por categoria (constante em `src/utils/`), reutilizando ícones de
  `getBillIcon`/categoria existente onde fizer sentido.
- Estado vazio: mensagem amigável quando não há ocorrências no período.

---

## 5. F2 — Projeção dos próximos meses

### Backend
`GET /api/analytics/projection?months=6`
- `months` default 6, limitado a [1, 12].
- Resposta: `{ meses: [{ ano, mes, label, total }] }` (`label` ex.: `"Jun/2026"`).

### Frontend
- Na mesma página **Análise**, abaixo do donut.
- Gráfico de **barras recharts** dos próximos 6 meses.
- Destaque textual do próximo mês: "Você vai gastar ~R$ X em <mês>".

---

## 6. F4 — Sumário mensal no WhatsApp (+ conserto do semanal)

### Sumário mensal (novo)
- **Service:** `sendMonthlySummary(userId)` em `services/summaryService.ts`.
- Usa `fechamentoMensal` do **mês anterior**: total, quebra por categoria (top categorias),
  e comparação com `monthly_budget_limit` quando configurado.
- **Scheduler:** dispara no **dia 1, às 8h BRT**, para usuários com
  `monthly_summary_enabled = 1`, `is_active = 1` e `whatsapp_alerts_enabled = 1`.
- Mensagem em pt-BR, formato consistente com o resumo semanal existente (emojis + BRL).

### Conserto do resumo semanal (`sendWeeklySummary`)
- Remover toda referência a `o.status`.
- Novo conteúdo: total do mês corrente + próximas contas dos 7 dias (sem split
  pago/pendente/atrasado, que não existe mais).

### Conserto do alerta de orçamento (`checkBudgetAlert`)
- Trocar `SUM ... WHERE status IN ('pending','overdue')` por soma de **todas** as ocorrências
  do mês corrente do usuário (via `financialAnalytics` ou query equivalente sem `status`).

---

## 7. Mudanças de schema e tipos

### Migração 011 (em `backend/src/migrate.ts`)
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE
  AFTER summary_day_of_week;
```
Registrar a migração na lista executada por `runMigrations()`.

### Tipos / API / UI
- `src/types/index.ts`: `User` ganha `monthly_summary_enabled: boolean`.
- `backend/src/routes/users.ts`: aceitar `monthly_summary_enabled` no update de preferências.
- `src/pages/Configuracoes.tsx`: toggle "Resumo mensal no WhatsApp".
- `src/api/analytics.ts` (novo): `byCategory(from, to)`, `projection(months)`.
- Navegação: novo item "Análise" (rota + link).
- `package.json` (frontend): adicionar `recharts`.

---

## 8. Fora do escopo (registrado, não implementado aqui)

- **F3 — Alerta de variação de valor:** requer mecanismo de captura do valor real por
  ocorrência (hoje toda ocorrência herda o valor fixo da conta). Épico separado.
- **Bug crítico: notificações de contas quebradas.** `notificationMaterializer.ts`
  (`materializeForUser`) faz query em `o.status = 'pending'`, coluna removida pela migração 010
  — o envio de lembretes de contas falha em runtime. Deve ser corrigido com urgência **fora**
  desta spec (não é uma feature de visibilidade financeira).

---

## 9. Critérios de sucesso

1. Página **Análise** mostra donut de gastos por categoria do mês atual e do próximo, com
   valores e percentuais corretos derivados de `bill_occurrences`.
2. Página **Análise** mostra projeção em barras dos próximos 6 meses, com destaque do próximo.
3. Usuários com `monthly_summary_enabled` recebem, no dia 1 às 8h BRT, um sumário do mês
   anterior por WhatsApp com total, quebra por categoria e comparação com orçamento.
4. Resumo semanal e alerta de orçamento **não quebram mais em runtime** (sem referência a
   `status`) e enviam conteúdo coerente com o modelo de dados atual.
5. Toggle de resumo mensal disponível e persistido em Configurações.
6. Nenhuma das queries novas referencia colunas removidas (`status`, `paid_at`,
   `confirmation_source`).

---

## 10. Componentes e isolamento

| Unidade | Faz | Depende de |
|---|---|---|
| `financialAnalytics.ts` | Agrega valores por categoria/mês | `db` (pool) |
| `routes/analytics.ts` | Expõe agregações via REST | `financialAnalytics`, `authMiddleware` |
| `summaryService.ts` | Monta e envia resumos (semanal + mensal) | `financialAnalytics`, `waha` |
| `budgetAlertService.ts` | Alerta de estouro de orçamento | `financialAnalytics`, `waha` |
| `Analise.tsx` + `api/analytics.ts` | Renderiza gráficos | endpoints `/api/analytics/*`, recharts |
| Migração 011 | Coluna `monthly_summary_enabled` | `migrate.ts` |
