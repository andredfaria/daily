# Deploy EasyPanel — Container Único (Frontend + Backend)

**Data:** 2026-03-31
**Projeto:** BillSync (eficienciia/billsync)
**Stack:** React + Vite (frontend) + Node/Express (backend) + MySQL + WAHA

---

## Objetivo

Consolidar frontend e backend num único container Docker, deployado como um único App no EasyPanel (projeto `eficienciia`, app `billsync`). Elimina a necessidade de coordenar dois Apps separados e hostnames internos entre eles.

---

## Arquitetura

```
EasyPanel: projeto eficienciia
└── App: billsync (único)
    └── Container (imagem unificada)
        ├── nginx  → porta 80  (público, domínio EasyPanel)
        │    ├── GET /          → serve /usr/share/nginx/html (React build)
        │    └── GET /api/*     → proxy → localhost:4000/api/*
        └── node   → porta 4000 (interno, nunca exposto)
             └── Express API + MySQL + WAHA
```

---

## Dockerfile (multi-stage, 3 estágios)

### Stage 1 — Build frontend
- Base: `node:20-alpine`
- Workdir: `/app`
- Copia `package*.json` do root, roda `npm ci`
- Copia `src/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`
- Roda `npm run build` → produz `/app/dist`

### Stage 2 — Build backend
- Base: `node:20-alpine`
- Workdir: `/app`
- Copia `backend/package*.json`, roda `npm ci`
- Copia `backend/src/`, `backend/tsconfig.json`
- Roda `npm run build` → produz `/app/dist` + `/app/node_modules`

### Stage 3 — Imagem final
- Base: `nginx:alpine`
- Instala Node.js via `apk add --no-cache nodejs`
- Copia `/app/dist` do frontend-builder → `/usr/share/nginx/html`
- Copia `/app/dist` + `/app/node_modules` + `package*.json` do backend-builder → `/app/`
- Copia `nginx.conf` estático → `/etc/nginx/conf.d/default.conf`
- Copia `start.sh` → `/start.sh` (chmod +x)
- `EXPOSE 80`
- `CMD ["/start.sh"]`

---

## nginx.conf (estático, sem envsubst)

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

---

## start.sh

```sh
#!/bin/sh
node /app/dist/index.js &
exec nginx -g "daemon off;"
```

- `node` sobe em background
- `nginx` sobe em foreground (mantém o container vivo)
- `exec` garante que nginx recebe sinais do Docker (SIGTERM para shutdown limpo)

---

## Variáveis de Ambiente no EasyPanel

Configurar na aba **Environment** do App `billsync`:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DB_HOST` | `easypanel.eficienciia.com.br` |
| `DB_PORT` | `3306` |
| `DB_USER` | `mysql` |
| `DB_PASSWORD` | `<senha>` |
| `DB_NAME` | `daily` |
| `WAHA_URL` | `https://waha.eficienciia.com.br` |
| `WAHA_API_KEY` | `<chave>` |
| `WAHA_SESSION` | `default` |
| `WAHA_WEBHOOK_SECRET` | `<secret>` |

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `Dockerfile` | Substituir | Novo multi-stage com 3 estágios |
| `nginx.conf` | Criar | Config estática (localhost:4000) |
| `start.sh` | Criar | Script de startup dos dois processos |
| `nginx.conf.template` | Deletar do git | Não usado mais |
| `Dockerfile.backend` | Deletar | Não usado mais (era para build separado) |
| `Dockerfile.backend.dockerignore` | Deletar | Não usado mais |
| `.dockerignore` | Modificar | Remover exclusão de `backend/`, adicionar `backend/node_modules` e `backend/dist` separadamente |

---

## Fora do Escopo

- Configuração do MySQL (já existente e acessível via URL pública)
- Configuração do WAHA (já existente)
- CI/CD automático
- Health check do node no start.sh (pode ser adicionado futuramente)
