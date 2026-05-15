# Spec: Redesign da Tela de Notificações

**Data:** 2026-05-15  
**Status:** Aprovado — pronto para implementação  
**Execução:** Multi-agent paralelo

---

## Objetivo

Transformar a tela de Notificações de uma lista simples (e frequentemente vazia) em um **hub de comunicações WhatsApp** que exibe, numa interface unificada:

- Todos os lembretes de contas agendados e enviados, com o conteúdo exato da mensagem
- Todos os polls de checklist enviados com os resultados de votação por item
- Ações de cancelar (lembretes agendados) e reenviar (falhas)

---

## Decisões de Design

| Decisão | Escolha |
|---|---|
| Estrutura da página | Duas abas: Próximos Envios / Histórico — com bills e polls misturados em cada aba |
| Preview de mensagem | Inline expand — card se expande para baixo mostrando bolha WhatsApp |
| Resultado de poll | Barra de progresso + lista de itens com ✓ (concluídos) e ○ riscado (não concluídos) |
| Cancel de lembrete | Confirmação inline no card expandido → DELETE hard no banco |

---

## Escopo

### Dentro do escopo
- Lembretes de contas: ver, expandir mensagem, cancelar (scheduled), reenviar (failed), enviar agora
- Polls de checklist: ver, expandir itens + resultado de votação
- Preview de mensagem para lembretes ainda não enviados (construído client-side)
- `message_body` real para lembretes já enviados

### Fora do escopo
- Cancelar/reenviar polls de checklist (gerenciado na página Checklists)
- Criação manual de notificações
- Edição do conteúdo da mensagem
- Paginação (limite 200 registros é suficiente)

---

## Mudanças no Backend

### 1. `GET /api/notifications` — enriquecer com dados de pagamento

Adicionar LEFT JOIN com `payment_methods` (is_primary = 1) na query existente.

Campos adicionais na resposta:
```
pm_type          VARCHAR  (pix | boleto | null)
pix_key_type     VARCHAR
pix_key          VARCHAR
pix_beneficiary  VARCHAR
boleto_code      VARCHAR
```

Arquivo: `backend/src/routes/notifications.ts`

### 2. `GET /api/checklists/polls` — novo endpoint

```
GET /api/checklists/polls?upcoming=true
→ Poll de hoje (status=pending) com itens do checklist
  Resposta: ChecklistPollNotif | null

GET /api/checklists/polls?history=true
→ Últimos 30 polls (status IN sent, completed) com selected_options e itens
  Resposta: ChecklistPollNotif[]
```

Query base:
```sql
SELECT
  cdp.*,
  c.name AS checklist_name,
  GROUP_CONCAT(ci.text ORDER BY ci.sort_order SEPARATOR '|||') AS items_concat
FROM checklist_daily_polls cdp
JOIN checklists c ON c.id = cdp.checklist_id
JOIN checklist_items ci ON ci.checklist_id = cdp.checklist_id
WHERE cdp.user_id = ?
  -- upcoming: AND cdp.poll_date = CURDATE() AND cdp.status = 'pending'
  -- history:  AND cdp.status IN ('sent','completed')
GROUP BY cdp.id
ORDER BY cdp.poll_date DESC
LIMIT 30
```

`items_concat` é splitado por `|||` no handler para montar o array `items`.

Arquivo: `backend/src/routes/checklists.ts`

### 3. `DELETE /api/notifications/:id` — cancelar lembrete agendado

```
DELETE /api/notifications/:id
→ Valida ownership (JOIN com bills b.user_id = req.userId)
→ Valida status = 'scheduled' (400 se já enviado/falhado)
→ Hard delete da linha
→ 204 No Content
```

Arquivo: `backend/src/routes/notifications.ts`

---

## Mudanças no Frontend

### Novos tipos — `src/types/index.ts`

```typescript
// Extensão de NotificationEnriched com dados de pagamento
export interface NotificationEnriched extends Notification {
  bill_name: string
  due_date: string
  amount: number
  pm_type?: 'pix' | 'boleto'
  pix_key_type?: PixKeyType
  pix_key?: string
  pix_beneficiary?: string
  boleto_code?: string
}

// Poll de checklist para a tela de notificações
export interface ChecklistPollNotif {
  id: string
  checklist_id: string
  checklist_name: string
  poll_date: string           // YYYY-MM-DD
  status: 'pending' | 'sent' | 'completed'
  completed_count: number
  total_count: number
  completion_pct: number
  selected_options: string[]  // itens marcados como concluídos
  items: string[]             // todos os itens do checklist
  sent_at?: string
}
```

### Novo método de API — `src/api/notifications.ts`

```typescript
cancel: async (id: string): Promise<void> => {
  await client.delete(`/notifications/${id}`)
}
```

### Novo método de API — `src/api/checklists.ts`

```typescript
// Sempre retorna array — upcoming=true retorna 0 ou 1 item; history=true retorna N itens
polls: async (params: {
  upcoming?: boolean
  history?: boolean
}): Promise<ChecklistPollNotif[]> => {
  const res = await client.get('/checklists/polls', { params })
  return res.data
}
```

