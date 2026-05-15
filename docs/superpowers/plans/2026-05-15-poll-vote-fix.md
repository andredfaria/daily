# Correção do Fluxo de Votação de Enquetes — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que votos em enquetes WhatsApp cheguem corretamente ao sistema, corrigindo o registro do webhook no WAHA, adicionando observabilidade e tornando a extração do payload robusta a múltiplos formatos de engine.

**Architecture:** O backend registra o webhook no WAHA na startup via `configureWahaWebhook`; a função passa a tentar o formato de body com `config` wrapper (WAHA recente) e cai para o formato legado em erro 4xx, verificando o resultado via `GET /api/sessions/{session}`. Dois endpoints de diagnóstico (`POST /register-webhook`, `GET /webhook-status`) permitem re-registro e inspeção sem reiniciar o servidor. O handler `POST /api/webhooks/waha-poll` ganha log bruto do payload e extração defensiva de `pollMessageId` e `selectedOptions`.

**Tech Stack:** TypeScript, Express, axios (`wahaClient`), MySQL2. Sem framework de testes — verificação via `tsc --noEmit` e testes manuais com curl.

**Nota:** este projeto não tem suite de testes automatizados. Os steps de "verificação" usam compilação TypeScript e chamadas curl.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/src/services/waha.ts` | Modificar | Reescrever `configureWahaWebhook` com fallback + verificação; extrair `getWahaWebhookStatus` |
| `backend/src/routes/waha.ts` | Modificar | Adicionar `POST /register-webhook` e `GET /webhook-status` |
| `backend/src/routes/webhooks.ts` | Modificar | Adicionar log bruto + extração defensiva em `handlePollVote` |

---

### Task 1: Reescrever `configureWahaWebhook` e extrair `getWahaWebhookStatus`

**Files:**
- Modify: `backend/src/services/waha.ts` (função `configureWahaWebhook` já existe na linha ~166)

**Contexto:** A função atual envia `{ webhooks: [...] }` diretamente. WAHA recentes encapsulam em `{ config: { webhooks: [...] } }`. A API retorna 200 silenciosamente mesmo que o formato esteja errado, por isso adicionamos verificação pós-registro via `GET`.

- [ ] **Step 1: Substituir `configureWahaWebhook` e adicionar `getWahaWebhookStatus`**

Localizar a função `configureWahaWebhook` em `backend/src/services/waha.ts` (começa em volta da linha 166) e **substituir o bloco completo** (desde `export async function configureWahaWebhook` até o `}` de fechamento) por:

```typescript
export async function getWahaWebhookStatus(backendPublicUrl: string): Promise<{
  registered: boolean
  url: string
  webhooks: any[]
}> {
  const session = process.env.WAHA_SESSION || 'default'
  const webhookUrl = backendPublicUrl
    ? `${backendPublicUrl.replace(/\/$/, '')}/api/webhooks/waha-poll`
    : ''
  const { data } = await wahaClient().get(`/api/sessions/${session}`)
  const webhooks: any[] = data?.config?.webhooks ?? data?.webhooks ?? []
  const registered = webhooks.some((w: any) => String(w.url ?? '').includes('/api/webhooks/waha-poll'))
  return { registered, url: webhookUrl, webhooks }
}

