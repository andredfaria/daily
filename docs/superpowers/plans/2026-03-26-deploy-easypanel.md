# Deploy EasyPanel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajustar o `docker-compose.yml` para produção e realizar o deploy do BillSync no EasyPanel como Stack.

**Architecture:** Frontend (nginx) e Backend (node) sobem como serviços dentro de uma única Stack no EasyPanel. O nginx faz proxy de `/api/*` para o backend internamente. MySQL e WAHA já existem como serviços separados no EasyPanel e são acessados via hostname interno.

**Tech Stack:** Docker, Docker Compose, Nginx (nginx:alpine), Node.js 20 (node:alpine), EasyPanel

---

### Task 1: Ajustar `docker-compose.yml` para produção

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Remover a exposição pública da porta 4000 do backend**

Abrir `docker-compose.yml` e remover as linhas do bloco `ports` do serviço `backend`:

```yaml
# ANTES — serviço backend:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"          # ← REMOVER estas 2 linhas
    environment:
      NODE_ENV: development
```

```yaml
# DEPOIS — serviço backend:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV:-production}
```

O arquivo completo deve ficar assim:

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      BACKEND_HOST: ${BACKEND_HOST:-backend}
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV:-production}
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

- [ ] **Step 2: Verificar o diff antes de commitar**

```bash
git diff docker-compose.yml
```

Confirmar que:
- Bloco `ports: ["4000:4000"]` foi removido do backend
- `NODE_ENV: development` foi trocado por `NODE_ENV: ${NODE_ENV:-production}`
- Frontend ainda tem `ports: ["80:80"]`

- [ ] **Step 3: Commitar**

```bash
git add docker-compose.yml
git commit -m "chore: ajusta docker-compose para produção (remove porta 4000 publica, NODE_ENV configurável)"
```

- [ ] **Step 4: Fazer push para o repositório remoto**

```bash
git push origin main
```

---

### Task 2: Criar a Stack no EasyPanel

- [ ] **Step 1: Acessar o EasyPanel e criar nova Stack**

No painel do EasyPanel:
1. Clicar em **"+ Create Resource"**
2. Selecionar **"Stack"** (não "App")
3. Dar o nome: `billsync`

- [ ] **Step 2: Conectar ao repositório Git**

Na configuração da Stack:
- **Source:** Git
- **Repository URL:** URL do repositório (ex: `https://github.com/seu-usuario/daily`)
- **Branch:** `main`
- **Docker Compose File:** `docker-compose.yml` (caminho relativo na raiz do projeto)

- [ ] **Step 3: Verificar que a Stack reconhece os 2 serviços**

Após salvar, o EasyPanel deve mostrar 2 serviços detectados:
- `frontend`
- `backend`

Se mostrar erro de parse no `docker-compose.yml`, verificar a sintaxe com:
```bash
docker compose config
```

---

### Task 3: Descobrir os hostnames internos do MySQL e WAHA

> Os serviços dentro de uma Stack no EasyPanel se comunicam pelo **hostname interno** dos outros apps/serviços do servidor.

- [ ] **Step 1: Obter o hostname interno do MySQL**

No EasyPanel, acessar o serviço MySQL existente:
1. Abrir o serviço MySQL no painel
2. Na aba **"General"** ou **"Info"**, copiar o valor de **"Internal Domain"** ou **"Container Name"**
3. O formato é geralmente: `<projeto>_<serviço>` ou `<nome-do-app>`

Anotar o valor — será usado como `DB_HOST`.

- [ ] **Step 2: Obter o hostname interno do WAHA**

Mesmo processo para o serviço WAHA:
1. Abrir o serviço WAHA no painel
2. Copiar o **"Internal Domain"**
3. Verificar também a porta que o WAHA usa (geralmente `3000`)

Anotar o valor — será usado em `WAHA_URL=http://<hostname>:<porta>`.

---

### Task 4: Configurar variáveis de ambiente na Stack

- [ ] **Step 1: Acessar a aba Environment da Stack**

