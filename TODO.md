# TODO / Registro de Desenvolvimento — BillSync

> Consolida o que foi entregue a partir das specs/plans que existiam em
> `docs/superpowers/` (agora removido, conteúdo consumido) e o que permanece pendente.
> Última atualização: 2026-05-30.

---

## ✅ Concluído nesta rodada (2026-05-30)

### Bugs críticos de runtime (resíduo da remoção de pagamento)
A migração `010` removeu a coluna `bill_occurrences.status`, mas dois pontos ainda a
consultavam — quebrava o envio de notificações em runtime:

- [x] **`notificationMaterializer.ts`** — removido `AND o.status = 'pending'` da query de
  materialização. Sem pagamento, toda ocorrência no período é candidata a lembrete.
  *(commit `fix(materializer)`)*
- [x] **`dispatcher.ts`** — removido `o.status AS occurrence_status` do SELECT e o bloco que
  pulava ocorrências `paid`/`cancelled`. *(commit `fix(dispatcher)`)*

### S10 — Criptografia de `pix_key` em repouso (AES-256-GCM)
- [x] Serviço `backend/src/services/pixCrypto.ts` (`encryptPix` / `decryptPix` /
  `backfillPixEncryption`), formato `enc:v1:<iv>:<tag>:<ct>`, chave derivada de
  `PIX_ENCRYPTION_KEY` via scrypt.
- [x] `bills.ts` cifra no POST/PATCH e decifra em todas as leituras do dono.
- [x] `dispatcher.ts` e `notifications.ts` decifram antes de usar/retornar.
- [x] Backfill idempotente no boot (`index.ts`) cifra chaves legadas em plaintext.
- [x] Nova env `PIX_ENCRYPTION_KEY` documentada em `.env.example` e `CLAUDE.md`.
  **Obrigatória em produção**; em dev, sem chave, mantém plaintext com aviso.

### F10 — Onboarding guiado de primeiro acesso
- [x] `PATCH /users/me` aceita `onboarding_completed`; campo adicionado ao tipo `User`.
  (a migração `009` que cria a coluna já existia e está registrada no `migrate.ts`.)
- [x] `AuthContext` passa a expor `refreshUser()`.
- [x] Página `src/pages/Onboarding.tsx` — 3 passos: cadastrar 1ª conta → conferir status do
  WhatsApp → enviar mensagem de teste.
- [x] `ProtectedRoute` (em `App.tsx`) redireciona para `/onboarding` enquanto não concluído,
  sem loop (checa `location.pathname`). Opção de pular em qualquer etapa.
- [x] Novo cliente `src/api/waha.ts` (`getStatus`, `sendTest`).

### Verificação
- [x] Backend: `tsc --noEmit` sem erros.
- [x] Frontend: `tsc` + `vite build` sem erros.

---

## ✅ Já entregue em rodadas anteriores (contexto)

Confirmado no histórico do git e no código atual:

- **Visibilidade Financeira** — `financialAnalytics.ts`, endpoints
  `/api/analytics/by-category` e `/projection`, página `Analise.tsx` (donut + projeção,
  recharts), sumário mensal no WhatsApp + conserto do resumo semanal e do alerta de
  orçamento, migração `011` (`monthly_summary_enabled`).
- **Remoção da feature de pagamento** — migração `010`, limpeza de endpoints, tipos, API e
  UI (Dashboard, Histórico, StatusBadge).
- **Auditoria de segurança** — S1 (dispatch escopado por usuário), S2 (HMAC exigido em
  prod), S3 (ownership em payment_methods), S4 (OTP via `crypto.randomInt`), S5 (CSP no
  nginx), S6 (service account restrito por path), S7/S8/S9 (health sem versão, CORS, rate
  limiting no webhook). **S10 fechado nesta rodada.**
- **Bugs B1–B8** da auditoria — status real do WAHA, timezone São Paulo, validação de
  limit/offset, validação de POST /bills, validação de timezone, geração de ocorrências
  aguardada, `updated_at` de checklist, claim atômico de notificações.
- **WAHA scheduler, poll/webhook, normalização de telefone, redesign de notificações,
  correção de voto em poll, múltiplos checklists, recorrências, export CSV.**

---

## ⏳ Pendente / próximos passos

- [ ] **F3 — Alerta de variação de valor.** Depende de capturar o **valor real por
  ocorrência** (hoje toda ocorrência herda o valor fixo da conta). Épico separado, exige
  modelagem de dados nova.
- [ ] **S5 (reforço ideal) — JWT em `httpOnly` cookie.** Hoje o token de 30 dias fica em
  `localStorage` (mitigado por CSP). Migrar para cookie `SameSite=Strict` reduz exposição a
  XSS. Requer mudança no fluxo de auth (backend + `client.ts` + `AuthContext`).
- [ ] **Suíte de testes.** O projeto ainda não tem testes automatizados (ver `CLAUDE.md`).
  Cobrir ao menos `pixCrypto`, materializer/dispatcher e os endpoints de analytics.
- [ ] **Onboarding — número alternativo.** Hoje o passo de WhatsApp assume o número do
  login. Avaliar permitir trocar/confirmar outro número no fluxo.
