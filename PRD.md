# PRD — DailySync
**Product Requirements Document**
Versão 1.0 | 14 de março de 2026

---

## 1. Visão Geral do Produto

### 1.1 Declaração do Produto

O **DailySync** é uma plataforma SaaS de acompanhamento de atividades diárias integrada ao WhatsApp. O sistema automatiza o envio de enquetes/perguntas periódicas via WhatsApp e consolida as respostas em um dashboard analítico, permitindo que usuários monitorem sua consistência e progresso ao longo do tempo.

### 1.2 Problema

Criar hábitos e monitorar atividades diárias exige disciplina e ferramentas adequadas. A maioria das pessoas já usa o WhatsApp diariamente, mas não dispõe de uma forma estruturada de registrar check-ins e visualizar progresso. Planilhas e aplicativos de hábito isolados geram atrito elevado e baixo engajamento.

### 1.3 Solução

DailySync entrega a pergunta diária diretamente no WhatsApp do usuário no horário configurado por ele. As respostas são capturadas automaticamente e exibidas em um dashboard com heatmap, KPIs e histórico completo — sem fricção adicional para o usuário final.

### 1.4 Proposta de Valor

| Para quem | Proposta |
|-----------|---------|
| Usuário final | Acompanhamento de hábitos sem sair do WhatsApp |
| Admin / Gestor | Visão consolidada de todos os usuários e atividades |
| Empreendedor SaaS | Receita recorrente com Stripe e Hotmart integrados |

---

## 2. Objetivos e Métricas de Sucesso

### 2.1 Objetivos de Negócio

- Converter usuários trial (7 dias) em assinantes pagos
- Manter taxa de churn < 5% ao mês
- Crescer base de usuários ativos via indicações (WhatsApp como canal viral)

### 2.2 Métricas-Chave (KPIs)

| Métrica | Definição | Meta Inicial |
|---------|-----------|-------------|
| Taxa de Conversão Trial → Pago | % de trials que se tornam assinantes | ≥ 20% |
| Taxa de Conclusão Diária | % de dias com check-in realizado | ≥ 70% dos usuários ativos |
| MRR (Monthly Recurring Revenue) | Receita mensal recorrente | — |
| Churn Mensal | Cancelamentos / base total | < 5% |
| Time to First Activity | Tempo da criação até 1ª atividade registrada | < 24h |

---

## 3. Usuários e Personas

### 3.1 Persona 1 — Usuário Final (End User)

**Nome fictício:** Carla, 34 anos
**Perfil:** Profissional que quer criar consistência em atividades (exercício, leitura, meditação etc.)
**Comportamento:** Usa WhatsApp o dia inteiro, prefere não instalar novos apps
**Necessidades:**
- Receber lembrete diário automaticamente no WhatsApp
- Responder com um toque
- Ver progresso semanal/mensal sem esforço

**Frustrações:**
- Apps de hábito que exigem abertura ativa
- Dashboards complexos demais
- Notificações que pode ignorar facilmente

---

### 3.2 Persona 2 — Administrador

**Nome fictício:** André, fundador do produto
**Perfil:** Responsável técnico e de negócio da plataforma
**Necessidades:**
- Gerenciar todos os usuários (criar, editar, deletar)
- Visualizar status de assinaturas e pagamentos
- Criar leads manualmente e configurar parametros de envio
- Auditar atividades por usuário

---

## 4. Escopo do Produto

### 4.1 Funcionalidades In-Scope (v1)

#### Autenticação e Conta
- [x] Cadastro com telefone WhatsApp + senha (+ e-mail opcional)
- [x] Validação de número via WAHA antes do cadastro
- [x] Login com telefone + senha
- [x] JWT httpOnly cookie session (7 dias)
- [x] Recuperação de senha via token
- [x] Logout

#### Dashboard do Usuário
- [x] KPI cards: taxa de conclusão, total de atividades, dias completos, próximo envio
- [x] Heatmap de atividade (14 dias)
- [x] Tabela de histórico de atividades com ordenação
- [x] Exibição de perfil WhatsApp (foto, nome, status)
- [x] Banner de trial expirando / assinatura expirada

#### Configurações do Usuário
- [x] Editar nome, telefone, título da enquete, opções de resposta, horário de envio
- [x] Formulário de edição com validação de telefone via WAHA

