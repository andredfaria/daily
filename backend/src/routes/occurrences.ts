import { Router, Request, Response } from 'express'
import pool from '../db'

const router = Router()

// GET /api/occurrences/stats  (antes de /:id para não colidir)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [[countRows]]: any = await pool.query(
      `SELECT
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)                              AS paid_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)                           AS pending_count,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)                           AS overdue_count,
        SUM(CASE WHEN status = 'paid'    THEN bo.amount ELSE 0 END)                    AS monthly_paid_amount,
        SUM(CASE WHEN status = 'pending' THEN bo.amount ELSE 0 END)                  AS monthly_pending_amount,
        SUM(CASE WHEN status = 'overdue' THEN bo.amount ELSE 0 END)                  AS monthly_overdue_amount
       FROM bill_occurrences bo
       JOIN bills b ON b.id = bo.bill_id
       WHERE bo.due_date BETWEEN ? AND ? AND b.user_id = ?`,
      [firstOfMonth, lastOfMonth, req.userId]
    )

    const [[billCount]]: any = await pool.query(
      "SELECT COUNT(*) AS active_bills FROM bills WHERE is_active = 1 AND user_id = ?",
      [req.userId]
    )

    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const [[dueWeek]]: any = await pool.query(
      `SELECT COUNT(*) AS due_this_week FROM bill_occurrences bo
       JOIN bills b ON b.id = bo.bill_id
       WHERE bo.status = 'pending' AND bo.due_date BETWEEN ? AND ? AND b.user_id = ?`,
      [now, weekEnd, req.userId]
    )

    res.json({
      active_bills: billCount.active_bills,
      due_this_week: dueWeek.due_this_week,
      paid_this_month: countRows.paid_count ?? 0,
      waha_connected: false,
      monthly_paid_amount: Number(countRows.monthly_paid_amount) || 0,
      monthly_pending_amount: Number(countRows.monthly_pending_amount) || 0,
      monthly_overdue_amount: Number(countRows.monthly_overdue_amount) || 0,
      paid_count: countRows.paid_count ?? 0,
      pending_count: countRows.pending_count ?? 0,
      overdue_count: countRows.overdue_count ?? 0,
    })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/occurrences/upcoming
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 30
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + days)

    const [rows] = await pool.query(
      `SELECT o.*, b.name AS bill_name, b.amount AS bill_amount
       FROM bill_occurrences o
       LEFT JOIN bills b ON b.id = o.bill_id
       WHERE o.due_date BETWEEN ? AND ? AND o.status = 'pending' AND b.user_id = ?
       ORDER BY o.due_date ASC`,
      [from, to, req.userId]
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/occurrences
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, bill_id, from, to, limit = 200, offset = 0 } = req.query
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (status) { conditions.push('o.status = ?'); values.push(status) }
    if (bill_id) { conditions.push('o.bill_id = ?'); values.push(bill_id) }
    if (from) { conditions.push('o.due_date >= ?'); values.push(from) }
    if (to) { conditions.push('o.due_date <= ?'); values.push(to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(Number(limit), Number(offset))

    const [rows] = await pool.query(
      `SELECT o.*, b.name AS bill_name
       FROM bill_occurrences o
       LEFT JOIN bills b ON b.id = o.bill_id
       ${where}
       ORDER BY o.due_date DESC
       LIMIT ? OFFSET ?`,
      values
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/occurrences/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT o.* FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id WHERE o.id = ? AND b.user_id = ?',
      [req.params.id, req.userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/occurrences/:id/pay
router.patch('/:id/pay', async (req: Request, res: Response) => {
  try {
    const [ownerRows]: any = await pool.query(
      'SELECT o.id FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id WHERE o.id = ? AND b.user_id = ?',
      [req.params.id, req.userId]
    )
    if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })

    const { confirmation_source } = req.body
    const now = new Date()
    await pool.query(
      `UPDATE bill_occurrences
       SET status = 'paid', paid_at = ?, confirmation_source = ?, updated_at = ?
       WHERE id = ?`,
      [now, confirmation_source ?? 'web', now, req.params.id]
    )
    const [rows]: any = await pool.query(
      'SELECT * FROM bill_occurrences WHERE id = ?', [req.params.id]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/occurrences/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const [ownerRows]: any = await pool.query(
      'SELECT o.id FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id WHERE o.id = ? AND b.user_id = ?',
      [req.params.id, req.userId]
    )
    if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })

    const allowed = ['status', 'confirmation_source', 'amount']
    const fields: string[] = []
    const values: any[] = []

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' })

    fields.push('updated_at = ?')
    values.push(new Date())
    values.push(req.params.id)

    await pool.query(`UPDATE bill_occurrences SET ${fields.join(', ')} WHERE id = ?`, values)

    const [rows]: any = await pool.query(
      'SELECT * FROM bill_occurrences WHERE id = ?', [req.params.id]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
