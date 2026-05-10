# BillSync — WAHA Scheduler & Notification Config Design

| Campo | Valor |
|---|---|
| **Data** | 2026-04-07 |
| **Status** | Aprovado |
| **Escopo** | Agendamento de notificações via cron interno + persistência de preferências + UI de configuração |

---

## 1. Contexto

O BillSync já possui integração com WAHA para envio de mensagens WhatsApp, mas o fluxo de notificações diárias dependia inteiramente do n8n como orquestrador. As preferências de notificação (toggles, dias de antecedência) existem no banco de dados mas nunca são salvas pela interface. Não existe horário de envio configurável.

**Decisão:** remover a dependência do n8n para o fluxo de notificações. O backend passa a rodar um cron job interno (node-cron) que dispara o envio diariamente no horário configurado pelo usuário, chamando o WAHA diretamente.

---

## 2. Banco de Dados

### 2.1 Migração `002_add_notification_time.sql`

```sql
ALTER TABLE users
  ADD COLUMN notification_time TINYINT UNSIGNED NOT NULL DEFAULT 8;
-- Valores válidos: 7, 8, 9, 10, 12, 18 (hora do dia em America/Sao_Paulo)
```

### 2.2 Campos já existentes (agora serão usados de fato)

| Coluna | Tipo | Uso |
|---|---|---|
| `whatsapp_alerts_enabled` | BOOLEAN | Liga/desliga todos os alertas WhatsApp |
| `weekly_summary_enabled` | BOOLEAN | Liga/desliga resumo semanal (segunda-feira) |
| `default_days_before_alert` | TINYINT | Padrão global de antecedência para novas contas |
| `notification_time` | TINYINT | Hora do dia para disparar notificações (novo) |

---

## 3. Backend

### 3.1 `PATCH /api/users/me` — campos adicionados

Adicionar à lista de campos permitidos:
- `whatsapp_alerts_enabled`
- `weekly_summary_enabled`
- `default_days_before_alert`
- `notification_time`

### 3.2 Novo endpoint `POST /api/notifications/dispatch`

Dispara o envio imediatamente (mesma lógica do cron). Útil para teste manual e debug.

**Response:**
```json
{ "sent": 2, "failed": 0, "skipped": 1 }
```

**Comportamento:** sempre executa independente de `whatsapp_alerts_enabled` (é um disparo manual explícito).

### 3.3 `backend/src/dispatcher.ts` (novo arquivo)

Função exportada: `runDispatch(): Promise<{ sent: number; failed: number; skipped: number }>`

Fluxo interno:
1. Busca notificações com `status = 'scheduled'` e `scheduled_for = DATE(NOW())`
2. Para cada notificação, busca a ocorrência vinculada e a conta com método de pagamento principal
3. Verifica se sessão WAHA está ativa (`GET /api/sessions/:session`); se não estiver, marca todas como `failed` com detalhe `"Sessão WAHA inativa"`
4. Normaliza número do usuário → `{digits}@c.us`
5. Monta mensagem (ver template abaixo)
6. Envia via `POST /api/sendText` do WAHA
7. Sucesso: `UPDATE notifications SET status='sent', sent_at=NOW(), waha_message_id=?`
8. Falha: `UPDATE notifications SET status='failed', error_detail=?`

**Template de mensagem:**
```
📅 *Lembrete de Vencimento — BillSync*

Conta: *{nome}*
Valor: R$ {valor}
Vencimento: *{referência relativa} ({data})*

💳 *Pagamento:*
{dados do método principal — PIX ou Boleto}
```

Referência relativa: `hoje`, `amanhã`, `em X dias`, `venceu há X dias`.

Dados de pagamento:
- PIX: `PIX — {tipo}: {chave}\nFavorecido: {beneficiário}`
- Boleto: `Boleto:\n{código}`
- Sem método: omite a seção de pagamento

### 3.4 `backend/src/scheduler.ts` (novo arquivo)

```typescript
// API pública do módulo
export function initScheduler(): void   // chamado no index.ts
export function reloadSchedule(): Promise<void>  // chamado ao salvar configurações
```

