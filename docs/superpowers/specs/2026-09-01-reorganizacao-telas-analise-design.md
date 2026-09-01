# Reorganização das Telas: Análise por Domínio e Home

| Campo | Valor |
|---|---|
| **Data** | 2026-09-01 |
| **Status** | Design aprovado — pronto para plano de implementação |
| **Escopo** | Frontend (rotas, páginas, componentes) + backend (snapshots de ativos) |

---

## 1. Problema

A página `/analise` concentra métricas de dois domínios diferentes (contas e
checklists) atrás de duas abas próprias. Quem quer entender os gastos precisa
sair de Contas, ir para Análise e escolher a aba certa; a análise vive longe
do dado que ela analisa.

Ativos não tem análise nenhuma — `routes/assets.ts` faz CRUD e cotação, e a
tela lista posições sem nenhuma visão agregada de patrimônio, alocação ou
resultado.

O Dashboard mistura seis StatCards agregados com a lista de vencimentos, e
mostra o estado do WhatsApp como uma bolinha de 8px com duas palavras ao lado,
enquanto o perfil completo (foto, nome, recado) está enterrado em Configurações.

## 2. Solução

Dissolver `/analise`: cada domínio ganha sua própria aba de análise, dentro da
própria página. `Dashboard` vira `Home`, com o perfil do WhatsApp em destaque e
foco no que exige ação hoje, em vez de números agregados que agora moram nas
abas de análise.

Ativos ganha análise nova, incluindo evolução histórica do patrimônio — o que
exige uma tabela de snapshots diários, alimentada de carona na coleta de
cotações que o alerta de preço já faz.

## 3. Decisões

| # | Decisão | Alternativa descartada |
|---|---|---|
| 1 | Abas são sub-rotas reais (`/contas/analise`) | `useState` local: perde a aba no F5, impede link direto |
| 2 | Shell fino + rotas aninhadas + `TabNav` compartilhado | Página única de ~600 linhas misturando CRUD e gráficos |
| 3 | Ativos com histórico persistido | Só posição atual: mais barato, mas sem evolução |
| 4 | Home = perfil + pendências | Home = painel de resumos: duplica as abas de análise |
| 5 | `Sair` sai do bottom nav, vai para Configurações | Manter 7 alvos numa barra de ~14% de largura cada |
| 6 | `quantity = 0` é watchlist, fora de patrimônio | Contar como posição de valor zero: distorce alocação |
| 7 | Snapshot ignora a trava de cotação velha | Aplicá-la zeraria ações no sábado e criaria queda falsa |
| 8 | vitest no frontend para a agregação de ativos | Deixar a agregação sem teste, ou movê-la para o backend |

## 4. Rotas

```
/                       Home
/contas                 → <Navigate to="lista" replace/>
/contas/lista           ContasLista
/contas/analise         ContasAnalise
/contas/nova            BillForm            (fora do shell)
/contas/:id/editar      BillForm            (fora do shell)
/ativos                 → <Navigate to="carteira" replace/>
/ativos/carteira        AtivosCarteira
/ativos/analise         AtivosAnalise
/checklists             → <Navigate to="lista" replace/>
/checklists/lista       ChecklistsLista
/checklists/analise     ChecklistsAnalise
/notificacoes           Notificacoes
/configuracoes          Configuracoes
```

`/analise` é removida sem redirect: a página deixou de existir conceitualmente
e apontá-la para uma das duas abas seria arbitrário.

`BillForm` fica fora do shell porque é formulário de tela cheia — barra de abas
ali seria ruído.

`/contas/analise` e `/contas/nova` são segmentos estáticos e o React Router os
prioriza sobre `/contas/:id/editar`; não há colisão.

## 5. Estrutura de arquivos

```
src/pages/
  Home.tsx                          ← substitui Dashboard.tsx
  contas/ContasShell.tsx
  contas/ContasLista.tsx            ← Contas.tsx, sem o header próprio
  contas/ContasAnalise.tsx          ← aba Financeiro de Analise.tsx
  ativos/AtivosShell.tsx
  ativos/AtivosCarteira.tsx         ← Ativos.tsx
  ativos/AtivosAnalise.tsx          novo
  checklists/ChecklistsShell.tsx
  checklists/ChecklistsLista.tsx    ← Checklists.tsx
  checklists/ChecklistsAnalise.tsx  ← aba Checklist de Analise.tsx

src/components/
  ui/TabNav.tsx                     novo
  ui/StatCard.tsx                   ← promovido de checklist/StatCard.tsx
  whatsapp/WhatsAppProfileCard.tsx  ← extraído de Configuracoes.tsx
  contas/analise/                   ← components/analise/* movido
  ativos/analise/                   novo
  checklist/analise/                ← Heatmap, ItemRanking, WeeklyTrendSparkline
  checklist/                        ChecklistCard, ProgressBar permanecem

src/utils/assetAnalytics.ts         novo — agregação pura, testada
```

