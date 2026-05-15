# Design: Auto-configuração do Webhook de Enquetes do WAHA

**Data:** 2026-05-14  
**Status:** Aprovado

## Problema

O backend possui o handler `POST /api/webhooks/waha-poll` pronto para receber votos de enquetes do WhatsApp, mas o WAHA não está configurado para chamar esse endpoint. Quando o usuário vota em uma enquete, o voto nunca chega ao sistema.

## Solução

Ao inicializar, o backend chama a API do WAHA para registrar automaticamente o webhook com a URL correta e os eventos necessários. Idempotente — seguro de executar a cada deploy.

## Arquitetura

```
[Usuário vota no WhatsApp]
        ↓
     [WAHA]  ←── configurado na startup com webhook URL
        ↓
POST /api/webhooks/waha-poll
        ↓
  handlePollVote()
        ↓
  UPDATE checklist_daily_polls
```

## Mudanças

### 1. `backend/src/services/waha.ts`
Nova função `configureWahaWebhook(backendUrl: string)`:
- Chama `PUT /api/sessions/{session}` no WAHA
- Registra `url: ${backendUrl}/api/webhooks/waha-poll`
- Registra eventos: `["poll.vote", "poll.vote.failed"]`
- Falha silenciosa com log de aviso (não deve impedir o servidor de subir)

### 2. `backend/src/index.ts`
- Após `initScheduler()`, chama `configureWahaWebhook(process.env.BACKEND_PUBLIC_URL)`
- Se `BACKEND_PUBLIC_URL` não estiver definido, loga aviso e pula

### 3. `backend/src/routes/webhooks.ts`
- Eventos desconhecidos retornam `200` (silencioso) em vez de `400`
- Evita que o WAHA reintente indefinidamente para eventos não mapeados

### 4. `.env.example`
- Adiciona `BACKEND_PUBLIC_URL=https://seu-backend.railway.app`

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `BACKEND_PUBLIC_URL` | URL pública do backend (para o WAHA chamar de volta) | `https://meuapp.railway.app` |
| `WAHA_URL` | URL do WAHA (já existente) | `https://waha.eficienciia.com.br` |

## Sem mudanças em
- Banco de dados (nenhuma migração)
- Frontend
- Lógica de processamento de votos (já está correta)
