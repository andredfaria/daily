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
