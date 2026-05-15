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
- `DEV_OTP_BYPASS=true` — skip WAHA for OTP in local dev (code logged to backend stdout)

## Architecture

### Frontend (`src/`)
React SPA with React Router v6. All pages are protected by `ProtectedRoute`; `AuthProvider` (Context) holds the session and validates the stored JWT on load.

- `src/api/client.ts` — shared axios instance; attaches `billsync_token` from `localStorage` to every request; auto-redirects to `/login` on 401
- `src/api/*.ts` — one file per domain (bills, occurrences, notifications, checklists)
- `src/types/index.ts` — canonical TypeScript types shared across frontend (no duplication with backend)
- `src/pages/` — full-page components: Dashboard, Contas (bills list), BillForm (create/edit), Checklists, Notificacoes, Configuracoes, Login

### Backend (`backend/src/`)
Express app, TypeScript, MySQL2 connection pool.

- `db.ts` — exports a single `mysql2/promise` pool
- `index.ts` — wires routes, auth middleware (all `/api/*` except `/api/auth` and `/api/webhooks`), then calls `runMigrations()` and `initScheduler()` at startup
- `migrate.ts` — inline migration system; checks for table existence and runs `CREATE TABLE IF NOT EXISTS` statements split on `;`
- `scheduler.ts` — `node-cron` hourly tick (America/Sao_Paulo); dispatches bill notifications and checklist polls
- `dispatcher.ts` — builds WhatsApp message text and calls WAHA to send bill reminders
- `routes/` — REST handlers (bills, occurrences, notifications, checklists, waha, users, auth, webhooks)
- `services/` — domain logic separated from routes: `waha.ts` (WAHA client), `notificationMaterializer.ts` (generates notification records), `occurrenceGenerator.ts`, `checklistDispatcher.ts`

### Database (MySQL 8.0.13+)
Requires `DEFAULT (UUID())` expression support. Schema in `database/migrations/` (initial schema) + incremental migrations in `backend/src/migrate.ts`. Tables: `users`, `bills`, `payment_methods`, `bill_occurrences`, `notifications`, `otp_codes`, `checklists`, `checklist_items`, `checklist_daily_polls`.

### Auth flow
OTP via WhatsApp → JWT (30 days) stored in `localStorage` → `Authorization: Bearer` on every API call. `authMiddleware` (`backend/src/middleware/auth.ts`) sets `req.userId` for downstream handlers.

## Key conventions

- All code, comments, and log messages are in **Portuguese** (pt-BR).
- `notification_time` on `users` is an integer hour (0–23) in America/Sao_Paulo; scheduler compares it to current São Paulo hour.
- Bill recurrence: `monthly` uses `recurrence_day_of_month`, `weekly` uses `recurrence_day_of_week` (0=Sunday), `once` uses `due_date`.
- WAHA webhook hits `/api/webhooks`; payment confirmations via WhatsApp reply update occurrence status.
- No test suite currently exists in this repo.
