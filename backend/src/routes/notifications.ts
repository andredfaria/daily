import { Router, Request, Response } from 'express'
import pool from '../db'
import { runDispatch } from '../dispatcher'

const router = Router()

// GET /api/notifications/due-today
router.get('/due-today', async (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [rows] = await pool.query(
      `SELECT n.* FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       WHERE o.due_date BETWEEN ? AND ? AND n.status = 'scheduled'
       ORDER BY n.scheduled_for ASC`,
      [today, tomorrow]
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query
    const conditions: string[] = []
    const values: any[] = []

    if (status) { conditions.push('status = ?'); values.push(status) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(Number(limit))

    const [rows] = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY scheduled_for DESC LIMIT ?`,
      values
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/:id/sent
router.patch('/:id/sent', async (req: Request, res: Response) => {
  try {
    const { waha_message_id } = req.body
    const now = new Date()
    await pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = ?, waha_message_id = ? WHERE id = ?`,
      [now, waha_message_id ?? null, req.params.id]
    )
    const [rows]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/:id/failed
router.patch('/:id/failed', async (req: Request, res: Response) => {
  try {
    const { error_detail } = req.body
    await pool.query(
      `UPDATE notifications SET status = 'failed', error_detail = ? WHERE id = ?`,
      [error_detail ?? null, req.params.id]
    )
    const [rows]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications/dispatch
// Dispara o envio das notificações do dia imediatamente (manual/debug).
router.post('/dispatch', async (_req: Request, res: Response) => {
  try {
    const result = await runDispatch()
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
