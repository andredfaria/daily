import { Router, Request, Response } from 'express'
import { decidirAcessoAdmin, ehNumeroAdmin } from '../services/adminAccess'
import jwt from 'jsonwebtoken'
import { randomInt } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { fetchWhatsAppName, resolveWhatsAppNumber, sendWhatsAppText, sendWhatsAppOtpButton, WhatsAppNumberNotFoundError, buildPhoneCandidates } from '../services/waha'
import { authMiddleware } from '../middleware/auth'
import { registrarAtividade, descreverErroEnvio } from '../services/activityLog'
import { criarSessao } from '../services/sessions'
import { ehTokenLegado } from '../services/sessionToken'

const router = Router()

// Quem pediu código: usuário quando o número já existe (com ou sem o 9º dígito).
async function registrarPedidoOtp(digits: string, status: 'ok' | 'falha', error?: string): Promise<void> {
  let userId: string | null = null
  try {
    const [rows]: any = await pool.query(
      `SELECT id FROM users WHERE whatsapp_number IN (${buildPhoneCandidates(digits, digits).map(() => '?').join(', ')}) LIMIT 1`,
      buildPhoneCandidates(digits, digits)
    )
    userId = rows[0]?.id ?? null
  } catch { /* sem usuário no log: segue */ }
  void registrarAtividade({ userId, kind: 'otp_pedido', status, error: error ?? null, meta: { telefone: digits.slice(-4) } })
}

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

    const code = String(randomInt(100000, 1000000))

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
      void registrarPedidoOtp(digits, 'ok')
      return res.json({ success: true, message: 'Código gerado (dev bypass — veja o log do backend)' })
    }

    try {
      await sendWhatsAppOtpButton(digits, code, { userId: null, tipo: 'otp' })
    } catch (btnErr) {
      if (btnErr instanceof WhatsAppNumberNotFoundError) {
        void registrarPedidoOtp(digits, 'falha', 'número não encontrado no WhatsApp')
        return res.status(400).json({ error: 'Número não encontrado no WhatsApp. Verifique o número e tente novamente.' })
      }
      // Fallback: sendButtons indisponível (tier Core ou deprecated) — envia 2 mensagens de texto
      console.warn('[auth] sendButtons indisponível — usando fallback de texto')
      try {
        await sendWhatsAppText(digits, `Seu código de acesso Rotina (válido por 5 min):`, { userId: null, tipo: 'otp' })
        await sendWhatsAppText(digits, code, { userId: null, tipo: 'otp' })
      } catch (txtErr) {
        if (txtErr instanceof WhatsAppNumberNotFoundError) {
          void registrarPedidoOtp(digits, 'falha', 'número não encontrado no WhatsApp')
          return res.status(400).json({ error: 'Número não encontrado no WhatsApp. Verifique o número e tente novamente.' })
        }
        void registrarPedidoOtp(digits, 'falha', descreverErroEnvio(txtErr))
        throw txtErr
      }
    }

    void registrarPedidoOtp(digits, 'ok')
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
      void registrarAtividade({ kind: 'login_falha', status: 'falha', error: 'código inválido ou expirado', meta: { telefone: digits.slice(-4) } })
      return res.status(401).json({ error: 'Código inválido ou expirado' })
    }

    const row = otpRows[0]

    // Increment attempts atomically — only if code is valid and not exhausted
    const [incResult]: any = await pool.query(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ? AND used = FALSE AND attempts < 5 AND expires_at > NOW()',
      [row.id]
    )
    if (incResult.affectedRows === 0) {
      void registrarAtividade({ kind: 'login_falha', status: 'falha', error: 'código bloqueado ou expirado', meta: { telefone: digits.slice(-4) } })
      return res.status(401).json({ error: 'Código bloqueado por excesso de tentativas ou expirado' })
    }

    // Constant-time comparison to prevent timing attacks
    const { timingSafeEqual } = await import('crypto')
    const expected = Buffer.from(row.code)
    const provided = Buffer.from((code || '').trim().padEnd(row.code.length, '\0').slice(0, row.code.length))
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      void registrarAtividade({ kind: 'login_falha', status: 'falha', error: 'código incorreto', meta: { telefone: digits.slice(-4) } })
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
      `SELECT * FROM users WHERE whatsapp_number IN (${placeholders}) ORDER BY whatsapp_number = ? DESC LIMIT 1`,
      [...candidates, digits]
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

    // Fallback do admin: só aqui, com o número provado pelo OTP. Nunca em requisição comum.
    // O número do usuário escolhido tem de ser exatamente o provado pelo OTP.
    if (!user.is_admin && user.whatsapp_number === digits && ehNumeroAdmin(digits, process.env.ADMIN_WHATSAPP)) {
      try {
        await pool.query('UPDATE users SET is_admin = TRUE WHERE id = ?', [user.id])
        user.is_admin = 1
      } catch (err) {
        console.error('[auth] falha ao promover admin por ADMIN_WHATSAPP:', err)
      }
    }

    const token = await criarSessao(user.id, req.headers['user-agent'])
    void registrarAtividade({ userId: user.id, kind: 'login', meta: { user_agent: req.headers['user-agent'] ?? null } })

    const safeUser = {
      id: user.id,
      name: user.name,
      whatsapp_number: user.whatsapp_number,
      timezone: user.timezone,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_admin: decidirAcessoAdmin(user),
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

    return res.json({ ...rows[0], is_admin: decidirAcessoAdmin(rows[0]) })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/auth/upgrade-session
// Troca o JWT de 30 dias (anterior às sessões) por uma sessão, para quem já
// estava logado não precisar pedir código de novo. Só aceita JWT válido e não
// vencido, então a janela fecha sozinha 30 dias depois do deploy — aí esta rota
// e o JWT_SECRET podem sair.
router.post('/upgrade-session', async (req: Request, res: Response) => {
  const header = req.headers.authorization
  const legado = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!legado || !ehTokenLegado(legado) || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }

  let userId: string
  try {
    userId = (jwt.verify(legado, process.env.JWT_SECRET) as { userId: string }).userId
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }

  try {
    const [rows]: any = await pool.query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId])
    if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' })
    const token = await criarSessao(userId, req.headers['user-agent'])
    void registrarAtividade({ userId, kind: 'login', ref: 'upgrade-session', meta: { user_agent: req.headers['user-agent'] ?? null } })
    return res.json({ token })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/auth/logout — encerra a sessão deste dispositivo no servidor
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query(`DELETE FROM sessions WHERE id = ?`, [req.sessionId])
    void registrarAtividade({ userId: req.userId, kind: 'logout' })
    return res.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/auth/sessions — dispositivos conectados
router.get('/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, user_agent, created_at, last_used_at
         FROM sessions
        WHERE user_id = ? AND expires_at > NOW()
        ORDER BY last_used_at DESC`,
      [req.userId]
    )
    return res.json(rows.map((r: any) => ({ ...r, current: r.id === req.sessionId })))
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/auth/sessions — encerra todos os outros dispositivos
router.delete('/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      `DELETE FROM sessions WHERE user_id = ? AND id <> ?`,
      [req.userId, req.sessionId]
    )
    if (result.affectedRows > 0) {
      void registrarAtividade({ userId: req.userId, kind: 'logout', meta: { sessao_encerrada: 'outras', quantidade: result.affectedRows } })
    }
    return res.json({ removed: result.affectedRows })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/auth/sessions/:id — encerra um dispositivo
router.delete('/sessions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    // user_id no WHERE: não dá para derrubar sessão de outra pessoa adivinhando o id
    const [result]: any = await pool.query(
      `DELETE FROM sessions WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'Sessão não encontrada' })
    void registrarAtividade({ userId: req.userId, kind: 'logout', meta: { sessao_encerrada: req.params.id } })
    return res.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
