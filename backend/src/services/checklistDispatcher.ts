import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { sendWhatsAppPoll, sendWhatsAppText, WhatsAppNumberNotFoundError } from './waha'
import { nextMissState, buildInactivityMessage, INACTIVITY_THRESHOLD } from './checklistInactivity'

export function getTodaySaoPaulo(): string {
  // formatToParts garante YYYY-MM-DD independente da versão do ICU/Node
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const p: Record<string, string> = {}
  parts.forEach(({ type, value }) => { p[type] = value })
  return `${p.year}-${p.month}-${p.day}`
}

// Normaliza um valor de data (Date do mysql2 ou string) para YYYY-MM-DD,
// seguindo o padrão já estabelecido em financialAnalytics.ts (topOcorrencias).
function normalizeDate(value: any): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

// Verifica o resultado do poll mais recente já encerrado (poll_date < hoje) e
// atualiza o contador de dias seguidos sem resposta. Se o limiar for atingido,
// pausa apenas este checklist e avisa por WhatsApp na hora.
// A pausa não toca users.is_active de propósito: cortar os lembretes de contas
// de quem só parou de votar no checklist desliga a função principal do app.
// Retorna true se o checklist foi travado agora (o envio de hoje deve ser pulado).
async function applyInactivityCheck(checklistId: string, userId: string, today: string): Promise<boolean> {
  const [lastPollRows]: any = await pool.query(
    'SELECT poll_date, completed_count FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date < ? ORDER BY poll_date DESC LIMIT 1',
    [checklistId, today],
  )
  if (!lastPollRows.length) return false

  const [checklistRows]: any = await pool.query(
    'SELECT name, consecutive_misses, last_miss_poll_date FROM checklists WHERE id = ?',
    [checklistId],
  )
  if (!checklistRows.length) return false

  const lastPollDate = normalizeDate(lastPollRows[0].poll_date)
  const lastMissPollDate = checklistRows[0].last_miss_poll_date
    ? normalizeDate(checklistRows[0].last_miss_poll_date)
    : null

  // Esse poll já foi avaliado (reenvio no mesmo dia após falha, ou nenhum
  // poll novo fechou desde a última avaliação) — não conta de novo.
  if (lastMissPollDate === lastPollDate) return false

  const { misses, shouldLock } = nextMissState(
    Number(checklistRows[0].consecutive_misses),
    Number(lastPollRows[0].completed_count),
    INACTIVITY_THRESHOLD,
  )

  await pool.query(
    'UPDATE checklists SET consecutive_misses = ?, last_miss_poll_date = ? WHERE id = ?',
    [misses, lastPollDate, checklistId],
  )

  if (!shouldLock) return false

  await pool.query('UPDATE checklists SET is_active = 0 WHERE id = ?', [checklistId])
  console.log(`[checklistDispatcher] checklist ${checklistId} pausado por inatividade (${misses} dias sem resposta)`)

  const [userRows]: any = await pool.query('SELECT whatsapp_number FROM users WHERE id = ?', [userId])
  const phone = userRows[0]?.whatsapp_number
  if (phone) {
    try {
      await sendWhatsAppText(phone, buildInactivityMessage(checklistRows[0].name))
    } catch (err: any) {
      // Falhar o aviso não pode desfazer a pausa — o checklist já está pausado
      // e o usuário ainda encontra o botão de reativar na tela.
      console.error(`[checklistDispatcher] erro ao enviar aviso de pausa:`, err.message)
    }
  }

  return true
}

// Restaura checklists que foram travados pela regra de inatividade (is_active=0
// com consecutive_misses >= limiar — único jeito de chegar nesse estado hoje) e
// zera os contadores de todos os checklists do usuário, zerando a sequência de
// faltas de cada um.
export async function reactivateUserChecklists(userId: string): Promise<void> {
  await pool.query(
    'UPDATE checklists SET is_active = 1 WHERE user_id = ? AND is_active = 0 AND consecutive_misses >= ?',
    [userId, INACTIVITY_THRESHOLD],
  )
  await pool.query(
    'UPDATE checklists SET consecutive_misses = 0, last_miss_poll_date = NULL WHERE user_id = ?',
    [userId],
  )
}

