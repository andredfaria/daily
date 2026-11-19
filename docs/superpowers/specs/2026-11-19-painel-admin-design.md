# Painel de administrador — design

Data: 2026-11-19

## Por quê

O dono do sistema (WhatsApp `553591404064`) quer um único lugar para:

1. **Acompanhar o uso de cada usuário**: quem entra, quando e quanto usa, e o que usa (app ou comandos no WhatsApp).
2. **Pegar falhas**: mensagem que não chegou, erro de API, erro no tick do agendador. Hoje esses erros vão só para o console do container e se perdem a cada deploy.

O cenário típico é alguém dizer que algo não chegou ou não funcionou, o admin abrir o painel e ver o que aconteceu.

## Metas

- Ser admin pelo número de WhatsApp: só ele vê o painel e as rotas `/api/admin/*`.
- Histórico de login, logout e acesso de cada usuário, que hoje se perde porque a sessão é apagada ao sair.
- Feed de mensagens enviadas e recebidas, com status, motivo da falha e texto de tudo que o **sistema** envia.
- Registro persistente de erros (API 5xx, envio, tick).
- Telas que mostrem primeiro as falhas e a atividade recente.

## Fora do escopo

- Agir como outro usuário (impersonar), editar dados de outros usuários, reenviar mensagem pelo painel.
- Gerenciar vários admins pela interface (o admin é ligado por migration ou SQL).
- Alertas por WhatsApp de falha para o admin (pode vir depois, em cima do mesmo log).
- Ferramenta externa de observabilidade (Sentry, Loki).
- Confirmação de entrega/leitura do WhatsApp (`message.ack`): "ok" significa aceito pelo WAHA. Fica para uma versão seguinte, em cima da mesma tabela (o `waha_message_id` já vai em `meta`).
- Reconstruir o histórico anterior: o log vale do deploy em diante. Os dados que já existem (`notifications`, `sessions`, contagens) aparecem como estão.

## O que não pode acontecer (mesmo funcionando)

- **O log não pode quebrar o fluxo.** Falha ao gravar o log nunca impede um envio, um login ou uma resposta de API. Toda gravação é *fire-and-forget* com `catch` que só faz `console.error`.
- **Não guardar a conversa do usuário.** O texto que o usuário manda **não** é gravado. Do recebido fica só o comando (`/gasto`, `/marcar`...), sem os argumentos. Mensagem que não é comando continua sem registro, como hoje.
- **Não guardar segredo.** O código OTP nunca vai para o log: o envio de OTP é registrado com o texto mascarado (`código ******`). Token de sessão também nunca vai.
- Usuário comum não consegue ler nada de `/api/admin/*` (403) nem ver o item de menu.

## Restrições

- MySQL 8, migration inline em `backend/src/migrate.ts` (próximo número livre depois de `030_expense_goals`).
- Código, comentários e logs em pt-BR.
- Frontend: React Router v6, shell com abas via `TabNav` (mesmo padrão de Contas, Ativos e Checklists).
- Testes só de funções puras (jest no backend, vitest no frontend).

## Abordagens consideradas

1. **Log de eventos próprio + telas de admin no app** — *escolhida.* Cobre uso e falhas no mesmo lugar, segue o stack atual e o ponto único de envio em `services/waha.ts` facilita. Custo: uma tabela que cresce (resolvido com limpeza de 90 dias) e cuidado para o log não derrubar o fluxo.
2. **Tela de admin só com dados que já existem** — descartada. É rápida, mas não tem histórico de login, texto da maioria das mensagens, motivo de falha fora dos lembretes nem erro de API, e falha é metade do pedido.
3. **Ferramenta externa para erros** — descartada. Ainda exigiria a opção 1 para uso e mensagens, e seriam dois lugares para olhar e mais um serviço no deploy.

## Desenho

### Banco (migration `031_admin_activity_log`)

