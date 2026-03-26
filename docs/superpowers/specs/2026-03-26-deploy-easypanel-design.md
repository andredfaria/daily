# Deploy EasyPanel — Design Spec

**Data:** 2026-03-26
**Projeto:** BillSync (daily)
**Stack:** React + Vite (frontend) + Node/Express (backend) + MySQL + WAHA

---

## Objetivo

Fazer o deploy correto do projeto no EasyPanel usando o `docker-compose.yml` como Stack, ajustado para produção.

---

## Arquitetura

```
EasyPanel Server
│
├── Stack: billsync (docker-compose.yml)
│   ├── Service: frontend  (nginx:alpine, porta 80 — pública via domínio)
│   │     └── proxy /api/* → backend:4000  (rede interna da stack)
│   └── Service: backend   (node:alpine, porta 4000 — INTERNA apenas)
│
├── App: mysql             (já existente — DB_HOST via hostname interno)
└── App: waha              (já existente — WAHA_URL via hostname interno)
```

**Fluxo de rede:**
- Usuário → domínio público → frontend (porta 80)
- Frontend nginx → `http://backend:4000/api/` (rede interna Docker)
- Backend → MySQL EasyPanel (hostname interno)
- Backend → WAHA EasyPanel (hostname interno)

---

## Mudanças no `docker-compose.yml`

### 1. Remover exposição pública da porta do backend
```yaml
# REMOVER esta linha do serviço backend:
ports:
  - "4000:4000"
```
O backend só precisa ser acessível internamente pelo frontend. Expor a porta 4000 publicamente é desnecessário e inseguro.

### 2. Tornar NODE_ENV configurável
```yaml
# TROCAR:
NODE_ENV: development

# POR:
NODE_ENV: ${NODE_ENV:-production}
```

---

## Variáveis de Ambiente no EasyPanel

Configurar no painel da Stack (aba "Environment"):

| Variável | Valor |
|---|---|
| `DB_HOST` | hostname interno do MySQL no EasyPanel |
| `DB_PORT` | `3306` |
| `DB_USER` | usuário do banco |
| `DB_PASSWORD` | senha do banco |
| `DB_NAME` | `daily` |
| `WAHA_URL` | `http://<hostname-waha>:<porta>` |
| `WAHA_API_KEY` | chave da API do WAHA |
| `WAHA_SESSION` | `default` (ou nome da sessão) |
| `WAHA_WEBHOOK_SECRET` | secret do webhook |
| `NODE_ENV` | `production` |

> **Como obter o hostname interno no EasyPanel:** No painel do serviço MySQL ou WAHA, verificar o campo "Internal Domain" ou "Container Name". Geralmente segue o padrão `<projeto>_<serviço>` ou o nome do app.

---

## Domínio

- Configurar o domínio no serviço **frontend** da stack
- EasyPanel gerencia o certificado SSL automaticamente via Let's Encrypt
- O backend **não** recebe domínio próprio

---

## Checklist de Deploy

- [ ] Ajustar `docker-compose.yml` (2 mudanças acima)
- [ ] Commitar as mudanças
- [ ] Criar Stack no EasyPanel apontando para o repositório
- [ ] Configurar todas as variáveis de ambiente na Stack
- [ ] Adicionar domínio ao serviço `frontend`
- [ ] Fazer o deploy e verificar logs de cada serviço
- [ ] Testar `GET /api/health` via domínio público

---

## Fora do Escopo

- Configuração interna do MySQL (já existente)
- Configuração interna do WAHA (já existente)
- CI/CD automático (pode ser adicionado futuramente)