O backend retorna sempre um array. Para `upcoming=true`, retorna `[]` se nenhum poll pendente, ou `[poll]` com o poll do dia.

### Refatoração completa — `src/pages/Notificacoes.tsx`

#### Tipo unificado de feed
```typescript
type FeedItem =
  | { kind: 'bill';      data: NotificationEnriched }
  | { kind: 'checklist'; data: ChecklistPollNotif }
```

#### Estado
```typescript
const [upcoming,    setUpcoming]    = useState<FeedItem[]>([])
const [history,     setHistory]     = useState<FeedItem[]>([])
const [expandedId,  setExpandedId]  = useState<string | null>(null)
const [cancelling,  setCancelling]  = useState<string | null>(null)
const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
```

#### Carregamento — 4 fetches paralelos
```typescript
const [billsUp, billsHist, pollUp, pollHist] = await Promise.allSettled([
  notificationsApi.listEnriched({ upcoming: true }),
  notificationsApi.listEnriched({ history: true }),
  checklistsApi.polls({ upcoming: true }),
  checklistsApi.polls({ history: true }),
])
// mapear cada resultado para FeedItem e ordenar por data
```

#### Função pura de prévia — `buildMessagePreview(notif: NotificationEnriched): string`
Reconstrói o texto da mensagem WhatsApp para notificações `scheduled` sem `message_body`.
Mesma lógica do `dispatcher.ts` portada para TypeScript no cliente.

#### Componentes internos

| Componente | Responsabilidade |
|---|---|
| `FeedRow` | Container de item — renderiza `BillRow` ou `PollRow` baseado em `kind`; gerencia expand/collapse |
| `BillRow` | Linha de lembrete de conta (collapsed): barra colorida, ícone, nome, badge Conta, valor, botão ▼ |
| `BillExpanded` | Conteúdo expandido de lembrete: bolha WhatsApp + botões de ação (cancelar/enviar/reenviar) |
| `PollRow` | Linha de poll de checklist (collapsed): barra verde, ícone, nome, badge Poll, % ou status, botão ▼ |
| `PollExpanded` | Conteúdo expandido de poll: barra de progresso + lista de itens com ✓/○ |
| `MessageBubble` | Renderiza texto com formatação WhatsApp (*bold*, quebras de linha) como bolha verde |
| `CancelConfirm` | Confirmação inline dentro do card expandido antes de deletar |

#### Fluxo de cancelamento
1. Usuário clica "Cancelar envio" → `setConfirmCancel(id)` — mostra texto de confirmação no card
2. Usuário confirma → `setCancelling(id)` → `notificationsApi.cancel(id)` → remove da lista com fade
3. Usuário cancela → `setConfirmCancel(null)` — volta ao estado normal
4. Em caso de erro → toast de erro, estado resetado

---

## Comportamentos de Borda

| Cenário | Comportamento |
|---|---|
| Sem checklist cadastrado | Upcoming e histórico não mostram seção de poll |
| Poll do dia já enviado (status=sent) | Aparece em "Próximos" como informativo sem ação de cancelar |
| `message_body` vazio em notif enviada | Fallback para `buildMessagePreview()` |
| Bill sem método de pagamento | Prévia omite seção "💳 Pagamento" |
| Cancel falha na API | Toast de erro; item permanece; botão volta ao normal |
| Resend resulta em `skipped` | Toast: "Conta já paga — lembrete ignorado" |
| Upcoming vazio (ambos os tipos) | Empty state único com ícone e explicação do scheduler |

---

## Conformidade com Design System

Seguir `design-system/billsync/MASTER.md`:
- Touch targets mínimos `w-11 h-11` em botões de ação
- `min-h-dvh` (não `min-h-screen`)
- Tokens semânticos — sem hex hardcoded nos componentes
- Cores de status: `text-tertiary` (sent/concluído), `text-error` (failed), `text-yellow-400` (pending), `text-on-surface-variant` (skipped)
- Bolha WhatsApp: `bg-[#1f7e4a]` com texto branco (cor real do WhatsApp)
- Animação de fade-out ao cancelar: `transition-all duration-300 opacity-0`

---

## Paralelização para Multi-Agent

O trabalho pode ser dividido em 3 streams independentes:

**Stream A — Backend**
1. Adicionar pm_fields ao GET /api/notifications
2. Criar GET /api/checklists/polls
3. Criar DELETE /api/notifications/:id

**Stream B — Tipos e API layer**
1. Atualizar `src/types/index.ts`
2. Atualizar `src/api/notifications.ts` (cancel)
3. Atualizar `src/api/checklists.ts` (polls)

**Stream C — Componentes UI** *(depende de B)*
1. `buildMessagePreview` utility
2. `MessageBubble` + `PollResult` components
3. Refatoração de `Notificacoes.tsx`

Stream A e B podem rodar em paralelo. Stream C começa depois que B terminar.
