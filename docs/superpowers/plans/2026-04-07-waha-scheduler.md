# WAHA Scheduler & Notification Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o n8n por um cron job interno no backend que envia notificações WhatsApp diariamente no horário configurado pelo usuário, e persistir as preferências de notificação que hoje ficam apenas em estado local no frontend.

**Architecture:** Um módulo `dispatcher.ts` encapsula toda a lógica de busca/formatação/envio. Um módulo `scheduler.ts` gerencia o job cron com `node-cron`, lendo o horário do banco e expondo `reloadSchedule()` para recarga dinâmica ao salvar configurações. O frontend passa a inicializar os toggles com os valores reais do banco e salva via `PATCH /users/me`.

**Tech Stack:** Node.js + Express + TypeScript + node-cron + axios (WAHA) + MySQL2 · React + TypeScript (frontend)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `database/migrations/002_add_notification_time.sql` | Criar | Adiciona coluna `notification_time` na tabela `users` |
| `backend/src/dispatcher.ts` | Criar | Busca notificações do dia, monta mensagem, envia via WAHA, atualiza status |
| `backend/src/scheduler.ts` | Criar | Gerencia o job cron; expõe `initScheduler` e `reloadSchedule` |
| `backend/src/routes/users.ts` | Modificar | Salva campos de preferência + chama `reloadSchedule()` |
| `backend/src/routes/notifications.ts` | Modificar | Adiciona endpoint `POST /dispatch` |
| `backend/src/index.ts` | Modificar | Chama `initScheduler()` após server start |
| `src/types/index.ts` | Modificar | Adiciona campos de preferência ao tipo `User` |
| `src/api/notifications.ts` | Modificar | Adiciona método `dispatch()` |
| `src/pages/Configuracoes.tsx` | Modificar | UI real: carrega do banco, select de horário, botão dispatch |

---

## Task 1: Migração do banco de dados

**Files:**
- Create: `database/migrations/002_add_notification_time.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- database/migrations/002_add_notification_time.sql
ALTER TABLE users
  ADD COLUMN notification_time TINYINT UNSIGNED NOT NULL DEFAULT 8
  COMMENT 'Hora do dia para envio de notificações (7,8,9,10,12,18) em America/Sao_Paulo';
```

- [ ] **Step 2: Executar a migração no banco**

```bash
# Ajuste as credenciais conforme seu .env
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/migrations/002_add_notification_time.sql
```

Resultado esperado: sem erros. Verifique:
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESCRIBE users;" | grep notification_time
```
Esperado: linha com `notification_time | tinyint unsigned | NO | | 8 |`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/002_add_notification_time.sql
git commit -m "feat(db): add notification_time column to users"
```

---

## Task 2: Instalar node-cron

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Instalar dependências**

```bash
cd backend
npm install node-cron
npm install --save-dev @types/node-cron
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "const cron = require('node-cron'); console.log('ok', cron.validate('0 8 * * *'))"
```
Esperado: `ok true`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add node-cron dependency"
```

---

## Task 3: Criar `dispatcher.ts`

**Files:**
- Create: `backend/src/dispatcher.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// backend/src/dispatcher.ts
import pool from './db'
import axios from 'axios'

