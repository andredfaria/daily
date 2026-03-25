# BillSync — Docker + Easypanel Deployment Design Spec

| Campo | Valor |
|---|---|
| **Data** | 2026-03-25 |
| **Status** | Aprovado |
| **Abordagem** | nginx proxy (Opção A) — URL única, sem CORS |
| **Deploy** | GitHub + auto-deploy no Easypanel |

---

## Visão Geral

Dois containers novos (frontend + backend) adicionados ao Easypanel, que já roda MySQL e WAHA. O nginx do frontend proxeia `/api/*` para o backend — URL única, sem CORS, sem variável de build.

```
Internet
  └── Easypanel (easypanel.eficienciia.com.br)
        ├── billsync-frontend  (nginx:alpine, porta 80)
        │     ├── /           → serve React SPA
        │     └── /api/*      → proxy → billsync-backend:4000
        ├── billsync-backend   (node:20-alpine, porta 4000)
        │     └── conecta → MySQL (eficienciia_mysql:3306)
        │     └── conecta → WAHA (eficienciia_waha:3000)
        ├── eficienciia_mysql  (já existente)
        └── eficienciia_waha   (já existente)
```

---

## Estrutura de Arquivos

```
daily/                          ← repositório (raiz = frontend)
  Dockerfile                    ← multi-stage: Vite build → nginx
  nginx.conf                    ← SPA routing + proxy /api
  .dockerignore                 ← exclui node_modules, dist, .env
  docker-compose.yml            ← ambiente de dev local completo
  .env.example                  ← documenta todas as variáveis
  backend/
    Dockerfile                  ← multi-stage: tsc build → node runtime
    package.json
    tsconfig.json
    .dockerignore
    src/
      index.ts                  ← placeholder Express (health check)
```

---

## Dockerfile — Frontend (`./Dockerfile`)

```dockerfile
# Stage 1 — build Vite
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — nginx serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`.dockerignore` (raiz):**
```
node_modules
dist
.env
.env.*
backend
*.md
docs
```

---

## nginx.conf (`./nginx.conf`)

```nginx
server {
  listen 80;

  # SPA routing — todas as rotas desconhecidas → index.html
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }

  # Proxy /api/* → backend container (DNS interno do Easypanel/Docker)
  location /api/ {
    proxy_pass         http://backend:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }
}
```

> **Nota Easypanel:** O nome `backend` no proxy_pass deve corresponder exatamente ao nome do serviço configurado no Easypanel (campo "Service Name"). Se o serviço for nomeado `billsync-backend`, usar `http://billsync-backend:4000/api/`. Os dois serviços devem estar no mesmo App no Easypanel para compartilhar a rede Docker interna.

---

## Dockerfile — Backend (`./backend/Dockerfile`)

```dockerfile
# Stage 1 — build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — runtime mínimo (sem devDependencies)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/index.js"]
```

**`backend/.dockerignore`:**
```
node_modules
dist
.env
.env.*
*.md
```

---

## Backend Placeholder (`./backend/src/index.ts`)

Servidor Express mínimo e funcional. Substituído pelo backend real quando implementado — o Dockerfile não muda.

```typescript
import express from 'express'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(express.json())

// Health check — usado pelo Easypanel e pelo HEALTHCHECK do Docker
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] running on port ${PORT}`)
})
```

**`backend/package.json` (mínimo):**
```json
{
  "name": "billsync-backend",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev src/index.ts"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

---

## docker-compose.yml (dev local)

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
      PORT: 4000
      DB_HOST: ${DB_HOST}
      DB_PORT: ${DB_PORT:-3306}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME:-daily}
      WAHA_URL: ${WAHA_URL}
      WAHA_API_KEY: ${WAHA_API_KEY}
      WAHA_SESSION: ${WAHA_SESSION:-default}
      WAHA_WEBHOOK_SECRET: ${WAHA_WEBHOOK_SECRET}
```

> Em dev local, o backend aponta para o MySQL/WAHA no Easypanel via as variáveis de ambiente no `.env`.

---

## .env.example

```env
# Banco de dados (MySQL no Easypanel)
DB_HOST=easypanel.eficienciia.com.br
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=
DB_NAME=daily

# WAHA (WhatsApp API no Easypanel)
WAHA_URL=http://eficienciia_waha:3000
WAHA_API_KEY=
WAHA_SESSION=default
WAHA_WEBHOOK_SECRET=
```

---

## Configuração no Easypanel

### Serviço 1 — `billsync-frontend`

| Campo | Valor |
|---|---|
| Source | GitHub repo, branch `main` |
| Build context | `.` (raiz) |
| Dockerfile | `./Dockerfile` |
| Port | `80` |
| Domain | `daily.eficienciia.com.br` (ou similar) |
| Auto-deploy | ✅ On push to `main` |

Sem variáveis de ambiente (frontend é estático após o build).

### Serviço 2 — `billsync-backend`

| Campo | Valor |
|---|---|
| Source | GitHub repo, branch `main` |
| Build context | `./backend` |
| Dockerfile | `./backend/Dockerfile` |
| Port | `4000` |
| Domain | interno (não precisa de domínio público — nginx faz o proxy) |
| Auto-deploy | ✅ On push to `main` |

Variáveis de ambiente configuradas no painel do Easypanel (mesmo conteúdo do `.env.example`).

### Rede Docker

Os dois serviços precisam estar na mesma rede Docker para o proxy `http://backend:4000` funcionar. No Easypanel, colocar ambos no mesmo **App** garante isso automaticamente.

---

## Verificação

```bash
# 1. Build e teste local
docker compose up --build
curl http://localhost/api/health
# → {"status":"ok","version":"0.1.0",...}

# 2. Verificar SPA routing
curl http://localhost/qualquer-rota
# → retorna index.html (não 404)

# 3. Verificar proxy
curl http://localhost/api/health
# → resposta do backend via nginx proxy

# 4. Após deploy no Easypanel
curl https://daily.eficienciia.com.br/api/health
# → {"status":"ok",...}
```

---

## Notas Importantes

- **VITE_API_URL não é necessário** — o frontend usa `/api` relativo e o nginx proxeia. Não há variável de build.
- **Rebuild ao mudar env vars** — o frontend não precisa de rebuild para mudanças em env vars (são apenas do backend). O backend faz reload automático no Easypanel ao salvar variáveis.
- **Health check** — o `HEALTHCHECK` no Dockerfile do backend permite ao Easypanel verificar se o serviço está saudável e reiniciar automaticamente em caso de falha.
- **Node 20 LTS** — versão estável com suporte até 2026.