#### Assinaturas
- [x] Período trial de 7 dias pós-cadastro
- [x] Planos: basic, premium, enterprise
- [x] Status: trial, active, cancelled, expired
- [x] Webhook Stripe: criação, atualização, cancelamento, falhas de pagamento
- [x] Webhook Hotmart: aprovação de compra, cancelamento, reembolso, chargeback
- [x] Página de planos de assinatura

#### Administração
- [x] Listagem de todos os usuários com paginação
- [x] Criação manual de usuários/leads
- [x] Edição de qualquer usuário (incluindo campos de assinatura)
- [x] Deleção de usuário
- [x] Controle de permissão: admin vs. usuário comum

#### Integração WhatsApp (WAHA)
- [x] Validação de número antes do cadastro/alteração
- [x] Busca de perfil (nome, foto, status)
- [x] Rate limiting: 10 req/min para validação, 100 req/min geral

---

### 4.2 Funcionalidades Out-of-Scope (v1)

- Envio automatizado de mensagens WhatsApp via agendamento (scheduler/cron)
- Onboarding interativo via WhatsApp (chatbot)
- Relatórios exportáveis (PDF/CSV)
- Multi-tenancy (múltiplas organizações)
- App mobile nativo
- Notificações por e-mail
- Integração Asaas / Mercado Pago (schema preparado, não implementado)

---

## 5. Arquitetura do Sistema

### 5.1 Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilo | Tailwind CSS, glassmorphism dark theme |
| Backend | Next.js API Routes (Edge + Node.js runtimes) |
| Banco de Dados | MySQL 8+ com connection pooling (10 conexões) |
| Autenticação | JWT HS256, httpOnly cookies |
| Hash de Senhas | bcryptjs (12 rounds) |
| Pagamento | Stripe, Hotmart |
| WhatsApp | WAHA (WhatsApp HTTP API) |
| Hospedagem | Vercel (Next.js serverless + edge) |

---

### 5.2 Modelo de Dados

#### Tabela `daily_user`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT AI PK | Identificador único |
| created_at | DATETIME | Data de criação |
| name | VARCHAR(255) | Nome de exibição |
| email | VARCHAR(255) UNIQUE | E-mail (opcional) |
| password_hash | VARCHAR(255) | Senha hasheada (bcrypt) |
| phone | VARCHAR(50) UNIQUE | chatId WhatsApp (`5511999@c.us`) |
| title | VARCHAR(255) | Título da enquete diária |
| option | JSON | Array de opções de resposta |
| time_to_send | INT | Hora de envio (0–23) |
| is_admin | TINYINT | Flag de administrador |
| subscription_status | ENUM | trial / active / cancelled / expired |
| trial_ends_at | DATETIME | Fim do período trial |
| subscription_ends_at | DATETIME | Fim da assinatura paga |
| subscription_plan | ENUM | basic / premium / enterprise |
| payment_provider | ENUM | hotmart / stripe / asaas / mercadopago |
| payment_customer_id | VARCHAR | ID do cliente no provedor |
| payment_subscription_id | VARCHAR | ID da assinatura no provedor |
| payment_status | ENUM | pending / paid / failed / refunded / cancelled |
| next_billing_date | DATETIME | Próxima cobrança |
| reset_token | VARCHAR | Token de recuperação de senha |
| reset_token_expires_at | DATETIME | Validade do token de reset |

#### Tabela `daily_data`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT AI PK | Identificador único |
| id_user | BIGINT FK | Referência ao usuário |
| created_at | DATETIME | Timestamp de criação |
| activity_date | DATE | Data da atividade |
| check_status | TINYINT | Conclusão (boolean) |
| option | TEXT | Opção selecionada |

**Índices:** `(id_user, activity_date)`, `(email)`

---

### 5.3 Fluxo de Autenticação

```
Usuário                  Frontend              API             MySQL       WAHA
   |                        |                   |                |           |
   |--[phone + password]--->|                   |                |           |
   |                        |--POST /api/auth/login-->           |           |
   |                        |                   |--normaliza phone           |
   |                        |                   |--SELECT by phone-->        |
   |                        |                   |         <--user row--|     |
   |                        |                   |--bcrypt.compare()          |
   |                        |                   |--JWT sign (7d)             |
   |                        |                   |--Set-Cookie: daily_session |
   |                        |<--200 + user----  |                |           |
   |<--redirect /dashboard--|                   |                |           |
```

