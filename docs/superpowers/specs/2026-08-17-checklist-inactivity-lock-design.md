# Trava de inatividade do checklist

## Contexto

Hoje o BillSync envia a enquete diária do checklist via WhatsApp indefinidamente, mesmo que o usuário nunca vote. `users.is_active` já existe e já controla, simultaneamente, o envio de lembretes de contas (`dispatcher.ts`/`scheduler.ts`) e de enquetes de checklist (`checklistDispatcher.ts`) — mas nada nunca o desliga automaticamente hoje. `checklists.is_active` também existe (por checklist), mas nunca é escrito por nenhum endpoint — é sempre `true`. O único sinal de "resposta" disponível é o voto na enquete do WhatsApp (`selected_options`/`completed_count` em `checklist_daily_polls`, escrito só pelo webhook `poll.vote`); a confirmação de pagamento por resposta de texto foi removida (commit `4c200b9`).

Objetivo: parar de mandar mensagens (checklist e, em cascata, contas) pra quem parou de prestar atenção no WhatsApp, sem deixar o usuário travado sem saída.

## Objetivo

1. Se um checklist específico passar **15 dias consecutivos de envio com zero votos**, ele para de ser enviado (`checklists.is_active = 0`).
2. Se, após isso, **todos** os checklists ativos do usuário estiverem travados (ou o usuário não tiver nenhum checklist ativo restante), o usuário inteiro é desativado (`users.is_active = 0`) — o que já corta lembretes de contas e checklist, pela lógica existente.
3. Nessa transição (usuário desativado), envia uma única mensagem de WhatsApp avisando o motivo e como reativar.
4. O usuário consegue reativar tanto um checklist específico quanto a si mesmo pelo site, sem precisar de intervenção manual no banco.

## Definições

- **Dia contabilizado**: uma linha de `checklist_daily_polls` com `poll_date < hoje` (o poll de hoje, se existir, nunca conta — ainda pode ser votado até o fim do dia). Como só existe linha pra dias em que o checklist foi de fato enviado, dias sem envio (recorrência semanal/customizada) ficam automaticamente fora da contagem — não quebram nem avançam a sequência.
- **"Não respondeu"**: `completed_count === 0` no dia contabilizado (zero itens marcados). Qualquer marcação, mesmo parcial, conta como resposta e reseta a sequência.
- **Sequência (`consecutive_misses`)**: contador incremental por checklist, avaliado uma vez por dia (no momento do envio diário), não uma varredura recalculada do histórico inteiro — evita reabrir sequências antigas depois de uma reativação.
- **"Todos os checklists travados"**: nenhum checklist do usuário com `is_active = 1` e `consecutive_misses < 15` sobrando. Um usuário sem nenhum checklist cadastrado nunca é afetado por esta regra (nada para medir).

## Mudanças no Backend

### Migration em `backend/src/migrate.ts`

As migrations reais do projeto vivem no array `MIGRATIONS` desse arquivo (a última hoje é `011_users_monthly_summary`; o diretório `backend/src/pending-migrations/*.sql` é apenas rascunho não lido por `runMigrations()`). Nova entrada `012_checklists_consecutive_misses`, seguindo o padrão `run` + `addColumnIfNotExists` já usado por `007_users_summary_budget`/`008_checklists_multi`:

```ts
{
  name: '012_checklists_consecutive_misses',
  run: async () => {
    await addColumnIfNotExists('checklists', 'consecutive_misses', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0', 'is_active')
  },
},
```

### `backend/src/services/checklistDispatcher.ts`

Nova função, chamada no início de `sendDailyPoll` (antes do dedupe de "já enviado hoje", depois de confirmar que o checklist e o usuário estão ativos):

```ts
// Retorna true se o checklist foi travado agora (envio de hoje deve ser pulado)
async function applyInactivityCheck(checklistId: string, userId: string, today: string): Promise<boolean>
```

Lógica:
1. `SELECT completed_count FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date < ? ORDER BY poll_date DESC LIMIT 1` — se não houver linha, retorna `false` (sem histórico, nada a fazer).
2. Se `completed_count > 0` → `UPDATE checklists SET consecutive_misses = 0 WHERE id = ?`, retorna `false`.
3. Se `completed_count === 0` → `UPDATE checklists SET consecutive_misses = consecutive_misses + 1 WHERE id = ?`.
4. Relê `consecutive_misses`. Se `< 15`, retorna `false`.
5. Se `>= 15`:
   - `UPDATE checklists SET is_active = 0 WHERE id = ?`.
   - Verifica se sobra algum outro checklist do usuário com `is_active = 1 AND consecutive_misses < 15`. Se não sobrar nenhum:
     - `UPDATE users SET is_active = 0 WHERE id = ?`.
     - Envia mensagem de aviso via `sendWhatsAppText` (novo texto fixo, sem template dinâmico complexo).
   - Retorna `true`.

