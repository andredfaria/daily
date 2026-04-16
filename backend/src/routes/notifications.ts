import { Router, Request, Response } from 'express'
import pool from '../db'

const router = Router()

// GET /api/notifications/due-today
router.get('/due-today', async (req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [rows] = await pool.query(
      `SELECT n.* FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE o.due_date BETWEEN ? AND ? AND n.status = 'scheduled' AND b.user_id = ?
       ORDER BY n.scheduled_for ASC`,
      [today, tomorrow, req.userId]
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (status) { conditions.push('n.status = ?'); values.push(status) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(Number(limit))

    const [rows] = await pool.query(
      `SELECT n.* FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       ${where} ORDER BY n.scheduled_for DESC LIMIT ?`,
      values
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/notifications/:id/sent
router.patch('/:id/sent', async (req: Request, res: Response) => {
  try {
    if (req.userId !== '__service__') {
      const [ownerRows]: any = await pool.query(
        'SELECT n.id FROM notifications n JOIN bill_occurrences o ON o.id = n.bill_occurrence_id JOIN bills b ON b.id = o.bill_id WHERE n.id = ? AND b.user_id = ?',
        [req.params.id, req.userId]
      )
      if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })
    }

    const { waha_message_id } = req.body
    const now = new Date()
    await pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = ?, waha_message_id = ? WHERE id = ?`,
      [now, waha_message_id ?? null, req.params.id]
    )
    const [rows]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/notifications/:id/failed
router.patch('/:id/failed', async (req: Request, res: Response) => {
  try {
    if (req.userId !== '__service__') {
      const [ownerRows]: any = await pool.query(
        'SELECT n.id FROM notifications n JOIN bill_occurrences o ON o.id = n.bill_occurrence_id JOIN bills b ON b.id = o.bill_id WHERE n.id = ? AND b.user_id = ?',
        [req.params.id, req.userId]
      )
      if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })
    }

    const { error_detail } = req.body
    await pool.query(
      `UPDATE notifications SET status = 'failed', error_detail = ? WHERE id = ?`,
      [error_detail ?? null, req.params.id]
    )
    const [rows]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
