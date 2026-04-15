import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { wahaClient, fetchWhatsAppName } from '../services/waha'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// POST /api/auth/request-otp
router.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body
    const digits = (phone || '').replace(/\D/g, '')

    if (digits.length < 10) {
      return res.status(400).json({ error: 'Número de telefone inválido' })
    }

    // Rate limit: check last 1 minute
    const [recentRows]: any = await pool.query(
      `SELECT COUNT(*) as count FROM otp_codes WHERE phone_number = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
      [digits]
    )
    if (recentRows[0].count > 0) {
      return res.status(429).json({ error: 'Aguarde 1 minuto antes de solicitar novo código' })
    }

    // Rate limit: check last 1 hour (5+ entries)
    const [hourRows]: any = await pool.query(
      `SELECT COUNT(*) as count FROM otp_codes WHERE phone_number = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [digits]
    )
    if (hourRows[0].count >= 5) {
      return res.status(429).json({ error: 'Limite de tentativas excedido. Tente novamente em 1 hora' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))

    await pool.query(
      `INSERT INTO otp_codes (id, phone_number, code, expires_at) VALUES (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [digits, code]
    )

    await wahaClient().post('/api/send-text', {
      session: process.env.WAHA_SESSION || 'default',
      chatId: `${digits}@c.us`,
      text: `🔐 *BillSync* — Seu código de acesso:\n\n*${code}*\n\nVálido por 5 minutos. Não compartilhe.`,
    })

    return res.json({ success: true, message: 'Código enviado via WhatsApp' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body
    const digits = (phone || '').replace(/\D/g, '')

    if (digits.length < 10) {
      return res.status(400).json({ error: 'Número de telefone inválido' })
    }

    const [otpRows]: any = await pool.query(
      `SELECT * FROM otp_codes WHERE phone_number = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [digits]
    )

    if (!otpRows.length) {
      return res.status(401).json({ error: 'Código inválido ou expirado' })
    }

    const row = otpRows[0]

    if (row.attempts >= 5) {
      return res.status(401).json({ error: 'Código bloqueado por excesso de tentativas' })
    }

    await pool.query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`,
      [row.id]
    )

    if (row.code !== (code || '').trim()) {
      return res.status(401).json({ error: 'Código incorreto' })
    }

    await pool.query(
      `UPDATE otp_codes SET used = TRUE WHERE id = ?`,
      [row.id]
    )

    // Find or create user
    const [userRows]: any = await pool.query(
      `SELECT * FROM users WHERE whatsapp_number = ? LIMIT 1`,
      [digits]
    )

    let user: any
    if (userRows.length) {
      user = userRows[0]
    } else {
      const newId = uuidv4()
      await pool.query(
        `INSERT INTO users (id, name, whatsapp_number, timezone, is_active) VALUES (?, NULL, ?, 'America/Sao_Paulo', TRUE)`,
        [newId, digits]
      )
      const [newUserRows]: any = await pool.query(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [newId]
      )
      user = newUserRows[0]
    }

    // Fetch WhatsApp name if not set
    if (user.name === null) {
      const name = await fetchWhatsAppName(digits)
      if (name) {
        await pool.query(
          `UPDATE users SET name = ? WHERE id = ?`,
          [name, user.id]
        )
        user.name = name
      }
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    return res.json({ token, user })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT * FROM users WHERE id = ? LIMIT 1`,
      [req.userId]
    )

    if (!rows.length) {
      return res.status(401).json({ error: 'Usuário não encontrado' })
    }

    return res.json(rows[0])
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
