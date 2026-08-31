import { Router, Request, Response } from 'express'
import pool from '../db'
import { reactivateUserChecklists } from '../services/checklistDispatcher'

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
      'summary_enabled', 'summary_day_of_week', 'monthly_budget_limit',
      'monthly_summary_enabled',
      'asset_alerts_enabled', 'asset_alert_hour',
      'onboarding_completed',
    ]
    const fields: string[] = []
    const values: any[] = []

    let reactivating = false
    if (req.body.is_active === true) {
      const [[current]]: any = await pool.query('SELECT is_active FROM users WHERE id = ?', [req.userId])
      reactivating = !!current && !current.is_active
    }

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

      if (key === 'asset_alert_hour') {
        const h = Number(req.body[key])
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          return res.status(400).json({ error: 'asset_alert_hour deve ser um inteiro entre 0 e 23' })
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

      if (key === 'summary_day_of_week') {
        const dow = Number(req.body[key])
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
          return res.status(400).json({ error: 'summary_day_of_week deve ser um inteiro entre 0 e 6' })
        }
        fields.push(`${key} = ?`)
        values.push(dow)
        continue
      }

      if (key === 'monthly_budget_limit') {
        const val = req.body[key]
        if (val === null || val === '') {
          fields.push(`${key} = ?`)
          values.push(null)
          continue
        }
        const num = Number(val)
        if (isNaN(num) || num < 0) {
          return res.status(400).json({ error: 'monthly_budget_limit deve ser um número maior ou igual a zero' })
        }
        fields.push(`${key} = ?`)
        values.push(num)
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

    if (reactivating) {
      await reactivateUserChecklists(req.userId!)
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.userId])
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
