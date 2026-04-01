import { Router, Request, Response } from 'express'
import pool from '../db'

const router = Router()

// GET /api/users/me — retorna o primeiro usuário (single-tenant)
router.get('/me', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM users LIMIT 1'
    )
    if (!rows.length) {
      return res.json({
        id: '00000000-0000-0000-0000-000000000001',
        name: null,
        whatsapp_number: '',
        timezone: 'America/Sao_Paulo',
        is_active: true,
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
    const allowed = ['name', 'whatsapp_number', 'timezone', 'is_active']
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
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
