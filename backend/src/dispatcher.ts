// backend/src/dispatcher.ts
import pool from './db'
import axios from 'axios'
import { materializeForUser } from './services/notificationMaterializer'
import { sendWhatsAppText, WhatsAppNumberNotFoundError } from './services/waha'

function wahaClient() {
  return axios.create({
    baseURL: process.env.WAHA_URL || 'http://localhost:3000',
    headers: {
      'X-Api-Key': process.env.WAHA_API_KEY || '',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
}

function buildRelativeDate(dueDate: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  if (diffDays > 1) return `em ${diffDays} dias`
  if (diffDays === -1) return 'venceu ontem'
  return `venceu há ${Math.abs(diffDays)} dias`
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildPaymentSection(pm: any): string {
  if (!pm) return ''
  if (pm.type === 'pix') {
    const keyTypeLabel: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
    }
    const label = keyTypeLabel[pm.pix_key_type] ?? pm.pix_key_type
    const beneficiary = pm.pix_beneficiary ? `\nFavorecido: ${pm.pix_beneficiary}` : ''
    return `\n💳 *Pagamento:*\nPIX — ${label}: ${pm.pix_key}${beneficiary}`
  }
  if (pm.type === 'boleto') {
    return `\n💳 *Pagamento:*\nBoleto:\n${pm.boleto_code}`
  }
  return ''
}

function buildMessage(billName: string, amount: number, dueDate: string, pm: any): string {
  const due = new Date(dueDate)
  const dueFmt = due.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const relative = buildRelativeDate(dueDate)
  const paymentSection = buildPaymentSection(pm)

  return (
    `📅 *Lembrete de Vencimento — BillSync*\n\n` +
    `Conta: *${billName}*\n` +
    `Valor: R$ ${formatAmount(amount)}\n` +
    `Vencimento: *${relative} (${dueFmt})*` +
    paymentSection +
    `\n\nResponda *PAGO* para confirmar o pagamento.`
  )
}

export async function sendSingleNotification(notifId: string): Promise<'sent' | 'failed' | 'skipped'> {
  const [notifRows]: any = await pool.query(
    `SELECT n.id, n.bill_occurrence_id, n.type,
            o.due_date, o.amount, o.status AS occurrence_status,
            b.name AS bill_name,
            u.whatsapp_number, u.whatsapp_alerts_enabled,
            pm.type AS pm_type, pm.pix_key_type, pm.pix_key, pm.pix_beneficiary, pm.boleto_code
     FROM notifications n
     JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
     JOIN bills b ON b.id = o.bill_id
     JOIN users u ON u.id = b.user_id
     LEFT JOIN payment_methods pm ON pm.bill_id = b.id AND pm.is_primary = 1
     WHERE n.id = ?`,
    [notifId]
  )

  if (!notifRows.length) throw new Error(`Notificação ${notifId} não encontrada`)
  const notif = notifRows[0]

  if (notif.occurrence_status === 'paid' || notif.occurrence_status === 'cancelled') {
    await pool.query(`UPDATE notifications SET status='skipped' WHERE id=?`, [notifId])
    console.log(`[dispatcher] ⏭ ignorado: ${notif.bill_name} (${notifId}) — ocorrência ${notif.occurrence_status}`)
    return 'skipped'
  }

  if (!notif.whatsapp_number) {
    const detail = 'Nenhum usuário com WhatsApp configurado'
    await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
    return 'failed'
  }
  if (!notif.whatsapp_alerts_enabled) {
    await pool.query(`UPDATE notifications SET status='skipped' WHERE id=?`, [notifId])
    return 'skipped'
  }

  const digits = notif.whatsapp_number.replace(/\D/g, '')
  if (digits.length < 10) {
    const detail = `Número WhatsApp inválido: ${notif.whatsapp_number}`
    await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
    return 'failed'
  }

  const session = process.env.WAHA_SESSION || 'default'
  try {
    const { data: sessionData } = await wahaClient().get(`/api/sessions/${session}`)
    if (sessionData.status !== 'WORKING') {
      const detail = `Sessão WAHA inativa: ${sessionData.status}`
      await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
      return 'failed'
    }
  } catch (err: any) {
    const detail = `Erro ao verificar sessão WAHA: ${err.message}`
    await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
    return 'failed'
  }

  const pm = notif.pm_type
    ? { type: notif.pm_type, pix_key_type: notif.pix_key_type, pix_key: notif.pix_key,
        pix_beneficiary: notif.pix_beneficiary, boleto_code: notif.boleto_code }
    : null

  const messageBody = buildMessage(notif.bill_name, notif.amount, notif.due_date, pm)

  try {
    const { id: wahaMessageId } = await sendWhatsAppText(notif.whatsapp_number, messageBody)
    await pool.query(
      `UPDATE notifications SET status='sent', sent_at=NOW(), waha_message_id=?, message_body=?, error_detail=NULL WHERE id=?`,
      [wahaMessageId, messageBody, notifId]
    )
    console.log(`[dispatcher] ✓ enviado: ${notif.bill_name} (${notifId})`)
    return 'sent'
  } catch (err: any) {
    const detail = err instanceof WhatsAppNumberNotFoundError
      ? err.message
      : (err.response?.data?.exception?.message ?? err.response?.data?.message ?? err.response?.data?.error ?? err.message)
    console.error(`[dispatcher] ✗ falha: ${notif.bill_name} (${notifId}):`, detail)
    await pool.query(
      `UPDATE notifications SET status='failed', error_detail=? WHERE id=?`,
      [detail, notifId]
    )
    return 'failed'
  }
}

export async function runDispatchForUser(userId: string): Promise<{ sent: number; failed: number; skipped: number }> {
  const stats = { sent: 0, failed: 0, skipped: 0 }

  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, whatsapp_alerts_enabled FROM users WHERE id = ?',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) {
    console.warn(`[dispatcher] usuário ${userId} sem WhatsApp configurado, abortando`)
    return stats
  }
  if (!userRows[0].whatsapp_alerts_enabled) {
    console.log(`[dispatcher] alertas desabilitados para usuário ${userId}, abortando`)
    return stats
  }

  const session = process.env.WAHA_SESSION || 'default'
  try {
    const { data: sessionData } = await wahaClient().get(`/api/sessions/${session}`)
    if (sessionData.status !== 'WORKING') {
      console.warn('[dispatcher] sessão WAHA não está ativa:', sessionData.status)
      const [updateResult]: any = await pool.query(
        `UPDATE notifications n
         JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
         JOIN bills b ON b.id = o.bill_id
         SET n.status='failed', n.error_detail='Sessão WAHA inativa'
         WHERE b.user_id = ? AND n.status='scheduled' AND n.scheduled_for = CURDATE()`,
        [userId]
      )
      stats.failed = updateResult.affectedRows ?? 0
      return stats
    }
  } catch (err: any) {
    console.error('[dispatcher] erro ao verificar sessão WAHA:', err.message)
    const [updateResult]: any = await pool.query(
      `UPDATE notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       SET n.status='failed', n.error_detail=?
       WHERE b.user_id = ? AND n.status='scheduled' AND n.scheduled_for = CURDATE()`,
      [`Erro ao verificar sessão WAHA: ${err.message}`, userId]
    )
    stats.failed = updateResult.affectedRows ?? 0
    return stats
  }

  const [notifications]: any = await pool.query(
    `SELECT n.id FROM notifications n
     JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
     JOIN bills b ON b.id = o.bill_id
     WHERE b.user_id = ? AND n.status = 'scheduled' AND n.scheduled_for = CURDATE()`,
    [userId]
  )

  if (!notifications.length) {
    console.log(`[dispatcher] nenhuma notificação agendada para hoje (usuário ${userId})`)
    return stats
  }

  console.log(`[dispatcher] ${notifications.length} notificação(ões) para processar (usuário ${userId})`)

  for (const { id } of notifications) {
    const result = await sendSingleNotification(id)
    stats[result]++
  }

  console.log(`[dispatcher] concluído — enviadas: ${stats.sent}, falhas: ${stats.failed}, ignoradas: ${stats.skipped}`)
  return stats
}

export async function runDispatch(): Promise<{ sent: number; failed: number; skipped: number }> {
  const totals = { sent: 0, failed: 0, skipped: 0 }

  const [users]: any = await pool.query(
    'SELECT id FROM users WHERE whatsapp_alerts_enabled = 1 AND is_active = 1 AND whatsapp_number IS NOT NULL'
  )

  if (!users.length) {
    console.log('[dispatcher] nenhum usuário com alertas habilitados')
    return totals
  }

  const today = new Date().toISOString().slice(0, 10)
  for (const { id: userId } of users) {
    try {
      await materializeForUser(userId, today)
      const stats = await runDispatchForUser(userId)
      totals.sent += stats.sent
      totals.failed += stats.failed
      totals.skipped += stats.skipped
    } catch (err: any) {
      console.error(`[dispatcher] erro ao processar usuário ${userId}:`, err.message)
    }
  }

  return totals
}