`sendDailyPoll` passa a checar esse retorno logo no início e, se `true`, encerra sem enviar a enquete de hoje (mesmo padrão de early-return já usado nos outros guards da função).

### `backend/src/routes/checklists.ts`

- `PUT /:id` passa a aceitar também `is_active` no corpo da requisição. Quando o valor recebido for `true` (reativação), zera `consecutive_misses = 0` na mesma query — evita ser travado de novo no dia seguinte por causa do contador antigo.
- `DELETE /:id/history` (limpar histórico) passa a também resetar `consecutive_misses = 0` — coerente com dar um recomeço limpo.

### `backend/src/routes/users.ts`

Nenhuma mudança de schema/endpoint — `is_active` já é aceito em `PATCH /me`. Só o comportamento em cascata muda: quando o usuário reativa a si mesmo (`is_active: true` e valor anterior era `false`), a rota também roda `UPDATE checklists SET consecutive_misses = 0 WHERE user_id = ?` — dá 15 dias novos de chance a todos os checklists, em vez de reativar o usuário só pra ele ser travado de novo no primeiro checklist que checar.

### Mensagem de aviso

Texto fixo, enviado uma vez via `sendWhatsAppText` (reusa client já existente em `services/waha.ts`), só na transição em que `users.is_active` passa de `1` para `0` por esta regra:

> "Notamos que você não responde ao checklist há 15 dias, então pausamos os lembretes por WhatsApp (checklist e contas). Quando quiser voltar, reative em Configurações no BillSync."

Falha ao enviar essa mensagem (ex.: número inválido) não deve impedir a desativação — mesma filosofia de `handlePollVoteFailed`, que já loga erro e segue sem travar o fluxo principal.

## Mudanças no Frontend

### `src/pages/Configuracoes.tsx`

Quando `user.is_active === false`, mostra um banner (mesmo padrão visual de alerta já usado na tela, cores `error`/`bg-error-container` do design system) explicando a pausa, com botão "Reativar" chamando `client.patch('/users/me', { is_active: true })` — mesmo padrão já usado nesta página para os outros toggles (ex.: linhas 148, 168, 188).

### `src/pages/Checklists.tsx`

No card de cada checklist, quando `is_active === false`, mostra um badge "Pausado por inatividade" + botão "Reativar" chamando `checklistsApi.update(id, { is_active: true })` (client já existente em `src/api/checklists.ts`).

### `src/api/checklists.ts`

`Checklist.is_active` já existe no tipo (`src/types/index.ts:123`) e já é retornado por `GET /api/checklists` — nenhuma mudança nesse tipo. `consecutive_misses` é puramente interno ao backend e não precisa ser exposto ao frontend. Único ajuste: `UpdateChecklistPayload` ganha `is_active?: boolean` (hoje só tem `name`, `send_time`, `timezone`, `recurrence_type`, `recurrence_days`, `items`) — `checklistsApi.update` já faz `PUT /checklists/:id`, sem precisar de método novo.

## Testes

Sem suite automatizada no projeto (`CLAUDE.md`). Validação manual: inserir linhas simuladas em `checklist_daily_polls` com `completed_count = 0` cobrindo 15 dias passados para um checklist de teste, rodar `sendDailyPoll` manualmente (ou aguardar o tick do scheduler) e conferir:
- `checklists.is_active` e `consecutive_misses` no banco.
- `users.is_active` só muda quando todos os checklists estão travados.
- Mensagem de aviso chega no WhatsApp (ou aparece no log, em dev sem WAHA).
- Reativação pelo site (usuário e checklist) zera os contadores certos.

## Fora de escopo

- Qualquer UI de administração/relatório listando usuários travados — só o próprio usuário vê o próprio estado.
- Reativação automática por qualquer sinal que não seja ação explícita do usuário no site (ex.: não reativa sozinho se o usuário mandar mensagem solta no WhatsApp).
- Alterar o comportamento de `whatsapp_alerts_enabled` (toggle manual já existente) — esta trava é independente e não interage com aquele campo.
- Aplicar a trava a lembretes de contas de forma isolada (sem depender do checklist) — o gatilho é sempre a inatividade no checklist; quem não tem checklist cadastrado nunca é afetado por esta regra.
