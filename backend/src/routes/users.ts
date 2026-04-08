// backend/src/routes/users.ts
import { Router, Request, Response } from 'express'
import pool from '../db'
import { reloadSchedule } from '../scheduler'

const router = Router()

// GET /api/users/me — retorna o primeiro usuário (single-tenant)
router.get('/me', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM users LIMIT 1')
    if (!rows.length) {
      return res.json({
        id: '00000000-0000-0000-0000-000000000001',
        name: null,
        whatsapp_number: '',
        timezone: 'America/Sao_Paulo',
        is_active: true,
        whatsapp_alerts_enabled: true,
        weekly_summary_enabled: false,
        default_days_before_alert: 3,
        notification_time: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/users/me
router.patch('/me', async (req: Request, res: Response) => {
  try {
    const allowed = [
      'name',
      'whatsapp_number',
      'timezone',
      'is_active',
      'whatsapp_alerts_enabled',
      'weekly_summary_enabled',
      'default_days_before_alert',
      'notification_time',
    ]
    const fields: string[] = []
    const values: any[] = []

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }

    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(new Date())
      await pool.query(`UPDATE users SET ${fields.join(', ')} LIMIT 1`, values)
    }

    const [rows]: any = await pool.query('SELECT * FROM users LIMIT 1')

    // Recarregar o scheduler se preferências de notificação foram alteradas
    const notifFields = ['whatsapp_alerts_enabled', 'notification_time']
    const hasNotifChange = notifFields.some((f) => req.body[f] !== undefined)
    if (hasNotifChange) {
      reloadSchedule().catch((err) =>
        console.error('[users] erro ao recarregar schedule:', err.message)
      )
    }

    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
