# Carteira de Ativos com Alerta de Preço-Alvo via WhatsApp

| Campo | Valor |
|---|---|
| **Data** | 2026-08-30 |
| **Status** | Design aprovado — pronto para plano de implementação |
| **Módulo** | Terceiro módulo do BillSync (após Contas e Checklists) |

---

## 1. Problema

O usuário compra ações, FIIs e cripto e define mentalmente um preço de venda.
Não existe hoje nenhum lugar no BillSync para registrar essa posição, e nenhum
mecanismo que avise quando a cotação atinge o valor desejado. O resultado é
perder o ponto de venda por não estar olhando a corretora no momento certo.

## 2. Solução

Um módulo de carteira onde o usuário registra ticker, quantidade e preço médio
pago, define um preço-alvo (venda no lucro) e/ou um stop (corte de prejuízo), e
recebe uma mensagem no WhatsApp às 11h da manhã quando qualquer um dos dois é
atingido.

Escopo de ativos: **ações da B3, FIIs e criptomoedas**. Ações dos EUA ficam fora
— exigiriam um segundo provedor de cotação.

## 3. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Fonte de cotação | brapi.dev, plano gratuito | Cobre B3, FIIs e cripto num provedor só |
| Agendamento | Bloco no tick horário existente do `scheduler.ts` | Mesmo padrão de `budgetAlertService`; zero infra nova |
| Horário | Configurável por usuário, default 11h | Permite mudar para pós-fechamento sem tocar em código |
| Gatilho | Alvo **e** stop, ambos opcionais por ativo | Mesmo custo de implementação; cobre lucro e prejuízo |
| Repetição | Dispara 1x e pausa; reativação manual no app | Evita a mesma mensagem toda manhã por semanas |
| Mensagem | Uma consolidada por usuário, não uma por ativo | Cinco ativos batendo no mesmo dia = uma notificação |
| Carteira | Com cálculo de lucro/prejuízo | É o que dá sentido à decisão de vender |
| Autocomplete de ticker | Fora da v1 | Validação no save já cobre o erro real |

## 4. Dependência externa: brapi.dev

- **Endpoints:** `/api/quote/{ticker}` (ações e FIIs, confirmado empiricamente), `/api/v2/crypto` (cripto)
- **Autenticação:** header `Authorization: Bearer ${BRAPI_TOKEN}`
- **Plano gratuito:** 15.000 requisições/mês, **1 ticker por requisição** (sem batch)
- **Sem token:** apenas PETR4, MGLU3, VALE3 e ITUB4 respondem

**Orçamento de requisições:** 10 ativos × 1 checagem/dia ≈ 300 req/mês, mais as
consultas de tela mitigadas por cache. Folga confortável dentro do limite.

Nova variável no `.env.example`: `BRAPI_TOKEN`. Ausente, o serviço loga um
warning e continua funcionando para os 4 tickers livres — mesma filosofia de
degradação do `DEV_OTP_BYPASS`.

## 5. Modelo de dados

### Migration `014_assets`

```sql
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
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_ticker (user_id, ticker),
  KEY idx_assets_user_active (user_id, is_active),
  CONSTRAINT fk_assets_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**Notas de schema:**
- `DECIMAL(18,8)` em preços e quantidade: cripto é fracionária.
- `quantity = 0` é válido — o ativo vira watchlist sem posição, e a tela omite o L/P.
- `target_triggered_at IS NOT NULL` significa **alerta pausado**. Reativar = voltar a NULL.
- `last_price` / `last_quote_at` são cache de exibição, para a tela não gastar
  requisição a cada carregamento.

### Migration `015_users_asset_alerts`

Via `addColumnIfNotExists`, seguindo o padrão das migrations 011–013:

- `asset_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE`
- `asset_alert_hour TINYINT UNSIGNED NOT NULL DEFAULT 11`

## 6. Componentes

### 6.1 `backend/src/services/brapi.ts` — cliente de cotação

Única fronteira com a API externa. Nada mais no sistema conhece a brapi.

```ts
export interface Quote { ticker: string; price: number; shortName: string; quotedAt: Date }
export async function fetchQuote(ticker: string, kind: AssetKind): Promise<Quote | null>
export async function validateTicker(ticker: string, kind: AssetKind): Promise<boolean>
```

- Instância axios com `baseURL: https://brapi.dev/api`, header Bearer, timeout 10s.
- Cache em memória (`Map<string, {quote, expiresAt}>`), TTL 10 min por ticker.
  Sem ele, recarregar a tela repetidamente queima o limite mensal.
