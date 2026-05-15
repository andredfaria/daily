# WAHA Poll Webhook Auto-configuração — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar automaticamente o webhook do WAHA no startup do backend para que votos de enquetes do WhatsApp sejam recebidos pelo sistema.

**Architecture:** O backend chama `PUT /api/sessions/{session}` no WAHA ao inicializar, registrando a URL `${BACKEND_PUBLIC_URL}/api/webhooks/waha-poll` e os eventos `poll.vote` e `poll.vote.failed`. Falha silenciosa — se o WAHA estiver indisponível, o backend sobe mesmo assim. Eventos desconhecidos no handler retornam 200 em vez de 400 para evitar retentativas.

**Tech Stack:** TypeScript, Express, axios (já usado via `wahaClient()`), Node.js env vars.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/src/services/waha.ts` | Modificar | Adicionar `configureWahaWebhook()` |
| `backend/src/index.ts` | Modificar | Chamar `configureWahaWebhook()` após startup |
| `backend/src/routes/webhooks.ts` | Modificar | Retornar 200 para eventos desconhecidos |
| `.env.example` | Modificar | Documentar `BACKEND_PUBLIC_URL` |

---

### Task 1: Adicionar `configureWahaWebhook` em `waha.ts`

**Files:**
- Modify: `backend/src/services/waha.ts`

- [ ] **Step 1: Adicionar a função ao final de `waha.ts`, antes do último export**

Abrir `backend/src/services/waha.ts` e adicionar ao final do arquivo (após `fetchWhatsAppName`):

```typescript
export async function configureWahaWebhook(backendPublicUrl: string): Promise<void> {
  const session = process.env.WAHA_SESSION || 'default'
  const webhookUrl = `${backendPublicUrl}/api/webhooks/waha-poll`

  try {
    await wahaClient().put(`/api/sessions/${session}`, {
      webhooks: [
        {
          url: webhookUrl,
          events: ['poll.vote', 'poll.vote.failed'],
        },
      ],
    })
    console.log(`[waha] webhook configurado: ${webhookUrl}`)
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

- [ ] **Step 2: Verificar que o arquivo compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros de compilação.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/waha.ts
git commit -m "feat: add configureWahaWebhook to register poll.vote webhook on startup"
```

---

### Task 2: Chamar `configureWahaWebhook` no startup em `index.ts`

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Importar a função no topo de `index.ts`**

Localizar a linha de import existente de `waha.ts` — não há nenhum import direto de `./services/waha` em `index.ts`. Adicionar o import após os imports existentes de serviços:

```typescript
import { configureWahaWebhook } from './services/waha'
```

- [ ] **Step 2: Chamar a função após `initScheduler()` dentro da função `start()`**

Localizar o bloco onde `initScheduler()` é chamado (linha ~85):

```typescript
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[backend] running on port ${PORT}`)
    // ... outros logs ...
    initScheduler()
  })
```

Substituir por:

```typescript
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[backend] running on port ${PORT}`)
    console.log(`[backend] DB_HOST=${process.env.DB_HOST || 'não definido'}`)
    console.log(`[backend] DB_NAME=${process.env.DB_NAME || 'não definido'}`)
    console.log(`[backend] DB_USER=${process.env.DB_USER || 'não definido'}`)
    console.log(`[backend] DB_PASSWORD=${process.env.DB_PASSWORD ? '***definido***' : 'não definido'}`)
    initScheduler()

    const backendPublicUrl = process.env.BACKEND_PUBLIC_URL
    if (backendPublicUrl) {
      await configureWahaWebhook(backendPublicUrl)
    } else {
      console.warn('[backend] BACKEND_PUBLIC_URL não definido — webhook do WAHA não será configurado automaticamente')
    }
  })
```

- [ ] **Step 3: Verificar que o arquivo compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: call configureWahaWebhook on backend startup"
```

---

### Task 3: Corrigir handler de eventos desconhecidos em `webhooks.ts`

**Files:**
- Modify: `backend/src/routes/webhooks.ts`

- [ ] **Step 1: Alterar o retorno de `400` para `200` em eventos não mapeados**

Localizar o trecho (linhas ~44-47):

```typescript
    if (event !== 'poll.vote') {
      return res.status(400).json({ error: `evento desconhecido: ${event}` })
    }
```

Substituir por:

```typescript
    if (event !== 'poll.vote') {
      console.log(`[webhook] evento ignorado: ${event}`)
      return res.status(200).json({ ok: true })
    }
```

- [ ] **Step 2: Verificar que o arquivo compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/webhooks.ts
git commit -m "fix: return 200 for unknown webhook events to prevent WAHA retries"
```

---

### Task 4: Documentar `BACKEND_PUBLIC_URL` no `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Adicionar a variável na seção WhatsApp / WAHA do `.env.example`**

Localizar o bloco existente:

```
# --------------------------------------------
# WhatsApp / WAHA
# --------------------------------------------
WAHA_URL=http://localhost:3000
WAHA_API_KEY=
WAHA_SESSION=default
WHATSAPP_HOOK_HMAC_KEY=
```

Substituir por:

```
# --------------------------------------------
# WhatsApp / WAHA
# --------------------------------------------
WAHA_URL=http://localhost:3000
WAHA_API_KEY=
WAHA_SESSION=default
WHATSAPP_HOOK_HMAC_KEY=
# URL pública do backend (usada pelo WAHA para enviar webhooks de volta)
# Exemplo: https://meuapp.railway.app
BACKEND_PUBLIC_URL=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add BACKEND_PUBLIC_URL to .env.example"
```

---

### Task 5: Verificação manual end-to-end

- [ ] **Step 1: Adicionar `BACKEND_PUBLIC_URL` ao `.env` local ou variáveis de produção**

No `.env` local (ou painel do Railway/Render/etc.):
```
BACKEND_PUBLIC_URL=https://seu-backend.railway.app
```

> Nota: em dev local com WAHA externo (`https://waha.eficienciia.com.br`), o WAHA precisa conseguir acessar sua URL pública. Se estiver rodando localmente sem URL pública, use ngrok ou similar para expor o backend temporariamente.

- [ ] **Step 2: Reiniciar o backend e verificar o log de startup**

Esperado no log:
```
[backend] running on port 4000
...
[waha] webhook configurado: https://seu-backend.railway.app/api/webhooks/waha-poll
```

Se aparecer `não foi possível configurar webhook`, verificar que `WAHA_URL`, `WAHA_API_KEY` e `WAHA_SESSION` estão corretos.

- [ ] **Step 3: Enviar uma enquete de teste e votar nela**

Via endpoint `POST /api/checklists/send-now` (com `force: true` no body) ou aguardar o horário configurado.

Votar na enquete recebida no WhatsApp.

Esperado no log do backend:
```
[req] POST /api/webhooks/waha-poll
[webhook] voto processado: N/M (XX%)
```

- [ ] **Step 4: Verificar no banco que `checklist_daily_polls` foi atualizado**

```sql
SELECT waha_poll_id, selected_options, completed_count, completion_pct, status
FROM checklist_daily_polls
ORDER BY updated_at DESC
LIMIT 1;
```

Esperado: `selected_options` preenchido com as opções votadas, `completion_pct > 0`, `status = 'completed'` se todos os itens foram marcados.
