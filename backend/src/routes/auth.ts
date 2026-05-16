import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { fetchWhatsAppName, resolveWhatsAppNumber, sendWhatsAppText, WhatsAppNumberNotFoundError, buildPhoneCandidates } from '../services/waha'
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

    const devBypass = process.env.DEV_OTP_BYPASS === 'true'

    if (!devBypass) {
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
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))

    if (devBypass) {
      // Clear previous unused OTPs so attempts/expiry never block local testing
      await pool.query(
        `DELETE FROM otp_codes WHERE phone_number = ? AND used = FALSE`,
        [digits]
      )
    }

    await pool.query(
      `INSERT INTO otp_codes (id, phone_number, code, expires_at) VALUES (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [digits, code]
    )

    if (devBypass) {
      console.log(`[dev-otp] phone=${digits} code=${code}`)
      return res.json({ success: true, message: 'Código gerado (dev bypass — veja o log do backend)' })
    }

    const otpText = `🔐 *BillSync* — Seu código de acesso:\n\n*${code}*\n\nVálido por 5 minutos. Não compartilhe.`
    try {
      await sendWhatsAppText(digits, otpText)
    } catch (err) {
      if (err instanceof WhatsAppNumberNotFoundError) {
        return res.status(400).json({ error: 'Número não encontrado no WhatsApp. Verifique o número e tente novamente.' })
      }
      throw err
    }

    return res.json({ success: true, message: 'Código enviado via WhatsApp' })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
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

    // Increment attempts atomically — only if code is valid and not exhausted
    const [incResult]: any = await pool.query(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ? AND used = FALSE AND attempts < 5 AND expires_at > NOW()',
      [row.id]
    )
    if (incResult.affectedRows === 0) {
      return res.status(401).json({ error: 'Código bloqueado por excesso de tentativas ou expirado' })
    }

    // Constant-time comparison to prevent timing attacks
    const { timingSafeEqual } = await import('crypto')
    const expected = Buffer.from(row.code)
    const provided = Buffer.from((code || '').trim().padEnd(row.code.length, '\0').slice(0, row.code.length))
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return res.status(401).json({ error: 'Código incorreto' })
    }

    // Mark OTP as used
    await pool.query('UPDATE otp_codes SET used = TRUE WHERE id = ?', [row.id])

    // Resolve numero correto no WhatsApp (com ou sem o 9)
    let resolvedNumber = digits
    try {
      resolvedNumber = await resolveWhatsAppNumber(digits)
    } catch {
      // WAHA indisponível — fallback por variante de string
    }

    // Busca usuario por todos os candidatos: digits, resolved e variante com/sem 9
    const candidates = buildPhoneCandidates(digits, resolvedNumber)
    const placeholders = candidates.map(() => '?').join(', ')
    const [userRows]: any = await pool.query(
      `SELECT * FROM users WHERE whatsapp_number IN (${placeholders}) LIMIT 1`,
      candidates
    )

    let user: any
    if (userRows.length) {
      user = userRows[0]
    } else {
      const newId = uuidv4()
      await pool.query(
        `INSERT INTO users (id, name, whatsapp_number, timezone, is_active) VALUES (?, NULL, ?, 'America/Sao_Paulo', TRUE)`,
        [newId, resolvedNumber]
      )
      const [newUserRows]: any = await pool.query(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [newId]
      )
      user = newUserRows[0]
    }

    // Fetch WhatsApp name if not set
    if (user.name === null) {
      const name = await fetchWhatsAppName(resolvedNumber)
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

    const safeUser = {
      id: user.id,
      name: user.name,
      whatsapp_number: user.whatsapp_number,
      timezone: user.timezone,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }
    return res.json({ token, user: safeUser })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
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
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
