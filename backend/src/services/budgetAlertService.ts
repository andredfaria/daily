import pool from '../db'
import { sendWhatsAppText } from './waha'

export async function checkBudgetAlert(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, monthly_budget_limit FROM users WHERE id = ? AND is_active = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].monthly_budget_limit || !userRows[0].whatsapp_number) return

  const budget = Number(userRows[0].monthly_budget_limit)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [[stats]]: any = await pool.query(
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, firstOfMonth, lastOfMonth]
  )

  const total = Number(stats.total) || 0
  if (total > budget) {
    const msg =
      `⚠️ *Alerta de Orçamento — BillSync*\n\n` +
      `Suas contas deste mês somam *R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*, ` +
      `acima do limite configurado de *R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.`
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
    console.log(`[budgetAlert] alerta enviado para ${userId}`)
  }
}