Na Stack `billsync` no EasyPanel, clicar na aba **"Environment"** (ou "Env Vars").

- [ ] **Step 2: Preencher todas as variáveis**

Adicionar as seguintes variáveis (substituindo os valores reais):

```
DB_HOST=<hostname-interno-mysql>
DB_PORT=3306
DB_USER=<usuario-do-banco>
DB_PASSWORD=<senha-do-banco>
DB_NAME=daily
WAHA_URL=http://<hostname-interno-waha>:<porta>
WAHA_API_KEY=<chave-api-waha>
WAHA_SESSION=default
WAHA_WEBHOOK_SECRET=<secret-webhook>
NODE_ENV=production
```

- [ ] **Step 3: Salvar as variáveis**

Clicar em **"Save"**. Nenhum deploy acontece ainda.

---

### Task 5: Configurar domínio no serviço frontend

- [ ] **Step 1: Acessar o serviço frontend dentro da Stack**

Dentro da Stack `billsync`, clicar no serviço `frontend`.

- [ ] **Step 2: Adicionar o domínio**

Na aba **"Domains"**:
1. Clicar em **"Add Domain"**
2. Inserir o domínio desejado (ex: `daily.seudominio.com`)
3. Porta: `80`
4. Habilitar **HTTPS** (certificado Let's Encrypt automático)
5. Salvar

- [ ] **Step 3: Verificar que o backend NÃO tem domínio configurado**

O serviço `backend` não deve ter domínio externo. Ele só é acessível internamente pelo frontend.

---

### Task 6: Fazer o deploy e verificar

- [ ] **Step 1: Iniciar o deploy da Stack**

Na Stack `billsync`, clicar em **"Deploy"**.

O EasyPanel irá:
1. Clonar o repositório
2. Fazer o build do `frontend` (stage Node para Vite build + stage nginx)
3. Fazer o build do `backend` (stage Node para TS build + stage Node runtime)
4. Subir os containers

- [ ] **Step 2: Acompanhar os logs de build**

Verificar os logs de build de cada serviço. O build do frontend deve terminar com:
```
Successfully built ...
Successfully tagged ...
```

E o backend deve ter o healthcheck passando:
```
HEALTHCHECK: wget -qO- http://localhost:4000/api/health
```

- [ ] **Step 3: Verificar que os containers subiram**

Ambos os serviços devem estar com status **"Running"** no painel.

- [ ] **Step 4: Testar o health do backend via proxy do frontend**

```bash
curl https://daily.seudominio.com/api/health
```

Resposta esperada: `200 OK` com JSON de status.

- [ ] **Step 5: Testar a aplicação no browser**

Abrir `https://daily.seudominio.com` no browser.

Verificar:
- A interface React carrega corretamente
- Não há erros de CORS no console do browser
- As chamadas de API (`/api/bills`, etc.) retornam dados

---

### Task 7: Troubleshooting comum

> Referência rápida para problemas frequentes. Não é um step obrigatório — consultar só se necessário.

**Problema: frontend não consegue conectar ao backend**
- Verificar que `BACKEND_HOST` está como `backend` (nome do serviço no docker-compose)
- Verificar logs do nginx: `502 Bad Gateway` significa que o backend não está acessível

**Problema: backend não conecta ao MySQL**
- Verificar o valor de `DB_HOST` — usar o hostname interno exato do EasyPanel
- Testar conectividade: nos logs do backend, procurar erros de `ECONNREFUSED` ou `Access denied`

**Problema: build falha no frontend**
- Verificar se `npm ci` passa localmente: `cd /home/andre/Documentos/projetos/daily && npm ci && npm run build`

**Problema: envsubst não substitui as variáveis no nginx**
- O nginx:alpine processa templates em `/etc/nginx/templates/*.template` automaticamente via `envsubst`
- Verificar que `BACKEND_HOST` e `BACKEND_PORT` estão definidos nas env vars do serviço frontend
- `BACKEND_PORT` não está no docker-compose.yml — o Dockerfile define como `ENV BACKEND_PORT=4000` (default ok)
