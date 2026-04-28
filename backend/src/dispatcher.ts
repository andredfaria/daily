// backend/src/dispatcher.ts
import pool from './db'
import axios from 'axios'

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

// Envia uma única notificação pelo ID. Funciona para status 'scheduled' ou 'failed'.
export async function sendSingleNotification(notifId: string): Promise<'sent' | 'failed' | 'skipped'> {
  // 1. Buscar dados da notificação + conta + ocorrência + método de pagamento
  const [notifRows]: any = await pool.query(
    `SELECT n.id, n.bill_occurrence_id, n.type,
            o.due_date, o.amount, o.status AS occurrence_status,
            b.name AS bill_name,
            pm.type AS pm_type, pm.pix_key_type, pm.pix_key, pm.pix_beneficiary, pm.boleto_code
     FROM notifications n
     JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
     JOIN bills b ON b.id = o.bill_id
     LEFT JOIN payment_methods pm ON pm.bill_id = b.id AND pm.is_primary = 1
     WHERE n.id = ?`,
    [notifId]
  )

  if (!notifRows.length) throw new Error(`Notificação ${notifId} não encontrada`)
  const notif = notifRows[0]

  // 2. Pular se ocorrência já foi paga/cancelada
  if (notif.occurrence_status === 'paid' || notif.occurrence_status === 'cancelled') {
    await pool.query(`UPDATE notifications SET status='skipped' WHERE id=?`, [notifId])
    console.log(`[dispatcher] ⏭ ignorado: ${notif.bill_name} (${notifId}) — ocorrência ${notif.occurrence_status}`)
    return 'skipped'
  }

  // 3. Buscar número WhatsApp do usuário
  const [userRows]: any = await pool.query('SELECT whatsapp_number, whatsapp_alerts_enabled FROM users LIMIT 1')
  if (!userRows.length || !userRows[0].whatsapp_number) {
    const detail = 'Nenhum usuário com WhatsApp configurado'
    await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
    return 'failed'
  }
  if (!userRows[0].whatsapp_alerts_enabled) {
    await pool.query(`UPDATE notifications SET status='skipped' WHERE id=?`, [notifId])
    return 'skipped'
  }

  const rawNumber: string = userRows[0].whatsapp_number
  const digits = rawNumber.replace(/\D/g, '')
  if (digits.length < 10) {
    const detail = `Número WhatsApp inválido: ${rawNumber}`
    await pool.query(`UPDATE notifications SET status='failed', error_detail=? WHERE id=?`, [detail, notifId])
    return 'failed'
  }
  const chatId = `${digits}@c.us`

  // 4. Verificar sessão WAHA
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

  // 5. Montar e enviar mensagem
  const pm = notif.pm_type
    ? { type: notif.pm_type, pix_key_type: notif.pix_key_type, pix_key: notif.pix_key,
        pix_beneficiary: notif.pix_beneficiary, boleto_code: notif.boleto_code }
    : null

  const messageBody = buildMessage(notif.bill_name, notif.amount, notif.due_date, pm)

  try {
    const { data: msgData } = await wahaClient().post('/api/sendText', {
      session,
      chatId,
      text: messageBody,
    })

    const wahaMessageId = msgData.id ?? msgData.key?.id ?? null
    await pool.query(
      `UPDATE notifications SET status='sent', sent_at=NOW(), waha_message_id=?, message_body=?, error_detail=NULL WHERE id=?`,
      [wahaMessageId, messageBody, notifId]
    )
    console.log(`[dispatcher] ✓ enviado: ${notif.bill_name} (${notifId})`)
    return 'sent'
  } catch (err: any) {
    const detail =
      err.response?.data?.exception?.message ??
      err.response?.data?.message ??
      err.response?.data?.error ??
      err.message
    console.error(`[dispatcher] ✗ falha: ${notif.bill_name} (${notifId}):`, JSON.stringify(err.response?.data ?? err.message, null, 2))
    await pool.query(
      `UPDATE notifications SET status='failed', error_detail=? WHERE id=?`,
      [detail, notifId]
    )
    return 'failed'
  }
}

export async function runDispatch(): Promise<{ sent: number; failed: number; skipped: number }> {
  const stats = { sent: 0, failed: 0, skipped: 0 }

  // 1. Verificar usuário
  const [userRows]: any = await pool.query('SELECT whatsapp_number, whatsapp_alerts_enabled FROM users LIMIT 1')
  if (!userRows.length || !userRows[0].whatsapp_number) {
    console.warn('[dispatcher] nenhum usuário com WhatsApp configurado, abortando')
    return stats
  }
  if (!userRows[0].whatsapp_alerts_enabled) {
    console.log('[dispatcher] alertas WhatsApp desabilitados, abortando')
    return stats
  }

  // 2. Verificar sessão WAHA antes do loop para falhar em lote se necessário
  const session = process.env.WAHA_SESSION || 'default'
  try {
    const { data: sessionData } = await wahaClient().get(`/api/sessions/${session}`)
    if (sessionData.status !== 'WORKING') {
      console.warn('[dispatcher] sessão WAHA não está ativa:', sessionData.status)
      const [updateResult]: any = await pool.query(
        `UPDATE notifications SET status='failed', error_detail='Sessão WAHA inativa'
         WHERE status='scheduled' AND scheduled_for = CURDATE()`
      )
      stats.failed = updateResult.affectedRows ?? 0
      return stats
    }
  } catch (err: any) {
    console.error('[dispatcher] erro ao verificar sessão WAHA:', err.message)
    const [updateResult]: any = await pool.query(
      `UPDATE notifications SET status='failed', error_detail=?
       WHERE status='scheduled' AND scheduled_for = CURDATE()`,
      [`Erro ao verificar sessão WAHA: ${err.message}`]
    )
    stats.failed = updateResult.affectedRows ?? 0
    return stats
  }

  // 3. Buscar IDs das notificações agendadas para hoje
  const [notifications]: any = await pool.query(
    `SELECT n.id FROM notifications n
     JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
     JOIN bills b ON b.id = o.bill_id
     WHERE n.status = 'scheduled' AND n.scheduled_for = CURDATE()`
  )

  if (!notifications.length) {
    console.log('[dispatcher] nenhuma notificação agendada para hoje')
    return stats
  }

  console.log(`[dispatcher] ${notifications.length} notificação(ões) para processar`)

  // 4. Enviar cada uma via sendSingleNotification
  for (const { id } of notifications) {
    const result = await sendSingleNotification(id)
    stats[result]++
  }

  console.log(`[dispatcher] concluído — enviadas: ${stats.sent}, falhas: ${stats.failed}, ignoradas: ${stats.skipped}`)
  return stats
}
