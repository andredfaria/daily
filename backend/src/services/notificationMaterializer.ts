import { v4 as uuidv4 } from 'uuid'
import pool from '../db'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTodaySaoPaulo(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const p: Record<string, string> = {}
  parts.forEach(({ type, value }) => { p[type] = value })
  return `${p.year}-${p.month}-${p.day}`
}

export async function materializeForUser(userId: string, targetDate?: string): Promise<number> {
  const date = targetDate ?? getTodaySaoPaulo()

  const [candidates]: any = await pool.query(
    `SELECT o.id AS occurrence_id,
            CASE WHEN o.due_date = ? THEN 'on_due_date' ELSE 'before_due' END AS notif_type
     FROM bill_occurrences o
     JOIN bills b ON b.id = o.bill_id
     JOIN users u ON u.id = b.user_id
     WHERE u.id = ?
       AND b.is_active = 1
       AND (
         o.due_date = ?
         OR DATE_SUB(o.due_date, INTERVAL COALESCE(b.days_before_alert, u.default_days_before_alert, 3) DAY) = ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM notifications n2
         WHERE n2.bill_occurrence_id = o.id AND n2.scheduled_for = ?
       )`,
    [date, userId, date, date, date]
  )

  if (!candidates.length) return 0

  const now = new Date()
  const values = candidates.map((c: any) => [
    uuidv4(), c.occurrence_id, c.notif_type, date, 'scheduled', now, now,
  ])

  await pool.query(
    `INSERT INTO notifications (id, bill_occurrence_id, type, scheduled_for, status, created_at, updated_at) VALUES ?`,
    [values]
  )

  console.log(`[materializer] ${values.length} notificação(ões) criada(s) para usuário ${userId} em ${date}`)
  return values.length
}

export { getTodaySaoPaulo }
