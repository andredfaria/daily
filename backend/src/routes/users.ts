import { Router, Request, Response } from 'express'
import pool from '../db'

const router = Router()

// GET /api/users/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.userId])
    if (!rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/users/me
router.patch('/me', async (req: Request, res: Response) => {
  try {
    const allowed = [
      'name', 'whatsapp_number', 'timezone', 'is_active',
      'notification_time', 'whatsapp_alerts_enabled',
      'weekly_summary_enabled', 'default_days_before_alert',
    ]
    const fields: string[] = []
    const values: any[] = []

    for (const key of allowed) {
      if (req.body[key] === undefined) continue

      if (key === 'notification_time') {
        const h = Number(req.body[key])
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          return res.status(400).json({ error: 'notification_time deve ser um inteiro entre 0 e 23' })
        }
        fields.push(`${key} = ?`)
        values.push(h)
        continue
      }

      if (key === 'default_days_before_alert') {
        const d = Number(req.body[key])
        if (!Number.isInteger(d) || d < 0 || d > 30) {
          return res.status(400).json({ error: 'default_days_before_alert deve ser um inteiro entre 0 e 30' })
        }
        fields.push(`${key} = ?`)
        values.push(d)
        continue
      }

      if (key === 'timezone') {
        const tz = String(req.body[key])
        const validTimezones: string[] = (Intl as any).supportedValuesOf('timeZone')
        if (!validTimezones.includes(tz)) {
          return res.status(400).json({ error: `timezone inválido: "${tz}"` })
        }
        fields.push(`${key} = ?`)
        values.push(tz)
        continue
      }

      fields.push(`${key} = ?`)
      values.push(req.body[key])
    }

    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(new Date())
      values.push(req.userId)
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.userId])
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
