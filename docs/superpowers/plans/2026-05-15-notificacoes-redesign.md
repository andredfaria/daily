# Notificações Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a tela de Notificações em um hub de comunicações WhatsApp que exibe lembretes de contas e polls de checklist com preview de mensagem inline e resultado de votação por item.

**Architecture:** Stream A (backend) e Stream B (tipos + API layer) executam em paralelo. Stream C (componentes UI) inicia somente após Stream B estar completo. Cada stream é independente: A toca apenas `backend/src/`, B toca apenas `src/types/` e `src/api/`, C toca `src/utils/format.ts` e `src/pages/Notificacoes.tsx`.

**Tech Stack:** Express + MySQL2 (backend), React + TypeScript + Tailwind CSS (frontend), date-fns, Material Symbols Outlined.

---

## File Map

| Arquivo | Ação | Stream |
|---|---|---|
| `backend/src/routes/notifications.ts` | Modificar — enriquecer GET com pm fields + adicionar DELETE | A |
| `backend/src/routes/checklists.ts` | Modificar — adicionar GET /polls | A |
| `src/types/index.ts` | Modificar — estender NotificationEnriched + novo ChecklistPollNotif | B |
| `src/api/notifications.ts` | Modificar — adicionar método cancel | B |
| `src/api/checklists.ts` | Modificar — adicionar método polls | B |
| `src/utils/format.ts` | Modificar — adicionar buildMessagePreview | C |
| `src/pages/Notificacoes.tsx` | Reescrever completamente | C |

---

## ═══ STREAM A — Backend ═══

> Executa em paralelo com Stream B. Não requer nenhuma mudança de frontend.

---

### Task A1: Enriquecer GET /api/notifications com dados de pagamento

**Arquivo:** `backend/src/routes/notifications.ts`

