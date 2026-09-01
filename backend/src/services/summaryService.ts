import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fechamentoMensal } from './financialAnalytics'
import { claimMessage, releaseMessageClaim, claimKeyDia, claimKeyMesAnterior } from './messageClaim'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NOMES_CATEGORIA: Record<string, string> = {
  moradia: 'Moradia',
  assinaturas: 'Assinaturas',
  'serviços': 'Serviços',
  'saúde': 'Saúde',
  'educação': 'Educação',
  transporte: 'Transporte',
  'alimentação': 'Alimentação',
  outro: 'Outro',
}

// --- Resumo semanal (consertado: sem coluna status) ---
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
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, firstOfMonth, lastOfMonth]
  )

  const [upcoming]: any = await pool.query(
    `SELECT b.name, o.due_date, o.amount
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?
      ORDER BY o.due_date ASC LIMIT 5`,
    [userId, now, nextWeek]
  )

  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''
  let msg = `📊 *Resumo BillSync${firstName}*\n\n`
  msg += `*Total deste mês:* R$ ${formatBRL(Number(stats.total) || 0)}\n`

  if (upcoming.length) {
    msg += `\n*Próximos 7 dias:*\n`
    for (const o of upcoming) {
      const d = (o.due_date instanceof Date ? o.due_date : new Date(o.due_date)).toLocaleDateString('pt-BR')
      msg += `• ${o.name} — R$ ${formatBRL(Number(o.amount))} (${d})\n`
    }
  } else {
    msg += `\nNenhuma conta nos próximos 7 dias. 🎉\n`
  }

  const refKey = claimKeyDia()
  if (!await claimMessage(userId, 'weekly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaim(userId, 'weekly_summary', refKey)
    throw err
  }
  console.log(`[summary] resumo semanal enviado para ${userId}`)
}

// --- Sumário mensal (novo): fechamento do mês anterior ---
export async function sendMonthlySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ano = prev.getFullYear()
  const mes = prev.getMonth() + 1

  const fechamento = await fechamentoMensal(userId, ano, mes)
  if (fechamento.qtdContas === 0) return // nada a reportar

  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''

  let msg = `📅 *Fechamento de ${nomesMes[mes - 1]}${firstName}*\n\n`
  msg += `*Total:* R$ ${formatBRL(fechamento.total)} em ${fechamento.qtdContas} conta(s)\n`

  if (fechamento.porCategoria.length) {
    msg += `\n*Por categoria:*\n`
    for (const c of fechamento.porCategoria) {
      const nome = NOMES_CATEGORIA[c.category] ?? c.category
      msg += `• ${nome}: R$ ${formatBRL(c.total)}\n`
    }
  }

  if (fechamento.orcamento != null) {
    const diff = fechamento.total - fechamento.orcamento
    if (diff > 0) {
      msg += `\n⚠️ R$ ${formatBRL(diff)} acima do orçamento de R$ ${formatBRL(fechamento.orcamento)}.`
    } else {
      msg += `\n✅ Dentro do orçamento (R$ ${formatBRL(fechamento.orcamento)}).`
    }
  }

  const refKey = claimKeyMesAnterior()
  if (!await claimMessage(userId, 'monthly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaim(userId, 'monthly_summary', refKey)
    throw err
  }
  console.log(`[summary] sumário mensal enviado para ${userId}`)
}
