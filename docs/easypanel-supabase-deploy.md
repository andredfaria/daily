# Guia completo — Docker + EasyPanel + Supabase (BillSync)

Este guia descreve como subir o projeto no EasyPanel com **frontend** e **backend** comunicando via rede interna Docker, usando **um único `.env`** como fonte de configuração, e como configurar a parte Supabase (schema + Edge Functions + secrets).

---

## 1) Pré-requisitos

- Repositório do projeto acessível no EasyPanel.
- EasyPanel já instalado e com acesso ao servidor.
- Um projeto Supabase criado (cloud).
- WAHA e banco (MySQL) provisionados no EasyPanel, se forem usados na operação.
- CLI opcional para setup local:
  - Docker + Docker Compose
  - Supabase CLI

---

## 2) Arquitetura final

- **frontend (nginx)** expõe a aplicação web para o domínio público.
- **backend (node/express)** fica apenas na rede interna da stack.
- O `nginx` faz proxy de `/api/*` para `backend:4000` internamente.
- O frontend usa Supabase para dados/autenticação via `VITE_SUPABASE_*`.
- Funções Edge do Supabase usam secrets server-side (`SUPABASE_SERVICE_ROLE_KEY`, WAHA etc.).

Fluxo:

1. Browser acessa `https://seu-dominio`.
2. Frontend responde assets e SPA.
3. Chamadas `https://seu-dominio/api/*` vão para `http://backend:4000/api/*`.
4. Frontend consome Supabase com `anon key`.
5. Edge Functions executam integrações (WAHA, rotinas, webhook).

---

## 3) Arquivos que devem existir no projeto

- `docker-compose.yml` com dois serviços (`frontend` e `backend`) e `env_file: .env`.
- `nginx.conf.template` com proxy de `/api/` para `${BACKEND_HOST}:${BACKEND_PORT}`.
- `.env.example` como modelo único de variáveis.
- `supabase/config.toml` para organizar Edge Functions no padrão Supabase CLI.

---

## 4) Criar seu `.env` único

Crie um `.env` na raiz copiando `.env.example`:

```bash
cp .env.example .env
```

Preencha todos os valores.

### Variáveis mínimas

#### Rede app
- `FRONTEND_PORT=80`
- `BACKEND_HOST=backend`
- `BACKEND_PORT=4000`

#### Backend
- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

#### Supabase frontend
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### Supabase Edge Functions / integrações server-side
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAHA_URL`
- `WAHA_API_KEY`
- `WAHA_SESSION`
- `WAHA_WEBHOOK_SECRET`

> Segurança: `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para bundle frontend.

---

## 5) Teste local via Docker (opcional, recomendado)

```bash
docker compose --env-file .env up --build -d
```

Validações:

```bash
curl -i http://localhost:${FRONTEND_PORT}/
curl -i http://localhost:${FRONTEND_PORT}/api/health
```

Se `/api/health` responder `200`, proxy frontend → backend está correto.

---

## 6) Subir stack no EasyPanel

1. No EasyPanel, clique em **New Project** (ou use projeto existente).
2. Clique em **New Service → Stack (Docker Compose)**.
3. Conecte ao repositório e branch.
4. Use o `docker-compose.yml` da raiz.
5. Em **Environment Variables**, cole todas as variáveis do seu `.env` (mesmos nomes).
6. Deploy.

### Domínio

- Anexe domínio público **somente ao serviço frontend**.
- SSL/TLS pode ser gerado automaticamente pelo EasyPanel (Let's Encrypt).
- Não exponha domínio/porta pública do backend.

---

## 7) Configurar Supabase para a aplicação

### 7.1 Banco (schema)

Aplique as migrations SQL no projeto Supabase (via SQL Editor ou CLI):

1. `database/migrations/001_create_schema.sql`
2. `database/migrations/002_supabase_postgres.sql`
3. (Opcional) `database/seed.sql`

### 7.2 Edge Functions

As funções ficam em `supabase/functions/*`:

- `generate-occurrences`
- `mark-overdue`
- `notification-dispatch`
- `waha-status`
- `whatsapp-webhook`

Deploy por CLI (exemplo):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy generate-occurrences
supabase functions deploy mark-overdue
supabase functions deploy notification-dispatch
supabase functions deploy waha-status
supabase functions deploy whatsapp-webhook
```

### 7.3 Secrets das Edge Functions

Defina os secrets no Supabase (Dashboard ou CLI):

```bash
supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  WAHA_URL="$WAHA_URL" \
  WAHA_API_KEY="$WAHA_API_KEY" \
  WAHA_SESSION="$WAHA_SESSION" \
  WAHA_WEBHOOK_SECRET="$WAHA_WEBHOOK_SECRET"
```

> Os nomes acima devem ser idênticos aos usados no código das funções.

---

## 8) Webhook WAHA → Supabase

Se usar confirmação por WhatsApp:

1. Pegue a URL pública da função `whatsapp-webhook` no Supabase.
2. Configure no WAHA o endpoint de webhook.
3. Envie header `x-webhook-secret` com `WAHA_WEBHOOK_SECRET`.

---

## 9) Checklist final

- [ ] `.env` único preenchido e consistente.
- [ ] Stack no EasyPanel criada via `docker-compose.yml`.
- [ ] Domínio público apontado para frontend.
- [ ] `/api/health` respondendo no domínio.
- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` válidos.
- [ ] Schema aplicado no Supabase.
- [ ] Edge Functions publicadas e secrets configurados.
- [ ] WAHA webhook validado (quando aplicável).

---

## 10) Troubleshooting rápido

- **Frontend abre, mas API falha:** revisar `nginx.conf.template`, `BACKEND_HOST`, `BACKEND_PORT`.
- **Edge Function falha em produção:** conferir secrets no Supabase.
- **Erro de CORS:** priorize chamadas via mesmo domínio (`/api`) e mantenha Supabase URL correta.
- **Função WAHA status offline:** validar `WAHA_URL`, sessão e `WAHA_API_KEY`.