- [ ] **Passo 1: Localizar a query do GET /**

Abrir `backend/src/routes/notifications.ts`. Localizar o bloco `router.get('/', ...)` (linha ~37). A query atual é:

```typescript
const [rows] = await pool.query(
  `SELECT n.*, b.name AS bill_name, o.due_date, o.amount
   FROM notifications n
   JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
   JOIN bills b ON b.id = o.bill_id
   ${where} ORDER BY n.scheduled_for DESC LIMIT ?`,
  values
)
```

- [ ] **Passo 2: Substituir a query adicionando LEFT JOIN com payment_methods**

Substituir apenas essa query (manter todo o resto do handler intacto):

```typescript
const [rows] = await pool.query(
  `SELECT n.*, b.name AS bill_name, o.due_date, o.amount,
          pm.type AS pm_type, pm.pix_key_type, pm.pix_key,
          pm.pix_beneficiary, pm.boleto_code
   FROM notifications n
   JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
   JOIN bills b ON b.id = o.bill_id
   LEFT JOIN payment_methods pm ON pm.bill_id = b.id AND pm.is_primary = 1
   ${where} ORDER BY n.scheduled_for DESC LIMIT ?`,
  values
)
```

- [ ] **Passo 3: Verificar build**

```bash
cd backend && npm run build 2>&1 | tail -5
```
Esperado: sem erros TypeScript.

- [ ] **Passo 4: Commit**

```bash
git add backend/src/routes/notifications.ts
git commit -m "feat(backend): enrich GET /notifications with payment method fields"
```

---

### Task A2: Adicionar DELETE /api/notifications/:id

**Arquivo:** `backend/src/routes/notifications.ts`

- [ ] **Passo 1: Adicionar o handler DELETE no final do arquivo, antes de `export default router`**

```typescript
// DELETE /api/notifications/:id
// Cancela (hard delete) uma notificação com status=scheduled.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [ownerRows]: any = await pool.query(
      `SELECT n.id, n.status FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ? AND b.user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!ownerRows.length) {
      return res.status(404).json({ error: 'Notificação não encontrada' })
    }
    if (ownerRows[0].status !== 'scheduled') {
      return res.status(400).json({ error: 'Apenas notificações agendadas podem ser canceladas' })
    }
    await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Passo 2: Verificar build**

```bash
cd backend && npm run build 2>&1 | tail -5
```
Esperado: sem erros TypeScript.

- [ ] **Passo 3: Commit**

```bash
git add backend/src/routes/notifications.ts
git commit -m "feat(backend): add DELETE /notifications/:id to cancel scheduled reminders"
```

---

### Task A3: Adicionar GET /api/checklists/polls

**Arquivo:** `backend/src/routes/checklists.ts`

- [ ] **Passo 1: Localizar onde inserir a nova rota**

Abrir `backend/src/routes/checklists.ts`. Localizar o primeiro `router.get('/dashboard', ...)`. O novo endpoint `/polls` deve ser inserido **antes** de qualquer rota com parâmetro `/:id` para evitar conflito de matching no Express.

- [ ] **Passo 2: Inserir o handler GET /polls antes do bloco GET /dashboard**

```typescript
// GET /api/checklists/polls
// Query params:
//   upcoming=true  — poll de hoje com status=pending (inclui itens)
//   history=true   — últimos 30 polls enviados/concluídos (inclui itens e selected_options)
// Sempre retorna array. upcoming=true retorna [] ou [poll].
router.get('/polls', async (req: Request, res: Response) => {
  try {
    const { upcoming, history } = req.query

    let condition: string
    if (upcoming === 'true') {
      condition = "cdp.poll_date = CURDATE() AND cdp.status = 'pending'"
    } else if (history === 'true') {
      condition = "cdp.status IN ('sent','completed')"
    } else {
      return res.status(400).json({ error: 'Parâmetro upcoming ou history obrigatório' })
    }

    const [rows]: any = await pool.query(
      `SELECT cdp.id, cdp.checklist_id, cdp.poll_date, cdp.status,
              cdp.completed_count, cdp.total_count, cdp.completion_pct,
              cdp.selected_options, cdp.updated_at AS sent_at,
              c.name AS checklist_name,
              GROUP_CONCAT(ci.text ORDER BY ci.sort_order SEPARATOR '|||') AS items_concat
       FROM checklist_daily_polls cdp
       JOIN checklists c ON c.id = cdp.checklist_id
       JOIN checklist_items ci ON ci.checklist_id = cdp.checklist_id
       WHERE cdp.user_id = ? AND ${condition}
       GROUP BY cdp.id
       ORDER BY cdp.poll_date DESC
       LIMIT 30`,
      [req.userId]
    )

    const polls = rows.map((row: any) => {
      const rawOptions = row.selected_options
      return {
        id: row.id,
        checklist_id: row.checklist_id,
        checklist_name: row.checklist_name,
        poll_date: row.poll_date instanceof Date
          ? row.poll_date.toISOString().slice(0, 10)
          : String(row.poll_date).slice(0, 10),
        status: row.status,
        completed_count: row.completed_count,
        total_count: row.total_count,
        completion_pct: Number(row.completion_pct),
        selected_options: Array.isArray(rawOptions)
          ? rawOptions
          : (rawOptions ? JSON.parse(rawOptions) : []),
        items: row.items_concat ? row.items_concat.split('|||') : [],
        sent_at: row.sent_at,
      }
    })

    res.json(polls)
  } catch (err: any) {
    console.error('[checklists] GET /polls', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})
```

- [ ] **Passo 3: Verificar build**

```bash
cd backend && npm run build 2>&1 | tail -5
```
Esperado: sem erros TypeScript.

- [ ] **Passo 4: Commit**

```bash
git add backend/src/routes/checklists.ts
git commit -m "feat(backend): add GET /checklists/polls for notification hub"
```

---

## ═══ STREAM B — Tipos e API layer ═══

> Executa em paralelo com Stream A. Stream C depende deste stream.

---

### Task B1: Atualizar tipos

**Arquivo:** `src/types/index.ts`

- [ ] **Passo 1: Estender NotificationEnriched com campos de pagamento**

Localizar a interface `NotificationEnriched` (linha ~66) e substituir:

```typescript
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
```

- [ ] **Passo 2: Adicionar ChecklistPollNotif após NotificationEnriched**

```typescript
export interface ChecklistPollNotif {
  id: string
  checklist_id: string
  checklist_name: string
  poll_date: string
  status: 'pending' | 'sent' | 'completed'
  completed_count: number
  total_count: number
  completion_pct: number
  selected_options: string[]
  items: string[]
  sent_at?: string
}
```

- [ ] **Passo 3: Verificar build frontend**

```bash
npm run build 2>&1 | grep -E "error TS|✓"
```
Esperado: sem erros TS (ou só o aviso de chunk size que já existia).

- [ ] **Passo 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): extend NotificationEnriched with pm fields + add ChecklistPollNotif"
```

---

### Task B2: Adicionar métodos de API

**Arquivos:** `src/api/notifications.ts`, `src/api/checklists.ts`

- [ ] **Passo 1: Adicionar método `cancel` em notifications.ts**

Abrir `src/api/notifications.ts`. Adicionar **antes** do fechamento do objeto `notificationsApi`:

```typescript
  cancel: async (id: string): Promise<void> => {
    await client.delete(`/notifications/${id}`)
  },
```

- [ ] **Passo 2: Adicionar método `polls` em checklists.ts**

Abrir `src/api/checklists.ts`. Adicionar o import do tipo novo no topo:

```typescript
import type { Checklist, ChecklistDashboardData, ChecklistPollNotif } from '../types'
```

Adicionar **antes** do fechamento do objeto `checklistsApi`:

```typescript
  polls: async (params: {
    upcoming?: boolean
    history?: boolean
  }): Promise<ChecklistPollNotif[]> => {
    const res = await client.get<ChecklistPollNotif[]>('/checklists/polls', { params })
    return res.data
  },
```

- [ ] **Passo 3: Verificar build**

```bash
npm run build 2>&1 | grep -E "error TS|✓"
```
Esperado: sem erros TypeScript.

- [ ] **Passo 4: Commit**

```bash
git add src/api/notifications.ts src/api/checklists.ts
git commit -m "feat(api): add cancel to notificationsApi and polls to checklistsApi"
```

---

## ═══ STREAM C — Componentes UI ═══

> Inicia somente após Stream B completo (tipos e API layer disponíveis).

---

### Task C1: Adicionar buildMessagePreview ao format.ts

**Arquivo:** `src/utils/format.ts`

- [ ] **Passo 1: Adicionar import do tipo no topo do arquivo**

Localizar a linha de imports do date-fns (linha 1) e adicionar **após**:

```typescript
import type { NotificationEnriched } from '../types'
```

- [ ] **Passo 2: Adicionar a função buildMessagePreview no final do arquivo**

```typescript
export const buildMessagePreview = (notif: NotificationEnriched): string => {
  const dueDateStr = typeof notif.due_date === 'string'
    ? notif.due_date.slice(0, 10)
    : String(notif.due_date).slice(0, 10)
  const [y, m, d] = dueDateStr.split('-')
  const dueFmt = `${d}/${m}/${y}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let relative: string
  if (diffDays === 0) relative = 'hoje'
  else if (diffDays === 1) relative = 'amanhã'
  else if (diffDays > 1) relative = `em ${diffDays} dias`
  else if (diffDays === -1) relative = 'venceu ontem'
  else relative = `venceu há ${Math.abs(diffDays)} dias`

  const amount = Number(notif.amount).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  let paymentSection = ''
  if (notif.pm_type === 'pix') {
    const keyTypeLabel: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
    }
    const label = notif.pix_key_type ? (keyTypeLabel[notif.pix_key_type] ?? notif.pix_key_type) : ''
    const beneficiary = notif.pix_beneficiary ? `\nFavorecido: ${notif.pix_beneficiary}` : ''
    paymentSection = `\n\n💳 *Pagamento:*\nPIX — ${label}: ${notif.pix_key}${beneficiary}`
  } else if (notif.pm_type === 'boleto') {
    paymentSection = `\n\n💳 *Pagamento:*\nBoleto:\n${notif.boleto_code}`
  }

  return `📅 *Lembrete de Vencimento — BillSync*\n\nConta: *${notif.bill_name}*\nValor: R$ ${amount}\nVencimento: *${relative} (${dueFmt})*${paymentSection}`
}
```

- [ ] **Passo 3: Verificar build**

```bash
npm run build 2>&1 | grep -E "error TS|✓"
```
Esperado: sem erros TypeScript.

- [ ] **Passo 4: Commit**

```bash
git add src/utils/format.ts
git commit -m "feat(utils): add buildMessagePreview for WhatsApp message reconstruction"
```

---

### Task C2: Reescrever Notificacoes.tsx

**Arquivo:** `src/pages/Notificacoes.tsx`

- [ ] **Passo 1: Substituir o arquivo completo pelo conteúdo abaixo**

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { notificationsApi } from '../api/notifications'
import { checklistsApi } from '../api/checklists'
import type { NotificationEnriched, NotificationStatus, ChecklistPollNotif } from '../types'
import { formatBRL, formatDate, getBillIcon, buildMessagePreview } from '../utils/format'
import { useToast } from '../context/ToastContext'
import { SkeletonRow } from '../components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'history'
type HistoryFilter = 'all' | 'sent' | 'failed' | 'skipped'
type FeedItem =
  | { kind: 'bill'; data: NotificationEnriched }
  | { kind: 'checklist'; data: ChecklistPollNotif }

const historyFilters: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sent', label: 'Enviados' },
  { value: 'failed', label: 'Falhas' },
  { value: 'skipped', label: 'Ignorados' },
]

const statusConfig: Record<NotificationStatus, { icon: string; label: string; color: string; bg: string }> = {
  scheduled: { icon: 'schedule', label: 'Agendado', color: 'text-on-surface-variant', bg: 'bg-outline/10' },
  sent: { icon: 'check_circle', label: 'Enviado', color: 'text-tertiary', bg: 'bg-tertiary/10' },
  failed: { icon: 'cancel', label: 'Falha', color: 'text-error', bg: 'bg-error/10' },
  skipped: { icon: 'skip_next', label: 'Ignorado', color: 'text-on-surface-variant', bg: 'bg-outline/10' },
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*[^*]+\*)/g)
  return (
    <div className="bg-[#1f7e4a] rounded-xl rounded-bl-sm px-3 py-2.5 max-w-[85%] text-white text-xs leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <strong key={i}>{part.slice(1, -1)}</strong>
        }
        return part.split('\n').map((line, j, arr) => (
          <React.Fragment key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ))
      })}
    </div>
  )
}

// ─── PollResult ───────────────────────────────────────────────────────────────

const PollResult: React.FC<{ poll: ChecklistPollNotif }> = ({ poll }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full bg-tertiary rounded-full transition-all duration-500"
          style={{ width: `${poll.completion_pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-tertiary w-8 text-right">{poll.completion_pct}%</span>
    </div>
    <div className="space-y-1.5">
      {poll.items.map((item, i) => {
        const done = poll.selected_options.includes(item)
        return (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs ${done ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}
          >
            <span
              className={`material-symbols-outlined text-sm flex-shrink-0 ${done ? 'text-tertiary' : 'text-outline'}`}
              style={done ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {done ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            {item}
          </div>
        )
      })}
    </div>
  </div>
)

// ─── BillFeedRow ──────────────────────────────────────────────────────────────

interface BillFeedRowProps {
  notif: NotificationEnriched
  isExpanded: boolean
  onToggle: () => void
  isResending: boolean
  onResend: () => void
  isCancelling: boolean
  confirmingCancel: boolean
  onCancelRequest: () => void
  onCancelConfirm: () => void
  onCancelAbort: () => void
  onSendNow: () => void
}

const BillFeedRow: React.FC<BillFeedRowProps> = ({
  notif, isExpanded, onToggle,
  isResending, onResend,
  isCancelling, confirmingCancel, onCancelRequest, onCancelConfirm, onCancelAbort,
  onSendNow,
}) => {
  const icon = getBillIcon(notif.bill_name)
  const cfg = statusConfig[notif.status]
  const isScheduled = notif.status === 'scheduled'
  const isFailed = notif.status === 'failed'

  const leftBarColor = notif.status === 'sent'
    ? 'bg-tertiary'
    : notif.status === 'failed'
    ? 'bg-error'
    : notif.status === 'scheduled'
    ? 'bg-primary'
    : 'bg-outline/30'

  const messageText = notif.message_body || buildMessagePreview(notif)

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
      isExpanded ? 'border-primary/40' : 'border-outline-variant/20'
    } bg-surface-container/40 hover:bg-surface-container`}>
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left"
      >
        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${leftBarColor}`} />
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface truncate">{notif.bill_name}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0">
              Conta
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Vence: {formatDate(notif.due_date)}
            {notif.status === 'scheduled' && ` · Envio: ${formatDate(notif.scheduled_for)}`}
            {notif.sent_at && ` · Enviado: ${format(parseISO(notif.sent_at), 'dd/MM HH:mm')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="text-sm font-bold text-on-surface hidden sm:block">{formatBRL(notif.amount)}</p>
          {notif.status !== 'scheduled' && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                {cfg.icon}
              </span>
              <span className="hidden sm:inline">{cfg.label}</span>
            </span>
          )}
          <span className={`material-symbols-outlined text-base text-on-surface-variant transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-4 border-t border-outline-variant/20 pt-3 space-y-3">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-semibold">
            {isScheduled ? 'Prévia da mensagem' : 'Mensagem enviada'}
          </p>
          <MessageBubble text={messageText} />

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isScheduled && !confirmingCancel && (
              <>
                <button
                  onClick={onSendNow}
                  disabled={isResending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
                >
                  {isResending
                    ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-sm">send</span>
                  }
                  Enviar agora
                </button>
                <button
                  onClick={onCancelRequest}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Cancelar envio
                </button>
              </>
            )}

            {isScheduled && confirmingCancel && (
              <div className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-error/10 border border-error/30">
                <span className="material-symbols-outlined text-error text-sm">warning</span>
                <span className="text-xs text-error flex-1">Remover lembrete agendado?</span>
                <button
                  onClick={onCancelConfirm}
                  disabled={isCancelling}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-error text-white min-h-[36px] disabled:opacity-50"
                >
                  {isCancelling
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    : 'Remover'
                  }
                </button>
                <button
                  onClick={onCancelAbort}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant min-h-[36px]"
                >
                  Manter
                </button>
              </div>
            )}

            {isFailed && (
              <button
                onClick={onResend}
                disabled={isResending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
              >
                {isResending
                  ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-sm">refresh</span>
                }
                Reenviar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ChecklistFeedRow ─────────────────────────────────────────────────────────

interface ChecklistFeedRowProps {
  poll: ChecklistPollNotif
  isExpanded: boolean
  onToggle: () => void
}

const ChecklistFeedRow: React.FC<ChecklistFeedRowProps> = ({ poll, isExpanded, onToggle }) => {
  const isPending = poll.status === 'pending'
  const leftBarColor = isPending ? 'bg-outline/30' : 'bg-tertiary'
  const dateLabel = (() => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(new Date(poll.poll_date + 'T00:00:00'))
    } catch {
      return poll.poll_date
    }
  })()

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
      isExpanded ? 'border-tertiary/40' : 'border-outline-variant/20'
    } bg-surface-container/40 hover:bg-surface-container`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left"
      >
        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${leftBarColor}`} />
        <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-tertiary text-lg">checklist</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface truncate">{poll.checklist_name}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-tertiary/15 text-tertiary flex-shrink-0">
              Poll
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {dateLabel} · {poll.total_count} {poll.total_count === 1 ? 'item' : 'itens'}
            {!isPending && ` · ${poll.completed_count} concluídos`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-outline/10 text-on-surface-variant">
              Pendente
            </span>
          ) : (
            <span className="text-sm font-bold text-tertiary">{poll.completion_pct}%</span>
          )}
          <span className={`material-symbols-outlined text-base text-on-surface-variant transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 sm:px-4 pb-4 border-t border-outline-variant/20 pt-3">
          {isPending ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-semibold mb-2">
                Itens do poll
              </p>
              {poll.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm text-outline">radio_button_unchecked</span>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-semibold mb-3">
                Resultado da votação
              </p>
              <PollResult poll={poll} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MonthGroup ───────────────────────────────────────────────────────────────

interface MonthGroupData {
  key: string
  label: string
  date: Date
  items: FeedItem[]
}

// ─── TabButton ────────────────────────────────────────────────────────────────

const TabButton: React.FC<{
  active: boolean; onClick: () => void; icon: string; label: string
  count?: number; countColor?: string
}> = ({ active, onClick, icon, label, count, countColor }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
      active ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
    }`}
  >
    <span className="material-symbols-outlined text-base">{icon}</span>
    {label}
    {count !== undefined && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countColor}`}>{count}</span>
    )}
  </button>
)

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
    <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">{icon}</span>
    <h3 className="text-base font-semibold text-on-surface mb-2">{title}</h3>
    <p className="text-sm text-on-surface-variant">{description}</p>
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────

const Notificacoes: React.FC = () => {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [upcoming, setUpcoming] = useState<FeedItem[]>([])
  const [history, setHistory] = useState<FeedItem[]>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  const fetchUpcoming = useCallback(async () => {
    try {
      setLoadingUpcoming(true)
      const [bills, polls] = await Promise.allSettled([
        notificationsApi.listEnriched({ upcoming: true }),
        checklistsApi.polls({ upcoming: true }),
      ])

      const billItems: FeedItem[] = bills.status === 'fulfilled'
        ? bills.value.map((d) => ({ kind: 'bill' as const, data: d }))
        : []
      const pollItems: FeedItem[] = polls.status === 'fulfilled'
        ? polls.value.map((d) => ({ kind: 'checklist' as const, data: d }))
        : []

      const merged = [...billItems, ...pollItems].sort((a, b) => {
        const dateA = a.kind === 'bill' ? a.data.scheduled_for : a.data.poll_date
        const dateB = b.kind === 'bill' ? b.data.scheduled_for : b.data.poll_date
        return dateA.localeCompare(dateB)
      })
      setUpcoming(merged)
    } catch {
      showError('Erro ao carregar próximos envios.')
    } finally {
      setLoadingUpcoming(false)
    }
  }, [showError])

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true)
      const [bills, polls] = await Promise.allSettled([
        notificationsApi.listEnriched({ history: true }),
        checklistsApi.polls({ history: true }),
      ])

      const billItems: FeedItem[] = bills.status === 'fulfilled'
        ? bills.value.map((d) => ({ kind: 'bill' as const, data: d }))
        : []
      const pollItems: FeedItem[] = polls.status === 'fulfilled'
        ? polls.value.map((d) => ({ kind: 'checklist' as const, data: d }))
        : []

      const merged = [...billItems, ...pollItems].sort((a, b) => {
        const dateA = a.kind === 'bill' ? a.data.scheduled_for : a.data.poll_date
        const dateB = b.kind === 'bill' ? b.data.scheduled_for : b.data.poll_date
        return dateB.localeCompare(dateA)
      })
      setHistory(merged)
    } catch {
      showError('Erro ao carregar histórico.')
    } finally {
      setLoadingHistory(false)
    }
  }, [showError])

  useEffect(() => {
    fetchUpcoming()
    fetchHistory()
  }, [fetchUpcoming, fetchHistory])

  const handleResend = useCallback(async (id: string) => {
    setResendingId(id)
    try {
      const { result } = await notificationsApi.resend(id)
      if (result === 'sent') {
        success('Notificação enviada com sucesso!')
      } else if (result === 'skipped') {
        success('Conta já paga — lembrete ignorado.')
      } else {
        showError('Falha ao enviar. Verifique a conexão WAHA.')
      }
      await Promise.all([fetchUpcoming(), fetchHistory()])
    } catch (err: any) {
      showError(err.response?.data?.error ?? 'Erro ao enviar notificação.')
    } finally {
      setResendingId(null)
    }
  }, [fetchUpcoming, fetchHistory, success, showError])

  const handleCancel = useCallback(async (id: string) => {
    setCancellingId(id)
    try {
      await notificationsApi.cancel(id)
      setUpcoming((prev) => prev.filter((item) => {
        if (item.kind === 'bill') return item.data.id !== id
        return true
      }))
      setExpandedId(null)
      setConfirmCancelId(null)
      success('Lembrete cancelado.')
    } catch (err: any) {
      showError(err.response?.data?.error ?? 'Erro ao cancelar notificação.')
    } finally {
      setCancellingId(null)
    }
  }, [success, showError])

  // Filtrar histórico: filtros de status aplicam-se apenas a bills; polls sempre aparecem
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history
    return history.filter((item) => {
      if (item.kind === 'checklist') return true
      return item.data.status === historyFilter
    })
  }, [history, historyFilter])

  // Agrupar histórico por mês
  const monthGroups = useMemo<MonthGroupData[]>(() => {
    const groups: Record<string, MonthGroupData> = {}
    filteredHistory.forEach((item) => {
      const rawDate = item.kind === 'bill' ? item.data.scheduled_for : item.data.poll_date
      const d = rawDate.length === 10 ? new Date(rawDate + 'T00:00:00') : parseISO(rawDate)
      const key = format(d, 'yyyy-MM')
      if (!groups[key]) {
        groups[key] = {
          key,
          label: format(startOfMonth(d), "MMMM yyyy", { locale: ptBR }),
          date: startOfMonth(d),
          items: [],
        }
      }
      groups[key].items.push(item)
    })
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [filteredHistory])

  const upcomingCount = upcoming.length
  const failedCount = history.filter((i) => i.kind === 'bill' && i.data.status === 'failed').length

  const renderFeedItem = (item: FeedItem) => {
    const id = item.kind === 'bill' ? item.data.id : item.data.id
    const isExpanded = expandedId === id

    if (item.kind === 'bill') {
      return (
        <BillFeedRow
          key={id}
          notif={item.data}
          isExpanded={isExpanded}
          onToggle={() => setExpandedId(isExpanded ? null : id)}
          isResending={resendingId === id}
          onResend={() => handleResend(id)}
          isCancelling={cancellingId === id}
          confirmingCancel={confirmCancelId === id}
          onCancelRequest={() => setConfirmCancelId(id)}
          onCancelConfirm={() => handleCancel(id)}
          onCancelAbort={() => setConfirmCancelId(null)}
          onSendNow={() => handleResend(id)}
        />
      )
    }

    return (
      <ChecklistFeedRow
        key={id}
        poll={item.data}
        isExpanded={isExpanded}
        onToggle={() => setExpandedId(isExpanded ? null : id)}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-on-surface">Notificações WhatsApp</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Lembretes de contas e polls de checklist
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container rounded-xl w-fit">
        <TabButton
          active={tab === 'upcoming'}
          onClick={() => setTab('upcoming')}
          icon="schedule_send"
          label="Próximos"
          count={upcomingCount > 0 ? upcomingCount : undefined}
          countColor="bg-primary text-on-primary-fixed"
        />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          icon="history"
          label="Histórico"
          count={failedCount > 0 ? failedCount : undefined}
          countColor="bg-error text-white"
        />
      </div>

      {/* Tab: Próximos */}
      {tab === 'upcoming' && (
        <div className="space-y-2">
          {loadingUpcoming ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="notifications_off"
              title="Nenhum envio agendado"
              description="Notificações são geradas automaticamente conforme as contas se aproximam do vencimento."
            />
          ) : (
            <>
              <p className="text-xs text-on-surface-variant">
                {upcomingCount} {upcomingCount === 1 ? 'envio agendado' : 'envios agendados'}
              </p>
              {upcoming.map(renderFeedItem)}
            </>
          )}
        </div>
      )}

      {/* Tab: Histórico */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filter chips — aplicam-se apenas a lembretes de contas */}
          <div className="flex flex-wrap gap-2">
            {historyFilters.map((f) => {
              const count = f.value === 'all'
                ? history.filter((i) => i.kind === 'bill').length
                : history.filter((i) => i.kind === 'bill' && i.data.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setHistoryFilter(f.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 min-h-[44px] ${
                    historyFilter === f.value
                      ? 'bg-primary text-on-primary-fixed shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      historyFilter === f.value ? 'bg-white/20 text-white' : 'bg-outline/15 text-on-surface-variant'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {loadingHistory ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-5 shimmer-bg rounded w-28 mb-3" />
                  {Array.from({ length: 3 }).map((_, j) => <SkeletonRow key={j} />)}
                </div>
              ))}
            </div>
          ) : monthGroups.length === 0 ? (
            <EmptyState
              icon="mark_email_unread"
              title="Nenhum envio encontrado"
              description={historyFilter === 'all'
                ? 'Ainda não há histórico de envios.'
                : `Nenhum lembrete com status "${historyFilters.find((f) => f.value === historyFilter)?.label}".`
              }
            />
          ) : (
            <div className="space-y-8">
              {monthGroups.map((group) => {
                const billsSent = group.items.filter((i) => i.kind === 'bill' && i.data.status === 'sent').length
                const billsFailed = group.items.filter((i) => i.kind === 'bill' && i.data.status === 'failed').length
                const pollsCount = group.items.filter((i) => i.kind === 'checklist').length
                return (
                  <div key={group.key}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-on-surface capitalize">{group.label}</h3>
                      <div className="flex items-center gap-3 text-xs">
                        {billsSent > 0 && (
                          <span className="text-tertiary font-semibold">{billsSent} enviado{billsSent > 1 ? 's' : ''}</span>
                        )}
                        {billsFailed > 0 && (
                          <span className="text-error font-semibold">{billsFailed} falha{billsFailed > 1 ? 's' : ''}</span>
                        )}
                        {pollsCount > 0 && (
                          <span className="text-on-surface-variant font-semibold">{pollsCount} poll{pollsCount > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.items.map(renderFeedItem)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Notificacoes
```

- [ ] **Passo 2: Verificar build**

```bash
npm run build 2>&1 | grep -E "error TS|✓"
```
Esperado: sem erros TypeScript. O aviso de chunk size pode aparecer — é normal.

- [ ] **Passo 3: Verificar em dev que a página carrega sem erro de console**

```bash
npm run dev
```
Abrir http://localhost:5173/notificacoes. Verificar que a página renderiza sem erros no console.

- [ ] **Passo 4: Commit final**

```bash
git add src/pages/Notificacoes.tsx
git commit -m "feat(ui): redesign notifications as WhatsApp hub with inline message preview and poll results"
```

---

## Verificação de Integração

Após todos os streams completos:

- [ ] **Build completo**

```bash
npm run build 2>&1 | tail -5
cd backend && npm run build 2>&1 | tail -5
```
Esperado: ambos sem erros TypeScript.

- [ ] **Push**

```bash
git push
```
