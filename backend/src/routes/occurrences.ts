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

    const [[billCount]]: any = await pool.query(
      'SELECT COUNT(*) AS active_bills FROM bills WHERE is_active = 1 AND user_id = ?',
      [req.userId]
    )

    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const [[dueWeek]]: any = await pool.query(
      `SELECT COUNT(*) AS due_this_week FROM bill_occurrences bo
       JOIN bills b ON b.id = bo.bill_id
       WHERE bo.due_date BETWEEN ? AND ? AND b.user_id = ?`,
      [now, weekEnd, req.userId]
    )

    const waha_connected = await checkWahaConnected()

    res.json({
      active_bills: billCount.active_bills,
      due_this_week: dueWeek.due_this_week,
      waha_connected,
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
       WHERE o.due_date BETWEEN ? AND ? AND b.user_id = ?
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
    const { bill_id, from, to } = req.query
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

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

// GET /api/occurrences/export?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { bill_id, from, to } = req.query
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (bill_id) { conditions.push('o.bill_id = ?'); values.push(bill_id) }
    if (from) { conditions.push('o.due_date >= ?'); values.push(from) }
    if (to) { conditions.push('o.due_date <= ?'); values.push(to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows]: any = await pool.query(
      `SELECT o.due_date, b.name AS bill_name, o.amount
       FROM bill_occurrences o
       LEFT JOIN bills b ON b.id = o.bill_id
       ${where}
       ORDER BY o.due_date DESC
       LIMIT 5000`,
      values
    )

    // Ponto e vírgula, e não vírgula: o valor sai em formato pt-BR ("1234,56") e
    // é esse o separador de lista que o Excel em português espera. Com vírgula,
    // o decimal do valor virava uma coluna extra e desalinhava a planilha toda.
    const SEP = ';'
    // Todo campo entre aspas (RFC 4180) — assim separador, aspas e quebra de
    // linha dentro do nome da conta não vazam para fora da célula.
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const header = ['Conta', 'Valor (R$)', 'Vencimento'].map(cell).join(SEP)
    const csvRows = rows.map((r: any) => {
      const dueDate = r.due_date instanceof Date
        ? r.due_date.toISOString().slice(0, 10)
        : String(r.due_date).slice(0, 10)
      const amount = Number(r.amount).toFixed(2).replace('.', ',')
      return [cell(r.bill_name ?? ''), cell(amount), cell(dueDate)].join(SEP)
    })

    // CRLF é o fim de linha que o RFC 4180 pede e o Excel trata sem surpresa.
    const csv = [header, ...csvRows].join('\r\n')
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


export default router
