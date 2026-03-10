# Product Backlog

## Diagnóstico técnico atual da codebase

- **Stack principal:** Next.js 14 (App Router), TypeScript, MySQL (`mysql2`), autenticação JWT com cookies HTTP-only, Tailwind CSS.
- **Arquitetura atual:** monólito web + API routes em `app/api/*`, camada SQL em `lib/db/*`, integrações com WAHA (validação/perfil), Stripe e Hotmart por webhook.
- **Banco atual:** foco em `daily_user` e `daily_data`; já possui campos de assinatura dentro de `daily_user`.
- **Pontos frágeis identificados:**
  - ausência de modelo multi-tenant real (dados concentrados por usuário);
  - rate limit em memória (não distribuído);
  - ausência de fila/scheduler para envios programados;
  - inexistência de endpoint webhook WAHA para ingestão de respostas;
  - billing acoplado por provedor e sem camada de abstração completa;
  - falta de trilha de auditoria persistente para ações críticas.

---

## Feature
Envio automático de enquete no horário definido

### Descrição
Permitir que cada cliente configure pergunta, opções e horário de disparo de enquete no WhatsApp, com execução automática sem intervenção manual.

### Problema que resolve
Elimina disparos manuais e torna a coleta de feedback previsível, escalável e compatível com operação SaaS.

### Implementação técnica
- Criar domínio de enquetes (`polls`) e agendamentos (`poll_schedules`).
- Implementar serviço `PollSchedulerService` com uma destas abordagens (ordem recomendada):
  1. **Job queue com Redis + worker** (BullMQ/alternativa);
  2. Cron interno temporário (fallback de curto prazo).
- Novo worker para buscar enquetes pendentes por janela de tempo e disparar via cliente WAHA.
- Persistir estado de envio por destinatário para idempotência (`pending`, `sent`, `failed`).

### Alterações no banco
- `polls`: `id`, `workspace_id`, `question`, `status`, `created_by`, `created_at`, `updated_at`.
- `poll_options`: `id`, `poll_id`, `label`, `position`.
- `poll_schedules`: `id`, `poll_id`, `scheduled_at`, `timezone`, `status`, `last_run_at`, `next_run_at`.
- `poll_dispatches`: `id`, `poll_id`, `recipient_phone`, `waha_message_id`, `status`, `error`, `sent_at`.
- Índices: `(workspace_id, status)`, `(scheduled_at, status)`, `(poll_id, recipient_phone)`.

### Fluxo técnico
1. Cliente cria enquete e opções.
2. Cliente define data/hora e timezone.
3. Sistema valida e salva com status `scheduled`.
4. Scheduler/worker captura registros vencidos.
5. Worker envia mensagem via WAHA, grava `poll_dispatches`.
6. Worker atualiza `poll_schedules.status` para `processed` ou `retry`.

### Critérios de aceite
- [ ] Criar enquete com no mínimo 2 opções.
- [ ] Agendar envio em timezone configurável.
- [ ] Disparo automático ocorrer até 1 minuto do horário.
- [ ] Falhas temporárias reprocessadas com retry exponencial.
- [ ] Idempotência evita duplicidade por destinatário.

### Complexidade
Alta

---

## Feature
Recebimento de respostas da enquete via webhook WAHA

### Descrição
Receber eventos de mensagens do WAHA, correlacionar com enquete enviada e registrar a resposta do usuário.

### Problema que resolve
Sem ingestão de resposta, o produto não fecha ciclo de valor da enquete e não produz métricas.

### Implementação técnica
- Criar endpoint `POST /api/webhooks/waha`.
- Validar assinatura/token do webhook (HMAC ou API key dedicada).
- Normalizar payload WAHA em um adaptador (`lib/integrations/waha/webhook-adapter.ts`).
- Correlacionar resposta via `waha_message_id` e/ou metadado de enquete.
- Persistir resposta com deduplicação por mensagem WAHA.

### Alterações no banco
- `webhook_events`: `id`, `provider`, `external_event_id`, `payload_json`, `received_at`, `processed_at`, `status`.
- Índice único: `(provider, external_event_id)` para idempotência.

