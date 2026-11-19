# Painel de Administrador — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel `/admin`, visível só para o dono (WhatsApp 553591404064), com uso por usuário, feed de mensagens e falhas, gravados numa tabela `activity_log` nova.

**Architecture:** O backend grava eventos em `activity_log` por um registrador que nunca lança erro (`services/activityLog.ts`), chamado no ponto único de envio do WAHA, no fluxo de auth, em um middleware de 5xx e nos `catch` do agendador e dos serviços. `routes/admin.ts`, atrás de `adminMiddleware`, expõe a visão geral, os usuários e o feed. O frontend ganha um shell `/admin` com `TabNav` e quatro abas.

**Tech Stack:** Express + mysql2 + TypeScript (jest), React 18 + React Router v6 + Tailwind (vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-painel-admin-design.md`

## Global Constraints

- Código, comentários, logs e textos de tela em pt-BR.
- Migration inline em `backend/src/migrate.ts`, nome `031_admin_activity_log`, formato `run: async () => {...}` (como `030_expense_goals`), usando `addColumnIfNotExists`.
- `status` do log: `ENUM('ok','falha','ignorado')`. Retenção: 90 dias.
- `detail` e `error` cortados em 2000 caracteres. OTP nunca gravado (texto vira `código ******`).
- A gravação do log **nunca** derruba o fluxo: `registrarAtividade` não lança erro nem rejeita a promise, e quem chama não precisa de `await`.
- Texto que o usuário manda não é gravado. Do comando fica só o nome (`/gasto`), sem argumentos.
- `user_id` precisa ser um id real ou `NULL`. `'__service__'` vira `NULL` com `meta.origem = 'n8n'`.
- Testes só de funções puras: backend `cd backend && npm test`, frontend `npm test` na raiz.

## Review Focus

1. **Banco fora do ar ou tabela ausente** (deploy antes da migration): envio, login e API seguem normais. Teste: `registrarAtividade` com pool que rejeita resolve sem lançar (Task 1).
2. **Erro de envio que não é axios** (`WhatsAppNumberNotFoundError`, `ECONNRESET` sem `response`): o evento sai com `status: 'falha'` e uma mensagem legível. Teste em `descreverErroEnvio` (Task 1).
3. **Número do admin com e sem o 9º dígito, ou com `+`/espaços:** é reconhecido como admin. Teste em `ehNumeroAdmin` (Task 4).
4. **Comando com argumentos sensíveis** (`/gasto 45 mercado`): grava só `/gasto`. Teste em `nomeDoComando` (Task 1).
5. **Usuário comum chamando `/api/admin/*`:** recebe 403. Teste: `decidirAcessoAdmin` (Task 4).

---

### Task 1: Tabela e registrador de atividade

**Files:**
- Modify: `backend/src/migrate.ts` (nova migration no fim de `MIGRATIONS`)
- Create: `backend/src/services/activityLog.ts`
- Test: `backend/src/services/__tests__/activityLog.test.ts`

**Interfaces:**
- Produces:
  - `type KindAtividade = 'login'|'login_falha'|'otp_pedido'|'logout'|'acesso'|'msg_enviada'|'comando'|'erro_api'|'erro_tick'`
  - `type StatusAtividade = 'ok'|'falha'|'ignorado'`
  - `interface EventoAtividade { userId?: string|null; kind: KindAtividade; status?: StatusAtividade; ref?: string|null; detail?: string|null; error?: string|null; meta?: Record<string, unknown>|null }`
  - `registrarAtividade(ev: EventoAtividade): Promise<void>`: nunca rejeita.
  - Funções puras: `cortarTexto(s: string|null|undefined, max = 2000): string|null`, `mascararOtp(texto: string): string` (troca sequências de 4 a 8 dígitos por `******`), `descreverErroEnvio(err: any): string` (axios com `response` → `HTTP <status>: <data.message|data.error|statusText>`; senão `err.code` + `err.message`; `WhatsAppNumberNotFoundError` → `número não encontrado no WhatsApp`), `nomeDoComando(texto: string): string|null` (primeira palavra começando com `/`, minúscula; `null` se não começa com `/`), `normalizarUserId(id: string|null|undefined): string|null` (`'__service__'` e vazio → `null`).
  - `limparAtividadeAntiga(): Promise<number>`: apaga `created_at < NOW() - INTERVAL 90 DAY` em lotes de `LIMIT 5000` até zerar e devolve o total apagado.

- [ ] **Step 1: Write the failing tests** em `activityLog.test.ts`:
  - `cortarTexto('a'.repeat(2500))` tem tamanho 2000; `cortarTexto(null)` é `null`.
  - `mascararOtp('Seu código: 123456')` é `'Seu código: ******'`.
  - `descreverErroEnvio({ response: { status: 404, data: { message: 'not found' } } })` contém `'HTTP 404'` e `'not found'`.
  - `descreverErroEnvio({ code: 'ECONNRESET', message: 'socket hang up' })` contém `'ECONNRESET'`.
  - `descreverErroEnvio(new WhatsAppNumberNotFoundError(...))` (importe de `../waha`) é `'número não encontrado no WhatsApp'`.
  - `nomeDoComando('/Gasto 45 mercado')` é `'/gasto'`; `nomeDoComando('oi')` é `null`.
  - `normalizarUserId('__service__')` é `null`; `normalizarUserId('abc')` é `'abc'`.
  - Com `jest.mock('../../db')` e um `pool.query` que rejeita, `await registrarAtividade({ kind: 'login' })` resolve como `undefined`.
- [ ] **Step 2:** `cd backend && npx jest activityLog`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implemente** `activityLog.ts`. `registrarAtividade` aplica `normalizarUserId` e `cortarTexto`, faz `JSON.stringify(meta)` e um `INSERT` com `try/catch` que só dá `console.error('[activity] ...')`.
- [ ] **Step 4: Migration `031_admin_activity_log`** (`run`): `addColumnIfNotExists('users','is_admin','BOOLEAN NOT NULL DEFAULT FALSE')`; `UPDATE users SET is_admin = TRUE WHERE whatsapp_number IN ('553591404064','5535991404064')`; `CREATE TABLE IF NOT EXISTS activity_log` exatamente como no spec, com o ENUM de três valores, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.
- [ ] **Step 5:** `cd backend && npx jest activityLog && npx tsc --noEmit`. Esperado: PASS, sem erros de tipo.
- [ ] **Step 6: Commit** `feat(admin): tabela activity_log e registrador de atividade`

### Task 2: Registrar envios de WhatsApp

**Files:**
- Modify: `backend/src/services/waha.ts` (`sendWhatsAppText`, `sendTextToChat`, `sendWhatsAppPoll`, `sendWhatsAppOtpButton`)
- Modify: todos os chamadores (`grep -rn "sendWhatsAppText\|sendTextToChat\|sendWhatsAppPoll\|sendWhatsAppOtpButton" backend/src`), `backend/src/routes/webhooks.ts` (apology), `backend/src/dispatcher.ts`, `backend/src/services/checklistDispatcher.ts`, `summaryService.ts`, `assetAlertService.ts`, `budgetAlertService.ts`, `whatsappCommandHandler.ts`, `routes/auth.ts`, `routes/notifications.ts`
- Test: `backend/src/services/__tests__/activityLog.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `registrarAtividade`, `descreverErroEnvio`, `mascararOtp`, `nomeDoComando` (Task 1).
- Produces: `interface ContextoEnvio { userId?: string|null; tipo: string }`, exportado de `waha.ts`. As quatro funções recebem `ctx?: ContextoEnvio` como **último** parâmetro, opcional. Pura em `activityLog.ts`: `eventoDeEnvio(ctx: ContextoEnvio|undefined, texto: string, resultado: { id: string|null } | { erro: any }, extra?: Record<string, unknown>): EventoAtividade` (kind `msg_enviada`, `ref = ctx?.tipo ?? 'desconhecido'`, `detail` = texto (mascarado quando `tipo === 'otp'`), `status` ok/falha, `error = descreverErroEnvio(erro)`, `meta.waha_message_id` ou `meta.chatId`).

- [ ] **Step 1: Failing tests** para `eventoDeEnvio`:
  - sem ctx, o `ref` é `'desconhecido'`;
  - `{tipo:'otp'}` com texto `'código 123456'` gera `detail` sem `123456`;
  - resultado `{erro:{response:{status:500}}}` gera `status 'falha'` e `error` com `'HTTP 500'`;
  - resultado `{id:'abc'}` gera `meta.waha_message_id === 'abc'`.
- [ ] **Step 2:** `npx jest activityLog`. Esperado: FAIL.
- [ ] **Step 3:** Implemente `eventoDeEnvio`. Em cada função de envio de `waha.ts`, envolva o `post` em `try`: no sucesso, `void registrarAtividade(eventoDeEnvio(ctx, texto, {id}))` e retorne; no `catch`, registre com `{erro}` e **relance o mesmo erro**. Para a enquete, o texto é `name + ' | ' + options.join(', ')`. Para o OTP, `ctx` vira `{ ...ctx, tipo: 'otp' }`.
- [ ] **Step 4: Passe o `ctx` em todos os chamadores.** O `tipo` pode ser `lembrete_conta`, `enquete`, `resumo_semanal`, `resumo_mensal`, `alerta_ativo`, `alerta_orcamento`, `resposta_comando`, `otp`, `apology` ou `reenvio` (n8n/resend), além de qualquer outro que o grep revelar, com nome descritivo. O apology de `routes/webhooks.ts`, que faz `wahaClient().post('/api/sendText')` direto, passa a usar `sendTextToChat(chatId, texto, { userId, tipo: 'apology' })`.
- [ ] **Step 5: Comando.** Em `whatsappCommandHandler.ts`, depois de casar o remetente com o usuário, registre `{ userId, kind:'comando', ref: nomeDoComando(texto) }`. Se o tratamento lançar erro, registre `status:'falha'` com `error`. Mensagem que não é comando não gera evento.
- [ ] **Step 6: Envio pulado e erro engolido.** Onde o envio não acontece por motivo conhecido, registre `msg_enviada` com `status:'ignorado'`, `ref` do tipo e `error` com o motivo. Casos: `claimMessage` devolve que a trava já existe (`'trava já tomada'`), notificação vira `skipped`, conta já paga (`'conta já paga'`). Nos `catch` por usuário dentro de `dispatcher.ts`, `checklistDispatcher.ts`, `summaryService.ts`, `assetAlertService.ts`, `budgetAlertService.ts` e `assetQuoteSync.ts` que hoje só fazem `console.error`, acrescente `registrarAtividade({ userId, kind:'erro_tick', status:'falha', ref:'<nome do serviço>', error: err.message })`.
- [ ] **Step 7:** `cd backend && npm test && npx tsc --noEmit`. Esperado: tudo PASS. Os testes existentes de `waha.test.ts` continuam passando.
- [ ] **Step 8: Commit** `feat(admin): registra envios, comandos e envios pulados`

### Task 3: Auth, erros de API, tick e limpeza

**Files:**
- Modify: `backend/src/routes/auth.ts`, `backend/src/services/sessions.ts`, `backend/src/index.ts`, `backend/src/scheduler.ts`
- Create: `backend/src/middleware/activityErrors.ts`
- Test: `backend/src/services/__tests__/activityLog.test.ts` (acrescentar)

**Interfaces:**
- Consumes: Task 1.
- Produces: `validarSessao` passa a devolver `{ sessionId, userId, renovada: boolean }` (`renovada` = `affectedRows > 0` do `UPDATE`). `activityErrorsMiddleware(req, res, next)`. Pura em `activityLog.ts`: `rotaNormalizada(baseUrl: string, routePath: string|undefined, path: string): string` (com `routePath` devolve `baseUrl + routePath`; sem ele, troca segmentos UUID e numéricos do `path` por `:id`).

- [ ] **Step 1: Failing tests** para `rotaNormalizada`:
  - `('/api/bills', '/:id', '/api/bills/abc')` → `'/api/bills/:id'`;
  - `('', undefined, '/api/bills/0b7c...-uuid/x')` → `'/api/bills/:id/x'`.
- [ ] **Step 2:** `npx jest activityLog`. Esperado: FAIL.
- [ ] **Step 3: Implemente `rotaNormalizada` e `activityErrorsMiddleware`.** O middleware envolve `res.json` para guardar `body?.error` em `res.locals.erroResposta` e, em `res.on('finish')`, se `res.statusCode >= 500`, registra `erro_api` com `ref = '<METHOD> <rota>'`, `userId = req.userId`, `error = res.locals.erroResposta` e `meta.duracao_ms`. Monte-o em `index.ts` logo depois de `express.json()`, antes das rotas. No tratador final de `index.ts`, guarde `err.stack` em `res.locals.erroResposta` antes de responder.
- [ ] **Step 4: Auth.**
  - Em `routes/auth.ts`: `otp_pedido` (`userId` do usuário quando já existe, `status` falha se o envio falhar), `login_falha` (OTP errado ou expirado, com `meta.telefone` só nos últimos 4 dígitos), `login` (depois de `criarSessao`, em `verify-otp` e `upgrade-session`, com `meta.user_agent`), `logout` (no logout e no encerramento de outra sessão, com `meta.sessao_encerrada`).
  - Em `middleware/auth.ts`: quando `renovada` for `true`, registre `acesso` com `meta.user_agent`.
- [ ] **Step 5: Agendador.** Cada `catch` de `runTick` em `scheduler.ts` registra `erro_tick` (`ref` = bloco: `contas`, `checklists`, `resumo_semanal`, `webhook_waha`, `vencimentos`... e `userId` quando houver). No bloco `hour === 0`, chame `limparAtividadeAntiga()` dentro de `try` e registre a contagem no console.
- [ ] **Step 6:** `cd backend && npm test && npx tsc --noEmit`. Esperado: PASS. Os testes de `sessionToken` seguem verdes.
- [ ] **Step 7: Commit** `feat(admin): registra login, acesso, erros de API e do agendador`

### Task 4: API de admin

**Files:**
- Create: `backend/src/middleware/admin.ts`, `backend/src/routes/admin.ts`, `backend/src/services/adminAccess.ts`
- Modify: `backend/src/index.ts` (montar `/api/admin`), `backend/src/routes/users.ts` (`/me` devolve `is_admin` efetivo)
- Test: `backend/src/services/__tests__/adminAccess.test.ts`

**Interfaces:**
- Consumes: tabela `activity_log` (Task 1).
- Produces:
  - `ehNumeroAdmin(numero: string, adminEnv: string|undefined): boolean`: compara só dígitos, aceita a variante com e sem o 9º dígito (55 + DDD + 8 ou 9 dígitos), `false` quando `adminEnv` está vazio.
  - `decidirAcessoAdmin(user: { is_admin: number|boolean; whatsapp_number: string } | null, adminEnv: string|undefined): boolean`.
  - `usuarioEhAdmin(userId: string): Promise<boolean>`, com cache em memória de 60s por userId.
  - `adminMiddleware`: responde 403 `{ error: 'Acesso restrito ao administrador' }`.
  - Endpoints (todos JSON, datas em ISO):
    - `GET /api/admin/overview?horas=24` → `{ falhasPorTipo: {kind, ref, total}[], ativos: { h24, d7, d30 }, enviadasHoje: number, ultimasFalhas: LinhaAtividade[] }`. Os ativos excluem admins.
    - `GET /api/admin/users` → `UsuarioAdmin[]` = `{ id, name, whatsapp_number, created_at, is_admin, ultimo_acesso, sessoes_ativas, logins_30d, comandos_30d, mensagens_30d, falhas_30d, contas_ativas, gastos_mes, ativos, checklists }`, ordenado por `ultimo_acesso DESC`.
    - `GET /api/admin/users/:id` → `UsuarioAdmin & { sessoes: {id, user_agent, created_at, last_used_at}[], whatsapp_alerts_enabled, notification_time, summary_enabled }`. 404 se não existir.
    - `GET /api/admin/activity?user_id=&kind=a,b&status=&antes_de=&limite=50` → `{ itens: LinhaAtividade[], proximo: number|null }`, com `LinhaAtividade = { id, user_id, user_name, kind, status, ref, detail, error, meta, created_at }`. `limite` limitado a 200, `id < antes_de`, ordem `id DESC`.
- [ ] **Step 1: Failing tests:**
  - `ehNumeroAdmin('553591404064','553591404064')` é true;
  - `ehNumeroAdmin('5535991404064','553591404064')` é true;
  - `ehNumeroAdmin('+55 35 9140-4064','553591404064')` é true;
  - `ehNumeroAdmin('553591404065','553591404064')` é false;
  - `ehNumeroAdmin('553591404064', undefined)` é false;
  - `decidirAcessoAdmin({is_admin:1, whatsapp_number:'x'}, undefined)` é true;
  - `decidirAcessoAdmin({is_admin:0, whatsapp_number:'553591404064'}, '553591404064')` é true;
  - `decidirAcessoAdmin({is_admin:0, whatsapp_number:'5511999999999'}, '553591404064')` é false;
  - `decidirAcessoAdmin(null, '553591404064')` é false.
- [ ] **Step 2:** `npx jest adminAccess`. Esperado: FAIL.
- [ ] **Step 3: Implemente** `adminAccess.ts`, o middleware e as rotas. `adminEnv` vem de `process.env.ADMIN_WHATSAPP`. Monte em `index.ts` com `app.use('/api/admin', adminMiddleware, adminRouter)`, depois de `authMiddleware`. Em `/api/users/me`, devolva `is_admin: decidirAcessoAdmin(row, process.env.ADMIN_WHATSAPP)`.
- [ ] **Step 4:** `cd backend && npm test && npx tsc --noEmit`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(admin): API de visão geral, usuários e atividade`

### Task 5: Telas de admin

**Files:**
- Create: `src/api/admin.ts`, `src/utils/atividade.ts`, `src/utils/__tests__/atividade.test.ts`, `src/pages/admin/AdminShell.tsx`, `AdminGeral.tsx`, `AdminUsuarios.tsx`, `AdminUsuario.tsx`, `AdminMensagens.tsx`, `AdminErros.tsx`, `src/components/admin/FeedAtividade.tsx`
- Modify: `src/types/index.ts` (`User.is_admin?: boolean`, mais os tipos `LinhaAtividade`, `UsuarioAdmin`, `VisaoGeralAdmin` espelhando a Task 4), `src/App.tsx`, `src/components/Layout/Sidebar.tsx` (e a barra inferior do celular, se usar `navItems`)

**Interfaces:**
- Consumes: os endpoints da Task 4 e `User.is_admin` de `/api/users/me`.
- Produces: `tempoRelativo(iso: string, agora?: Date): string` (`'agora'` com menos de 1 min, `'há 5 min'`, `'há 2 h'`, `'há 3 dias'`, e acima de 30 dias `dd/mm/aaaa`); `rotuloAtividade(kind: string, ref: string|null): string` (ex.: `msg_enviada` + `lembrete_conta` → `'Lembrete de conta'`, `login` → `'Entrou'`, `erro_api` → `'Erro de API'`, e o `ref` cru para tipo desconhecido); `corStatus(status): 'ok'|'erro'|'aviso'`.
- [ ] **Step 1: Failing tests** em `atividade.test.ts`:
  - `tempoRelativo` com `agora` fixo cobre os casos `'agora'`, `'há 5 min'`, `'há 2 h'`, `'há 3 dias'` e a data de 40 dias atrás;
  - `rotuloAtividade('login', null)` é `'Entrou'`;
  - `rotuloAtividade('msg_enviada','xyz')` é `'xyz'`;
  - `corStatus('ignorado')` é `'aviso'`.
- [ ] **Step 2:** `npx vitest run src/utils/__tests__/atividade.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implemente `atividade.ts` e `api/admin.ts` (`getVisaoGeral(horas)`, `getUsuariosAdmin()`, `getUsuarioAdmin(id)`, `getAtividade(filtros)`).
- [ ] **Step 4: Telas.**
  - `AdminShell` segue `ChecklistsShell`: abas Visão geral (`geral`, ícone `dashboard`), Usuários (`usuarios`, `group`), Mensagens (`mensagens`, `chat`), Erros (`erros`, `error`).
  - Rotas em `App.tsx`: `/admin` → `index` redireciona para `geral`; `usuarios/:id` → `AdminUsuario`. O shell redireciona para `/` quando `!user?.is_admin`.
  - `FeedAtividade` (props `filtros`, com "Carregar mais" via `proximo`) mostra hora, usuário, rótulo, selo de status e `detail`/`error` expansível. É reusado em Mensagens (`kind=msg_enviada,comando`, com um toggle "Só falhas" que manda `status=falha`), em Erros (`kind=erro_api,erro_tick` mais `msg_enviada` com falha) e no detalhe do usuário (`user_id`).
  - Visão geral: cartões conforme o sketch do spec. Clicar num tipo de falha leva para Mensagens ou Erros com o filtro.
  - Usuários: tabela no desktop e cartões no celular, selo "você" quando `is_admin`.
  - Use os componentes de `src/components/ui` e as classes existentes.
- [ ] **Step 5: Menu.** Item `{ path: '/admin', label: 'Admin', icon: 'admin_panel_settings' }` só quando `user?.is_admin` (filtrar `navItems` no Sidebar e na barra inferior).
- [ ] **Step 6:** `npm test && npm run build` na raiz. Esperado: PASS e build sem erros.
- [ ] **Step 7: Commit** `feat(admin): telas de visão geral, usuários, mensagens e erros`

### Task 6: Documentação

**Files:** Modify `CLAUDE.md`, `.env.example`

- [ ] **Step 1:** No `CLAUDE.md`:
  - adicione `activity_log` à lista de tabelas;
  - adicione `ADMIN_WHATSAPP` (opcional) às variáveis de ambiente;
  - escreva um parágrafo em "Key conventions" sobre o painel admin: `is_admin`, `activity_log`, `registrarAtividade` que nunca lança, o `ctx` nas funções de envio, a política mista de texto, o status `ignorado`, o middleware de 5xx e a limpeza de 90 dias às 0h.
- [ ] **Step 2:** Adicione a linha `ADMIN_WHATSAPP=` no `.env.example`, com um comentário.
- [ ] **Step 3: Commit** `docs(admin): painel de administrador no CLAUDE.md`
