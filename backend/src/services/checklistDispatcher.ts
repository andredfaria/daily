import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { sendWhatsAppPoll, WhatsAppNumberNotFoundError } from './waha'

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
