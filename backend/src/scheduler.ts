// backend/src/scheduler.ts
import cron from 'node-cron'
import pool from './db'
import { runDispatchForUser } from './dispatcher'
import { materializeForUser, getTodaySaoPaulo } from './services/notificationMaterializer'
import { sendPollsForHour } from './services/checklistDispatcher'
import { sendWeeklySummary, sendMonthlySummary } from './services/summaryService'
import { checkBudgetAlert } from './services/budgetAlertService'
import { configureWahaWebhook } from './services/waha'

function getCurrentHourSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const hourPart = parts.find(p => p.type === 'hour')
  return parseInt(hourPart?.value ?? '0', 10) % 24
}

function getCurrentDayOfMonthSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
  }).formatToParts(new Date())
  return parseInt(parts.find(p => p.type === 'day')?.value ?? '1', 10)
}

function getCurrentDayOfWeekSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).formatToParts(new Date())
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  return weekdayMap[weekday] ?? 0
}

export async function initScheduler(): Promise<void> {
  cron.schedule('0 * * * *', async () => {
    const hour = getCurrentHourSaoPaulo()
    const today = getTodaySaoPaulo()
    console.log(`[scheduler] tick ${String(hour).padStart(2, '0')}h (${today} BRT)`)

    // --- Reafirma webhook do WAHA (autocorreção caso a sessão tenha perdido a config) ---
    const backendPublicUrl = process.env.BACKEND_PUBLIC_URL
    if (backendPublicUrl) {
      try {
        await configureWahaWebhook(backendPublicUrl)
      } catch (err: any) {
        console.error('[scheduler] erro ao reafirmar webhook WAHA:', err.message)
      }
    }

    // --- Envio de notificações de contas ---
    try {
      const [users]: any = await pool.query(
        `SELECT id FROM users
         WHERE notification_time = ? AND whatsapp_alerts_enabled = 1 AND is_active = 1`,
        [hour]
      )

      if (users.length) {
        console.log(`[scheduler] ${users.length} usuário(s) elegível(eis) para envio de contas`)
        for (const { id: userId } of users) {
          try {
            await materializeForUser(userId, today)
            await runDispatchForUser(userId)
          } catch (err: any) {
            console.error(`[scheduler] erro ao processar usuário ${userId}:`, err.message)
          }
        }
      }
    } catch (err: any) {
      console.error('[scheduler] erro no tick de contas:', err.message)
    }

    // --- Envio de checklists ---
    try {
      await sendPollsForHour(hour)
    } catch (err: any) {
      console.error('[scheduler] erro no tick de checklists:', err.message)
    }

    // --- Resumo semanal (apenas às 8h BRT) ---
    if (hour === 8) {
      try {
        const dayOfWeek = getCurrentDayOfWeekSaoPaulo()
        const [summaryUsers]: any = await pool.query(
          `SELECT id FROM users WHERE summary_enabled = 1 AND summary_day_of_week = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1`,
          [dayOfWeek]
        )
        for (const { id } of summaryUsers) {
          try { await sendWeeklySummary(id) } catch (e: any) { console.error('[scheduler] summary erro:', e.message) }
        }
      } catch (e: any) { console.error('[scheduler] summary tick erro:', e.message) }
    }

    // --- Sumário mensal (dia 1, 8h BRT) ---
    if (hour === 8 && getCurrentDayOfMonthSaoPaulo() === 1) {
      try {
        const [monthlyUsers]: any = await pool.query(
          `SELECT id FROM users WHERE monthly_summary_enabled = 1 AND is_active = 1 AND whatsapp_alerts_enabled = 1`
        )
        for (const { id } of monthlyUsers) {
          try { await sendMonthlySummary(id) } catch (e: any) { console.error('[scheduler] monthly summary erro:', e.message) }
        }
      } catch (e: any) { console.error('[scheduler] monthly summary tick erro:', e.message) }
    }

    // --- Alerta de orçamento (executa às 9h) ---
    if (hour === 9) {
      try {
        const [budgetUsers]: any = await pool.query(
          `SELECT id FROM users WHERE monthly_budget_limit IS NOT NULL AND is_active = 1`
        )
        for (const { id } of budgetUsers) {
          try { await checkBudgetAlert(id) } catch (e: any) { console.error('[scheduler] budget erro:', e.message) }
        }
      } catch (e: any) { console.error('[scheduler] budget tick erro:', e.message) }
    }
  }, { timezone: 'America/Sao_Paulo' })

  console.log('[scheduler] cron horário registrado (timezone America/Sao_Paulo)')
}
