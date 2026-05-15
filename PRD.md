# BillSync — Product Requirements Document

| Campo | Valor |
|---|---|
| **Produto** | BillSync |
| **Versão** | 3.0 (unificado) |
| **Data** | Maio 2026 |
| **Status** | Implementado — referência viva |
| **Stack real** | React + TypeScript + Node.js/Express + MySQL 8 + WAHA |

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Problema](#2-problema)
3. [Solução](#3-solução)
4. [Público-alvo](#4-público-alvo)
5. [Módulos do Produto](#5-módulos-do-produto)
6. [Requisitos Funcionais](#6-requisitos-funcionais)
7. [Requisitos Não Funcionais](#7-requisitos-não-funcionais)
8. [Arquitetura Técnica](#8-arquitetura-técnica)
9. [API REST — Referência Completa](#9-api-rest--referência-completa)
10. [Modelo de Dados](#10-modelo-de-dados)
11. [Integrações Externas](#11-integrações-externas)
12. [Regras de Negócio](#12-regras-de-negócio)
13. [Casos de Borda e Tratamento de Erros](#13-casos-de-borda-e-tratamento-de-erros)
14. [Fluxos Críticos](#14-fluxos-críticos)
15. [Riscos e Dependências](#15-riscos-e-dependências)

---

## 1. Visão Geral

O **BillSync** é um sistema web pessoal com dois módulos integrados:

1. **Gestão de contas a pagar** — cadastro, acompanhamento e notificação automática de vencimentos via WhatsApp, com confirmação de pagamento por resposta na conversa.
2. **Checklists diários** — envio automático de enquetes de tarefas/hábitos via WhatsApp e dashboard de acompanhamento de conclusão.

O diferencial é a integração nativa com o WhatsApp: o usuário recebe alertas e interage sem precisar abrir o app. O sistema é projetado para uso individual com arquitetura preparada para escalar a múltiplos usuários.

---

## 2. Problema

Contas recorrentes (aluguel, energia, internet, academia) são esquecidas por falta de um sistema centralizado e proativo. Da mesma forma, hábitos e tarefas diárias falham por atrito de abrir um aplicativo dedicado.

**Soluções existentes falham porque:**
- Planilhas são passivas — não enviam alertas.
- Apps de finanças não integram com WhatsApp, canal primário do público-alvo.
- Lembretes de calendário não incluem dados de pagamento (chave PIX, boleto).
- Apps de tarefas exigem abertura ativa todos os dias.

**Consequências reais:**
- Pagamentos atrasados com juros, multas e dano ao score de crédito.
- Interrupção de serviços (internet, energia, plano de saúde).
- Abandono de metas e hábitos por falta de lembretes no canal certo.

---

## 3. Solução

### 3.1 Contas a Pagar
- Cadastro centralizado de contas com recorrência configurável.
- Alertas automáticos no WhatsApp com dados completos de pagamento (chave PIX ou código de boleto) na antecedência configurada pelo usuário.
- Confirmação de pagamento respondendo `PAGO` diretamente na conversa do WhatsApp.

### 3.2 Checklists Diários
- Cadastro de listas de tarefas/hábitos via interface web.
- Envio automático diário no horário configurado em formato de enquete WhatsApp de múltipla escolha.
- O usuário marca as tarefas concluídas tocando nas opções da enquete — sem precisar digitar.
- Dashboard com progresso do dia e histórico dos últimos 14 dias.

---

## 4. Público-alvo

**Perfil primário:**
- Pessoa física no Brasil, 25–45 anos.
- Usa WhatsApp diariamente como canal principal de comunicação.
- Tem 5–20 contas recorrentes mensais.
- Acompanha hábitos ou tarefas diárias.
- Sofreu ou teme atrasos por esquecimento.

**O que o usuário NÃO precisa:**
- Conhecimento técnico.
- Monitorar o sistema ativamente.
- Abrir o app para confirmar pagamentos — o WhatsApp é suficiente.

---

## 5. Módulos do Produto

| Módulo | Telas | Funcionalidade central |
|---|---|---|
| Autenticação | Login | OTP via WhatsApp + JWT 30 dias |
| Dashboard | Dashboard | Resumo financeiro do mês + próximos vencimentos |
| Contas | Lista de contas, Formulário | CRUD de contas e métodos de pagamento |
| Histórico | Histórico | Todas as ocorrências com filtros |
| Notificações | Notificações | Histórico de envios e reenvio individual |
| Checklists | Checklists | Gestão da lista + dashboard de progresso |
| Configurações | Configurações | Perfil, preferências e integração WAHA |

---

## 6. Requisitos Funcionais

### 6.1 Autenticação (implementado)

**RF-01 — Login via OTP no WhatsApp**
O usuário informa seu número de telefone. O sistema envia um código de 6 dígitos via mensagem WhatsApp. O código é válido por 5 minutos e bloqueado após 5 tentativas incorretas.

**RF-02 — Criação automática de conta**
Se o número não existir no banco, um novo usuário é criado automaticamente no primeiro login válido. O nome é obtido do perfil WhatsApp via WAHA.

**RF-03 — Sessão JWT**
Após validação do OTP, o sistema emite um JWT com validade de 30 dias armazenado no `localStorage`. Todas as requisições autenticadas incluem o token no header `Authorization: Bearer`.

**RF-04 — Bypass para desenvolvimento**
Com `DEV_OTP_BYPASS=true`, o código OTP é registrado no log do backend sem envio WhatsApp, permitindo testes sem WAHA ativo.

**RF-05 — Rate limiting de OTP**
Máximo de 1 requisição por minuto e 5 por hora por número de telefone.

### 6.2 Contas a Pagar (implementado)

**RF-06 — Cadastrar conta**
Campos obrigatórios: nome, valor (BRL), tipo de recorrência (`monthly`, `weekly`, `once`), configuração de vencimento conforme tipo, dias de antecedência para alerta (padrão: 3), status ativo (padrão: ativo).

**RF-07 — Tipos de recorrência**
- `monthly`: vence no dia N do mês (1–31). Meses com menos dias usam o último dia válido.
- `weekly`: vence em um dia da semana (0=Dom a 6=Sab).
- `once`: vence em uma data exata específica.

**RF-08 — Métodos de pagamento**
Cada conta suporta N métodos do tipo `pix` ou `boleto`. Exatamente um método é marcado como `is_primary`. O método principal aparece em destaque nas notificações WhatsApp.

**RF-09 — Campos PIX**
Tipo de chave (`cpf`, `email`, `phone`, `random`), valor da chave, nome do beneficiário (opcional).

**RF-10 — Campos Boleto**
Código de barras / linha digitável completo.

**RF-11 — Geração automática de ocorrências**
Ao criar ou editar uma conta, o sistema gera automaticamente até 12 ocorrências futuras (mensal e semanal) ou 1 ocorrência (avulsa).

**RF-12 — Regeneração ao editar**
Se campos de recorrência ou valor forem editados, ocorrências futuras pendentes são removidas e regeradas.

**RF-13 — Status de ocorrências**
`pending` → `paid` (por web ou WhatsApp) ou `overdue` (passada da data). `cancelled` disponível para cancelamentos explícitos.

**RF-14 — Marcar como pago via web**
O usuário pode marcar qualquer ocorrência como paga pela interface. O sistema registra `confirmation_source = 'web'` e o timestamp.

**RF-15 — Desativar / reativar conta**
Contas inativas não recebem novas ocorrências nem notificações. O histórico existente é preservado.

**RF-16 — Excluir conta**
Remove a conta e todos os dados dependentes (ocorrências, notificações, métodos de pagamento) em cascata. Requer confirmação explícita.

### 6.3 Notificações WhatsApp — Contas (implementado)

**RF-17 — Materialização de notificações**
Um job horário (cron `America/Sao_Paulo`) identifica ocorrências cujo vencimento é hoje ou em X dias (conforme `days_before_alert` da conta ou `default_days_before_alert` do usuário). Para cada uma cria um registro `scheduled` na tabela `notifications`, evitando duplicatas.

**RF-18 — Envio automático**
O mesmo job horário despacha as notificações `scheduled` do dia via WAHA para o número WhatsApp do usuário.

**RF-19 — Conteúdo da mensagem**
A mensagem inclui: nome da conta, valor formatado em BRL, data de vencimento com referência relativa (hoje / amanhã / em N dias / venceu há N dias) e dados do método de pagamento principal (chave PIX completa ou código de boleto).

**RF-20 — Confirmação via WhatsApp**
O sistema recebe webhooks do WAHA com mensagens do usuário. Palavras-chave reconhecidas: `pago`, `ok`, `feito`, `confirmado`, `✅` (case insensitive). Ao reconhecer, marca a ocorrência mais próxima pendente como paga (`confirmation_source = 'whatsapp'`).

**RF-21 — Reenvio manual**
O usuário pode reenviar individualmente qualquer notificação `scheduled` ou `failed` pela tela de Notificações.

**RF-22 — Disparo manual**
Endpoint `POST /api/notifications/dispatch` dispara todas as notificações do dia imediatamente (uso de debug/teste).

**RF-23 — Registro completo**
Cada envio registra: `status` (sent/failed/skipped), `sent_at`, `waha_message_id`, `message_body` e `error_detail`.

### 6.4 Checklists Diários (implementado)

**RF-24 — Cadastrar checklist**
Um usuário tem no máximo 1 checklist. Campos: nome (padrão: "Checklist Diário"), itens (2–12 textos únicos), horário de envio (inteiro 0–23, representando a hora em `America/Sao_Paulo`), fuso horário.

**RF-25 — Itens da enquete**
Mínimo 2, máximo 12 itens. Textos duplicados (case insensitive) são rejeitados com erro 400.

**RF-26 — Envio automático diário**
O job horário compara a hora atual em São Paulo com `send_time` de cada checklist ativo. Envia uma enquete de múltipla escolha via `POST /api/sendPoll` do WAHA.

**RF-27 — Envio manual (teste)**
`POST /api/checklists/send-now` dispara o checklist imediatamente. Com `{ force: true }` remove o registro do dia e reenvia, permitindo múltiplos testes no mesmo dia.

**RF-28 — Recepção de votos**
Webhook `POST /api/webhooks/waha-poll` recebe eventos `poll.vote` do WAHA. O sistema correlaciona pelo `waha_poll_id`, atualiza `selected_options`, `completed_count` e `completion_pct`. Usa o `timestamp` do voto para resolver concorrência (prioriza o mais recente).

**RF-29 — Tratamento de falha de voto**
Eventos `poll.vote.failed` (falha de descriptografia) disparam uma mensagem de apologia automática via WhatsApp pedindo que o usuário vote novamente.

**RF-30 — Dashboard do checklist**
Exibe: progresso do dia (contagem e percentual), itens marcados como concluídos, e histórico dos últimos 14 dias com barra de progresso por dia.

### 6.5 Dashboard (implementado)

**RF-31 — Estatísticas mensais**
Calcula para o mês corrente: total de contas ativas, ocorrências vencendo em 7 dias, total pago (contagem e valor), total pendente (valor) e total em atraso (valor).

**RF-32 — Próximos vencimentos**
Lista ocorrências pendentes dos próximos 30 dias ordenadas por data.

**RF-33 — Status da conexão WAHA**
Indica se a sessão WhatsApp está ativa (`WORKING`) ou desconectada.

### 6.6 Histórico (implementado)

**RF-34 — Listagem completa**
Exibe todas as ocorrências do usuário com filtros por: texto do nome da conta, status (`pending`, `paid`, `overdue`, `cancelled`) e intervalo de datas.

**RF-35 — Origem do pagamento**
Cada ocorrência paga mostra a origem: `whatsapp`, `web` ou `manual`.

### 6.7 Configurações (implementado)

**RF-36 — Perfil**
O usuário pode atualizar: nome, número WhatsApp e fuso horário.

**RF-37 — Preferências de notificação**
Configuráveis: ativar/desativar alertas WhatsApp, horário de envio das notificações (inteiro 0–23), dias padrão de antecedência para alertas, ativar/desativar resumo semanal.

**RF-38 — Teste de integração WAHA**
Botão que envia uma mensagem de teste para o número configurado, verificando a sessão WAHA antes do envio.

**RF-39 — Reconectar / desconectar WAHA**
Botões para reiniciar ou parar a sessão WAHA diretamente da interface.

---

## 7. Requisitos Não Funcionais

### 7.1 Performance

| Requisito | Meta |
|---|---|
| Tempo de resposta (leitura) | < 300ms (p95) |
| Tempo de resposta (escrita) | < 500ms (p95) |
| Carregamento inicial do frontend | < 2 segundos (LCP) |

### 7.2 Confiabilidade

- Migrations são executadas automaticamente no startup do backend.
- O container de produção aguarda o backend responder em `/api/health` antes de iniciar o nginx.
- Se o processo Node.js morrer dentro do container, o nginx é encerrado para forçar restart pelo orquestrador.
- Falhas de envio WAHA são registradas com detalhes do erro para diagnóstico e reenvio posterior.

### 7.3 Segurança

- Comparação de OTP usa `crypto.timingSafeEqual` para prevenir timing attacks.
- JWT assina com `JWT_SECRET` via `jsonwebtoken`; tokens têm validade de 30 dias.
- Todos os endpoints da API (exceto `/api/auth` e `/api/webhooks`) requerem JWT válido.
- Webhook de polls verificado com HMAC-SHA256 via header `X-Webhook-Hmac` (quando `WHATSAPP_HOOK_HMAC_KEY` configurado).
- Queries usam parâmetros preparados (mysql2 pool) — sem interpolação de string.

### 7.4 Usabilidade

- Feedback visual imediato em todas as ações (loading states, toasts de sucesso/erro).
- Todas as ações destrutivas requerem confirmação explícita.
- Responsivo para desktop e mobile.

### 7.5 Observações de Infraestrutura

- MySQL 8.0.13+ obrigatório (requerido para `DEFAULT (UUID())` em DDL).
- WAHA deve usar engine **NOWEB** ou **GOWS** — o WEBJS não descriptografa opções de enquetes corretamente.
- Sessão WAHA deve persistir volumes Docker (`/app/.sessions`) para preservar chaves criptográficas entre restarts.

---

## 8. Arquitetura Técnica

### 8.1 Stack implementado

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS v3 |
| Roteamento frontend | React Router v6 |
| HTTP client | axios (interceptors de auth e 401) |
| Backend | Node.js + Express + TypeScript |
| Banco de dados | MySQL 8.0.13+ (mysql2/promise connection pool) |
| Scheduler | node-cron (job horário, timezone São Paulo) |
| WhatsApp gateway | WAHA (self-hosted, chamado diretamente pelo backend) |
| Autenticação | JWT + OTP via WhatsApp |
| Deploy | Docker Compose (nginx + Node.js em único container) |

> **Nota:** O PRD v2 previa PostgreSQL/Supabase e n8n. A implementação real usa MySQL e chama o WAHA diretamente — o n8n não está integrado.

### 8.2 Topologia de produção

```
Internet → nginx :80
              ├── /          → frontend (dist estático)
              └── /api/      → Node.js backend :4000
                                  └── MySQL (externo)
                                  └── WAHA (externo/self-hosted)
```

### 8.3 Estrutura de diretórios

```
/
├── src/                  # Frontend React
│   ├── api/              # Clientes HTTP por domínio
│   ├── components/       # Layout e componentes UI
│   ├── context/          # AuthContext, ToastContext
│   ├── pages/            # Dashboard, Contas, BillForm, etc.
│   └── types/index.ts    # Tipos TypeScript canônicos
├── backend/src/
│   ├── routes/           # Handlers Express por domínio
│   ├── services/         # Lógica de negócio (waha, dispatcher, etc.)
│   ├── db.ts             # Pool MySQL
│   ├── migrate.ts        # Migrations inline
│   ├── scheduler.ts      # Cron job horário
│   └── dispatcher.ts     # Formatação e envio de mensagens de contas
└── database/migrations/  # Schema inicial SQL
```

---

## 9. API REST — Referência Completa

### 9.1 Autenticação

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/request-otp` | Não | Solicita código OTP para o número informado |
| `POST` | `/api/auth/verify-otp` | Não | Valida OTP, retorna `{ token, user }` |
| `GET` | `/api/auth/me` | JWT | Retorna dados do usuário autenticado |

### 9.2 Usuários

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/users/me` | JWT | Retorna perfil completo do usuário |
| `PATCH` | `/api/users/me` | JWT | Atualiza nome, WhatsApp, timezone, preferências de notificação |

Campos editáveis em `PATCH /users/me`: `name`, `whatsapp_number`, `timezone`, `is_active`, `notification_time` (0–23), `whatsapp_alerts_enabled`, `weekly_summary_enabled`, `default_days_before_alert` (0–30).

### 9.3 Contas

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/bills` | JWT | Lista todas as contas com métodos de pagamento |
| `GET` | `/api/bills/:id` | JWT | Retorna conta com métodos de pagamento |
| `POST` | `/api/bills` | JWT | Cria conta e gera ocorrências automaticamente |
| `PATCH` | `/api/bills/:id` | JWT | Edita conta (regenera ocorrências se recorrência/valor mudar) |
| `DELETE` | `/api/bills/:id` | JWT | Remove conta e todos os dados dependentes |

### 9.4 Métodos de Pagamento

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/bills/:billId/payment-methods` | JWT | Lista métodos de pagamento da conta |
| `POST` | `/api/bills/:billId/payment-methods` | JWT | Adiciona método de pagamento |
| `PATCH` | `/api/bills/:billId/payment-methods/:methodId` | JWT | Atualiza método de pagamento |
| `DELETE` | `/api/bills/:billId/payment-methods/:methodId` | JWT | Remove método de pagamento |

### 9.5 Ocorrências

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/occurrences` | JWT | Lista ocorrências (filtros: `status`, `bill_id`, `from`, `to`, `limit`, `offset`) |
| `GET` | `/api/occurrences/upcoming` | JWT | Próximas ocorrências pendentes (padrão: 30 dias; query `?days=N`) |
| `GET` | `/api/occurrences/stats` | JWT | Estatísticas do mês corrente para o dashboard |
| `GET` | `/api/occurrences/:id` | JWT | Retorna ocorrência específica |
| `PATCH` | `/api/occurrences/:id/pay` | JWT | Marca como paga (`paid_via`, `confirmation_source`) |
| `PATCH` | `/api/occurrences/:id` | JWT | Atualiza campos: `status`, `paid_via`, `confirmation_source`, `amount` |

### 9.6 Notificações

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/notifications` | JWT | Lista notificações (filtros: `status`, `upcoming=true`, `history=true`, `limit`) |
| `GET` | `/api/notifications/due-today` | JWT | Notificações agendadas para hoje |
| `PATCH` | `/api/notifications/:id/sent` | JWT | Marca como enviada (`waha_message_id`) |
| `PATCH` | `/api/notifications/:id/failed` | JWT | Registra falha (`error_detail`) |
| `POST` | `/api/notifications/:id/resend` | JWT | Reenvia notificação individual (reseta `failed` → `scheduled` antes) |
| `POST` | `/api/notifications/dispatch` | JWT | Dispara todas as notificações do dia (manual/debug) |

### 9.7 Checklists

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/checklists` | JWT | Retorna o checklist do usuário (ou `null`) |
| `POST` | `/api/checklists` | JWT | Cria checklist (erro 409 se já existir) |
| `PUT` | `/api/checklists/:id` | JWT | Atualiza checklist e itens |
| `DELETE` | `/api/checklists/:id` | JWT | Remove checklist |
| `GET` | `/api/checklists/dashboard` | JWT | Dashboard: checklist + poll de hoje + histórico 14 dias |
| `POST` | `/api/checklists/send-now` | JWT | Envia checklist imediatamente (`{ force: true }` para reenviar o dia) |

### 9.8 WAHA

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/waha/status` | JWT | Status da sessão WhatsApp |
| `POST` | `/api/waha/reconnect` | JWT | Reinicia a sessão WAHA |
| `POST` | `/api/waha/disconnect` | JWT | Para a sessão WAHA |
| `POST` | `/api/waha/test-message` | JWT | Envia mensagem de teste para o número do usuário |

### 9.9 Webhooks (sem auth JWT)

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/webhooks/waha-poll` | HMAC opcional | Recebe eventos `poll.vote` e `poll.vote.failed` do WAHA |

Eventos suportados: `poll.vote` (atualiza respostas), `poll.vote.failed` (envia mensagem de apologia).

### 9.10 Sistema

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Não | Health check: status + conectividade MySQL |

---

## 10. Modelo de Dados

### 10.1 Diagrama de entidades

```
users
 ├── bills (1:N)
 │    ├── payment_methods (1:N)
 │    └── bill_occurrences (1:N)
 │         └── notifications (1:N)
 ├── otp_codes (1:N)
 └── checklists (1:1)
      ├── checklist_items (1:N)
      └── checklist_daily_polls (1:N)
```

### 10.2 Tabela: `users`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | CHAR(36) | UUID primário |
| `name` | VARCHAR(255) | Nome obtido do perfil WhatsApp |
| `whatsapp_number` | VARCHAR(20) UNIQUE | Número sem formatação |
| `timezone` | VARCHAR(50) | Padrão: `America/Sao_Paulo` |
| `is_active` | BOOLEAN | Conta ativa |
| `whatsapp_alerts_enabled` | BOOLEAN | Alertas de contas habilitados |
| `weekly_summary_enabled` | BOOLEAN | Resumo semanal habilitado |
| `default_days_before_alert` | TINYINT | Dias padrão de antecedência |
| `notification_time` | TINYINT | Hora (0–23) para envio diário em SP |

### 10.3 Tabela: `bills`

| Campo | Tipo | Descrição |
|---|---|---|
| `recurrence_type` | ENUM('monthly','weekly','once') | Tipo de recorrência |
| `recurrence_day_of_month` | TINYINT | Dia 1–31 (recorrência mensal) |
| `recurrence_day_of_week` | TINYINT | Dia 0–6, 0=Dom (recorrência semanal) |
| `due_date` | DATE | Data exata (recorrência avulsa) |
| `days_before_alert` | TINYINT | Dias de antecedência para alerta |

### 10.4 Tabela: `payment_methods`

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | ENUM('pix','boleto') | |
| `pix_key_type` | ENUM('cpf','email','phone','random') | |
| `pix_key` | VARCHAR(255) | Chave PIX |
| `pix_beneficiary` | VARCHAR(255) | Nome do beneficiário |
| `boleto_code` | TEXT | Linha digitável |
| `is_primary` | BOOLEAN | Método principal da conta |

### 10.5 Tabela: `bill_occurrences`

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | ENUM('pending','paid','overdue','cancelled') | |
| `paid_at` | DATETIME | Timestamp do pagamento |
| `paid_via` | VARCHAR | Método de pagamento usado |
| `confirmation_source` | ENUM('whatsapp','web','manual') | Origem da confirmação |
| `whatsapp_msg` | TEXT | Texto da mensagem recebida |

### 10.6 Tabela: `notifications`

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | ENUM('before_due','on_due_date') | Tipo de notificação |
| `scheduled_for` | DATE | Data de envio planejada |
| `status` | ENUM('scheduled','sent','failed','skipped') | |
| `waha_message_id` | VARCHAR(255) | ID retornado pelo WAHA |
| `message_body` | TEXT | Corpo da mensagem enviada |
| `error_detail` | TEXT | Detalhe do erro (se `failed`) |

### 10.7 Tabela: `otp_codes`

| Campo | Tipo | Descrição |
|---|---|---|
| `phone_number` | VARCHAR(20) | Número solicitante |
| `code` | VARCHAR(6) | Código de 6 dígitos |
| `expires_at` | DATETIME | Expiração (5 minutos) |
| `used` | BOOLEAN | Marcado após uso válido |
| `attempts` | TINYINT | Contador de tentativas (máx: 5) |

### 10.8 Tabela: `checklists`

| Campo | Tipo | Descrição |
|---|---|---|
| `user_id` | CHAR(36) UNIQUE | 1 checklist por usuário |
| `name` | VARCHAR(100) | Nome da enquete WhatsApp |
| `send_time` | TINYINT | Hora de envio (0–23) em SP |
| `is_active` | BOOLEAN | Ativo para envio automático |

### 10.9 Tabela: `checklist_daily_polls`

| Campo | Tipo | Descrição |
|---|---|---|
| `poll_date` | DATE | Data da enquete (SP) |
| `waha_poll_id` | VARCHAR(255) | ID da mensagem WAHA para correlação de votos |
| `selected_options` | JSON | Array de strings com opções marcadas |
| `completed_count` | TINYINT | Quantidade de itens marcados |
| `total_count` | TINYINT | Total de itens da enquete |
| `completion_pct` | DECIMAL(5,2) | Percentual de conclusão |
| `last_vote_timestamp` | BIGINT | Timestamp do último voto (resolução de concorrência) |
| `status` | ENUM('pending','sent','completed') | |

---

## 11. Integrações Externas

### 11.1 WAHA (WhatsApp HTTP API)

O backend chama o WAHA **diretamente** (sem intermediário como n8n).

**Endpoints utilizados:**

| Operação | Endpoint WAHA | Chamado quando |
|---|---|---|
| Verificar sessão | `GET /api/sessions/{session}` | Dashboard, teste de envio |
| Enviar texto | `POST /api/sendText` | OTP, confirmações, teste de integração |
| Enviar enquete | `POST /api/sendPoll` | Checklist diário |
| Verificar número | `GET /api/contacts/check-exists` | Resolução de chatId antes de envios |
| Obter contato | `GET /api/contacts` | Nome do usuário no primeiro login |
| Reiniciar sessão | `POST /api/sessions/{session}/restart` | Reconexão manual |
| Parar sessão | `POST /api/sessions/{session}/stop` | Desconexão manual |

**Resolução de número brasileiro:**
O sistema tenta o número exato e a variante (com/sem o 9 após o DDD) para compatibilidade com números antigos e novos. Lança `WhatsAppNumberNotFoundError` se nenhuma variante existir no WhatsApp.

**Formato da enquete:**
```json
{
  "session": "default",
  "chatId": "5511999990000@c.us",
  "poll": {
    "name": "Checklist Diário",
    "options": ["Beber água", "Treinar", "Ler"],
    "multipleAnswers": true
  }
}
```

**Requisito de engine:** NOWEB ou GOWS obrigatório para enquetes. WEBJS não descriptografa votos corretamente.

### 11.2 Webhook WAHA → BillSync

O WAHA deve ser configurado para enviar eventos ao endpoint `POST /api/webhooks/waha-poll`:

- **`poll.vote`** — usuário votou na enquete (payload: `pollMessageId`, `chatId`, `selectedOptions`, `timestamp`).
- **`poll.vote.failed`** — falha de descriptografia (payload: `pollMessageId`, `chatId`).

Autenticação opcional via HMAC-SHA256 com header `X-Webhook-Hmac` e variável `WHATSAPP_HOOK_HMAC_KEY`.

---

## 12. Regras de Negócio

**RN-01 — Recorrência mensal com dias inválidos**
Se o dia configurado não existir no mês (ex: dia 31 em fevereiro), usa o último dia válido do mês.

**RN-02 — Geração de ocorrências**
- Mensal e semanal: 12 ocorrências futuras geradas no cadastro.
- Avulsa: exatamente 1 ocorrência na data informada.
- Ao editar recorrência/valor: ocorrências futuras pendentes são removidas e regeradas.

**RN-03 — Método de pagamento principal**
Cada conta tem exatamente um método `is_primary`. A lógica de promoção automática quando o principal é removido é responsabilidade do chamador (frontend ou API).

**RN-04 — Materialização de notificações**
Notificações são criadas sob demanda pelo job horário no dia correto (dia do vencimento e X dias antes). Não são pré-agendadas no futuro — isso evita stale data se as configurações mudarem.

**RN-05 — Não duplicar notificações**
A query de materialização verifica `NOT EXISTS` na tabela `notifications` para o mesmo `bill_occurrence_id` e `scheduled_for` antes de criar.

**RN-06 — Notificações ao pagar (cancelamento)**
Ao marcar uma ocorrência como paga, notificações pendentes (`scheduled`) vinculadas a ela devem ser canceladas (`skipped`). *[Atualmente não implementado automaticamente — oportunidade de melhoria.]*

**RN-07 — Valor da ocorrência**
O valor é herdado de `bills.amount` no momento da geração. Edições posteriores ao valor da conta regeneram ocorrências futuras pendentes.

**RN-08 — Fuso horário**
Todos os cálculos de data (materialização, scheduler de contas, scheduler de checklists, dashboard) usam `America/Sao_Paulo`. O dashboard de checklists usa `getTodaySaoPaulo()` para garantir consistência com o dispatcher.

**RN-09 — Limites da enquete**
WhatsApp suporta 2–12 opções por enquete. Itens duplicados são rejeitados (400) antes de chegar ao WAHA.

**RN-10 — Estado de voto**
O WAHA envia o array `selectedOptions` completo a cada interação (não incremental). O backend substitui os dados anteriores, priorizando o voto com `timestamp` mais recente.

**RN-11 — Reenvio de checklist**
`send-now` sem `force` só envia se não houver poll do dia. Com `force: true`, exclui o registro existente e cria um novo, permitindo testes ilimitados.

**RN-12 — Identificação do usuário no webhook**
A correlação é feita pelo `waha_poll_id` gravado na tabela `checklist_daily_polls` no momento do envio. Não depende do chatId do remetente.

---

## 13. Casos de Borda e Tratamento de Erros

### 13.1 WAHA indisponível
- Sends falham com erro registrado em `notifications.error_detail`.
- O serviço web permanece funcionando normalmente.
- Reenvio manual disponível pela tela de Notificações.

### 13.2 Número WhatsApp não encontrado
- `WhatsAppNumberNotFoundError` é lançado após tentar o número original e a variante (±9).
- OTP: retorna 400 "Número não encontrado no WhatsApp".
- Checklist send-now: retorna 502 com mensagem do erro.
- Teste de integração: retorna 400 orientando o usuário a verificar o número em Configurações.

### 13.3 Sessão WAHA não ativa
- `POST /api/waha/test-message` verifica o status antes de enviar e retorna 503 se não estiver `WORKING`.
- Fluxo de OTP não verifica previamente — falha no envio da mensagem gera erro 500.

### 13.4 `poll.vote.failed`
- O backend envia uma mensagem de texto pedindo que o usuário vote novamente.
- Causa raiz mais comum: volumes Docker não persistidos entre restarts do WAHA.

### 13.5 Conta avulsa no passado
- O sistema aceita o cadastro e gera a ocorrência. O status inicial é `pending` — a marcação como `overdue` ocorreria em uma varredura periódica (não implementada atualmente).

### 13.6 Múltiplas ocorrências pendentes (confirmação WhatsApp)
- O webhook de confirmação de pagamento (mensagem de texto `PAGO`) identifica a ocorrência mais próxima com base na data — a lógica está no handler `waha.ts` da rota de webhooks.

### 13.7 Container Docker
- O `start.sh` aguarda até 30 tentativas (30s) pelo backend responder em `/api/health`.
- Se o backend morrer após iniciar, o processo de monitoramento encerra o container inteiro para forçar restart.

---

## 14. Fluxos Críticos

### 14.1 Login (OTP via WhatsApp)

```
1. Usuário digita número de telefone
2. POST /api/auth/request-otp → código gerado e enviado via WAHA
3. Usuário digita código recebido
4. POST /api/auth/verify-otp → validação com timingSafeEqual
5. Sistema verifica/cria usuário pelo número + variante (±9)
6. Se nome nulo: busca nome do perfil via WAHA
7. JWT 30 dias emitido → armazenado em localStorage
8. Redirecionamento para Dashboard
```

### 14.2 Ciclo completo de uma conta mensal

```
Cadastro:
  Usuário cria "Aluguel" R$ 2.850 → dia 5 → PIX → 3 dias antes
  Sistema gera 12 ocorrências (próximos 12 meses no dia 5)

Às notification_time do dia 2 (3 dias antes):
  Scheduler materializa notificação → dispatcher envia via WAHA
  Mensagem inclui: nome, valor, data relativa + chave PIX

No dia 5:
  Segunda notificação enviada ("Vence HOJE")
  Usuário paga e responde "pago" no WhatsApp
  Webhook WAHA → backend marca ocorrência como paid (source: whatsapp)
```

### 14.3 Checklist diário

```
Cadastro:
  Usuário cria checklist com 5 tarefas e horário 09:00

Às 09h (São Paulo):
  Scheduler chama sendPollsForHour(9)
  Para cada checklist com send_time=9: sendDailyPoll()
  Verifica se já enviou hoje (poll_date = getTodaySaoPaulo())
  Envia enquete via WAHA sendPoll com as 5 opções
  Salva waha_poll_id no banco

Ao longo do dia:
  Usuário toca nas opções concluídas
  WAHA envia webhook poll.vote com selectedOptions e timestamp
  Backend atualiza completed_count, completion_pct

Dashboard:
  Usuário vê progresso (ex: 3/5 = 60%) e histórico 14 dias
```

### 14.4 Envio manual para teste

```
Usuário na tela Checklists → clica "Enviar Agora"
POST /api/checklists/send-now { force: false }
  Se poll já enviado hoje → retorna ok sem reenviar
  Se não enviado → envia normalmente

Para reenviar (sobrescreve):
  Ícone refresh no card de progresso → { force: true }
  DELETE poll existente do dia → re-executa sendDailyPoll
  Dashboard atualizado
```

---

## 15. Riscos e Dependências

### 15.1 Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sessão WAHA desconectando | Alta | Alto | Monitoramento no Dashboard; botão de reconexão manual |
| Volumes Docker não persistidos → `poll.vote.failed` | Alta | Médio | Configurar `/app/.sessions` como volume; mensagem de apologia automática |
| Engine WEBJS → votos não descriptografados | Alta (se configurado errado) | Alto | Usar apenas NOWEB ou GOWS |
| WhatsApp bloqueando número | Baixa (uso pessoal) | Alto | Volume baixo de mensagens reduz risco |
| Bug no cálculo de datas de recorrência | Baixa | Alto | Cobertura por testes unitários (pendente) |

### 15.2 Dependências críticas

| Dependência | Criticidade | Observação |
|---|---|---|
| WAHA | Crítica | OTP, notificações e checklists dependem desta ferramenta |
| MySQL 8.0.13+ | Crítica | `DEFAULT (UUID())` obrigatório no DDL |
| Número WhatsApp ativo | Crítica | Deve permanecer autenticado no WAHA |

### 15.3 Funcionalidades planejadas não implementadas

| Funcionalidade | Status | Observação |
|---|---|---|
| Cancelamento de notificações ao marcar pago | Pendente | `notifications.status = 'skipped'` existe, mas não é chamado automaticamente ao pagar |
| Marcação automática de ocorrências como `overdue` | Pendente | Requer job periódico de varredura |
| Resumo semanal via WhatsApp | Pendente | `weekly_summary_enabled` existe no banco mas sem dispatcher |
| Múltiplos usuários / SaaS | Futuro | Arquitetura multi-user já prevista no schema (`user_id` em todas as tabelas) |
| Importação de extratos | Futuro | Fora do escopo v1 |

---

*Documento gerado em Maio 2026 · BillSync PRD v3.0 — reflete o estado implementado do sistema*
