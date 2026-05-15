# Design: Correção do Fluxo de Votação de Enquetes (WhatsApp → BillSync)

**Data:** 2026-05-15
**Status:** Aprovado

## Problema

Quando um usuário vota em uma enquete enviada pelo BillSync no WhatsApp, o voto nunca chega ao sistema. Três causas identificadas em camadas:

1. **`BACKEND_PUBLIC_URL` não definida em produção** — `configureWahaWebhook` nunca é chamada, o WAHA não sabe para qual URL enviar os eventos `poll.vote`.
2. **Formato de body incorreto na chamada de registro** — o código envia `{ webhooks: [...] }`, mas WAHA recentes esperam `{ config: { webhooks: [...] } }`. A API retorna 200 mesmo ignorando o body.
3. **Extração do payload `poll.vote` frágil** — `data.pollMessageId` não existe no engine NOWEB (está em `data.pollInfo.msgId`); `selectedOptions` pode ser `[{name: "..."}]` (objetos) em vez de strings puras.

## Solução

Corrigir as três camadas de forma defensiva, adicionando observabilidade para diagnóstico imediato na primeira votação real.

## Arquitetura

```
[Startup]
  backend/index.ts
    → configureWahaWebhook(BACKEND_PUBLIC_URL)
      → PUT /api/sessions/{session} com { config: { webhooks: [...] } }
      → fallback: PUT sem wrapper config (WAHA legado)
      → GET /api/sessions/{session} para confirmar registro
      → log explícito: "webhook confirmado ✓" ou "NÃO confirmado"

[Re-registro manual — sem reiniciar o backend]
  POST /api/waha/register-webhook  (autenticado)
    → chama configureWahaWebhook(BACKEND_PUBLIC_URL) novamente
    → retorna { ok, registered, webhooks }

[Status — verificar se o webhook está ativo no WAHA]
  GET /api/waha/webhook-status  (autenticado)
    → GET /api/sessions/{session} no WAHA
    → retorna { registered: boolean, webhooks: [...], url: string }

[Fluxo de votação]
  Usuário vota no WhatsApp
    → WAHA dispara poll.vote
    → POST /api/webhooks/waha-poll
      → LOG BRUTO do body completo (antes de qualquer processamento)
      → handlePollVote()
        → extração defensiva de pollMessageId (4 locais com fallback)
        → normalização de selectedOptions (string[] independente do formato)
      → UPDATE checklist_daily_polls
```

## Mudanças

### 1. `backend/src/services/waha.ts` — `configureWahaWebhook`

Substituir a implementação atual por versão com:
- Tentativa primária: `PUT /api/sessions/{session}` com `{ config: { webhooks: [webhookEntry] } }`
- Fallback em erros 4xx: retry sem wrapper config (`{ webhooks: [webhookEntry] }`)
- Verificação pós-registro: `GET /api/sessions/{session}` → checar se webhook URL aparece em `data.config?.webhooks ?? data?.webhooks`
- Log explícito de confirmação ou falha

```typescript
// Exemplo da lógica de fallback
const webhookEntry = {
  url: webhookUrl,
  events: ['poll.vote', 'poll.vote.failed'],
}
try {
  await wahaClient().put(`/api/sessions/${session}`, { config: { webhooks: [webhookEntry] } })
} catch (err: any) {
  if (err.response?.status >= 400 && err.response?.status < 500) {
    await wahaClient().put(`/api/sessions/${session}`, { webhooks: [webhookEntry] })
  } else throw err
}
// Verificação
const { data } = await wahaClient().get(`/api/sessions/${session}`)
const webhooks: any[] = data?.config?.webhooks ?? data?.webhooks ?? []
const ok = webhooks.some((w: any) => String(w.url ?? '').includes('/api/webhooks/waha-poll'))
console.log(ok ? '[waha] webhook confirmado ✓' : '[waha] webhook NÃO confirmado — verificar WAHA')
```

### 2. `backend/src/routes/waha.ts` — rotas de diagnóstico

Adicionar dois endpoints autenticados (protegidos pelo `authMiddleware` já existente na cadeia de `index.ts`):

**`POST /api/waha/register-webhook`**
- Chama `configureWahaWebhook(process.env.BACKEND_PUBLIC_URL ?? '')`
- Retorna `{ ok: true, registered: boolean, webhooks: [...] }`
- Erro 400 se `BACKEND_PUBLIC_URL` não estiver definida

**`GET /api/waha/webhook-status`**
- Chama `GET /api/sessions/{session}` no WAHA
- Extrai lista de webhooks de `data.config?.webhooks ?? data?.webhooks ?? []`
- Retorna `{ registered: boolean, url: string, webhooks: [...] }`

### 3. `backend/src/routes/webhooks.ts` — log bruto + extração defensiva

**Log bruto** — primeira ação dentro do `router.post('/waha-poll', ...)`, antes do HMAC:
```typescript
console.log('[webhook] payload raw:', JSON.stringify(req.body))
```

**Extração defensiva em `handlePollVote`:**
```typescript
// pollMessageId: tenta 4 locais em ordem de prioridade
const pollMessageId: string | undefined =
  data.pollMessageId ??       // formato WEBJS/legado
  data.pollInfo?.msgId ??     // formato NOWEB recente
  data.key?.id ??             // fallback genérico de mensagem WA
  data.id                     // último recurso

// selectedOptions: normaliza para string[] independente do formato WAHA
const rawOptions: unknown[] = Array.isArray(data.selectedOptions) ? data.selectedOptions : []
const selectedOptions: string[] = rawOptions.map((opt) =>
  typeof opt === 'string' ? opt : ((opt as any)?.name ?? String(opt))
)
```

## Sem mudanças em

- Banco de dados (nenhuma migration necessária)
- Frontend
- Scheduler
- `handlePollVoteFailed`
- Lógica de cálculo de `completion_pct` e `status` (já correta)

## Variáveis de Ambiente

| Variável | Obrigatória em prod | Descrição |
|---|---|---|
| `BACKEND_PUBLIC_URL` | **Sim** | URL pública do backend (ex: `https://meu-app.railway.app`) — sem barra final |
| `WAHA_URL` | Sim (já existe) | URL do WAHA |
| `WAHA_SESSION` | Sim (já existe) | Nome da sessão WAHA (padrão: `default`) |

## Critérios de Aceitação

1. Ao subir o backend com `BACKEND_PUBLIC_URL` definido, os logs mostram `[waha] webhook confirmado ✓`
2. `GET /api/waha/webhook-status` retorna `{ registered: true }` após a startup
3. `POST /api/waha/register-webhook` re-registra sem reiniciar o servidor
4. Na primeira votação real, os logs mostram `[webhook] payload raw: {...}` com o body completo
5. Após votar, `checklist_daily_polls.selected_options` é atualizado com as opções corretas em formato string