Comportamento:
- `initScheduler()`: lê `notification_time` e `whatsapp_alerts_enabled` do banco; se alertas habilitados, cria job cron `0 {hora} * * *` no timezone `America/Sao_Paulo`
- `reloadSchedule()`: cancela job ativo (se existir), relê configuração do banco, recria o job
- Se `whatsapp_alerts_enabled = false`: cancela o job sem recriar
- Log em console a cada ação: `[scheduler] job agendado para 08:00`, `[scheduler] job cancelado`

### 3.5 `backend/src/index.ts` — mudanças

- Importar e chamar `initScheduler()` após `app.listen()`

### 3.6 `backend/src/routes/notifications.ts` — mudança

- Adicionar endpoint `POST /dispatch` ao router de notificações

### 3.7 `backend/src/routes/users.ts` — mudança

- Após salvar com sucesso no `PATCH /users/me`, chamar `reloadSchedule()`

---

## 4. Frontend

### 4.1 `src/types/index.ts` — tipo `User` atualizado

Adicionar campos:
```typescript
whatsapp_alerts_enabled: boolean
weekly_summary_enabled: boolean
default_days_before_alert: number
notification_time: number  // 7 | 8 | 9 | 10 | 12 | 18
```

### 4.2 `src/api/notifications.ts` — novo método

```typescript
dispatch: async (): Promise<{ sent: number; failed: number; skipped: number }>
```

### 4.3 `src/pages/Configuracoes.tsx` — mudanças

**Inicialização:** `notifSettings` passa a ser inicializado com os valores reais vindos de `fetchUser()`.

**Card Notificações — layout atualizado:**
```
[toggle] Alertas WhatsApp
[toggle] Resumo Semanal
─────────────────────────
Dias de antecedência:  [−] 3 [+]
Horário de envio:      [08:00 ▼]   ← novo (apenas se whatsapp_alerts ativo)
─────────────────────────
[btn] Salvar  ← chama PATCH /users/me com todos os campos + reloadSchedule no backend
```

**Horários disponíveis no select:** 07:00, 08:00, 09:00, 10:00, 12:00, 18:00

**Card "Testar Envio" — atualizado:**
- Botão existente "Enviar Mensagem de Teste" permanece (chama `/waha/test-message`)
- Novo botão "Disparar Notificações de Hoje" (chama `POST /notifications/dispatch`)
  - Exibe resultado: `✅ 2 enviadas · 0 falhas · 1 ignoradas`
- Indicador de status WAHA: bolinha verde (WORKING) ou vermelha (offline) com botão "Reconectar"

---

## 5. Fluxo completo após a mudança

```
[Usuário salva configurações: horário = 09h]
  → PATCH /users/me { notification_time: 9, whatsapp_alerts_enabled: true, ... }
  → Backend salva no banco
  → Backend chama reloadSchedule()
  → scheduler cancela job das 08h, cria job das 09h
  → Responde 200 com usuário atualizado
  → Frontend atualiza UI, exibe toast "Configurações salvas!"

[09:00 do dia seguinte]
  → node-cron dispara runDispatch()
  → dispatcher busca notificações do dia
  → para cada uma: monta mensagem, envia via WAHA, atualiza status
  → log: "[dispatcher] 3 enviadas, 0 falhas"
```

---

## 6. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `database/migrations/002_add_notification_time.sql` | Criar |
| `backend/src/dispatcher.ts` | Criar |
| `backend/src/scheduler.ts` | Criar |
| `backend/src/routes/notifications.ts` | Modificar (adicionar POST /dispatch) |
| `backend/src/routes/users.ts` | Modificar (salvar preferências + chamar reloadSchedule) |
| `backend/src/index.ts` | Modificar (initScheduler) |
| `src/types/index.ts` | Modificar (campos User) |
| `src/api/notifications.ts` | Modificar (método dispatch) |
| `src/pages/Configuracoes.tsx` | Modificar (UI + persistência real) |

---

## 7. Fora do escopo desta iteração


- Resumo semanal automático (toggle existe, lógica de disparo fica para próxima iteração)
- Retry automático em caso de falha do WAHA
- Multi-usuário
