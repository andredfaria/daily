import { Router, Request, Response } from 'express'
import axios from 'axios'
import pool from '../db'

const router = Router()

// Cache simples em memória para status do WAHA (TTL 30s)
let wahaStatusCache: { connected: boolean; timestamp: number } | null = null
const WAHA_CACHE_TTL_MS = 30_000

async function checkWahaConnected(): Promise<boolean> {
  const now = Date.now()
  if (wahaStatusCache && (now - wahaStatusCache.timestamp) < WAHA_CACHE_TTL_MS) {
    return wahaStatusCache.connected
  }
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const { data } = await axios.get(
      `${process.env.WAHA_URL || 'http://localhost:3000'}/api/sessions/${session}`,
      {
        headers: { 'X-Api-Key': process.env.WAHA_API_KEY || '' },
        timeout: 3000,
      }
    )
    const connected = data?.status === 'WORKING'
    wahaStatusCache = { connected, timestamp: now }
    return connected
  } catch {
    wahaStatusCache = { connected: false, timestamp: now }
    return false
  }
}

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

    const waha_connected = await checkWahaConnected()

    res.json({
      active_bills: billCount.active_bills,
      due_this_week: dueWeek.due_this_week,
      paid_this_month: countRows.paid_count ?? 0,
      waha_connected,
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
    const { status, bill_id, from, to } = req.query
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (status) { conditions.push('o.status = ?'); values.push(status) }
    if (bill_id) { conditions.push('o.bill_id = ?'); values.push(bill_id) }
    if (from) { conditions.push('o.due_date >= ?'); values.push(from) }
    if (to) { conditions.push('o.due_date <= ?'); values.push(to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(limit, offset)

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

// GET /api/occurrences/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=paid
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { status, bill_id, from, to } = req.query
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (status) { conditions.push('o.status = ?'); values.push(status) }
    if (bill_id) { conditions.push('o.bill_id = ?'); values.push(bill_id) }
    if (from) { conditions.push('o.due_date >= ?'); values.push(from) }
    if (to) { conditions.push('o.due_date <= ?'); values.push(to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows]: any = await pool.query(
      `SELECT o.due_date, b.name AS bill_name, o.amount, o.status,
              o.paid_at, o.confirmation_source
       FROM bill_occurrences o
       LEFT JOIN bills b ON b.id = o.bill_id
       ${where}
       ORDER BY o.due_date DESC
       LIMIT 5000`,
      values
    )

    const header = 'Conta,Valor (R$),Vencimento,Status,Pago Em,Origem\n'
    const csvRows = rows.map((r: any) => {
      const dueDate = r.due_date instanceof Date
        ? r.due_date.toISOString().slice(0, 10)
        : String(r.due_date).slice(0, 10)
      const paidAt = r.paid_at
        ? (r.paid_at instanceof Date ? r.paid_at.toISOString().slice(0, 10) : String(r.paid_at).slice(0, 10))
        : ''
      const amount = Number(r.amount).toFixed(2).replace('.', ',')
      const statusLabel: Record<string, string> = {
        paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado',
      }
      const safeStr = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
      return [
        safeStr(r.bill_name ?? ''),
        amount,
        dueDate,
        statusLabel[r.status] ?? r.status,
        paidAt,
        r.confirmation_source ?? '',
      ].join(',')
    })

    const csv = header + csvRows.join('\n')
    const filename = `billsync-historico-${new Date().toISOString().slice(0, 10)}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('﻿' + csv) // BOM para Excel reconhecer UTF-8
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