### Fluxo técnico
1. WAHA envia evento para `/api/webhooks/waha`.
2. API valida autenticação e schema.
3. Evento bruto é persistido em `webhook_events`.
4. Serviço resolve enquete/opção correspondente.
5. Resposta é salva e evento marcado como processado.

### Critérios de aceite
- [ ] Endpoint responde `2xx` para payload válido.
- [ ] Requisições inválidas retornam `401/400`.
- [ ] Evento duplicado não duplica resposta.
- [ ] Logs e rastreabilidade por `external_event_id`.

### Complexidade
Média

---

## Feature
Persistência de respostas de enquete

### Descrição
Criar armazenamento estruturado para respostas dos usuários e histórico temporal.

### Problema que resolve
Permite analytics, auditoria de participação e uso de respostas em automações futuras.

### Implementação técnica
- Criar tabela `poll_responses` com referência para `polls` e opção selecionada.
- Service layer `lib/db/poll_responses.ts` para CRUD e agregações.
- Suportar resposta livre e resposta por opção (para compatibilidade futura).

### Alterações no banco
- `poll_responses`
  - `id`
  - `poll_id`
  - `workspace_id`
  - `phone`
  - `answer`
  - `poll_option_id` (nullable)
  - `waha_message_id`
  - `created_at`
- Índices: `(poll_id, created_at)`, `(workspace_id, created_at)`, único opcional `(poll_id, phone)` se regra for 1 resposta por usuário.

### Fluxo técnico
1. Endpoint de webhook recebe mensagem.
2. Parser interpreta resposta (texto/índice).
3. Serviço valida se opção existe.
4. Resposta é gravada na tabela.

### Critérios de aceite
- [ ] Registro contém telefone, enquete, resposta e timestamp.
- [ ] Consulta por enquete retorna total de respostas.
- [ ] Integridade referencial ativa para `poll_id`.

### Complexidade
Baixa

---

## Feature
Arquitetura de billing com Billing Provider Pattern

### Descrição
Criar camada de billing desacoplada para suportar múltiplos gateways (Stripe, AbacatePay, Mercado Pago, Paddle, Asaas) com troca simples e sem reescrever fluxo core.

### Problema que resolve
Evita lock-in em gateway, reduz custo de manutenção e facilita expansão geográfica/comercial.

### Implementação técnica
- Estruturar módulo:
  - `lib/billing/providers/stripeProvider.ts`
  - `lib/billing/providers/abacateProvider.ts`
  - `lib/billing/providers/mercadoPagoProvider.ts`
  - `lib/billing/billingService.ts`
  - `lib/billing/providerRegistry.ts`
- Definir interface única `BillingProvider`:
  - `createCheckout`, `cancelSubscription`, `changePlan`, `handleWebhook`, `getSubscriptionStatus`.
- Atualizar rotas de checkout/webhook para chamar `billingService`.
- Armazenar provider por workspace/plano e versionar eventos de pagamento.

### Alterações no banco
- `subscriptions`: `id`, `workspace_id`, `plan_id`, `provider`, `provider_customer_id`, `provider_subscription_id`, `status`, `started_at`, `ended_at`, `next_billing_at`.
- `billing_events`: `id`, `workspace_id`, `provider`, `event_type`, `external_id`, `payload_json`, `status`, `created_at`.
- `plans`: catálogo de planos e limites.

### Fluxo técnico
1. Usuário escolhe plano.
2. `billingService` resolve provider ativo.
3. Provider cria checkout e redireciona usuário.
4. Webhook do provider confirma pagamento.
5. Serviço atualiza assinatura e limites do workspace.

### Critérios de aceite
- [ ] Troca de provider por configuração sem alterar regras de negócio.
- [ ] Upgrade/downgrade funcional.
- [ ] Cancelamento refletido no acesso do cliente.
- [ ] Eventos de billing idempotentes.

### Complexidade
Alta

---

