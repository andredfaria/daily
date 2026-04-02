import { Router, Request, Response } from 'express'
import axios from 'axios'
import pool from '../db'

const router = Router()

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
    res.status(500).json({ error: err.message })
  }
})

// POST /api/waha/disconnect
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    await wahaClient().post(`/api/sessions/${session}/stop`)
    res.json({ status: 'stopped' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/waha/test-message
// Envia uma mensagem de teste para o número WhatsApp configurado no perfil do usuário.
// Retorna { success: true, to, message_id } ou { success: false, error }
router.post('/test-message', async (_req: Request, res: Response) => {
  try {
    // 1. Buscar número do usuário no banco
    const [rows]: any = await pool.query('SELECT whatsapp_number, name FROM users LIMIT 1')

    if (!rows.length || !rows[0].whatsapp_number) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum número WhatsApp configurado. Acesse Configurações > Perfil e defina seu número.',
      })
    }

    const rawNumber: string = rows[0].whatsapp_number
    const userName: string = rows[0].name || 'Usuário'

    // 2. Normalizar número: remover tudo que não for dígito e adicionar sufixo @c.us
    const digits = rawNumber.replace(/\D/g, '')
    if (digits.length < 10) {
      return res.status(400).json({
        success: false,
        error: `Número inválido: "${rawNumber}". Use o formato +55 (11) 99999-9999.`,
      })
    }
    const chatId = `${digits}@c.us`

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
    const status = err.response?.status
    const detail = err.response?.data?.message ?? err.response?.data?.error ?? err.message

    return res.status(500).json({
      success: false,
      error: status
        ? `Erro ${status} ao enviar mensagem: ${detail}`
        : `Erro de conexão com WAHA: ${detail}`,
    })
  }
})

export default router