```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET is_admin = TRUE WHERE whatsapp_number IN ('553591404064','5535991404064');

CREATE TABLE IF NOT EXISTS activity_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     CHAR(36)     NULL,          -- NULL: erro sem usuário, OTP para número sem conta
  kind        VARCHAR(30)  NOT NULL,      -- ver tabela abaixo
  status      ENUM('ok','falha','ignorado') NOT NULL DEFAULT 'ok',
  ref         VARCHAR(60)  NULL,          -- tipo da mensagem (lembrete_conta, enquete...), comando, rota
  detail      TEXT         NULL,          -- texto enviado pelo sistema / detalhe do evento
  error       TEXT         NULL,          -- mensagem do erro, código HTTP, err.code
  meta        JSON         NULL,          -- extras: user_agent, chatId, waha_message_id, duração
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_user_time (user_id, created_at),
  KEY idx_activity_kind_time (kind, created_at),
  KEY idx_activity_status_time (status, created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

O `UPDATE` cobre as duas grafias do 9º dígito. Se o usuário admin ainda não existir no momento da migration, nada é marcado: o fallback é a variável de ambiente `ADMIN_WHATSAPP` (opcional), checada também no middleware de admin, que casa por telefone com a variante do 9º dígito.

### Tipos de evento (`kind`)

| kind | quando | status/falha |
|---|---|---|
| `login` | `verify-otp` cria sessão (também `upgrade-session`) | ok |
| `login_falha` | OTP errado ou expirado | falha |
| `otp_pedido` | `request-otp` | falha se o envio falhar |
| `logout` | `POST /api/auth/logout` e encerramento de outra sessão | ok |
| `acesso` | `authMiddleware`, no máximo 1 por hora por sessão (junto com a renovação que já existe) | ok |
| `msg_enviada` | toda chamada de `sendWhatsAppText`, `sendTextToChat`, `sendWhatsAppPoll`, `sendWhatsAppOtpButton` | falha se lançar erro |
| `comando` | webhook reconheceu `/algo` de um usuário | falha se o handler lançar erro |
| `erro_api` | tratador de erro do Express (5xx) | falha |
| `erro_tick` | `catch` dos blocos do `scheduler.ts` | falha |

### Gravação

- `services/activityLog.ts`: `registrarAtividade(evento)` faz `pool.query(INSERT ...)` sem `await` no chamador (ou com `void ... .catch`), corta `detail` e `error` em 2.000 caracteres e nunca lança erro.
- **Envios:** as quatro funções de envio de `services/waha.ts` ganham um último parâmetro opcional `ctx?: { userId?: string; tipo: string }` (`tipo`: `lembrete_conta`, `enquete`, `resumo_semanal`, `resumo_mensal`, `alerta_ativo`, `alerta_orcamento`, `resposta_comando`, `otp`, `apology`...). Cada função registra depois do `post` (ok, com o `waha_message_id`) ou no `catch` (falha, com status HTTP e `err.code`) e relança o erro sem mudar o comportamento atual. Quem chama passa o `ctx`. Chamada sem `ctx` ainda é registrada, com `ref = 'desconhecido'`, então nada fica de fora.
- **Comando:** em `whatsappCommandHandler`, depois de casar o remetente, registra `comando` com `ref` igual ao nome do comando, sem argumentos.
- **Erros de API:** as rotas respondem `res.status(500)` direto (78 pontos em 12 arquivos) e quase nunca chamam `next(err)`, então o tratador final sozinho não pegaria nada. Em vez de refatorar as rotas, um middleware global (montado antes das rotas) envolve `res.json` para guardar o campo `error` do corpo e, no `res.on('finish')`, registra `erro_api` para todo status ≥ 500 com método, rota normalizada (`req.baseUrl + req.route?.path`), `req.userId`, o `error` capturado e a duração. O tratador final de `index.ts` continua e acrescenta a stack quando houver. *(Decisão minha.)*
- **Erros de tick e de serviço:** os `catch` do `scheduler.ts` registram `erro_tick`. Os `catch` por usuário que engolem o erro dentro de `dispatcher.ts`, `checklistDispatcher.ts`, `summaryService.ts`, `assetAlertService.ts`, `budgetAlertService.ts` e `assetQuoteSync.ts` também registram `erro_tick`, com `user_id` e `ref` igual ao serviço. Senão a falha de um usuário só não aparece. *(Decisão minha.)*
- **Envio pulado:** quando um envio não acontece por um motivo conhecido (trava em `message_claims` já tomada, `notifications.status = 'skipped'`, conta já paga), registra `msg_enviada` com `status = 'ignorado'` e o motivo em `error`. O ENUM de `status` passa a ser `('ok','falha','ignorado')`. A tela de Mensagens mostra isso com cor própria: responde ao "não chegou" quando nem foi tentado. *(Decisão minha.)*
- **Envio fora das funções de `waha.ts`:** o "apology" de `routes/webhooks.ts` (que faz `wahaClient().post` direto) passa a usar `sendTextToChat` com `ctx`, para não ficar de fora. Chamada da conta de serviço n8n (`req.userId = '__service__'`) grava `user_id = NULL` e `meta.origem = 'n8n'`, porque o id falso quebraria a chave estrangeira. *(Decisão minha.)*
- **Limpeza:** no tick das 0h, `DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL 90 DAY` em lotes (`LIMIT 5000` em loop).

### API (`routes/admin.ts`, montado em `/api/admin` depois do `authMiddleware` + `adminMiddleware`)

- `GET /overview?horas=24`: falhas no período por kind/ref, usuários ativos (com `acesso` ou `login`) em 24h/7d/30d, total de mensagens enviadas e as últimas 10 falhas.
- `GET /users`: todo usuário com nome, número, criado em, último acesso (maior entre `sessions.last_used_at` e o último `acesso`), sessões ativas, eventos dos últimos 30 dias (logins, comandos, mensagens enviadas, falhas) e contagens de dados (contas ativas, gastos no mês, ativos, checklists).
- `GET /users/:id`: os mesmos números de um usuário, as sessões ativas (aparelho, último uso) e as preferências de notificação relevantes (alertas ligados, hora, resumo).
- `GET /activity?user_id=&kind=&status=&antes_de=<id>&limite=50`: feed paginado por cursor (`id < antes_de`), mais recente primeiro. Serve para Mensagens, Erros e a linha do tempo do usuário.

`adminMiddleware`: lê `users.is_admin` de `req.userId` (cache de 60s em memória) e responde 403 se não for admin. O `GET /api/users/me` passa a devolver `is_admin` para o frontend decidir o menu.

### Telas (`/admin`, shell com `TabNav`)

Item "Admin" no `Sidebar` só quando `user.is_admin`. Rota protegida também no frontend: quem não é admin vai para `/`.

1. **Visão geral** (`/admin/geral`): cartões de falhas nas últimas 24h (por tipo, com clique levando ao feed filtrado), ativos em 24h, 7d e 30d, mensagens enviadas hoje, e a lista das últimas falhas.
2. **Usuários** (`/admin/usuarios`): tabela (cartões no celular) com nome, número, último acesso relativo ("há 2h"), comandos e mensagens em 30 dias e um selo de falha recente. Ordena por último acesso.
   - **Detalhe** (`/admin/usuarios/:id`): números, sessões ativas e a linha do tempo daquele usuário (o feed filtrado), com filtro por tipo.
3. **Mensagens** (`/admin/mensagens`): feed de `msg_enviada` e `comando` com usuário, tipo, hora, status e o texto expansível. Filtros: só falhas, usuário, tipo.
4. **Erros** (`/admin/erros`): feed de `erro_api`, `erro_tick` e envios com falha, com o erro completo expansível.

```
┌ Admin ─────────────────────────────────────────┐
│ [Visão geral] Usuários  Mensagens  Erros       │
├────────────────────────────────────────────────┤
│ Falhas 24h  3   Ativos 24h 4   Enviadas hoje 27│
│                                                │
│ Últimas falhas                                 │
│ 14:02  Maria   enquete      timeout 10s        │
│ 09:00  João    lembrete     404 número inexist.│
│ 03:10  —       erro_tick    ER_LOCK_DEADLOCK   │
└────────────────────────────────────────────────┘
```

Partes puras testáveis: no backend, a montagem do evento a partir do erro do axios (status, `code`, mascaramento do OTP, corte de tamanho); no frontend, a formatação de "há X tempo" e o rótulo e cor por `kind`/`ref`.

## Decisões do usuário

- Uso de cada pessoa e falhas, os dois.
- Privacidade "mista": guarda o texto do que o sistema envia e só o comando do que o usuário manda.
- Abordagem 1 (log próprio + telas no app).
- Implementação com subagentes.
- Confirmação de entrega (`message.ack`) fica para depois.

## Decisões minhas (pode corrigir)

- Admin por `users.is_admin`, ligado pelo número, com `ADMIN_WHATSAPP` de reserva. O e-mail não entra porque o sistema não tem e-mail.
- Retenção de 90 dias.
- `acesso` com granularidade de 1 hora por sessão, aproveitando a renovação que já existe, para não gravar uma linha por requisição.
- Sem impersonar e sem reenviar pelo painel nesta versão.
- O próprio admin aparece na lista de Usuários com o selo "você", mas fica **fora** das contagens de "ativos" da Visão geral, para os números refletirem os outros usuários.
- Erro de API pego por middleware no `finish` (sem refatorar as 78 respostas 500), envio pulado com status `ignorado`, e erros engolidos nos serviços também registrados.

## Fica para o construtor

- A forma exata dos componentes, seguindo `src/components/ui`.
- Os nomes dos `tipo` de envio em cada chamador (a lista acima é um ponto de partida).
- Ajustar índices se as consultas da visão geral ficarem lentas.