---

### 5.4 Rotas da API

#### Autenticação

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/api/auth/register` | Público | Cadastro com validação WAHA |
| POST | `/api/auth/login` | Público | Login phone + senha |
| POST | `/api/auth/logout` | Autenticado | Limpar cookie de sessão |
| GET | `/api/auth/me` | Autenticado | Dados do usuário logado |
| POST | `/api/auth/forgot-password` | Público | Solicitar reset de senha |

#### Usuários

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/users` | Admin | Listar usuários com paginação |
| POST | `/api/users` | Admin | Criar lead/usuário |
| GET | `/api/users/[id]` | Autenticado | Buscar usuário por ID |
| PUT | `/api/users/[id]` | Usuário / Admin | Atualizar perfil |
| DELETE | `/api/users/[id]` | Admin | Deletar usuário |

#### Atividades

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/daily-data` | Autenticado | Atividades por usuário (sort/order) |

#### WAHA

| Método | Rota | Acesso | Rate Limit |
|--------|------|--------|-----------|
| POST | `/api/waha/validate-phone` | Autenticado | 10 req/min |
| POST | `/api/waha/profile` | Autenticado | 100 req/min |

#### Webhooks de Pagamento

| Método | Rota | Verificação |
|--------|------|------------|
| POST | `/api/webhooks/stripe` | Stripe-Signature header |
| POST | `/api/webhooks/hotmart` | hottok token |

---

### 5.5 Modelo de Permissões

| Recurso | Usuário Comum | Admin |
|---------|--------------|-------|
| Visualizar próprio perfil | Sim | Sim |
| Editar próprio perfil | Sim (campos limitados) | Sim (todos os campos) |
| Ver próprias atividades | Sim | Sim |
| Listar todos os usuários | Não | Sim |
| Editar qualquer usuário | Não | Sim |
| Deletar usuário | Não | Sim |
| Criar usuário/lead | Não | Sim |
| Alterar `is_admin` | Não | Não (via endpoint separado) |

**Campos editáveis por usuário comum:** name, title, phone, option, time_to_send
**Campos exclusivos de admin:** email, subscription_status, subscription_ends_at, subscription_plan, payment_*

---

## 6. Fluxos de Produto

### 6.1 Cadastro de Novo Usuário

```
1. Usuário acessa /register
2. Preenche: telefone, senha (+ e-mail opcional)
3. Sistema valida telefone via WAHA API
   └─ Erro: número não existe no WhatsApp → bloquear cadastro
4. Sistema verifica unicidade do e-mail (se fornecido)
5. Senha hasheada com bcrypt (12 rounds)
6. Usuário criado com subscription_status = 'trial', trial_ends_at = now + 7 dias
7. JWT gerado e cookie definido
8. Webhook USER_CREATED_WEBHOOK_URL disparado (se configurado)
9. Redirecionamento para /dashboard
```

### 6.2 Login

```
1. Usuário acessa /login
2. Preenche telefone (qualquer formato) + senha
3. Telefone normalizado para chatId (XXXXXXXXXXX@c.us)
4. Busca no banco por phone
5. bcrypt.compare() para verificar senha
6. JWT gerado (payload: userId, phone, email, isAdmin)
7. Cookie daily_session definido (7 dias, httpOnly)
8. Redirecionamento para /dashboard
```

### 6.3 Dashboard

```
1. Middleware verifica JWT no cookie
2. Server Component busca em paralelo: usuário + atividades
3. Renderização:
   ├─ KPI Cards (taxa conclusão, total, dias completos, próximo envio)
   ├─ Heatmap 14 dias
   ├─ Tabela de atividades (ordenável)
   └─ Perfil WhatsApp (foto, nome, status via WAHA)