## Feature
Plano de escalabilidade de banco de dados e processamento

### Descrição
Evoluir a arquitetura de dados para suportar crescimento de tráfego, webhook e volume de mensagens.

### Problema que resolve
Evita gargalos de latência, indisponibilidade e contenção de conexões em picos.

### Implementação técnica
- Curto prazo:
  - Ajustar pool MySQL com parâmetros por ambiente.
  - Índices para consultas críticas de dashboard e webhooks.
  - Migração de rate limit para Redis.
- Médio prazo:
  - Fila para eventos assíncronos (webhooks, disparos, retries).
  - Cache Redis para dashboards agregados.
- Longo prazo:
  - Read replicas para leitura analítica.
  - Particionamento temporal em tabelas de eventos/respostas.

### Alterações no banco
- Índices adicionais em `daily_data`, `poll_dispatches`, `poll_responses`, `billing_events`, `webhook_events`.
- Estratégia de partição por mês para tabelas de alto volume.

### Fluxo técnico
1. Requisições de escrita entram no nó primário.
2. Eventos críticos entram na fila.
3. Workers processam assíncrono com retry.
4. Consultas analíticas usam cache e/ou réplica.

### Critérios de aceite
- [ ] Tempo de resposta p95 da API dentro de meta definida.
- [ ] Sem erro de exaustão de conexão sob carga-alvo.
- [ ] Processamento de webhooks resiliente em picos.

### Complexidade
Alta

---

## Feature
Autenticação e autorização SaaS (RBAC completo)

### Descrição
Evoluir autenticação atual para incluir recuperação de senha completa, papéis granulares e controle por tenant/workspace.

### Problema que resolve
Reduz risco de acesso indevido e habilita operação B2B com times.

### Implementação técnica
- Finalizar fluxo de recuperação de senha com provedor de e-mail.
- Criar modelo de roles/permissions por workspace.
- Adotar access token curto + refresh token (opcional) e rotação.

### Alterações no banco
- `workspaces`, `workspace_users`, `roles`, `role_permissions`, `password_reset_tokens`.

### Fluxo técnico
1. Usuário autentica.
2. Sistema carrega memberships e permissões.
3. Middleware valida acesso por rota/ação.

### Critérios de aceite
- [ ] Login/logout e reset de senha ponta a ponta.
- [ ] Usuários com papéis distintos têm acesso correto.
- [ ] Sessão revogada bloqueia novas ações imediatamente.

### Complexidade
Média

---

## Feature
Multi-tenant com isolamento por workspace

### Descrição
Separar dados e regras por cliente (tenant), permitindo múltiplos usuários por conta e isolamento lógico.

### Problema que resolve
Sem multi-tenant real, há risco de mistura de dados e limitação comercial do SaaS.

### Implementação técnica
- Introduzir `workspace_id` nas entidades de negócio.
- Aplicar filtros obrigatórios em camada de acesso a dados.
- Criar middleware de contexto do workspace.

### Alterações no banco
- `accounts`, `users`, `workspaces`, `workspace_memberships`.
- Coluna `workspace_id` em tabelas de domínio (polls, responses, subscriptions, etc.).

### Fluxo técnico
1. Usuário seleciona/resolve workspace ativo.
2. Request inclui contexto do tenant.
3. Queries aplicam filtro obrigatório por `workspace_id`.

### Critérios de aceite
- [ ] Usuário de um workspace não acessa dados de outro.
- [ ] Admin global e admin de workspace respeitam escopo.

### Complexidade
Alta

---

## Feature
Dashboard de resultados de enquetes

### Descrição
Entregar visão analítica com métricas de envio e resposta em tempo real/quase real.

### Problema que resolve
Sem dashboard, cliente não enxerga ROI das campanhas e não otimiza comunicação.

### Implementação técnica
- Criar endpoints agregados por enquete/período.
- Exibir métricas: total enviado, total respondido, taxa de resposta, distribuição por opção.
- Cache de agregados em Redis com invalidação por evento.

