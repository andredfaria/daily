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