**Removidos:** `src/pages/Analise.tsx`, `src/pages/Dashboard.tsx`,
`src/pages/Historico.tsx` (órfão: nenhum import, nenhuma rota), o `StatCard`
duplicado dentro de `Dashboard.tsx:41-54`, e a entrada `'/historico'` em
`Header.tsx:11`.

`components/analise/` vira `components/contas/analise/` porque, sem a página
Análise, o nome sozinho deixou de identificar o domínio.

## 6. Navegação

`navItems` em `Sidebar.tsx` perde o item Análise, ficando com seis: Home,
Contas, Ativos, Checklists, Notificações, Configurações.

O botão Sair sai do `BottomNav` (`Layout.tsx:32-40`) e passa a existir apenas
dentro de Configurações — a barra mobile fica com seis alvos de navegação real
em vez de sete, e nenhum deles é uma ação destrutiva encostada nas abas.

`pageTitles` no `Header` passa a resolver por prefixo, senão `/contas/lista`
cai no fallback `'BillSync'`. A aba corrente não entra no título: ela já está
visível na `TabNav` logo abaixo.

### `TabNav`

```tsx
<TabNav tabs={[
  { to: 'lista',   label: 'Contas',  icon: 'receipt_long' },
  { to: 'analise', label: 'Análise', icon: 'monitoring' },
]} />
```

`NavLink` por baixo — o estado ativo vem da URL, sem `useState`. Visual de
pílula herdado de `Analise.tsx:206-218`, com `min-h-[44px]` para respeitar o
touch target mínimo do design system.

## 7. Conteúdo das abas de análise

### `/contas/analise`

Realocação da aba Financeiro (`Analise.tsx:107-120`), sem mudança de conteúdo:
`SummaryStats`, `BudgetCard` + `TopOccurrencesList` lado a lado,
`SpendingTrendChart`, `CategoryBreakdown`. As mesmas cinco chamadas em
`Promise.allSettled`.

O flag `financeiroLoaded`, que evitava refetch ao trocar de aba, é removido:
com aba virando rota, o React desmonta o componente de qualquer forma.

### `/checklists/analise`

Realocação da aba Checklist (`Analise.tsx:122-200`): chips de seleção (só com
mais de um checklist), cinco StatCards, `WeeklyTrendSparkline`,
`ChecklistHeatmap`, `ChecklistItemRanking`.

Corte: `Analise.tsx:76` mantém `const [, setChecklistStats]` — busca
`checklistsApi.stats()` e descarta o resultado. A chamada e o estado saem.

### `/ativos/analise`

`AssetWithQuote` já traz `invested_value`, `current_value`, `profit_loss`,
`profit_loss_pct` e `quote_stale` calculados no backend; o resto é agregação em
`src/utils/assetAnalytics.ts`.

```
StatCards ×4        Patrimônio · Investido · Resultado · Ativos (n · m obs)
AreaChart           Evolução do patrimônio, 90 dias (patrimônio × custo)
Rosca               Alocação por tipo: ação / FII / cripto
Barras divergentes  Resultado por ativo, ordenado por percentual
Régua               Distância até alvo e stop, por ativo
```

Regras:

- **Watchlist fora dos agregados.** `quantity = 0` não entra em patrimônio,
  alocação nem resultado — a mesma regra que `assetMath.ts` já aplica em
  `buildHitBlock`. Aparece contada à parte no StatCard e na régua de alvo/stop,
  que é onde ela importa.
- **Cotação velha é rotulada, não escondida.** `quote_stale` gera um aviso no
  topo ("cotações de sexta, 28/08 — mercado fechado"). Omitir o ativo faria o
  patrimônio não bater com a carteira.
- **Alocação por tipo, não por ticker.** Três fatias leem bem; doze viram
  confete. A quebra por ativo mora na barra de resultado ao lado.