### Alterações no banco
- Possível tabela materializada lógica: `poll_metrics_daily` (opcional).

### Fluxo técnico
1. Frontend solicita métricas.
2. API consulta cache; se miss, agrega no banco.
3. Resposta alimenta cards e gráficos.

### Critérios de aceite
- [ ] Métricas batem com dados transacionais.
- [ ] Filtro por período e enquete funcional.

### Complexidade
Média

---

## Feature
Rate limiting e controle anti-bloqueio WhatsApp

### Descrição
Implementar limites por tenant, por número remetente e por janela temporal para prevenir bloqueios do WhatsApp.

### Problema que resolve
Reduz risco de banimento de número e interrupção de serviço.

### Implementação técnica
- Migrar limiter em memória para Redis distribuído.
- Estratégia de throttling com fila e jitter.
- Regras por tipo de mensagem e reputação do número.

### Alterações no banco
- `rate_limit_policies` e `sender_health` (opcional), com telemetria de rejeições.

### Fluxo técnico
1. Mensagem entra na fila.
2. Motor de limite avalia política.
3. Mensagem é enviada, adiada ou descartada com motivo.

### Critérios de aceite
- [ ] Limites configuráveis por workspace.
- [ ] Eventos de bloqueio/rejeição auditáveis.

### Complexidade
Média

---

## Feature
API pública para integrações externas

### Descrição
Disponibilizar API versionada para criação de enquetes, consulta de resultados e gestão de contatos.

### Problema que resolve
Habilita ecossistema de integrações (CRM, BI, automações de terceiros).

### Implementação técnica
- Namespace `/api/public/v1/*`.
- API keys por workspace com escopos.
- Documentação OpenAPI + exemplos de uso.

### Alterações no banco
- `api_keys`: `id`, `workspace_id`, `name`, `key_hash`, `scopes`, `last_used_at`, `revoked_at`.

### Fluxo técnico
1. Cliente gera API key.
2. Integração externa chama endpoint com `Authorization: Bearer`.
3. Gateway valida chave e escopo.

### Critérios de aceite
- [ ] API key revogável e rotacionável.
- [ ] Controle de escopo por endpoint.
- [ ] Rate limit específico para API pública.

### Complexidade
Média

---

## Feature
Auditoria e trilha de eventos críticos

### Descrição
Registrar ações sensíveis de segurança e negócio para compliance e troubleshooting.

### Problema que resolve
Sem auditoria, incidentes e fraudes são difíceis de investigar.

### Implementação técnica
- Middleware/serviço de auditoria para ações críticas.
- Registro estruturado com ator, alvo, ação, payload resumido e IP.

### Alterações no banco
- `audit_logs`: `id`, `workspace_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `ip`, `metadata_json`, `created_at`.

### Fluxo técnico
1. Ação crítica ocorre.
2. Serviço de auditoria persiste evento assíncrono.
3. Painel admin consulta trilha por filtros.

### Critérios de aceite
- [ ] Envio de campanha, exclusão e pagamento auditados.
- [ ] Consulta por período/usuário/ação.

### Complexidade
Baixa

---

## Feature
Hardening de segurança (webhooks, dados e abuso)

### Descrição
Fortalecer segurança de integrações e proteção de dados sensíveis.

### Problema que resolve
Mitiga fraude em webhook, vazamento de dados e abuso de endpoints.

### Implementação técnica
- Assinatura obrigatória para todos webhooks.
- Criptografia em repouso para campos sensíveis (telefone/token quando aplicável).
- Validação estrita de payload (zod/validador equivalente).
- Proteções anti-automação (rate limit + fingerprint básico).

### Alterações no banco
- Campos criptografados e rotação de chave via KMS/secret manager.

### Fluxo técnico
1. Requisição recebida.
2. Valida autenticidade e schema.
3. Persiste apenas payload necessário/minimizado.

### Critérios de aceite
- [ ] Webhooks inválidos rejeitados.
- [ ] Dados sensíveis mascarados em logs.
- [ ] Testes de regressão de segurança passando.

### Complexidade
Média
