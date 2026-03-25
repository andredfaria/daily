# BillSync — WAHA Integration Design Spec

| Campo | Valor |
|---|---|
| **Data** | 2026-03-25 |
| **Status** | Aprovado |
| **Escopo** | Integração WAHA (backend → WAHA direto, sem n8n) |
| **WAHA** | Easypanel interno, com API key |

---

## Visão Geral

A integração WAHA cobre três fluxos independentes:

1. **Envio de notificações** — cron job diário às 8h envia alertas de vencimento via WhatsApp
2. **Confirmação por WhatsApp** — webhook recebe resposta do usuário e marca ocorrência como paga
3. **Status check** — proxy do status da sessão WAHA para o frontend

**Arquitetura escolhida:** Backend Node.js chama o WAHA diretamente (sem n8n). Retry em memória com backoff exponencial, sem Redis.

---

## Estrutura de Arquivos

```
backend/src/
  waha/
    client.ts          ← WahaClient: HTTP wrapper (sendText, getSessionStatus)
    scheduler.ts       ← NotificationScheduler: cron 8h + retry queue
    webhook.handler.ts ← parse keyword → identifica ocorrência → marca paga
    templates.ts       ← templates de mensagem (before_due, on_due_date)
  routes/
    waha.routes.ts     ← GET /api/waha/status
    webhook.routes.ts  ← POST /api/webhooks/whatsapp
  config/
    waha.config.ts     ← lê e valida env vars do WAHA
```

---

## Variáveis de Ambiente

```env
WAHA_URL=http://eficienciia_waha:3000      # container interno Easypanel
WAHA_API_KEY=sua_chave_aqui                # header X-Api-Key
WAHA_SESSION=default                       # nome da sessão WAHA
WAHA_WEBHOOK_SECRET=token_secreto          # valida webhooks recebidos
```

---

## Módulo 1: `WahaClient` (`src/waha/client.ts`)

Wrapper HTTP sobre a WAHA API. Único ponto de contato com o servidor WAHA.

### Métodos

```typescript
class WahaClient {
  // Envia mensagem de texto
  // POST /api/sendText { session, chatId, text }
  // Headers: X-Api-Key, Content-Type: application/json
  // Retorna { id: string } — ID da mensagem WAHA
  sendText(chatId: string, text: string): Promise<{ id: string }>

  // Verifica status da sessão
  // GET /api/sessions/{session}
  // Retorna status: WORKING | FAILED | STOPPED | STARTING | SCAN_QR_CODE
  getSessionStatus(): Promise<{ status: string; name: string }>
}
```

### Formato do `chatId`

O `whatsapp_number` do usuário é convertido para o formato WAHA:
- `+5511999999999` → `5511999999999@c.us`
- Remoção do `+`, append de `@c.us`

### Tratamento de erros

- Timeout de 10s por requisição
- Lança `WahaError` com `{ statusCode, message, originalError }` em caso de falha HTTP
- Não trata retry — responsabilidade do `NotificationScheduler`

---

## Módulo 2: `NotificationScheduler` (`src/waha/scheduler.ts`)

Responsável pelo envio diário e pelo retry de falhas.

### Cron Job — 8h (America/Sao_Paulo)

```sql
-- Query de notificações do dia
SELECT
  n.id, n.bill_occurrence_id, n.type,
  b.name AS bill_name,
  o.amount, o.due_date,
  pm.type AS pm_type, pm.pix_key_type, pm.pix_key, pm.pix_beneficiary, pm.boleto_code,
  u.whatsapp_number
FROM notifications n
JOIN bill_occurrences o ON n.bill_occurrence_id = o.id
JOIN bills b ON o.bill_id = b.id
JOIN payment_methods pm ON b.id = pm.bill_id AND pm.is_primary = TRUE
JOIN users u ON b.user_id = u.id
WHERE n.scheduled_for = CURDATE()
  AND n.status = 'scheduled'
  AND u.whatsapp_alerts_enabled = TRUE
```

### Algoritmo de envio

```
Para cada notificação:
  1. Monta mensagem via templates.ts (tipo before_due ou on_due_date)
  2. chatId = phone_to_chat_id(user.whatsapp_number)
  3. WahaClient.sendText(chatId, text)
  4a. Sucesso: UPDATE notifications SET status='sent', sent_at=now(), waha_message_id=?
  4b. Falha: enfileira { notification, tentativa: 1 }
```

### Retry Queue (em memória)

```
Tentativa 1 → aguarda 2 minutos  → reenvio
Tentativa 2 → aguarda 8 minutos  → reenvio
Tentativa 3 → aguarda 32 minutos → reenvio
Esgotou     → UPDATE notifications SET status='failed', error_detail=?
```

- Implementado com `setTimeout` — sem dependência de Redis ou bullmq
- Estado perdido se o processo reiniciar (aceitável para v1)
- Notificações `failed` ficam registradas no banco para diagnóstico

### Garantias de RN

- **RN-05** (não reenviar): query filtra `status = 'scheduled'` — `sent` nunca reprocessados
- **RN-04** (cancelar ao pagar): `webhook.handler.ts` atualiza para `skipped` — próxima execução do cron ignora

---

## Módulo 3: `NotificationTemplates` (`src/waha/templates.ts`)

```typescript
function buildMessage(type: 'before_due' | 'on_due_date', data: NotificationData): string

interface NotificationData {
  billName: string
  amount: number          // R$ formatado pelo template
  dueDate: Date
  paymentMethod: {
    type: 'pix' | 'boleto'
    pixKeyType?: string
    pixKey?: string
    pixBeneficiary?: string
    boletoCode?: string
  }
}
```

