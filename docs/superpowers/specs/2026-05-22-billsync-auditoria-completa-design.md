# BillSync — Auditoria Completa do Sistema

**Data:** 2026-05-22
**Escopo:** Segurança · Bugs/Falhas de Feature · Roadmap de Novas Funcionalidades
**Contexto:** Produto SaaS multi-usuário. Documento de referência para decisão de prioridade.

---

## 1. Falhas de Segurança

### Críticas

#### S1 — `/api/notifications/dispatch` processa todos os usuários
- **Arquivo:** `backend/src/routes/notifications.ts:184`
- **Descrição:** `POST /api/notifications/dispatch` chama `runDispatch()` sem escopo de userId. Qualquer usuário autenticado pode disparar envios de WhatsApp para toda a base.
- **Impacto:** Spam para todos os usuários + custo WAHA indevido.
- **Correção:** Substituir `runDispatch()` por `runDispatchForUser(req.userId!)` na rota ou restringir o endpoint ao service account (`__service__`).

#### S2 — Verificação HMAC do webhook é opcional quando chave não configurada
- **Arquivo:** `backend/src/routes/webhooks.ts:8-16`
- **Descrição:** Se `WHATSAPP_HOOK_HMAC_KEY` não estiver no `.env`, `verifyHmac` retorna `true` incondicionalmente. Qualquer requisição externa pode forjar votos de checklist.
- **Impacto:** Injeção de dados falsos de checklist para qualquer usuário.
- **Correção:** Rejeitar requisições quando a chave não estiver configurada em produção (`NODE_ENV=production`). Exigir header em todos os casos.

#### S3 — PATCH payment-methods sem verificação de ownership do método
- **Arquivo:** `backend/src/routes/bills.ts:230`
- **Descrição:** O `UPDATE payment_methods SET ... WHERE id = ?` não inclui `AND bill_id = ?`. Um usuário que conhece o UUID de um método pode alterá-lo mesmo que pertença a outro usuário.
- **Impacto:** Modificação de dados financeiros (PIX, boleto) de outros usuários.
- **Correção:** Adicionar `AND bill_id = req.params.billId` na query de UPDATE, e confirmar que a associação pertence ao userId autenticado.

---

### Altas

#### S4 — OTP gerado com `Math.random()` (não criptográfico)
- **Arquivo:** `backend/src/routes/auth.ts:42`
- **Descrição:** `Math.random()` não é fonte de entropia segura para códigos de autenticação.
- **Impacto:** Predição/brute-force estatístico do OTP em cenários sofisticados.
- **Correção:** Usar `crypto.randomInt(100000, 1000000)` da stdlib do Node.

#### S5 — JWT armazenado em `localStorage` (exposição a XSS)
- **Arquivo:** `src/api/client.ts:13`
- **Descrição:** Token de 30 dias em `localStorage` fica acessível a qualquer script JS executado na página.
- **Impacto:** Roubo de sessão via XSS.
- **Correção (curto prazo):** Adicionar Content-Security-Policy rigorosa. **Correção (ideal):** Migrar para `httpOnly` cookie com `SameSite=Strict`.

#### S6 — Service account `__service__` sem escopo de operação
- **Arquivo:** `backend/src/middleware/auth.ts:14-18`
- **Descrição:** Qualquer requisição com `x-api-key: <N8N_API_KEY>` recebe `userId = '__service__'` e bypassa verificação de ownership em rotas de notificações.
- **Impacto:** Vazamento ou manipulação de notificações de qualquer usuário se a chave for comprometida.
- **Correção:** Limitar rotas acessíveis pelo service account; adicionar auditoria de acessos com esse token.

---

### Médias

#### S7 — `/api/health` sem autenticação expõe metadados da stack
- **Arquivo:** `backend/src/index.ts:32-40`
- **Descrição:** Endpoint público retorna `version`, status do DB e timestamp. Facilita fingerprinting.
- **Correção:** Remover `version` da resposta pública ou adicionar autenticação básica.

