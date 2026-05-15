import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import pool from '../db'
import { wahaClient } from '../services/waha'

const router = Router()

const HMAC_KEY = process.env.WHATSAPP_HOOK_HMAC_KEY || ''

function verifyHmac(payload: string, headerHmac: string): boolean {
  if (!HMAC_KEY) {
    console.warn('[webhook] WHATSAPP_HOOK_HMAC_KEY não configurado — pulando verificação')
    return true
  }
  const computed = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(headerHmac))
}

// POST /api/webhooks/waha-poll
// Recebe eventos poll.vote e poll.vote.failed do WAHA
router.post('/waha-poll', async (req: Request, res: Response) => {
  try {
    console.log('[webhook] payload raw:', JSON.stringify(req.body))
    const payload = JSON.stringify(req.body)
    const headerHmac = req.headers['x-webhook-hmac'] as string | undefined

    if (headerHmac && !verifyHmac(payload, headerHmac)) {
      console.warn('[webhook] HMAC inválido — requisição rejeitada')
      return res.status(401).json({ error: 'HMAC inválido' })
    }

    const event = req.body.event as string | undefined
    const data = req.body.payload || req.body

    if (!event) {
      console.log('[webhook] evento não especificado — payload ignorado')
      return res.status(200).json({ ok: true })
    }

    if (event === 'poll.vote.failed') {
      console.log('[webhook] poll.vote.failed recebido')
      // RN-Risco-1: tentar reenviar mensagem de apology
      await handlePollVoteFailed(data)
      return res.json({ ok: true })
    }

    if (event !== 'poll.vote') {
      console.log(`[webhook] evento ignorado: ${event}`)
      return res.status(200).json({ ok: true })
    }

    await handlePollVote(data)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[webhook] erro ao processar:', err.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

async function handlePollVote(data: any): Promise<void> {
  // WAHA envia: { pollMessageId, chatId, selectedOptions, timestamp, ... }
  const pollMessageId: string | undefined =
    data.pollMessageId ??
    data.pollInfo?.msgId ??
    data.key?.id ??
    data.id

  const rawOptions: unknown[] = Array.isArray(data.selectedOptions) ? data.selectedOptions : []
  const selectedOptions: string[] = rawOptions.map((opt) =>
    typeof opt === 'string' ? opt : ((opt as any)?.name ?? String(opt))
  )

  const voteTimestamp: number = Number(data.timestamp) || Date.now()

  if (!pollMessageId) {
    console.warn('[webhook] poll.vote sem pollMessageId')
    return
  }

  const [rows]: any = await pool.query(
    'SELECT id, total_count, selected_options, last_vote_timestamp FROM checklist_daily_polls WHERE waha_poll_id = ?',
    [pollMessageId],
  )
  if (!rows.length) {
    console.warn(`[webhook] poll não encontrado: ${pollMessageId}`)
    return
  }

  const poll = rows[0]

  // RN04: concorrência — priorizar timestamp mais recente
  if (poll.last_vote_timestamp && voteTimestamp <= Number(poll.last_vote_timestamp)) {
    console.log(`[webhook] voto ignorado (timestamp ${voteTimestamp} <= ${poll.last_vote_timestamp})`)
    return
  }

  const completedCount = selectedOptions.length
  const totalCount = poll.total_count || 1
  const completionPct = Math.round((completedCount / totalCount) * 10000) / 100

  await pool.query(
    `UPDATE checklist_daily_polls
     SET selected_options = ?, completed_count = ?, completion_pct = ?,
         last_vote_timestamp = ?, status = ?
     WHERE id = ?`,
    [
      JSON.stringify(selectedOptions),
      completedCount,
      completionPct,
      voteTimestamp,
      completedCount === totalCount ? 'completed' : 'sent',
      poll.id,
    ],
  )

  console.log(`[webhook] voto processado: ${completedCount}/${totalCount} (${completionPct}%)`)
}

async function handlePollVoteFailed(data: any): Promise<void> {
  // RN-Risco-1: enviar mensagem de apology
  const pollMessageId: string | undefined =
    data.pollMessageId ?? data.key?.id ?? data.id
  const chatId: string | undefined = data.chatId

  if (!pollMessageId || !chatId) {
    console.warn('[webhook] poll.vote.failed sem identificadores')
    return
  }

    try {
      const session = process.env.WAHA_SESSION || 'default'
      await wahaClient().post('/api/sendText', {
      session,
      chatId,
      text: 'Desculpe, não conseguimos ler seu voto. Por favor, marque novamente na enquete acima.',
    })
    console.log(`[webhook] mensagem de apology enviada para ${chatId}`)
  } catch (err: any) {
    console.error('[webhook] erro ao enviar apology:', err.message)
  }
}

export default router