function wahaClient() {
  return axios.create({
    baseURL: process.env.WAHA_URL || 'http://localhost:3000',
    headers: {
      'X-Api-Key': process.env.WAHA_API_KEY || '',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
}

function buildRelativeDate(dueDate: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  if (diffDays > 1) return `em ${diffDays} dias`
  if (diffDays === -1) return 'venceu ontem'
  return `venceu há ${Math.abs(diffDays)} dias`
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildPaymentSection(pm: any): string {
  if (!pm) return ''
  if (pm.type === 'pix') {
    const keyTypeLabel: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
    }
    const label = keyTypeLabel[pm.pix_key_type] ?? pm.pix_key_type
    const beneficiary = pm.pix_beneficiary ? `\nFavorecido: ${pm.pix_beneficiary}` : ''
    return `\n💳 *Pagamento:*\nPIX — ${label}: ${pm.pix_key}${beneficiary}`
  }
  if (pm.type === 'boleto') {
    return `\n💳 *Pagamento:*\nBoleto:\n${pm.boleto_code}`
  }
  return ''
}

function buildMessage(billName: string, amount: number, dueDate: string, pm: any): string {
  const due = new Date(dueDate)
  const dueFmt = due.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const relative = buildRelativeDate(dueDate)
  const paymentSection = buildPaymentSection(pm)

  return (
    `📅 *Lembrete de Vencimento — BillSync*\n\n` +
    `Conta: *${billName}*\n` +
    `Valor: R$ ${formatAmount(amount)}\n` +
    `Vencimento: *${relative} (${dueFmt})*` +
    paymentSection +
    `\n\nResponda *PAGO* para confirmar o pagamento.`
  )
}

export async function runDispatch(): Promise<{ sent: number; failed: number; skipped: number }> {
  const stats = { sent: 0, failed: 0, skipped: 0 }

  // 1. Buscar usuário (número WhatsApp)
  const [userRows]: any = await pool.query('SELECT whatsapp_number FROM users LIMIT 1')
  if (!userRows.length || !userRows[0].whatsapp_number) {
    console.warn('[dispatcher] nenhum usuário com WhatsApp configurado, abortando')
    return stats
  }
  const rawNumber: string = userRows[0].whatsapp_number
  const digits = rawNumber.replace(/\D/g, '')
  if (digits.length < 10) {
    console.warn('[dispatcher] número WhatsApp inválido:', rawNumber)
    return stats
  }
  const chatId = `${digits}@c.us`

  // 2. Verificar sessão WAHA
  const session = process.env.WAHA_SESSION || 'default'
  try {
    const { data: sessionData } = await wahaClient().get(`/api/sessions/${session}`)
    if (sessionData.status !== 'WORKING') {
      console.warn('[dispatcher] sessão WAHA não está ativa:', sessionData.status)
      // Marcar todas as notificações do dia como failed
      await pool.query(
        `UPDATE notifications SET status='failed', error_detail='Sessão WAHA inativa'
         WHERE status='scheduled' AND DATE(scheduled_for) = DATE(NOW())`
      )
      const [countRows]: any = await pool.query(
        `SELECT COUNT(*) as total FROM notifications WHERE status='failed' AND DATE(updated_at) = DATE(NOW())`
      )
      stats.failed = countRows[0]?.total ?? 0
      return stats
    }
  } catch (err: any) {
    console.error('[dispatcher] erro ao verificar sessão WAHA:', err.message)
    await pool.query(
      `UPDATE notifications SET status='failed', error_detail=?
       WHERE status='scheduled' AND DATE(scheduled_for) = DATE(NOW())`,
      [`Erro ao verificar sessão WAHA: ${err.message}`]
    )
    return stats
  }

  // 3. Buscar notificações agendadas para hoje
  const [notifications]: any = await pool.query(
    `SELECT n.id, n.bill_occurrence_id, n.type,
            o.due_date, o.amount, o.status AS occurrence_status,
            b.name AS bill_name,
            pm.type AS pm_type, pm.pix_key_type, pm.pix_key, pm.pix_beneficiary, pm.boleto_code
     FROM notifications n
     JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
     JOIN bills b ON b.id = o.bill_id
     LEFT JOIN payment_methods pm ON pm.bill_id = b.id AND pm.is_primary = 1
     WHERE n.status = 'scheduled' AND DATE(n.scheduled_for) = DATE(NOW())`
  )

  if (!notifications.length) {
    console.log('[dispatcher] nenhuma notificação agendada para hoje')
    return stats
  }

  console.log(`[dispatcher] ${notifications.length} notificação(ões) para processar`)

  // 4. Processar cada notificação
  for (const notif of notifications) {
    // Pular se ocorrência já foi paga/cancelada
    if (notif.occurrence_status === 'paid' || notif.occurrence_status === 'cancelled') {
      await pool.query(
        `UPDATE notifications SET status='skipped' WHERE id=?`,
        [notif.id]
      )
      stats.skipped++
      continue
    }

    const pm = notif.pm_type
      ? { type: notif.pm_type, pix_key_type: notif.pix_key_type, pix_key: notif.pix_key,
          pix_beneficiary: notif.pix_beneficiary, boleto_code: notif.boleto_code }
      : null

    const messageBody = buildMessage(notif.bill_name, notif.amount, notif.due_date, pm)

    try {
      const { data: msgData } = await wahaClient().post('/api/sendText', {
        session,
        chatId,
        text: messageBody,
      })

      const wahaMessageId = msgData.id ?? msgData.key?.id ?? null
      await pool.query(
        `UPDATE notifications SET status='sent', sent_at=NOW(), waha_message_id=?, message_body=? WHERE id=?`,
        [wahaMessageId, messageBody, notif.id]
      )
      stats.sent++
      console.log(`[dispatcher] ✓ enviado: ${notif.bill_name} (${notif.id})`)
    } catch (err: any) {
      const detail = err.response?.data?.message ?? err.response?.data?.error ?? err.message
      await pool.query(
        `UPDATE notifications SET status='failed', error_detail=? WHERE id=?`,
        [detail, notif.id]
      )
      stats.failed++
      console.error(`[dispatcher] ✗ falha: ${notif.bill_name} (${notif.id}):`, detail)
    }
  }

  console.log(`[dispatcher] concluído — enviadas: ${stats.sent}, falhas: ${stats.failed}, ignoradas: ${stats.skipped}`)
  return stats
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend
npx tsc --noEmit
```
Esperado: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add backend/src/dispatcher.ts
git commit -m "feat(backend): add notification dispatcher"
```

---

## Task 4: Criar `scheduler.ts`

**Files:**
- Create: `backend/src/scheduler.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// backend/src/scheduler.ts
import cron, { ScheduledTask } from 'node-cron'
import pool from './db'
import { runDispatch } from './dispatcher'

let activeTask: ScheduledTask | null = null

async function loadConfig(): Promise<{ notificationTime: number; alertsEnabled: boolean }> {
  const [rows]: any = await pool.query(
    'SELECT notification_time, whatsapp_alerts_enabled FROM users LIMIT 1'
  )
  if (!rows.length) return { notificationTime: 8, alertsEnabled: false }
  return {
    notificationTime: rows[0].notification_time ?? 8,
    alertsEnabled: Boolean(rows[0].whatsapp_alerts_enabled),
  }
}

function cancelActive() {
  if (activeTask) {
    activeTask.stop()
    activeTask = null
    console.log('[scheduler] job cancelado')
  }
}

function scheduleJob(hour: number) {
  const expression = `0 ${hour} * * *`
  activeTask = cron.schedule(expression, async () => {
    console.log(`[scheduler] disparando envio de notificações (${hour}h)`)
    try {
      await runDispatch()
    } catch (err: any) {
      console.error('[scheduler] erro no dispatch:', err.message)
    }
  }, { timezone: 'America/Sao_Paulo' })
  console.log(`[scheduler] job agendado para ${String(hour).padStart(2, '0')}:00`)
}

export async function initScheduler(): Promise<void> {
  try {
    const { notificationTime, alertsEnabled } = await loadConfig()
    if (!alertsEnabled) {
      console.log('[scheduler] alertas WhatsApp desabilitados, job não iniciado')
      return
    }
    scheduleJob(notificationTime)
  } catch (err: any) {
    console.error('[scheduler] erro ao inicializar:', err.message)
  }
}

export async function reloadSchedule(): Promise<void> {
  cancelActive()
  try {
    const { notificationTime, alertsEnabled } = await loadConfig()
    if (!alertsEnabled) {
      console.log('[scheduler] alertas desabilitados, job não reagendado')
      return
    }
    scheduleJob(notificationTime)
  } catch (err: any) {
    console.error('[scheduler] erro ao recarregar schedule:', err.message)
  }
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scheduler.ts
git commit -m "feat(backend): add cron scheduler with dynamic reload"
```

---

## Task 5: Atualizar `users.ts` — salvar preferências + reloadSchedule

**Files:**
- Modify: `backend/src/routes/users.ts`

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```typescript
// backend/src/routes/users.ts
import { Router, Request, Response } from 'express'
import pool from '../db'
import { reloadSchedule } from '../scheduler'

const router = Router()

// GET /api/users/me — retorna o primeiro usuário (single-tenant)
router.get('/me', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM users LIMIT 1')
    if (!rows.length) {
      return res.json({
        id: '00000000-0000-0000-0000-000000000001',
        name: null,
        whatsapp_number: '',
        timezone: 'America/Sao_Paulo',
        is_active: true,
        whatsapp_alerts_enabled: true,
        weekly_summary_enabled: false,
        default_days_before_alert: 3,
        notification_time: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/users/me
router.patch('/me', async (req: Request, res: Response) => {
  try {
    const allowed = [
      'name',
      'whatsapp_number',
      'timezone',
      'is_active',
      'whatsapp_alerts_enabled',
      'weekly_summary_enabled',
      'default_days_before_alert',
      'notification_time',
    ]
    const fields: string[] = []
    const values: any[] = []

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }

    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(new Date())
      await pool.query(`UPDATE users SET ${fields.join(', ')} LIMIT 1`, values)
    }

    const [rows]: any = await pool.query('SELECT * FROM users LIMIT 1')

    // Recarregar o scheduler se preferências de notificação foram alteradas
    const notifFields = ['whatsapp_alerts_enabled', 'notification_time']
    const hasNotifChange = notifFields.some((f) => req.body[f] !== undefined)
    if (hasNotifChange) {
      reloadSchedule().catch((err) =>
        console.error('[users] erro ao recarregar schedule:', err.message)
      )
    }

    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Testar endpoint manualmente**

```bash
# Salvar preferências (ajuste a URL se necessário)
curl -s -X PATCH http://localhost:4000/api/users/me \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_alerts_enabled": true, "notification_time": 9, "default_days_before_alert": 3}' | jq .
```
Esperado: objeto do usuário com os campos atualizados. Console do backend exibe `[scheduler] job agendado para 09:00`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/users.ts
git commit -m "feat(backend): persist notification preferences and reload scheduler on save"
```

---

## Task 6: Atualizar `notifications.ts` — endpoint `/dispatch`

**Files:**
- Modify: `backend/src/routes/notifications.ts`

- [ ] **Step 1: Adicionar o endpoint `POST /dispatch` ao final do arquivo, antes de `export default router`**

Abrir `backend/src/routes/notifications.ts` e adicionar após o último router.patch existente (linha ~78), antes da linha `export default router`:

```typescript
import { runDispatch } from '../dispatcher'

// POST /api/notifications/dispatch
// Dispara o envio das notificações do dia imediatamente (manual/debug).
router.post('/dispatch', async (_req: Request, res: Response) => {
  try {
    const result = await runDispatch()
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
```

**Atenção:** o import de `runDispatch` deve ser adicionado no topo do arquivo, junto aos outros imports.

- [ ] **Step 2: Verificar compilação**

```bash
cd backend
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Testar endpoint manualmente**

```bash
curl -s -X POST http://localhost:4000/api/notifications/dispatch | jq .
```
Esperado: `{ "sent": N, "failed": N, "skipped": N }` (valores dependem das notificações do dia).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/notifications.ts
git commit -m "feat(backend): add POST /notifications/dispatch endpoint"
```

---

## Task 7: Atualizar `index.ts` — inicializar scheduler

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Adicionar import e chamada do `initScheduler`**

No topo do arquivo, junto aos outros imports, adicionar:
```typescript
import { initScheduler } from './scheduler'
```

Dentro do callback do `app.listen(...)`, após os `console.log` existentes, adicionar:
```typescript
  initScheduler()
```

O bloco final ficará assim:
```typescript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] running on port ${PORT}`)
  console.log(`[backend] DB_HOST=${process.env.DB_HOST || 'não definido'}`)
  console.log(`[backend] DB_NAME=${process.env.DB_NAME || 'não definido'}`)
  console.log(`[backend] DB_USER=${process.env.DB_USER || 'não definido'}`)
  console.log(`[backend] DB_PASSWORD=${process.env.DB_PASSWORD ? '***definido***' : 'não definido'}`)
  initScheduler()
})
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Reiniciar o servidor e verificar log**

```bash
cd backend
npm run dev
```
Esperado no console: `[scheduler] job agendado para 08:00` (ou o horário salvo no banco, ou `alertas WhatsApp desabilitados` se estiver desabilitado).

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat(backend): initialize cron scheduler on server start"
```

---

## Task 8: Frontend — atualizar tipo `User` e API

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/notifications.ts`

- [ ] **Step 1: Atualizar `src/types/index.ts` — adicionar campos ao tipo `User`**

Substituir a interface `User` existente (linhas 65-73) por:

```typescript
export interface User {
  id: string
  name?: string
  whatsapp_number: string
  timezone: string
  is_active: boolean
  whatsapp_alerts_enabled: boolean
  weekly_summary_enabled: boolean
  default_days_before_alert: number
  notification_time: number
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Adicionar método `dispatch` em `src/api/notifications.ts`**

No objeto `notificationsApi`, adicionar após o método `testMessage`:

```typescript
  dispatch: async (): Promise<{ sent: number; failed: number; skipped: number }> => {
    const res = await client.post<{ sent: number; failed: number; skipped: number }>('/notifications/dispatch')
    return res.data
  },
```

- [ ] **Step 3: Verificar compilação do frontend**

```bash
cd /home/andre/Projetos/pessoal/daily
npx tsc --noEmit
```
Esperado: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/notifications.ts
git commit -m "feat(frontend): add notification preferences to User type and dispatch API method"
```

---

## Task 9: Frontend — atualizar `Configuracoes.tsx`

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

- [ ] **Step 1: Substituir o conteúdo completo de `Configuracoes.tsx`**

```typescript
import React, { useCallback, useEffect, useState } from 'react'
import client from '../api/client'
import { notificationsApi } from '../api/notifications'
import type { User } from '../types'
import { useToast } from '../context/ToastContext'

const NOTIFICATION_HOURS = [7, 8, 9, 10, 12, 18]

interface NotificationSettings {
  whatsapp_alerts: boolean
  weekly_summary: boolean
  days_before: number
  notification_time: number
}

const APP_VERSION = '1.0.0'

const Configuracoes: React.FC = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileWhatsapp, setProfileWhatsapp] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    whatsapp_alerts: true,
    weekly_summary: false,
    days_before: 3,
    notification_time: 8,
  })
  const [savingNotif, setSavingNotif] = useState(false)

  const [wahaStatus, setWahaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [reconnecting, setReconnecting] = useState(false)

  const [testingMessage, setTestingMessage] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null)

  const { success, error: showError } = useToast()

  const fetchUser = useCallback(async () => {
    try {
      setLoadingUser(true)
      const res = await client.get<User>('/users/me')
      const u = res.data
      setUser(u)
      setProfileName(u.name ?? '')
      setProfileWhatsapp(u.whatsapp_number)
      setNotifSettings({
        whatsapp_alerts: u.whatsapp_alerts_enabled ?? true,
        weekly_summary: u.weekly_summary_enabled ?? false,
        days_before: u.default_days_before_alert ?? 3,
        notification_time: u.notification_time ?? 8,
      })
    } catch {
      const placeholder: User = {
        id: '1',
        name: 'Usuário',
        whatsapp_number: '+55 (11) 99999-9999',
        timezone: 'America/Sao_Paulo',
        is_active: true,
        whatsapp_alerts_enabled: true,
        weekly_summary_enabled: false,
        default_days_before_alert: 3,
        notification_time: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setUser(placeholder)
      setProfileName(placeholder.name ?? '')
      setProfileWhatsapp(placeholder.whatsapp_number)
    } finally {
      setLoadingUser(false)
    }
  }, [])

  const fetchWahaStatus = useCallback(async () => {
    try {
      const res = await notificationsApi.getWahaStatus()
      setWahaStatus(res.connected ? 'connected' : 'disconnected')
    } catch {
      setWahaStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    fetchUser()
    fetchWahaStatus()
  }, [fetchUser, fetchWahaStatus])

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return
    setSavingProfile(true)
    try {
      await client.patch('/users/me', {
        name: profileName.trim(),
        whatsapp_number: profileWhatsapp.trim(),
      })
      setUser((prev) =>
        prev ? { ...prev, name: profileName.trim(), whatsapp_number: profileWhatsapp.trim() } : prev
      )
      setEditingProfile(false)
      success('Perfil atualizado!')
    } catch {
      showError('Erro ao atualizar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSavingNotif(true)
    try {
      await client.patch('/users/me', {
        whatsapp_alerts_enabled: notifSettings.whatsapp_alerts,
        weekly_summary_enabled: notifSettings.weekly_summary,
        default_days_before_alert: notifSettings.days_before,
        notification_time: notifSettings.notification_time,
      })
      success('Configurações salvas!')
    } catch {
      showError('Erro ao salvar configurações.')
    } finally {
      setSavingNotif(false)
    }
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await notificationsApi.reconnectWaha()
      await fetchWahaStatus()
      success('Reconexão iniciada!')
    } catch {
      showError('Erro ao reconectar WAHA.')
    } finally {
      setReconnecting(false)
    }
  }

  const handleTestMessage = async () => {
    setTestingMessage(true)
    setTestResult(null)
    try {
      const result = await notificationsApi.testMessage()
      if (result.success) {
        setTestResult({ success: true, message: `Mensagem enviada com sucesso para ${result.to}!` })
      } else {
        setTestResult({ success: false, message: result.error ?? 'Erro desconhecido.' })
      }
    } catch (err: any) {
      const detail = err.response?.data?.error ?? err.message ?? 'Erro de conexão.'
      setTestResult({ success: false, message: detail })
    } finally {
      setTestingMessage(false)
    }
  }

  const handleDispatch = async () => {
    setDispatching(true)
    setDispatchResult(null)
    try {
      const result = await notificationsApi.dispatch()
      setDispatchResult(result)
    } catch (err: any) {
      const detail = err.response?.data?.error ?? err.message ?? 'Erro de conexão.'
      setTestResult({ success: false, message: detail })
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-12 gap-6">
        {/* Left column */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Profile Card */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                <h3 className="text-base font-semibold text-on-surface">Perfil</h3>
              </div>
              {!editingProfile && (
                <button onClick={() => setEditingProfile(true)} className="btn-ghost text-xs">
                  <span className="material-symbols-outlined text-base">edit</span>
                  Editar Perfil
                </button>
              )}
            </div>

            {loadingUser ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 shimmer-bg rounded-xl" />
                ))}
              </div>
            ) : editingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Nome</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    type="text"
                    value={profileWhatsapp}
                    onChange={(e) => setProfileWhatsapp(e.target.value)}
                    className="input-field"
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary">
                    {savingProfile && (
                      <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                    )}
                    Salvar
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="btn-ghost">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ProfileField icon="badge" label="Nome" value={user?.name ?? 'Não definido'} />
                <ProfileField icon="chat" label="WhatsApp" value={user?.whatsapp_number ?? '-'} />
                <ProfileField icon="schedule" label="Fuso Horário" value={user?.timezone ?? 'America/Sao_Paulo'} />
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Notifications Card */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-primary">notifications</span>
              <h3 className="text-base font-semibold text-on-surface">Notificações</h3>
            </div>

            <div className="space-y-4">
              <ToggleRow
                label="Alertas WhatsApp"
                description="Receber alertas de vencimento"
                checked={notifSettings.whatsapp_alerts}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, whatsapp_alerts: v }))}
              />
              <ToggleRow
                label="Resumo Semanal"
                description="Receber resumo toda segunda"
                checked={notifSettings.weekly_summary}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, weekly_summary: v }))}
              />

              <div className="pt-2 border-t border-outline-variant/30 space-y-3">
                <div>
                  <label className="label">Dias de antecedência</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNotifSettings((p) => ({ ...p, days_before: Math.max(0, p.days_before - 1) }))
                      }
                      className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <span className="w-10 text-center text-base font-semibold text-on-surface">
                      {notifSettings.days_before}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifSettings((p) => ({ ...p, days_before: Math.min(30, p.days_before + 1) }))
                      }
                      className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>

                {notifSettings.whatsapp_alerts && (
                  <div>
                    <label className="label">Horário de envio</label>
                    <select
                      value={notifSettings.notification_time}
                      onChange={(e) =>
                        setNotifSettings((p) => ({ ...p, notification_time: Number(e.target.value) }))
                      }
                      className="input-field mt-1"
                    >
                      {NOTIFICATION_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="btn-primary w-full justify-center mt-2"
              >
                {savingNotif ? (
                  <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Salvar
              </button>
            </div>
          </div>

          {/* Test / Dispatch Card */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">send</span>
                <h3 className="text-base font-semibold text-on-surface">WhatsApp</h3>
              </div>
              {/* Status WAHA */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wahaStatus === 'connected'
                      ? 'bg-tertiary'
                      : wahaStatus === 'disconnected'
                      ? 'bg-error'
                      : 'bg-outline animate-pulse'
                  }`}
                />
                <span className="text-xs text-on-surface-variant">
                  {wahaStatus === 'connected' ? 'Conectado' : wahaStatus === 'disconnected' ? 'Desconectado' : '...'}
                </span>
                {wahaStatus === 'disconnected' && (
                  <button
                    onClick={handleReconnect}
                    disabled={reconnecting}
                    className="btn-ghost text-xs ml-1 py-0.5 px-2"
                  >
                    {reconnecting ? (
                      <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Reconectar'
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Valide a integração enviando uma mensagem de teste, ou dispare manualmente as notificações agendadas para hoje.
            </p>

            <div className="space-y-2">
              <button
                onClick={handleTestMessage}
                disabled={testingMessage}
                className="btn-primary w-full justify-center"
              >
                {testingMessage ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    Mensagem de Teste
                  </>
                )}
              </button>

              <button
                onClick={handleDispatch}
                disabled={dispatching}
                className="btn-ghost w-full justify-center"
              >
                {dispatching ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Disparando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">notifications_active</span>
                    Disparar Notificações de Hoje
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-4 p-3 rounded-xl flex items-start gap-2.5 text-sm ${
                  testResult.success
                    ? 'bg-tertiary/10 border border-tertiary/30 text-tertiary'
                    : 'bg-error-container/30 border border-error/30 text-error'
                }`}
              >
                <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <p className="leading-relaxed">{testResult.message}</p>
              </div>
            )}

            {dispatchResult && (
              <div className="mt-4 p-3 rounded-xl bg-surface-container border border-outline-variant/30 text-sm">
                <p className="text-on-surface font-medium mb-1">Resultado do disparo:</p>
                <p className="text-on-surface-variant">
                  ✅ {dispatchResult.sent} enviadas &nbsp;·&nbsp; ❌ {dispatchResult.failed} falhas &nbsp;·&nbsp; ⏭ {dispatchResult.skipped} ignoradas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center pt-4 border-t border-outline-variant/20">
        <p className="text-xs text-on-surface-variant">
          BillSync v{APP_VERSION} · Gestão de Pagamentos
        </p>
      </div>
    </div>
  )
}

// --- Helper Components ---
interface ProfileFieldProps {
  icon: string
  label: string
  value: string
}

const ProfileField: React.FC<ProfileFieldProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
    <span className="material-symbols-outlined text-on-surface-variant text-lg">{icon}</span>
    <div>
      <p className="text-xs text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-sm font-medium text-on-surface">{value}</p>
    </div>
  </div>
)

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-on-surface">{label}</p>
      <p className="text-xs text-on-surface-variant">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${
        checked ? 'bg-tertiary shadow-[0_0_6px_rgba(74,225,118,0.3)]' : 'bg-outline/30'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
          checked ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  </div>
)

export default Configuracoes
```

- [ ] **Step 2: Verificar compilação do frontend**

```bash
cd /home/andre/Projetos/pessoal/daily
npx tsc --noEmit
```
Esperado: sem erros de tipo.

- [ ] **Step 3: Testar no browser**

Iniciar o frontend (`npm run dev`) e acessar a página Configurações. Verificar:
- Toggles carregam com valores reais do banco
- Select de horário aparece quando "Alertas WhatsApp" está ativo
- Botão Salvar persiste no banco (verificar com `GET /api/users/me`)
- Botão "Disparar Notificações de Hoje" exibe resultado `{ sent, failed, skipped }`
- Status WAHA (bolinha verde/vermelha) aparece corretamente

- [ ] **Step 4: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(frontend): real notification preferences, time selector, dispatch button, WAHA status"
```

---

## Verificação final

- [ ] Backend compila sem erros: `cd backend && npx tsc --noEmit`
- [ ] Frontend compila sem erros: `cd /home/andre/Projetos/pessoal/daily && npx tsc --noEmit`
- [ ] Servidor inicia e exibe `[scheduler] job agendado para 08:00`
- [ ] `PATCH /users/me` com `notification_time: 9` exibe `[scheduler] job agendado para 09:00`
- [ ] `POST /notifications/dispatch` retorna `{ sent, failed, skipped }`
- [ ] UI de Configurações carrega preferências reais e salva corretamente