4. Se trial expirando (≤ 2 dias) → exibe TrialBanner
5. Se assinatura expirada → bloquear acesso ao dashboard
```

### 6.4 Atualização de Assinatura via Stripe

```
1. Evento Stripe recebido em /api/webhooks/stripe
2. Verificação de assinatura com STRIPE_WEBHOOK_SECRET
3. Switch por tipo de evento:
   ├─ checkout.session.completed → atualizar payment_customer_id
   ├─ customer.subscription.created/updated → status=active, subscription_ends_at
   ├─ customer.subscription.deleted → status=cancelled
   ├─ invoice.paid → payment_status=paid, next_billing_date
   └─ invoice.payment_failed → payment_status=failed
4. UPDATE no daily_user correspondente
```

### 6.5 Atualização de Assinatura via Hotmart

```
1. Evento Hotmart recebido em /api/webhooks/hotmart
2. Verificação do token (hottok header)
3. Switch por tipo de evento:
   ├─ PURCHASE_APPROVED → status=active, payment_status=paid
   ├─ SUBSCRIPTION_CANCELLED → status=cancelled
   ├─ PURCHASE_REFUNDED → payment_status=refunded, status=expired
   └─ CHARGEBACK → payment_status=refunded, status=expired
4. UPDATE no daily_user correspondente
```

---

## 7. Interface e Experiência do Usuário

### 7.1 Design System

- **Tema:** Dark, base `slate-950`
- **Estilo:** Glassmorphism com bordas sutis e backdrop blur
- **Tipografia:** Sistema default Next.js + Tailwind
- **Ícones:** Lucide React
- **Cores de status:**
  - Verde: ativo / completo
  - Amarelo: trial / atenção
  - Vermelho: erro / expirado
  - Cinza: inativo / pendente

### 7.2 Componentes Principais

| Componente | Propósito |
|-----------|----------|
| `KPICard` | Métricas no dashboard com valor, label e ícone |
| `ActivityTable` | Histórico de atividades paginado e ordenável |
| `TrialBanner` | Alerta de trial expirando (≤ 2 dias) |
| `DashboardSkeleton` | Loading state do dashboard |
| `UserForm` | Formulário de edição de perfil |
| `UserList` | Tabela admin de todos os usuários |
| `SubscriptionPlans` | Cards de planos de assinatura |
| `Toast` | Notificações de sucesso/erro não bloqueantes |
| `Skeleton` | Placeholder de carregamento (text/circular/rect) |

### 7.3 Páginas

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/` | Público | Root redirect |
| `/login` | Público | Login com branding |
| `/register` | Público | Cadastro com validação WAHA |
| `/forgot-password` | Público | Solicitação de reset de senha |
| `/reset-password` | Público | Formulário de nova senha |
| `/dashboard` | Autenticado | Dashboard principal (SSR) |
| `/user` | Autenticado | Configurações do perfil |
| `/edit?id=X` | Autenticado | Edição (própria ou admin) |
| `/users` | Admin | Listagem de usuários |
| `/create` | Admin | Criar lead/usuário |
| `/subscription` | Autenticado | Planos e assinatura |

---

## 8. Segurança

### 8.1 Medidas Implementadas

| Área | Implementação |
|------|--------------|
| Autenticação | JWT HS256, cookies httpOnly + secure + sameSite=lax |
| Senhas | bcryptjs, 12 rounds |
| Rotas | Middleware Edge Runtime com verificação de JWT |
| SQL Injection | Queries parametrizadas (mysql2 placeholders) |
| Rate Limiting | 10 req/min (validação de telefone), 100 req/min (geral) |
| Webhooks | Verificação de assinatura Stripe + token Hotmart |
| Sanitização | Input sanitization nas rotas WAHA |
| CSRF | sameSite=lax no cookie de sessão |

### 8.2 Variáveis de Ambiente Necessárias

```env
# Autenticação
JWT_SECRET=<chave-secreta-forte>

# Banco de Dados
MYSQL_URL=mysql://user:pass@host:3306/daily

# WAHA (WhatsApp HTTP API)
WAHA_BASE_URL=<url-da-api-waha>
WAHA_API_KEY=<chave-api-opcional>

# Stripe
STRIPE_SECRET_KEY=<chave-privada-stripe>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<chave-publica-stripe>
STRIPE_WEBHOOK_SECRET=<secret-webhook-stripe>

# Hotmart
HOTMART_WEBHOOK_TOKEN=<token-hotmart>

# Webhooks Opcionais
USER_CREATED_WEBHOOK_URL=<url-webhook-criacao-usuario>
```