- **A régua lista só quem tem alvo ou stop.** O resto vira uma linha final
  ("4 ativos sem alvo definido → definir") com link para a carteira.

Empty states: sem ativo → CTA para `/ativos/carteira`; com ativos e histórico
ainda vazio → "coletando desde 01/09 · volte em alguns dias" no lugar do
gráfico.

Gráficos em Recharts 3.8.1, já usado em `SpendingTrendChart`, com cores dos
tokens de `design-system/billsync/MASTER.md`.

## 8. Home

```
WhatsAppProfileCard          foto · nome · número · ● conectado
PRECISA DE VOCÊ HOJE         renderiza só se houver pendência
  • conta vencendo hoje ou amanhã       → /contas/lista
  • checklist de hoje incompleto        → /checklists/lista
  • ativo com alerta disparado          → /ativos/carteira
PRÓXIMOS VENCIMENTOS
  OccurrenceRow, como hoje
```

| Bloco | Fonte | Regra de pendência |
|---|---|---|
| Perfil | `notificationsApi.getWhatsAppProfile()` | — |
| Status | `wahaApi.status()` | — |
| Vencimentos | `occurrencesApi.upcoming(30)` | vence hoje ou amanhã |
| Checklist | `checklistsApi.dashboard()` | `today.completion_pct < 100` |
| Ativos | `assetsApi.list()` | `target_triggered_at` ou `stop_triggered_at` não nulo |

`Promise.allSettled`: WAHA fora do ar não pode esconder os vencimentos.

**Não há estado de pagamento para filtrar.** A migration `010_remove_payment_fields`
(`migrate.ts:208-213`) removeu `status`, `paid_at` e `confirmation_source` de
`bill_occurrences`, e `GET /occurrences/upcoming` devolve tudo o que vence na
janela. A pendência de conta é, portanto, apenas a data — uma conta já paga
continua aparecendo. É a mesma limitação do Dashboard atual e não é resolvida
aqui; resolvê-la exigiria reintroduzir marcação de pagamento, que é outro
projeto.

`occurrencesApi.getDashboardStats()` deixa de ser chamada — alimentava os
StatCards de contas e o `waha_connected`. Sem StatCards, o status vem de
`wahaApi.status()`, que é o endpoint que faz essa pergunta.

Nenhum endpoint novo para a Home.

Sem pendências, o bloco não renderiza (não vira card vazio). O "Tudo em dia!"
de `Dashboard.tsx:249-266` permanece, mas só quando também não há vencimentos.

### `WhatsAppProfileCard`

Extraído de `Configuracoes.tsx:369-425`, com prop `compact` para a Home. Traz
junto o que não pode divergir entre as duas telas: `onError` escondendo `<img>`
quebrada, fallback `account_circle`, skeleton de carregamento, e o estado de
erro com ícone `wifi_off`.

## 9. Backend — snapshots de ativos

### Migration `016_asset_snapshots`

Entra no array `MIGRATIONS` de `backend/src/migrate.ts` (última atual:
`015_users_asset_alerts`). Aplica sozinha no boot, via `runMigrations()`. Os
`.sql` em `backend/src/pending-migrations/` não são lidos por código nenhum e
não serão seguidos.

```sql
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
  CONSTRAINT fk_snapshot_asset FOREIGN KEY (asset_id)
    REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

`quantity` e `avg_price` são copiados para dentro do snapshot, não lidos de
`assets` na consulta: comprar mais de um ativo amanhã não pode alterar o
patrimônio de ontem.

`UNIQUE (asset_id, snapshot_date)` com `INSERT … ON DUPLICATE KEY UPDATE` torna
a coleta idempotente.

`ON DELETE CASCADE`: apagar um ativo apaga seu histórico e o patrimônio passado
muda. É deliberado — apagar é explícito, e quem só quer parar de acompanhar usa
`is_active = 0`, que preserva o histórico e interrompe a coleta dali em diante.

Volume: 10 ativos × 365 dias ≈ 3.650 linhas/ano. Sem expurgo.

### Separação coleta / alerta

`checkAssetAlerts` hoje faz as duas coisas no mesmo laço
(`assetAlertService.ts:32-70`). A primeira é extraída:

```
services/assetQuoteSync.ts
  syncUserAssets(userId): Promise<SyncedAsset[]>
    · SELECT ativos com is_active = 1
    · fetchQuote por ativo (cache de 10 min do brapi.ts)
    · UPDATE assets SET last_price, last_quote_at
    · INSERT … ON DUPLICATE KEY UPDATE em asset_snapshots
    · devolve [{ asset, quote }]