#### S8 — CORS não configurado explicitamente no Express
- **Arquivo:** `backend/src/index.ts`
- **Descrição:** Sem middleware `cors`, a API em porta 4000 (dev) aceita requisições de qualquer origem.
- **Correção:** Adicionar `cors({ origin: process.env.ALLOWED_ORIGIN })` com whitelist explícita.

#### S9 — Sem rate limiting no endpoint de webhook
- **Arquivo:** `backend/src/routes/webhooks.ts:21`
- **Descrição:** `POST /api/webhooks/waha-poll` não tem limitação de taxa. Pode ser inundado.
- **Correção:** Adicionar `express-rate-limit` com janela de 1 minuto e limite razoável (ex: 100 req/min por IP).

#### S10 — `pix_key` armazenado em plaintext
- **Arquivo:** `backend/src/routes/bills.ts` (tabela `payment_methods`)
- **Descrição:** Chaves PIX (CPF, e-mail, telefone) são dados financeiros sensíveis sem nenhuma proteção de armazenamento.
- **Impacto:** Vazamento de dados sensíveis em caso de comprometimento do banco.
- **Correção:** Criptografar `pix_key` em repouso com AES-256 (chave gerenciada por variável de ambiente). Decifrar apenas na hora do envio da mensagem.

---

## 2. Bugs e Falhas de Features

#### B1 — `waha_connected` sempre retorna `false`
- **Arquivo:** `backend/src/routes/occurrences.ts:46`
- **Descrição:** O campo `waha_connected` está hardcoded como `false` no stats do dashboard. O frontend nunca sabe se o WhatsApp está conectado.
- **Correção:** Verificar status da sessão WAHA em tempo real na rota `/stats` (com cache curto de 30s para não sobrecarregar).

#### B2 — `buildRelativeDate` usa timezone do servidor, não São Paulo
- **Arquivo:** `backend/src/dispatcher.ts:19-29`
- **Descrição:** `new Date()` na função usa o timezone do servidor (UTC em produção). "Vencimento: hoje" pode ser exibido incorretamente.
- **Correção:** Calcular a data "hoje" em São Paulo usando `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` (mesmo padrão do restante do sistema).

#### B3 — `limit` e `offset` sem validação em `/api/occurrences`
- **Arquivo:** `backend/src/routes/occurrences.ts:84`
- **Descrição:** Parâmetros `limit` e `offset` vindos da query string são convertidos diretamente para `Number()` sem teto nem sanitização.
- **Correção:** Aplicar `Math.min(Number(limit), 500)` e `Math.max(Number(offset), 0)` com fallbacks seguros.

#### B4 — `POST /api/bills` não valida campos obrigatórios
- **Arquivo:** `backend/src/routes/bills.ts:55`
- **Descrição:** `name`, `amount` e `recurrence_type` podem chegar `undefined`. O INSERT passa NULL para o banco sem retornar erro claro ao cliente.
- **Correção:** Validar presença e tipos no início do handler; retornar 400 com mensagem descritiva.

#### B5 — `timezone` em PATCH /users/me aceita qualquer string
- **Arquivo:** `backend/src/routes/users.ts:22`
- **Descrição:** Timezone inválido (ex: `"Mars/Olympus"`) é salvo no banco e pode causar exceções no scheduler ao tentar formatar datas.
- **Correção:** Validar contra lista de timezones válidos do `Intl.supportedValuesOf('timeZone')` antes de salvar.

#### B6 — Geração de ocorrências é fire-and-forget sem feedback
- **Arquivo:** `backend/src/routes/bills.ts:83-89`
- **Descrição:** `generateOccurrencesForBill` é chamado com `.catch()` e a resposta 201 é retornada imediatamente. Se falhar, a conta existe mas nunca gera ocorrências — sem alerta ao usuário.
- **Correção:** Aguardar a geração antes de retornar (ou implementar retry com log de falha persistido e alerta na UI).

#### B7 — `updated_at` do checklist não é atualizado ao substituir itens
- **Arquivo:** `backend/src/routes/checklists.ts:119-123`
- **Descrição:** No `PUT /:id`, quando apenas `items` muda, o cabeçalho do checklist (incluindo `updated_at`) não é tocado.
- **Correção:** Adicionar `updated_at = NOW()` sempre que houver mudança em itens.