- `kind` decide o endpoint: `stock`/`fii` → `/v2/stocks/quote`, `crypto` → `/v2/crypto`.
- Qualquer falha (timeout, 404, 5xx) retorna `null` e loga. Nunca lança.

### 6.2 `backend/src/services/assetAlertService.ts` — regra de alerta

Molde do `budgetAlertService.ts`: consulta, decide, envia.

```ts
export async function checkAssetAlerts(userId: string): Promise<void>
```

Fluxo:
1. Carrega usuário (`whatsapp_number`, `whatsapp_alerts_enabled`, `is_active`).
   Sai cedo se não for elegível.
2. Carrega ativos com `is_active = 1`.
3. Para cada ativo: busca a cotação. Falhou, loga e **pula esse ativo** — um
   ticker quebrado não pode abortar os demais. Grava `last_price`/`last_quote_at`.
4. Acumula os disparos:
   - alvo: `target_price IS NOT NULL AND price >= target_price AND target_triggered_at IS NULL`
   - stop: `stop_price IS NOT NULL AND price <= stop_price AND stop_triggered_at IS NULL`
5. Havendo disparos, monta **uma** mensagem consolidada, envia via
   `sendWhatsAppText`, e marca os `*_triggered_at` correspondentes com `NOW()`.

**Regra de mercado fechado:** ativos `stock` e `fii` são pulados quando a
cotação retornada não é do dia corrente — em fim de semana e feriado a brapi
devolve o fechamento anterior, e disparar com preço velho seria alerta falso.
A detecção usa a data da cotação, não um calendário de feriados da B3.
Cripto não sofre essa checagem.

**Formato da mensagem:**

```
📈 *Alerta de Ativos — BillSync*

🎯 *PETR4* atingiu o alvo
Cotação: R$ 42,30 (alvo R$ 42,00)
Posição: 100 un. · pago R$ 35,00
Lucro: +R$ 730,00 (+20,9%)

🛑 *MXRF11* atingiu o stop
Cotação: R$ 9,10 (stop R$ 9,20)
Prejuízo: -R$ 45,00 (-4,7%)

_Alertas pausados até você reativar no app._
```

Ativos com `quantity = 0` omitem as linhas de posição e de lucro.

### 6.3 `backend/src/services/assetMath.ts` — cálculos puros

Funções sem I/O, alvo direto da suíte jest existente:

```ts
export function investedValue(quantity: number, avgPrice: number): number
export function currentValue(quantity: number, price: number): number
export function profitLoss(quantity: number, avgPrice: number, price: number): number
export function profitLossPct(avgPrice: number, price: number): number
export function isTargetHit(price: number, target: number | null, triggeredAt: Date | null): boolean
export function isStopHit(price: number, stop: number | null, triggeredAt: Date | null): boolean
```

### 6.4 `backend/src/scheduler.ts` — integração

Bloco novo no tick horário existente, no estilo do alerta de orçamento:

```ts
try {
  const [assetUsers]: any = await pool.query(
    `SELECT id FROM users
      WHERE asset_alerts_enabled = 1 AND asset_alert_hour = ?
        AND whatsapp_alerts_enabled = 1 AND is_active = 1`, [hour])
  for (const { id } of assetUsers) {
    try { await checkAssetAlerts(id) }
    catch (e: any) { console.error('[scheduler] asset erro:', e.message) }
  }
} catch (e: any) { console.error('[scheduler] asset tick erro:', e.message) }
```

