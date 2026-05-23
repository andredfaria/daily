import pool from '../db'
import { sendWhatsAppText } from './waha'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function sendWeeklySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [[stats]]: any = await pool.query(
    `SELECT
      SUM(CASE WHEN o.status='paid' THEN o.amount ELSE 0 END) AS paid,
      SUM(CASE WHEN o.status='pending' THEN o.amount ELSE 0 END) AS pending,
      SUM(CASE WHEN o.status='overdue' THEN o.amount ELSE 0 END) AS overdue
     FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
     WHERE b.user_id = ? AND o.due_date BETWEEN ? AND ?`,
    [userId, firstOfMonth, lastOfMonth]
  )

  const [upcoming]: any = await pool.query(
    `SELECT b.name, o.due_date, o.amount
     FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
     WHERE b.user_id = ? AND o.status='pending' AND o.due_date BETWEEN ? AND ?
     ORDER BY o.due_date ASC LIMIT 5`,
    [userId, now, nextWeek]
  )

  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''
  let msg = `📊 *Resumo BillSync${firstName}*\n\n`
  msg += `*Este mês:*\n✅ Pago: R$ ${formatBRL(Number(stats.paid) || 0)}\n`
  msg += `⏳ Pendente: R$ ${formatBRL(Number(stats.pending) || 0)}\n`
  msg += `❗ Atrasado: R$ ${formatBRL(Number(stats.overdue) || 0)}\n`

  if (upcoming.length) {
    msg += `\n*Próximos 7 dias:*\n`
    for (const o of upcoming) {
      const d = (o.due_date instanceof Date ? o.due_date : new Date(o.due_date)).toLocaleDateString('pt-BR')
      msg += `• ${o.name} — R$ ${formatBRL(Number(o.amount))} (${d})\n`
    }
  }

  await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  console.log(`[summary] resumo enviado para ${userId}`)
}
