// backend/src/scheduler.ts
import cron from 'node-cron'
import pool from './db'
import { runDispatchForUser } from './dispatcher'
import { materializeForUser, getTodaySaoPaulo } from './services/notificationMaterializer'
import { sendPollsForHour } from './services/checklistDispatcher'
import { sendWeeklySummary, sendMonthlySummary } from './services/summaryService'
import { checkBudgetAlert } from './services/budgetAlertService'
import { checkAssetAlerts } from './services/assetAlertService'
import { syncUserAssets } from './services/assetQuoteSync'
import { configureWahaWebhook } from './services/waha'
import { chaveDoTick } from './services/schedulerTick'
import { completarOcorrencias } from './services/occurrenceGenerator'

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

// Reserva o tick da hora na scheduler_ticks. Só quem insere a linha roda: o cron
// e a recuperação do boot podem cair na mesma hora (ou duas instâncias no mesmo
// minuto), e repetir o tick reprocessaria todo mundo.
async function reservarTick(chave: string): Promise<boolean> {
  const [result]: any = await pool.query(
    'INSERT IGNORE INTO scheduler_ticks (tick_key) VALUES (?)',
    [chave]
  )
  return result.affectedRows === 1
}

async function executarTick(origem: 'cron' | 'boot'): Promise<void> {
  const { chave, hora } = chaveDoTick()

  let reservado: boolean
  try {
    reservado = await reservarTick(chave)
  } catch (err: any) {
    // Sem a tabela, o cron segue rodando como antes; a recuperação não arrisca.
    console.error(`[scheduler] erro ao reservar tick ${chave}:`, err.message)
    reservado = origem === 'cron'
  }

  if (!reservado) {
    if (origem === 'cron') console.log(`[scheduler] tick ${chave}h já executado — pulando`)
    return
  }

  if (origem === 'boot') {
    console.log(`[scheduler] tick ${chave}h não rodou (container fora no minuto 0) — recuperando`)
  }

  await runTick(hora)

  try {
    await pool.query('DELETE FROM scheduler_ticks WHERE ran_at < NOW() - INTERVAL 7 DAY')
  } catch (err: any) {
    console.error('[scheduler] erro ao limpar scheduler_ticks:', err.message)
  }
}

export async function initScheduler(): Promise<void> {
  cron.schedule('0 * * * *', () => executarTick('cron'), { timezone: 'America/Sao_Paulo' })
  console.log('[scheduler] cron horário registrado (timezone America/Sao_Paulo)')

  // Deploy ou queda no minuto 0 perdia o tick da hora inteira. Só a hora
  // corrente é recuperada: as funções do tick consultam "agora", não uma data
  // passada. Repetir é seguro — envios passam por message_claims ou pelo claim
  // de notifications.status, e o snapshot é upsert.
  // Completa os vencimentos antes do tick: o lembrete de hoje só sai se a
  // ocorrência existir.
  completarVencimentos()
    .then(() => executarTick('boot'))
    .catch((err: any) =>
      console.error('[scheduler] erro na recuperação do tick:', err.message)
    )
}

async function completarVencimentos(): Promise<void> {
  try {
    const geradas = await completarOcorrencias()
    if (geradas) console.log(`[scheduler] ${geradas} vencimento(s) completado(s)`)
  } catch (err: any) {
    console.error('[scheduler] erro ao completar vencimentos:', err.message)
  }
}

async function runTick(hour: number): Promise<void> {
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

  // --- Vencimentos: uma vez por dia mantém 12 meses à frente ---
  if (hour === 0) await completarVencimentos()

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
        `SELECT id FROM users
          WHERE (monthly_budget_limit IS NOT NULL OR monthly_expense_budget_limit IS NOT NULL) AND is_active = 1`
      )
      for (const { id } of budgetUsers) {
        try { await checkBudgetAlert(id) } catch (e: any) { console.error('[scheduler] budget erro:', e.message) }
      }
    } catch (e: any) { console.error('[scheduler] budget tick erro:', e.message) }
  }

  // --- Ativos: coleta diária de cotação + alerta (hora configurável, default 11h) ---
  // A coleta roda para todo mundo que tem ativo, mesmo com alerta desligado —
  // senão quem desliga alerta fica sem histórico de patrimônio.
  try {
    const [assetUsers]: any = await pool.query(
      `SELECT u.id, u.asset_alerts_enabled, u.whatsapp_alerts_enabled
         FROM users u
        WHERE u.is_active = 1 AND u.asset_alert_hour = ?
          AND EXISTS (SELECT 1 FROM assets a WHERE a.user_id = u.id AND a.is_active = 1)`,
      [hour]
    )
    for (const u of assetUsers) {
      try {
        const synced = await syncUserAssets(u.id)
        if (u.asset_alerts_enabled && u.whatsapp_alerts_enabled) {
          await checkAssetAlerts(u.id, synced)
        }
      } catch (e: any) { console.error('[scheduler] asset erro:', e.message) }
    }
  } catch (e: any) { console.error('[scheduler] asset tick erro:', e.message) }
}