#### B8 — Condição de corrida na entrega de notificações
- **Arquivo:** `backend/src/dispatcher.ts:202-218`
- **Descrição:** Scheduler + dispatch manual simultâneos podem processar a mesma notificação duas vezes. A verificação de status `'scheduled'` não é atômica.
- **Correção:** Usar `UPDATE notifications SET status = 'processing' WHERE id = ? AND status = 'scheduled'` e verificar `affectedRows` antes de enviar — garantindo que só um worker processa cada notificação.

---

## 3. Roadmap de Novas Funcionalidades

### Alto impacto para SaaS

#### F1 — Confirmação de pagamento via resposta no WhatsApp
- **Descrição:** Usuário responde "pago", "ok" ou similar a um lembrete de conta e o sistema marca a ocorrência como `paid` automaticamente via webhook de mensagem recebida.
- **Dependências:** Webhook de mensagem no WAHA (`message.received`), parser de intenção simples.

#### F2 — Mais tipos de recorrência
- **Descrição:** Suporte a quinzenal, bimestral, trimestral, semestral e anual. Atualmente apenas mensal, semanal e pontual.
- **Impacto:** Cobre a maioria dos planos de assinaturas anuais e faturas trimestrais.

#### F3 — Categorias/tags em contas
- **Descrição:** Campo `category` (enum ou free text) em `bills`. Filtros por categoria no frontend, agrupamento nos relatórios.
- **Impacto:** Permite ao usuário entender onde gasta mais.

#### F4 — Resumo semanal/mensal por WhatsApp
- **Descrição:** Envio automático (configurável) de um sumário: valor pago, pendente e próximas vencendo no período.
- **Dependências:** Nova coluna em `users` (ex: `summary_day_of_week`), nova tarefa no scheduler.

#### F5 — Alerta de orçamento
- **Descrição:** Notificar via WhatsApp quando o total de contas pendentes no mês ultrapassar um limite configurado pelo usuário.
- **Dependências:** Campo `monthly_budget_limit` em `users`.

#### F6 — Status real do WAHA no frontend
- **Descrição:** Indicador visual (verde/amarelo/vermelho) no dashboard mostrando se o WhatsApp está conectado. Aproveita a correção do B1.
- **Dependências:** B1 resolvido.

### Médio impacto

#### F7 — Múltiplos checklists por usuário
- **Descrição:** Remover a limitação MVP de 1 checklist por usuário. Permitir checklists temáticos (trabalho, saúde, rotina).
- **Impacto:** Remove unique key em `checklists.user_id`; ajusta rotas para listar/criar múltiplos.

#### F8 — Exportação CSV/PDF
- **Descrição:** Exportar histórico de ocorrências (pagas/pendentes) e notificações em formato planilha ou relatório.
- **Casos de uso:** Imposto de renda, controle pessoal, importação em outros sistemas.

#### F9 — Mais opções de recorrência para checklists
- **Descrição:** Além de diário, suportar: dias úteis, dias específicos da semana, personalizado.
- **Dependências:** Novo campo `recurrence_type` em `checklists`.

#### F10 — Onboarding guiado (primeiro acesso)
- **Descrição:** Fluxo de primeira vez detectado pelo frontend: cadastrar 1ª conta → configurar checklist → testar envio via WhatsApp. Reduz abandono de novos usuários SaaS.
- **Dependências:** Flag `onboarding_completed` em `users` ou detecção por ausência de dados.

---

## Resumo Executivo

| Categoria | Total | Crítico | Alto | Médio |
|-----------|-------|---------|------|-------|
| Segurança | 10 | 3 | 3 | 4 |
| Bugs | 8 | — | 3 | 5 |
| Features | 10 | — | 6 | 4 |

**Recomendação de sequência:**
1. Corrigir S1, S2, S3 imediatamente (exploração possível hoje)
2. Corrigir S4, B6, B8 antes do próximo release
3. Implementar F1, F6 como próximo ciclo de produto
4. Planejar F2, F3 para milestone seguinte