export async function configureWahaWebhook(backendPublicUrl: string): Promise<void> {
  if (!backendPublicUrl) {
    console.warn('[waha] BACKEND_PUBLIC_URL não definido — webhook não configurado')
    return
  }

  const session = process.env.WAHA_SESSION || 'default'
  const webhookUrl = `${backendPublicUrl.replace(/\/$/, '')}/api/webhooks/waha-poll`
  const webhookEntry = { url: webhookUrl, events: ['poll.vote', 'poll.vote.failed'] }

  try {
    try {
      await wahaClient().put(`/api/sessions/${session}`, { config: { webhooks: [webhookEntry] } })
    } catch (err: any) {
      if (err.response?.status >= 400 && err.response?.status < 500) {
        console.log('[waha] tentando formato legado de webhook...')
        await wahaClient().put(`/api/sessions/${session}`, { webhooks: [webhookEntry] })
      } else {
        throw err
      }
    }

    const status = await getWahaWebhookStatus(backendPublicUrl)
    if (status.registered) {
      console.log(`[waha] webhook confirmado ✓: ${webhookUrl}`)
    } else {
      console.warn(`[waha] webhook NÃO confirmado na sessão — verificar configuração do WAHA`)
    }
  } catch (err: any) {
    const detail =
      err.response?.data?.message ??
      err.response?.data?.error ??
      err.message ??
      'erro desconhecido'
    console.warn(`[waha] não foi possível configurar webhook: ${detail}`)
  }
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Esperado: zero erros. Se houver erros de tipo, corrigi-los antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/waha.ts
git commit -m "feat: rewrite configureWahaWebhook with config-wrapper fallback and post-registration check"
```

---

### Task 2: Adicionar rotas de diagnóstico de webhook em `waha.ts` (routes)

**Files:**
- Modify: `backend/src/routes/waha.ts`

**Contexto:** O router `waha` já está montado em `index.ts` após `authMiddleware` (`app.use(authMiddleware); ... app.use('/api/waha', wahaRouter)`), então ambas as rotas são automaticamente autenticadas.

- [ ] **Step 1: Adicionar imports de `configureWahaWebhook` e `getWahaWebhookStatus`**

Localizar a linha de import de `../services/waha` em `backend/src/routes/waha.ts` (linha 3):

```typescript
import { wahaClient, sendWhatsAppText, WhatsAppNumberNotFoundError, fetchWhatsAppProfile } from '../services/waha'
```

Substituir por:

```typescript
import { wahaClient, sendWhatsAppText, WhatsAppNumberNotFoundError, fetchWhatsAppProfile, configureWahaWebhook, getWahaWebhookStatus } from '../services/waha'
```

- [ ] **Step 2: Adicionar as rotas ao final do arquivo, antes de `export default router`**

Localizar a linha `export default router` em `backend/src/routes/waha.ts` (última linha do arquivo) e inserir **antes** dela:

```typescript
// POST /api/waha/register-webhook
// Re-registra o webhook no WAHA sem reiniciar o servidor.
// Útil quando BACKEND_PUBLIC_URL não estava definida na última startup.
router.post('/register-webhook', async (_req: Request, res: Response) => {
  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL ?? ''
  if (!backendPublicUrl) {
    return res.status(400).json({
      ok: false,
      error: 'BACKEND_PUBLIC_URL não definida — configure a variável de ambiente e reinicie o servidor',
    })
  }

  try {
    await configureWahaWebhook(backendPublicUrl)
    const status = await getWahaWebhookStatus(backendPublicUrl)
    res.json({ ok: true, ...status })
  } catch (err: any) {
    const detail = extractWahaError(err)
    res.status(500).json({ ok: false, error: detail })
  }
})

// GET /api/waha/webhook-status
// Retorna a configuração atual de webhooks na sessão WAHA.
router.get('/webhook-status', async (_req: Request, res: Response) => {
  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL ?? ''
  try {
    const status = await getWahaWebhookStatus(backendPublicUrl)
    res.json(status)
  } catch (err: any) {
    const detail = extractWahaError(err)
    res.status(503).json({ registered: false, error: detail })
  }
})
```

- [ ] **Step 3: Verificar compilação TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/waha.ts
git commit -m "feat: add /api/waha/register-webhook and /api/waha/webhook-status diagnostic routes"
```

---

### Task 3: Log bruto + extração defensiva em `webhooks.ts`

**Files:**
- Modify: `backend/src/routes/webhooks.ts`

**Contexto:** O handler atual tenta `data.pollMessageId` e assume `selectedOptions` como strings puras. O engine NOWEB do WAHA envia `pollMessageId` dentro de `data.pollInfo.msgId` e `selectedOptions` como array de objetos `[{name: "Opção A"}]`. A normalização garante que o campo salvo no banco seja sempre `string[]`.

- [ ] **Step 1: Adicionar log bruto como primeira ação do handler**

Localizar em `backend/src/routes/webhooks.ts` o início do bloco `try` dentro de `router.post('/waha-poll', ...)` (linha ~22). A primeira linha dentro do `try {` deve ser o log:

Substituir:
```typescript
  try {
    const payload = JSON.stringify(req.body)
```

Por:
```typescript
  try {
    console.log('[webhook] payload raw:', JSON.stringify(req.body))
    const payload = JSON.stringify(req.body)
```

- [ ] **Step 2: Reescrever a extração de `pollMessageId` e `selectedOptions` em `handlePollVote`**

Localizar a função `handlePollVote` em `backend/src/routes/webhooks.ts` (começa na linha ~59). Substituir as linhas de extração de `pollMessageId` e `selectedOptions`:

Substituir:
```typescript
  const pollMessageId: string | undefined =
    data.pollMessageId ?? data.key?.id ?? data.id
  const selectedOptions: string[] = data.selectedOptions ?? []
  const voteTimestamp: number = Number(data.timestamp) || Date.now()
```

Por:
```typescript
  const pollMessageId: string | undefined =
    data.pollMessageId ??
    data.pollInfo?.msgId ??
    data.key?.id ??
    data.id

  const rawOptions: unknown[] = Array.isArray(data.selectedOptions) ? data.selectedOptions : []
  const selectedOptions: string[] = rawOptions.map((opt) =>
    typeof opt === 'string' ? opt : ((opt as any)?.name ?? String(opt))
  )

  const voteTimestamp: number = Number(data.timestamp) || Date.now()
```

- [ ] **Step 3: Verificar compilação TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/webhooks.ts
git commit -m "fix: add raw payload log and defensive extraction for pollMessageId and selectedOptions"
```

---

### Task 4: Configurar `BACKEND_PUBLIC_URL` em produção e verificar

**Contexto:** Esta task não envolve código — é a configuração no ambiente de deploy. Sem ela, `configureWahaWebhook` nunca é chamada e as Tasks 1–3 não têm efeito.

- [ ] **Step 1: Definir `BACKEND_PUBLIC_URL` no painel do Railway/Render/VPS**

No painel da plataforma cloud (Railway, Render, etc.), adicionar a variável de ambiente:

```
BACKEND_PUBLIC_URL=https://<sua-url-de-producao>
```

Exemplos:
- Railway: `https://meuapp.railway.app` (sem barra final)
- Render: `https://meuapp.onrender.com`

**Atenção:** Use a URL pública do **backend** (a que o WAHA pode chamar pela internet), não a URL do frontend.

- [ ] **Step 2: Fazer deploy e verificar os logs de startup**

Após o deploy, verificar nos logs do backend a presença de uma dessas mensagens:

```
[waha] webhook confirmado ✓: https://<sua-url>/api/webhooks/waha-poll
```

Se aparecer:
```
[waha] webhook NÃO confirmado na sessão — verificar configuração do WAHA
```
…significa que a API do WAHA não salvou o webhook. Neste caso, ir para o Step 3.

Se aparecer:
```
[waha] não foi possível configurar webhook: ...
```
…verificar se `WAHA_URL` e `WAHA_SESSION` estão corretos e se o WAHA está rodando.

- [ ] **Step 3 (condicional): Re-registrar manualmente via endpoint**

Se o log de startup não confirmou o registro, usar o endpoint de diagnóstico com um token JWT válido:

```bash
curl -X POST https://<sua-url>/api/waha/register-webhook \
  -H "Authorization: Bearer <seu-jwt>" \
  -H "Content-Type: application/json"
```

Esperado:
```json
{"ok":true,"registered":true,"url":"https://<sua-url>/api/webhooks/waha-poll","webhooks":[...]}
```

- [ ] **Step 4: Verificar status via endpoint GET**

```bash
curl https://<sua-url>/api/waha/webhook-status \
  -H "Authorization: Bearer <seu-jwt>"
```

Esperado:
```json
{"registered":true,"url":"https://<sua-url>/api/webhooks/waha-poll","webhooks":[...]}
```

- [ ] **Step 5: Testar votação real e verificar log bruto**

Votar em uma enquete no WhatsApp. Verificar nos logs do backend:

```
[req] POST /api/webhooks/waha-poll
[webhook] payload raw: {"event":"poll.vote","session":"default","payload":{...}}
[webhook] voto processado: X/Y (ZZ%)
```

Se o log aparecer com `payload raw` mas não aparecer `voto processado`, copiar o payload bruto — ele revela o formato exato do WAHA em uso. Neste caso, abrir uma nova sessão de debugging para ajustar a extração com os dados reais.

---

## Critérios de Aceitação

1. Logs de startup mostram `[waha] webhook confirmado ✓` quando `BACKEND_PUBLIC_URL` está definida
2. `GET /api/waha/webhook-status` retorna `{ "registered": true }`
3. `POST /api/waha/register-webhook` re-registra e retorna `{ "ok": true, "registered": true }`
4. Na primeira votação real, logs mostram `[webhook] payload raw: {...}` com body completo
5. Após votar, `checklist_daily_polls.selected_options` contém as opções como strings (não objetos)