export async function sendDailyPoll(
  checklistId: string,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  try {
    const [checklistRows]: any = await pool.query(
      `SELECT c.id, c.name, c.user_id, u.whatsapp_number
       FROM checklists c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ? AND c.is_active = 1 AND u.is_active = 1`,
      [checklistId],
    )
    if (!checklistRows.length) {
      console.log(`[checklistDispatcher] checklist ${checklistId} não encontrado ou inativo`)
      return
    }

    const checklist = checklistRows[0]
    const today = getTodaySaoPaulo()

    if (!opts.force) {
      const [existingRows]: any = await pool.query(
        'SELECT id FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date = ?',
        [checklistId, today],
      )
      if (existingRows.length) {
        console.log(`[checklistDispatcher] poll já enviado hoje (checklist ${checklistId})`)
        return
      }

      // Avalia a trava de inatividade só na primeira tentativa natural do dia
      // (force=true é reenvio manual/teste e não deve mexer no contador, senão
      // um duplo clique em "enviar agora" incrementaria o contador duas vezes).
      const locked = await applyInactivityCheck(checklistId, userId, today)
      if (locked) return
    } else {
      // Force: remove o poll do dia para permitir reenvio
      await pool.query(
        'DELETE FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date = ?',
        [checklistId, today],
      )
    }

    const [itemRows]: any = await pool.query(
      'SELECT text FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order ASC',
      [checklistId],
    )
    if (itemRows.length < 2) {
      console.log(`[checklistDispatcher] checklist ${checklistId} tem menos de 2 itens`)
      return
    }

    const options = itemRows.map((r: any) => r.text)
    const phone = checklist.whatsapp_number
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      console.log(`[checklistDispatcher] usuário ${userId} sem whatsapp válido`)
      return
    }

    const pollName = checklist.name || 'Checklist Diário'
    const result = await sendWhatsAppPoll(phone, pollName, options)

    const dailyPollId = uuidv4()
    await pool.query(
      `INSERT INTO checklist_daily_polls (id, checklist_id, user_id, poll_date, waha_poll_id, total_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 'sent')`,
      [dailyPollId, checklistId, userId, today, result.id, options.length],
    )

    console.log(`[checklistDispatcher] poll enviado com sucesso: ${result.id}`)
  } catch (err: any) {
    if (err instanceof WhatsAppNumberNotFoundError) {
      console.log(`[checklistDispatcher] número não encontrado no WAHA: ${err.message}`)
      return
    }
    console.error(`[checklistDispatcher] erro ao enviar poll:`, err.message)
  }
}

function shouldSendToday(recurrenceType: string, recurrenceDays: number[] | null): boolean {
  const dayOfWeek = new Date().getDay() // 0=Dom, 6=Sáb
  if (recurrenceType === 'daily') return true
  if (recurrenceType === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (recurrenceType === 'custom' && recurrenceDays) return recurrenceDays.includes(dayOfWeek)
  return true
}

export async function sendPollsForHour(hour: number): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT c.id, c.user_id, c.recurrence_type, c.recurrence_days
       FROM checklists c
       JOIN users u ON u.id = c.user_id
       WHERE c.send_time = ? AND c.is_active = 1 AND u.is_active = 1 AND u.whatsapp_alerts_enabled = 1`,
      [hour],
    )

    if (!rows.length) {
      console.log(`[checklistDispatcher] nenhum checklist para enviar às ${hour}h`)
      return
    }

    console.log(`[checklistDispatcher] ${rows.length} checklist(s) para enviar às ${hour}h`)

    for (const row of rows) {
      try {
        const rDays = Array.isArray(row.recurrence_days)
          ? row.recurrence_days
          : (row.recurrence_days ? JSON.parse(row.recurrence_days) : null)

        if (!shouldSendToday(row.recurrence_type || 'daily', rDays)) {
          console.log(`[checklistDispatcher] checklist ${row.id} não enviado hoje (recurrence=${row.recurrence_type})`)
          continue
        }
        await sendDailyPoll(row.id, row.user_id)
      } catch (err: any) {
        console.error(`[checklistDispatcher] erro checklist ${row.id}:`, err.message)
      }
    }
  } catch (err: any) {
    console.error('[checklistDispatcher] erro no sendPollsForHour:', err.message)
  }
}
