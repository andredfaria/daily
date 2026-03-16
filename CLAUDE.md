# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

No test suite is configured. There is no test runner command.

## Architecture Overview

**Daily Status** is a Next.js 14 (App Router) application for managing daily WhatsApp activity check-ins, with user authentication, admin dashboards, and subscription management.

### Tech Stack
- **Framework:** Next.js 14 App Router + TypeScript
- **Database:** MySQL 8+ via `mysql2/promise` with connection pooling
- **Auth:** JWT (`jose`) stored in httpOnly cookies, 7-day expiry
- **Passwords:** `bcryptjs`
- **Payments:** Stripe + Hotmart (webhooks)
- **WhatsApp:** WAHA (self-hosted HTTP API)
- **Styling:** Tailwind CSS with dark theme (slate-950 bg, emerald-500 primary)

### Key Layers

**Database (`lib/mysql.ts`):**
- `query<T>(sql, values)` — SELECT queries
- `execute(sql, values)` — INSERT/UPDATE/DELETE
- Connection pool of 10, lazily initialized via `getPool()`

**Data Access (`lib/db/daily_user.ts`):**
- All user CRUD lives here
- `getDailyUserByPhoneForAuth()` is the only function that returns `password_hash` — all others use safe field projections
- Users are created with a 7-day trial on signup

**Authentication flow:**
1. `lib/auth-jwt.ts` — signs/verifies JWTs, sets/clears the `daily_session` cookie
2. `lib/server-auth.ts` — server-side helpers: `getSession()`, `getUser()`, `getCurrentDailyUser()`
3. `middleware.ts` — validates JWT on every request, redirects unauthenticated users to `/login`, enforces admin-only routes (`/users`), and enforces ownership on edit routes

**JWT payload shape:**
```typescript
{ userId: number, phone: string, email?: string, isAdmin: boolean }
```

**Client-side auth (`components/AuthProvider.tsx`):**
React context providing `user`, `dailyUser`, `loading`, `signOut()`, `refreshUser()`, `isAdmin()`, `canEdit(userId)`, `isSubscriptionActive()`. Wrap with `ClientProviders` (which includes `AuthProvider` + `ToastProvider`).

### Route Structure

Public routes (no auth required):
- `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`
- `GET /api/auth/*`

Protected routes:
- `/dashboard`, `/user` — authenticated users
- `/users`, `/edit`, `/create` — admin only

API route convention: `app/api/<resource>/route.ts` or `app/api/<resource>/[id]/route.ts`.

### Database Schema

Two tables in database `daily`:
- `daily_user` — users with subscription fields (`subscription_status`, `trial_ends_at`, etc.), `option` (JSON checklist items), `time_to_send` (hour 0–23), `reset_token`
- `daily_data` — daily check-in records linked to users via `id_user` FK with CASCADE delete

### Subscription System
Users start with `subscription_status = 'trial'` (7 days). Plans: `basic`, `premium`, `enterprise`. Payment providers: `hotmart`, `stripe`. Webhook handlers at `app/api/webhooks/stripe/` and `app/api/webhooks/hotmart/`.

### Environment Variables
See `.env.example`. Key vars:
- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — for signing tokens
- `WAHA_BASE_URL` — self-hosted WhatsApp API
- `STRIPE_SECRET_KEY`, `HOTMART_TOKEN`
- `NEXT_PUBLIC_APP_URL`

### Validation & Utilities
- `lib/validations.ts` — all form validation (name, phone, email, checklist, send time)
- `lib/utils.ts` — `normalizePhoneForDB()`, `cn()` (Tailwind class merging)
- `lib/utils/sanitize.ts` — input sanitization
- `lib/middleware/requireAdmin.ts` — admin guard for API routes
- `lib/middleware/rateLimit.ts` — rate limiting

### Project Documentation
- `auditoria.md` — security audit findings
- `PLANO_ACAO.md` — action plan for the 11 bugs from the audit
- `CONTEXT.md` — product context
- `PRD.md` — product requirements
- `DESIGN_SYSTEM.md` — UI/UX guidelines
- `VERCEL_RULES.md` — deployment notes