### 6.5 `backend/src/routes/assets.ts` — API REST

Montado em `/api/assets`, dentro do `authMiddleware`. Todo handler filtra por
`req.userId`.

| Método | Rota | Comportamento |
|---|---|---|
| GET | `/api/assets` | Lista os ativos com cotação atual (via cache), valor investido, valor atual, L/P em R$ e % |
| POST | `/api/assets` | Cria. Valida o ticker contra a brapi antes de salvar; 422 se não existir. 409 se já cadastrado |
| PATCH | `/api/assets/:id` | Atualiza quantidade, preço médio, alvo, stop, `is_active` |
| POST | `/api/assets/:id/rearm` | Zera `target_triggered_at` e `stop_triggered_at` |
| DELETE | `/api/assets/:id` | Remove o ativo |

Validações: `quantity >= 0`, `avg_price >= 0`, `target_price > 0` quando
presente, `stop_price > 0` quando presente, ticker normalizado para maiúsculas.

### 6.6 Frontend

- **`src/pages/Ativos.tsx`** — lista em cards. Por ativo: ticker e nome curto,
  cotação atual, quantidade e preço médio, L/P em R$ e % com cor (verde/vermelho),
  e a distância percentual até o alvo. Ativo com alerta pausado ganha badge
  "alvo atingido" e botão de reativar. Estado vazio convidando a cadastrar o
  primeiro ativo.
- **Formulário** de criar/editar seguindo o padrão de `BillForm.tsx`.
- **`src/api/assets.ts`** — client no padrão de `src/api/bills.ts`.
- **`src/types/index.ts`** — `Asset`, `AssetKind`, `AssetWithQuote`.
- **`src/App.tsx`** — rota `/ativos` dentro do `ProtectedRoute` + `Layout`.
- **`src/components/Layout/Sidebar.tsx`** — item `{ path: '/ativos', label: 'Ativos', icon: 'trending_up' }`.
- **`src/components/Layout/Header.tsx`** — título para `/ativos`.
- **`src/pages/Configuracoes.tsx`** — toggle de alertas de ativos e seletor de hora.

Todo o visual segue `design-system/billsync/MASTER.md`.

## 7. Casos de borda

| Situação | Tratamento |
|---|---|
| brapi fora do ar ou timeout | Loga, pula o ativo, o tick continua |
| Ticker deslistado ou inválido | Cotação nula, loga, sem alerta |
| `BRAPI_TOKEN` ausente | Warning no startup; funciona só com os 4 tickers livres |
| Fim de semana / feriado (stock, fii) | Pulado — cotação não é do dia |
| `whatsapp_alerts_enabled = 0` | Não envia, consistente com os demais alertas |
| Usuário inativo | Não envia |
| `quantity = 0` | Válido; watchlist sem cálculo de L/P |
| Alvo e stop batidos no mesmo dia | Ambos entram na mesma mensagem |
| Ticker duplicado para o mesmo usuário | Bloqueado pela unique key; API responde 409 |

## 8. Testes

Suíte jest existente em `backend/src/services/__tests__/`, padrão de funções
puras sem banco.

- **`assetMath.test.ts`** — valor investido, valor atual, L/P em R$ e %,
  gatilho de alvo e de stop incluindo as fronteiras (preço exatamente igual ao
  alvo dispara; alerta já disparado não redispara; alvo nulo nunca dispara).
- **`brapi.test.ts`** — parsing da resposta da API e comportamento do cache
  (hit dentro do TTL, expiração), com axios mockado.

## 9. Fora de escopo

- Ações dos EUA e outros mercados internacionais
- Autocomplete e busca de tickers
- Histórico de cotações e gráfico de evolução
- Registro de múltiplas compras com recálculo automático de preço médio
- Polling intradiário — o schema já suporta; é troca de gatilho no scheduler
- Venda ou integração com corretora
