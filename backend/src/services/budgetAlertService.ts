import pool from '../db'
import { sendWhatsAppText } from './waha'
import { claimMessage, releaseMessageClaimIfUndelivered, claimKeyDia, ClaimKind } from './messageClaim'

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

// Contas e gastos têm limites separados (conta é controle do mês, gasto é do dia
// a dia), então cada um tem o próprio alerta e a própria trava.
async function enviarAlerta(userId: string, numero: string, kind: ClaimKind, msg: string): Promise<void> {
  // Chave diária: preserva a cadência atual (um aviso por dia enquanto o
  // orçamento estiver estourado) e barra só a duplicata entre instâncias.
  const refKey = claimKeyDia()
  if (!await claimMessage(userId, kind, refKey)) return

  try {
    await sendWhatsAppText(numero, msg)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, kind, refKey, err)
    throw err
  }
  console.log(`[budgetAlert] ${kind} enviado para ${userId}`)
}

export async function checkBudgetAlert(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, monthly_budget_limit, monthly_expense_budget_limit FROM users WHERE id = ? AND is_active = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return
  const { whatsapp_number: numero, monthly_budget_limit, monthly_expense_budget_limit } = userRows[0]

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  if (monthly_budget_limit != null) {
    const limite = Number(monthly_budget_limit)
    const [[stats]]: any = await pool.query(
      `SELECT SUM(o.amount) AS total
         FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
        WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
      [userId, firstOfMonth, lastOfMonth]
    )
    const total = Number(stats.total) || 0
    if (total > limite) {
      await enviarAlerta(userId, numero, 'budget_alert',
        `⚠️ *Alerta de Orçamento — Rotina*\n\n` +
        `Suas contas deste mês somam *R$ ${brl(total)}*, ` +
        `acima do limite de contas de *R$ ${brl(limite)}*.`)
    }
  }

  if (monthly_expense_budget_limit != null) {
    const limite = Number(monthly_expense_budget_limit)
    const [[avulsos]]: any = await pool.query(
      'SELECT SUM(amount) AS total FROM expenses WHERE user_id = ? AND spent_on BETWEEN ? AND ?',
      [userId, firstOfMonth, lastOfMonth]
    )
    const total = Number(avulsos.total) || 0
    if (total > limite) {
      await enviarAlerta(userId, numero, 'expense_budget_alert',
        `⚠️ *Alerta de Gastos — Rotina*\n\n` +
        `Seus gastos do dia a dia deste mês somam *R$ ${brl(total)}*, ` +
        `acima do limite de gastos de *R$ ${brl(limite)}*.`)
    }
  }
}