---

## 9. Infraestrutura e Deploy

### 9.1 Requisitos

- Node.js 18+
- MySQL 8+
- Instância WAHA rodando e acessível
- Conta Stripe e/ou Hotmart configurada
- Variáveis de ambiente configuradas

### 9.2 Scripts

```bash
npm run dev    # Desenvolvimento local (localhost:3000)
npm run build  # Build de produção
npm run start  # Servidor de produção
npm run lint   # Lint ESLint
```

### 9.3 Banco de Dados — Setup Inicial

```sql
-- Executar schema.sql para criar tabelas
SOURCE schema.sql;
```

### 9.4 Hospedagem Recomendada

- **App:** Vercel (Next.js serverless + edge middleware)
- **Banco:** PlanetScale, Railway, ou MySQL gerenciado na AWS/GCP
- **WAHA:** VPS dedicada ou contêiner Docker

---

## 10. Limitações Conhecidas e Débito Técnico

### 10.1 Alta Prioridade

| Item | Descrição |
|------|-----------|
| Scheduler ausente | Envio de mensagens via WhatsApp não está implementado (apenas armazenamento de `time_to_send`) |
| Endpoints admin dispersos | `/api/admin/*` e `/api/users/*` têm sobreposição e inconsistência |
| Lógica de assinatura duplicada | Handlers Stripe e Hotmart repetem código de atualização de status |

### 10.2 Média Prioridade

| Item | Descrição |
|------|-----------|
| Dois middlewares de auth | `auth-jwt.ts` e `server-auth.ts` com responsabilidades sobrepostas |
| Código morto | Arquivos remanescentes da migração Supabase, SWR não utilizado |
| Pool de conexões | Limite de 10 pode ser insuficiente em escala |

### 10.3 Baixa Prioridade

| Item | Descrição |
|------|-----------|
| Tokens de design | Cores hardcoded em vez de semantic tokens |
| Validação de e-mail | Centralizar lógica de validação |
| Dependências não utilizadas | SWR instalado mas não usado |

---

## 11. Roadmap Sugerido

### Fase 1 — Estabilização (Curto Prazo)

- [ ] Implementar scheduler de envio de mensagens WhatsApp (`time_to_send`)
- [ ] Consolidar endpoints admin em padrão RESTful consistente
- [ ] Unificar middlewares de autenticação em único módulo
- [ ] Extrair lógica de atualização de assinatura para service reutilizável
- [ ] Implementar envio de e-mail para reset de senha

### Fase 2 — Crescimento (Médio Prazo)

- [ ] Onboarding via chatbot WhatsApp (configurar enquete pelo próprio chat)
- [ ] Notificações por e-mail (trial expirando, fatura emitida)
- [ ] Exportação de relatórios (CSV/PDF)
- [ ] Integração Asaas e Mercado Pago
- [ ] Analytics avançado: streaks, rankings, médias por período

### Fase 3 — Escala (Longo Prazo)

- [ ] Multi-tenancy (múltiplas organizações/clientes B2B)
- [ ] App mobile React Native
- [ ] Integrações via Zapier/Make (webhook genérico de saída)
- [ ] IA para insights de padrões de atividade

---

## 12. Glossário

| Termo | Definição |
|-------|-----------|
| chatId | Identificador WAHA de um número WhatsApp (`5511999@c.us`) |
| WAHA | WhatsApp HTTP API — proxy REST para automação WhatsApp |
| Trial | Período gratuito de 7 dias pós-cadastro |
| daily_data | Tabela de registros de atividade diária |
| daily_user | Tabela principal de usuários |
| time_to_send | Hora do dia (0–23) configurada para envio da enquete |
| check_status | Flag booleano indicando se a atividade foi concluída |
| option | Opção de resposta selecionada pelo usuário em determinado dia |
| RSC | React Server Components — renderização server-side no Next.js 14 |
| JWT | JSON Web Token — token de autenticação stateless |
| MRR | Monthly Recurring Revenue — receita mensal recorrente |

---

*Documento gerado por análise estática do código-fonte em 14/03/2026.*
*Manter atualizado a cada release significativo.*
