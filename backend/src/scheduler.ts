// backend/src/scheduler.ts
import cron from 'node-cron'
import pool from './db'
import { runDispatchForUser } from './dispatcher'
import { materializeForUser, getTodaySaoPaulo } from './services/notificationMaterializer'

function getCurrentHourSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const hourPart = parts.find(p => p.type === 'hour')
  return parseInt(hourPart?.value ?? '0', 10)
}

export async function initScheduler(): Promise<void> {
  cron.schedule('0 * * * *', async () => {
    const hour = getCurrentHourSaoPaulo()
    const today = getTodaySaoPaulo()
    console.log(`[scheduler] tick ${String(hour).padStart(2, '0')}h (${today} BRT)`)

    try {
      const [users]: any = await pool.query(
        `SELECT id FROM users
         WHERE notification_time = ? AND whatsapp_alerts_enabled = 1 AND is_active = 1`,
        [hour]
      )

      if (!users.length) {
        console.log(`[scheduler] nenhum usuário com notification_time=${hour}`)
        return
      }

      console.log(`[scheduler] ${users.length} usuário(s) elegível(eis) para envio`)

      for (const { id: userId } of users) {
        try {
          await materializeForUser(userId, today)
          await runDispatchForUser(userId)
        } catch (err: any) {
          console.error(`[scheduler] erro ao processar usuário ${userId}:`, err.message)
        }
      }
    } catch (err: any) {
      console.error('[scheduler] erro no tick horário:', err.message)
    }
  }, { timezone: 'America/Sao_Paulo' })

  console.log('[scheduler] cron horário registrado (timezone America/Sao_Paulo)')
}