**Template `before_due`:**
```
⏰ Lembrete de Conta — BillSync

📌 Conta: {billName}
💰 Valor: R$ {amount}
📅 Vencimento: {dueDate} (em {daysLeft} dias)

🏦 Formas de pagamento:
PIX → {pixKeyType}: {pixKey} ({pixBeneficiary})

Responda PAGO quando efetuar o pagamento ✅
```

**Template `on_due_date`:**
```
🚨 Vence HOJE — BillSync

📌 Conta: {billName}
💰 Valor: R$ {amount}
📅 Vencimento: HOJE, {dueDate}

🏦 PIX → {pixKeyType}: {pixKey} ({pixBeneficiary})

Responda PAGO para confirmar ✅
```

---

## Módulo 4: `WebhookHandler` (`src/waha/webhook.handler.ts`)

Processa mensagens recebidas do WAHA e confirma pagamentos.

### Endpoint

```
POST /api/webhooks/whatsapp?secret={WAHA_WEBHOOK_SECRET}
```

### Payload WAHA (entrada)

```json
{
  "event": "message",
  "session": "default",
  "from": "5511999999999@c.us",
  "fromMe": false,
  "body": "pago",
  "timestamp": 1711234567
}
```

### Fluxo completo

```
1. Validar req.query.secret === WAHA_WEBHOOK_SECRET
   → 401 se inválido

2. Ignorar se:
   - event !== 'message'
   - fromMe === true
   → 200 silencioso

3. Extrair número: "5511999999999@c.us" → "+5511999999999"

4. Verificar keyword (case-insensitive, trim):
   ["pago", "ok", "feito", "confirmado", "✅"]
   → 200 silencioso se não bater

5. Buscar usuário pelo whatsapp_number
   → 200 silencioso se não encontrado

6. Buscar ocorrência a confirmar (RN-06):
   SELECT * FROM bill_occurrences
   JOIN bills ON bill_occurrences.bill_id = bills.id
   WHERE bills.user_id = ?
     AND bill_occurrences.status = 'pending'
   ORDER BY
     CASE WHEN due_date < CURDATE() THEN 0 ELSE 1 END ASC,
     ABS(DATEDIFF(due_date, CURDATE())) ASC
   LIMIT 1
   → 200 silencioso se nenhuma encontrada

7. Transação:
   a. UPDATE bill_occurrences
      SET status='paid', paid_at=NOW(),
          confirmation_source='whatsapp', whatsapp_msg=?
      WHERE id=?
   b. UPDATE notifications
      SET status='skipped'
      WHERE bill_occurrence_id=? AND status='scheduled'
   c. Se conta for recurrence_type='once':
      UPDATE bills SET is_active=FALSE WHERE id=? (RN-02)

8. WahaClient.sendText(from, "✅ Pagamento de {billName} registrado!")

9. Retornar 200 { success: true }
```

---

## Módulo 5: Status Proxy (`src/routes/waha.routes.ts`)

```
GET /api/waha/status

→ WahaClient.getSessionStatus()
→ Sucesso: { connected: true, status: 'WORKING', session: 'default' }
→ Falha/WAHA offline: { connected: false, status: 'UNREACHABLE', session: 'default' }
→ Sempre retorna HTTP 200 (nunca propaga erro para o frontend)
```

Usado pelo frontend com polling a cada 30s para o card de status WAHA no Dashboard (RF-25).

---

## Casos de Borda

| Caso | Comportamento |
|---|---|
| WAHA offline durante cron | Retry 3x com backoff → `failed` com `error_detail` |
| Resposta WhatsApp sem ocorrência pendente | 200 silencioso |
| Múltiplas ocorrências pendentes | Mais atrasada primeiro; empate → mais próxima do vencimento |
| Conta `once` paga via WhatsApp | `bill_occurrences.status='paid'` + `bills.is_active=FALSE` (RN-02) |
| Webhook com secret inválido/ausente na query | 401 + log de segurança |
| Usuário responde "pago" duas vezes | Segunda busca retorna vazio → 200 silencioso |
| `whatsapp_alerts_enabled=false` | Excluído da query do cron — não recebe notificações |
| Status WAHA indisponível | Proxy retorna `{ connected: false }` — frontend exibe indicador de erro |

---

## Configuração do Webhook no WAHA

O WAHA precisa ser configurado para enviar eventos ao backend. Via API (no startup do backend) ou pelo painel do Easypanel:

```
POST /api/sessions/default/webhooks
{
  "url": "https://seu-backend.easypanel.app/api/webhooks/whatsapp?secret={WAHA_WEBHOOK_SECRET}",
  "events": ["message"]
}
```

O handler extrai e valida o `?secret=` da query string. Alternativa: variável de ambiente `WHATSAPP_HOOK_URL` no container WAHA com a URL já incluindo o secret.

---

## Dependências de Pacotes (a adicionar no backend)

```json
{
  "node-cron": "^3.x",     // scheduler do cron job
  "axios": "^1.x",         // HTTP client para WAHA
  "date-fns": "^3.x",      // formatação de datas nos templates (já usado no frontend)
  "date-fns-tz": "^3.x"    // fuso horário America/Sao_Paulo (RN-08)
}
```

---

## Verificação

```bash
# 1. Testar sendText manualmente
curl -X POST http://eficienciia_waha:3000/api/sendText \
  -H "X-Api-Key: $WAHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session":"default","chatId":"55XX@c.us","text":"Teste BillSync"}'

# 2. Testar webhook endpoint
curl -X POST "http://localhost:4000/api/webhooks/whatsapp?secret=$WAHA_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"message","from":"55XX@c.us","fromMe":false,"body":"pago","session":"default"}'

# 3. Verificar status WAHA
curl http://localhost:4000/api/waha/status

# 4. Disparar cron manualmente para teste
# Chamar scheduler.runNow() via endpoint de admin (dev only)
```
