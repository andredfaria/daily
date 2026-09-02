# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**BillSync** — personal finance manager that tracks bills and sends WhatsApp reminders via [WAHA](https://waha.devlike.pro/) (WhatsApp HTTP API). Users authenticate via OTP sent to WhatsApp; the app also dispatches daily checklist polls.

## Commands

### Frontend (root)
```bash
npm run dev       # Vite dev server (port 5173)
npm run build     # tsc + vite build → dist/
```

### Backend (`backend/`)
```bash
npm run dev       # ts-node-dev with hot reload (port 4000)
npm run build     # tsc → dist/
npm start         # run compiled dist/index.js
```

### Docker (full stack)
```bash
docker compose up --build   # build & start all services
docker compose up           # start with existing images
```

The single production container bundles nginx (port 80) + Node.js backend (port 4000). nginx proxies `/api/` to the backend and serves the built frontend from `/usr/share/nginx/html`.

### Environment
Copy `.env.example` to `.env`. Required vars for local dev:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL connection
- `JWT_SECRET` — signs 30-day session tokens
- `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` — WhatsApp gateway
- `WAHA_WEBHOOK_SECRET` / `WHATSAPP_HOOK_HMAC_KEY` — webhook HMAC verification
- `PIX_ENCRYPTION_KEY` — AES-256-GCM key for `pix_key` at-rest encryption; **required in production**. In dev, if unset, `pix_key` is stored in plaintext with a warning.
- `DEV_OTP_BYPASS=true` — skip WAHA for OTP in local dev (code logged to backend stdout)
- `BRAPI_TOKEN` — token gratuito da [brapi.dev](https://brapi.dev) para cotação de **ações e FIIs**. Sem ele, apenas PETR4, MGLU3, VALE3 e ITUB4 respondem. Plano gratuito: 15.000 req/mês, 1 ticker por requisição. Criptomoeda não passa pela brapi (exige plano pago, responde `403 FEATURE_NOT_AVAILABLE`).
- `BRAPI_TOKEN_2` — token de contingência, opcional. Usado automaticamente quando o primário é recusado (401/403) ou estoura a cota (402/429).
- `COINGECKO_API_KEY` — chave demo gratuita do [CoinGecko](https://www.coingecko.com/en/api/pricing), usada para cotação de criptomoedas. Opcional: a API pública funciona sem chave, mas com limite apertado (~10 req/min por IP contra 30 com chave).

## Architecture

### Frontend (`src/`)
React SPA with React Router v6. All pages are protected by `ProtectedRoute`; `AuthProvider` (Context) holds the session and validates the stored JWT on load.

- `src/api/client.ts` — shared axios instance; attaches `billsync_token` from `localStorage` to every request; auto-redirects to `/login` on 401
- `src/api/*.ts` — one file per domain (bills, occurrences, notifications, checklists)
- `src/types/index.ts` — canonical TypeScript types shared across frontend (no duplication with backend)
- `src/pages/` — Home, Contas (`contas/`: lista + análise), Ativos (`ativos/`: carteira + análise), Checklists (`checklists/`: lista + análise), BillForm (create/edit), Notificacoes, Configuracoes, Login. Páginas com análise usam shell + rotas aninhadas: `/contas/lista` e `/contas/analise` são rotas reais, e a aba ativa vem da URL via `TabNav` (`src/components/ui/TabNav.tsx`).

### Backend (`backend/src/`)
Express app, TypeScript, MySQL2 connection pool.

- `db.ts` — exports a single `mysql2/promise` pool
- `index.ts` — wires routes, auth middleware (all `/api/*` except `/api/auth` and `/api/webhooks`), then calls `runMigrations()` and `initScheduler()` at startup
- `migrate.ts` — inline migration system; checks for table existence and runs `CREATE TABLE IF NOT EXISTS` statements split on `;`
- `scheduler.ts` — `node-cron` hourly tick (America/Sao_Paulo); dispatches bill notifications and checklist polls
- `dispatcher.ts` — builds WhatsApp message text and calls WAHA to send bill reminders
- `routes/` — REST handlers (bills, occurrences, notifications, checklists, waha, users, auth, webhooks, assets)
- `services/` — domain logic separated from routes: `waha.ts` (WAHA client), `notificationMaterializer.ts` (generates notification records), `occurrenceGenerator.ts`, `checklistDispatcher.ts`, `quotes.ts` (porta de entrada das cotações: cache de 10 min e roteamento por tipo), `brapi.ts` (cliente da brapi para ações e FIIs, com contingência de token), `coingecko.ts` (cliente de cotação de criptomoedas em BRL), `assetAlertService.ts` (alerta de preço-alvo e stop), `assetMath.ts` (cálculos puros de posição), `assetQuoteSync.ts` (coleta diária de cotação + snapshot), `assetSnapshotMath.ts` (decisões puras do snapshot)

### Database (MySQL 8.0.13+)
Requires `DEFAULT (UUID())` expression support. Schema in `database/migrations/` (initial schema) + incremental migrations in `backend/src/migrate.ts`. Tables: `users`, `bills`, `payment_methods`, `bill_occurrences`, `notifications`, `otp_codes`, `checklists`, `checklist_items`, `checklist_daily_polls`, `assets`, `asset_snapshots`.

### Auth flow
OTP via WhatsApp → JWT (30 days) stored in `localStorage` → `Authorization: Bearer` on every API call. `authMiddleware` (`backend/src/middleware/auth.ts`) sets `req.userId` for downstream handlers.

## Key conventions

- All code, comments, and log messages are in **Portuguese** (pt-BR).
- `notification_time` on `users` is an integer hour (0–23) in America/Sao_Paulo; scheduler compares it to current São Paulo hour.
- Bill recurrence: `monthly` uses `recurrence_day_of_month`, `weekly` uses `recurrence_day_of_week` (0=Sunday), `once` uses `due_date`.
- WAHA webhook hits `/api/webhooks`; a resposta do usuário alimenta os checklists. Não há estado de pagamento em `bill_occurrences` — `status`, `paid_at` e `confirmation_source` foram removidos pela migration `010_remove_payment_fields`.
- Alertas de ativos rodam no tick horário conforme `users.asset_alert_hour` (default 11). Disparam uma vez e pausam (`target_triggered_at` / `stop_triggered_at`), até serem reativados no app.
- Ações e FIIs são pulados quando a cotação não é do dia corrente (fim de semana e feriado); cripto roda todo dia.
- Cotação é roteada por tipo em `services/quotes.ts`: ação e FII vão para a brapi.dev, cripto vai para o CoinGecko. O cache (10 min positivo, 60s negativo, chave `kind:symbol`) e o motivo da falha (`sem_cotacao` / `plano_nao_cobre` / `falha_na_consulta`) valem para os dois provedores. O 429 do limite gratuito do CoinGecko vira `falha_na_consulta` e é segurado pelo cache negativo — não confundir com ticker inexistente.
- Contingência de token da brapi (só ações e FIIs): `buscarNaBrapi` percorre `BRAPI_TOKEN` e depois `BRAPI_TOKEN_2`. Token recusado por credencial/cota fica 30 min de molho (vai para o fim da fila) para não gastar uma requisição perdida em cada ticker. `403 FEATURE_NOT_AVAILABLE` (recurso fora do plano) tenta o outro token mas **não** deixa o primeiro de molho — ele continua válido para o resto. Rede, 404 e 5xx não trocam de token.
- Ticker e tipo do ativo são editáveis no `PATCH /api/assets/:id`; a troca revalida a cotação no provedor do tipo, checa duplicidade e zera `last_price`/`last_quote_at`/gatilhos de alerta. O histórico em `asset_snapshots` continua preso ao `asset_id`, então linhas antigas seguem sob o ativo renomeado.
- Testes com jest + ts-jest em `backend/src/services/__tests__/`, cobrindo funções puras sem banco nem rede. Rodar com `cd backend && npm test`.
- Testes do frontend com vitest em `src/**/__tests__/`, também só de funções puras. Rodar com `npm test` na raiz.
- Snapshot diário de ativos: `syncUserAssets` roda no tick de `asset_alert_hour` para todo usuário com ativo ativo, mesmo com alerta desligado, e grava uma linha por ativo em `asset_snapshots`. A trava de cotação velha vale só para o alerta — o snapshot registra o preço como veio, senão o total do sábado despencaria por falta das ações.