services/assetAlertService.ts
  checkAssetAlerts(userId, synced)   ← recebe pronto, só decide alerta

services/assetSnapshotMath.ts
  resolveSnapshotPrice(quote, lastPrice): number | null
  buildSnapshotRow(asset, quote, hoje): SnapshotRow | null
```

`assetQuoteSync.ts` faz I/O (brapi, UPDATE, INSERT); `assetSnapshotMath.ts`
guarda as decisões puras — qual preço usar, quando pular o ativo — e é o que os
testes cobrem. Mesma separação que `assetAlertService.ts` já tem com
`assetMath.ts`.

Zero requisição extra à brapi: o mesmo `fetchQuote` serve os dois.

### Scheduler

`backend/src/scheduler.ts:124-136` hoje só alcança quem tem
`asset_alerts_enabled = 1`. Passa a:

```
usuários com is_active = 1, asset_alert_hour = <hora>, com ≥1 ativo ativo
  → syncUserAssets(id)                                sempre
  → se asset_alerts_enabled e whatsapp_alerts_enabled:
      checkAssetAlerts(id, synced)
```

Quem desliga o alerta continua acumulando histórico. O `try/catch` por usuário
e por ativo que já existe é preservado.

### Duas regras de dado

**A trava de cotação velha não vale para snapshot.**
`assetAlertService.ts:47` pula ação/FII quando a cotação não é do dia corrente
— existe para não disparar alerta falso no fim de semana. Aplicá-la ao snapshot
seria um bug: num sábado, cripto teria preço e ações não, e o total do dia
despencaria sem nada ter acontecido. O snapshot grava o preço como veio; o
fechamento de sexta é o valor da carteira no sábado.

**Cotação nula cai para `last_price`.** Se `fetchQuote` devolve `null`, o
snapshot usa o `last_price` guardado no ativo — sem isso, um ticker fora do ar
por um dia cria um degrau falso no gráfico. Sem `last_price` também (ativo
recém-criado), o ativo fica de fora daquele dia.

### `GET /api/assets/history?days=90`

```sql
SELECT snapshot_date,
       SUM(price * quantity)     AS current_value,
       SUM(avg_price * quantity) AS invested_value
  FROM asset_snapshots
 WHERE user_id = ? AND snapshot_date >= ?
 GROUP BY snapshot_date
 ORDER BY snapshot_date
```

Resposta: `{ pontos: [{ date, current_value, invested_value }] }` — duas séries,
patrimônio contra custo. `days` com default 90 e teto de 365.

A rota é registrada **antes** de qualquer `/:id` em `routes/assets.ts`, senão o
Express casa `history` como id.

Sem backfill: o plano gratuito da brapi não oferece histórico confiável, e
inventar dado passado seria pior que a ausência dele — daí o empty state
"coletando desde".

## 10. Loading, erro e testes

**Loading:** `SkeletonRow`, `SkeletonStatCard` e `SkeletonCard`
(`components/ui/Skeleton.tsx`) cobrem os casos. Por bloco, não por página.

**Erro:** o toast genérico de `Analise.tsx` ("alguns dados não puderam ser
carregados") vira erro no lugar do bloco, com botão "tentar de novo". Toast
desaparece e leva a informação junto; um gráfico que falhou precisa dizer que
falhou enquanto o usuário olha para ele. Toast fica reservado para ação do
usuário (salvar, excluir).

**Testes backend** (jest + ts-jest, já configurado): funções puras em
`services/assetSnapshotMath.ts` — fallback para `last_price`, cotação nula,
`quantity = 0`, escolha da data do snapshot.

**Testes frontend:** vitest é adicionado ao projeto, reaproveitando o
`vite.config.ts` existente, para cobrir `src/utils/assetAnalytics.ts` —
alocação por tipo, exclusão de watchlist, resultado por ativo, distância até
alvo/stop, e as bordas `current_price` nulo e `avg_price` zero.

## 11. Fora de escopo

- Backfill de cotações históricas.
- Análise no Notificações e no Configurações.
- Mudança nos endpoints de analytics de contas (`routes/analytics.ts`).
- Exportação de dados ou relatórios.
- Registro de aportes/vendas (o snapshot fotografa a posição, não transações).
