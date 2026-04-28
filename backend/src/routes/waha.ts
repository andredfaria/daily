import { Router, Request, Response } from 'express'
import pool from '../db'
import { wahaClient, resolveWhatsAppNumber } from '../services/waha'

// Extrai a mensagem de erro mais descritiva de uma resposta WAHA/Axios
function extractWahaError(err: any): string {
  return (
    err.response?.data?.exception?.message ??
    err.response?.data?.message ??
    err.response?.data?.error ??
    err.message ??
    'Erro desconhecido'
  )
}

const router = Router()

// GET /api/waha/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const { data } = await wahaClient().get(`/api/sessions/${session}`)
    res.json({
      connected: data.status === 'WORKING',
      session: data.name,
      status: data.status,
    })
  } catch (err: any) {
    res.json({ connected: false, error: err.message })
  }
})

// POST /api/waha/reconnect
router.post('/reconnect', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const { data } = await wahaClient().post(`/api/sessions/${session}/restart`)
    res.json({ status: data.status ?? 'restarting', qr_code: data.qr ?? undefined })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/waha/disconnect
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    await wahaClient().post(`/api/sessions/${session}/stop`)
    res.json({ status: 'stopped' })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/waha/test-message
// Envia uma mensagem de teste para o número WhatsApp configurado no perfil do usuário.
// Retorna { success: true, to, message_id } ou { success: false, error }
router.post('/test-message', async (req: Request, res: Response) => {
  try {
    // 1. Buscar número do usuário no banco
    const [rows]: any = await pool.query('SELECT whatsapp_number, name FROM users WHERE id = ?', [req.userId])

    if (!rows.length || !rows[0].whatsapp_number) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum número WhatsApp configurado. Acesse Configurações > Perfil e defina seu número.',
      })
    }

    const rawNumber: string = rows[0].whatsapp_number
    const userName: string = rows[0].name || 'Usuário'

    // 2. Resolver número: tenta variante com/sem o 9 para encontrar o correto no WhatsApp
    const digits = rawNumber.replace(/\D/g, '')
    if (digits.length < 10) {
      return res.status(400).json({
        success: false,
        error: `Número inválido: "${rawNumber}". Use o formato +55 (11) 99999-9999.`,
      })
    }
    const resolvedDigits = await resolveWhatsAppNumber(rawNumber)
    const chatId = `${resolvedDigits}@c.us`

    // 3. Verificar se sessão WAHA está ativa
    const session = process.env.WAHA_SESSION || 'default'
    try {
      const { data: sessionData } = await wahaClient().get(`/api/sessions/${session}`)
      if (sessionData.status !== 'WORKING') {
        return res.status(503).json({
          success: false,
          error: `Sessão WAHA não está ativa (status: ${sessionData.status}). Reconecte primeiro.`,
        })
      }
    } catch (sessionErr: any) {
      return res.status(503).json({
        success: false,
        error: `Não foi possível verificar a sessão WAHA: ${sessionErr.message}`,
      })
    }

    // 4. Enviar mensagem de teste
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const body = `✅ *Teste de Integração — BillSync*\n\nOlá, ${userName}! Esta é uma mensagem de teste enviada em ${now}.\n\nSe você está recebendo isso, o envio de notificações está funcionando corretamente. 🎉`

    const { data: msgData } = await wahaClient().post(`/api/sendText`, {
      session,
      chatId,
      text: body,
    })

    return res.json({
      success: true,
      to: rawNumber,
      message_id: msgData.id ?? msgData.key?.id ?? null,
    })
  } catch (err: any) {
    const detail = extractWahaError(err)
    console.error('[waha] test-message falhou:', JSON.stringify(err.response?.data ?? err.message, null, 2))
    return res.status(500).json({
      success: false,
      error: detail,
    })
  }
})

export default router
