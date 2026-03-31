# Deploy EasyPanel Container Único Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar frontend React e backend Node/Express numa única imagem Docker, deployada como um único App no EasyPanel (projeto `eficienciia`, app `billsync`).

**Architecture:** Imagem multi-stage com 3 estágios: frontend-builder (Vite), backend-builder (TypeScript), final (nginx:alpine + Node.js). nginx serve os arquivos estáticos e faz proxy de `/api/*` para o processo node rodando em `localhost:4000` dentro do mesmo container. Um script `start.sh` inicializa ambos os processos.

**Tech Stack:** Docker multi-stage build, nginx:alpine, Node.js 20, Vite 5, TypeScript, EasyPanel

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `Dockerfile` | Substituir | Build multi-stage: frontend + backend + imagem final |
| `nginx.conf` | Criar | Config nginx estática: serve SPA + proxy /api/* → localhost:4000 |
| `start.sh` | Criar | Inicializa node (bg) e nginx (fg) no container |
| `.dockerignore` | Modificar | Incluir `backend/` no contexto, excluir `backend/node_modules` e `backend/dist` |
| `nginx.conf.template` | Deletar | Substituído por `nginx.conf` estático |
| `Dockerfile.backend` | Deletar | Não usado mais (era para build separado da raiz) |
| `Dockerfile.backend.dockerignore` | Deletar | Não usado mais |

---

### Task 1: Atualizar `.dockerignore`

**Files:**
- Modify: `.dockerignore`

O `.dockerignore` atual exclui `backend` inteiro. O novo Dockerfile precisa copiar `backend/package*.json`, `backend/src/` e `backend/tsconfig.json`, então precisamos incluir `backend/` no contexto e excluir apenas as subpastas pesadas.

- [ ] **Step 1: Substituir o conteúdo do `.dockerignore`**

Abrir `.dockerignore` e substituir por:

```
node_modules
dist
.env
.env.*
backend/node_modules
backend/dist
*.md
docs
database
.git
.gitignore
.aiox-core
.claude
.cursor
.gemini
.codex
.antigravity
.github
```

- [ ] **Step 2: Verificar que `backend/` está acessível no contexto**

```bash
docker build --no-cache --progress=plain -f /dev/stdin . <<'EOF'
FROM alpine
COPY backend/package.json /tmp/test.json
RUN cat /tmp/test.json
EOF
```

Saída esperada: conteúdo do `backend/package.json` impresso no terminal. Se aparecer erro `COPY failed: file not found`, o `.dockerignore` ainda está bloqueando.

- [ ] **Step 3: Commitar**

```bash
git add .dockerignore
git commit -m "chore: atualiza .dockerignore para build de container único"
```

---

### Task 2: Criar `nginx.conf`

**Files:**
- Create: `nginx.conf`

Config nginx estática (sem envsubst). Backend roda em `localhost:4000` dentro do mesmo container, sem necessidade de variável de host.

- [ ] **Step 1: Criar o arquivo `nginx.conf`**

Criar `nginx.conf` na raiz do projeto com o conteúdo:

```nginx
server {
  listen 80;

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass         http://localhost:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }
}
```

- [ ] **Step 2: Validar a sintaxe do nginx localmente (opcional, se nginx disponível)**

```bash
nginx -t -c $(pwd)/nginx.conf 2>/dev/null || echo "nginx não disponível localmente — OK, será validado no build"
```

- [ ] **Step 3: Commitar**

```bash
git add nginx.conf
git commit -m "chore: adiciona nginx.conf estático para container único"
```

---

### Task 3: Criar `start.sh`

**Files:**
- Create: `start.sh`

Script de startup: inicia o processo node em background, depois o nginx em foreground. O `exec` garante que nginx seja o PID 1 efetivo e receba sinais do Docker corretamente (SIGTERM → shutdown limpo).

- [ ] **Step 1: Criar o arquivo `start.sh`**

Criar `start.sh` na raiz do projeto:

```sh
#!/bin/sh
node /app/dist/index.js &
exec nginx -g "daemon off;"
```

- [ ] **Step 2: Commitar**

```bash
git add start.sh
git commit -m "chore: adiciona start.sh para iniciar node e nginx no container único"
```

---

### Task 4: Substituir o `Dockerfile`

**Files:**
- Modify: `Dockerfile`

Novo Dockerfile com 3 stages:
- `frontend-builder`: compila o React/Vite
- `backend-builder`: compila o TypeScript do Express
- `final`: nginx:alpine + Node.js, copia artefatos, configura startup

- [ ] **Step 1: Substituir o `Dockerfile` pelo novo conteúdo**

```dockerfile
# ─────────────────────────────────────────
# Stage 1 — Build frontend (React + Vite)
# ─────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.ts ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────
# Stage 2 — Build backend (Node + TypeScript)
# ─────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ─────────────────────────────────────────
# Stage 3 — Imagem final
# ─────────────────────────────────────────
FROM nginx:alpine
RUN apk add --no-cache nodejs

# Frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Backend
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY backend/package*.json ./

# Config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
```

- [ ] **Step 2: Testar o build localmente**

```bash
docker build -t billsync-test .
```

Saída esperada: 3 stages concluídos com sucesso, linha final `Successfully tagged billsync-test:latest` (ou equivalente buildkit).

Se o build falhar:
- Stage 1 falha → verificar que `tailwind.config.ts`, `postcss.config.js`, `vite.config.ts` existem na raiz
- Stage 2 falha → verificar que `backend/src/index.ts` e `backend/tsconfig.json` existem
- Stage 3 falha → verificar que `nginx.conf` e `start.sh` foram criados nas tasks anteriores

- [ ] **Step 3: Testar o container localmente**

```bash
docker run --rm -p 8080:80 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e DB_HOST=easypanel.eficienciia.com.br \
  -e DB_PORT=3306 \
  -e DB_USER=mysql \
  -e DB_PASSWORD=0800mysql2017Aa \
  -e DB_NAME=daily \
  -e WAHA_URL=https://waha.eficienciia.com.br \
  -e WAHA_API_KEY=08002101210 \
  -e WAHA_SESSION=default \
  -e WAHA_WEBHOOK_SECRET=08002101210 \
  billsync-test
```

Em outro terminal, testar:

```bash
curl http://localhost:8080/
```

Esperado: HTML da aplicação React (status 200).

```bash
curl http://localhost:8080/api/health
```

Esperado: JSON de status do backend (status 200). Se retornar 502, o processo node não subiu — verificar logs do container com `docker logs <container-id>`.

- [ ] **Step 4: Commitar**

```bash
git add Dockerfile
git commit -m "chore: substitui Dockerfile por build multi-stage de container único (frontend + backend)"
```

---

### Task 5: Remover arquivos obsoletos

**Files:**
- Delete: `nginx.conf.template`
- Delete: `Dockerfile.backend`
- Delete: `Dockerfile.backend.dockerignore`

- [ ] **Step 1: Remover os 3 arquivos do git**

```bash
git rm nginx.conf.template Dockerfile.backend Dockerfile.backend.dockerignore
```

Saída esperada:
```
rm 'Dockerfile.backend'
rm 'Dockerfile.backend.dockerignore'
rm 'nginx.conf.template'
```

Nota: `nginx.conf.template` já foi deletado do working tree mas ainda está no índice git — o `git rm` vai confirmar a remoção.

- [ ] **Step 2: Commitar**

```bash
git commit -m "chore: remove arquivos obsoletos de deploy separado (nginx.conf.template, Dockerfile.backend)"
```

---

### Task 6: Push e deploy no EasyPanel

- [ ] **Step 1: Push para o repositório remoto**

```bash
git push origin master
```

Saída esperada: push aceito sem erros.

- [ ] **Step 2: Disparar o deploy no EasyPanel**

No EasyPanel, acessar o App `billsync` no projeto `eficienciia`:
1. Clicar em **"Deploy"** (ou aguardar o webhook automático se configurado)
2. Acompanhar os logs de build — deve aparecer os 3 stages do Dockerfile

- [ ] **Step 3: Verificar variáveis de ambiente no EasyPanel**

Na aba **"Environment"** do App `billsync`, confirmar que as seguintes variáveis estão configuradas:

```
NODE_ENV=production
PORT=4000
DB_HOST=easypanel.eficienciia.com.br
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=<senha>
DB_NAME=daily
WAHA_URL=https://waha.eficienciia.com.br
WAHA_API_KEY=<chave>
WAHA_SESSION=default
WAHA_WEBHOOK_SECRET=<secret>
```

- [ ] **Step 4: Verificar que o container subiu**

No painel, o App deve estar com status **"Running"**.

- [ ] **Step 5: Testar via domínio público**

```bash
curl https://eficienciia-billsync.jqd7au.easypanel.host/
```

Esperado: HTML da aplicação (status 200).

```bash
curl https://eficienciia-billsync.jqd7au.easypanel.host/api/health
```

Esperado: JSON de status (status 200). Se retornar 502, verificar logs do container no EasyPanel — procurar erros de conexão com o banco ou na inicialização do node.

- [ ] **Step 6: Verificar no browser**

Abrir `https://eficienciia-billsync.jqd7au.easypanel.host/` no browser e confirmar:
- App React carrega sem erros no console
- Erro `supabaseUrl is required` não aparece mais (era do build antigo)
- Chamadas `/api/` retornam dados reais
