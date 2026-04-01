import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'

const router = Router()

// GET /api/bills
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bills ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/bills/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM bills WHERE id = ?',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    const bill = rows[0]
    const [methods]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE bill_id = ?',
      [bill.id]
    )
    bill.payment_methods = methods
    res.json(bill)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bills
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name, description, amount, recurrence_type,
      recurrence_day_of_month, recurrence_day_of_week,
      due_date, days_before_alert, is_active = true,
    } = req.body

    const id = uuidv4()
    const now = new Date()

    await pool.query(
      `INSERT INTO bills
        (id, user_id, name, description, amount, recurrence_type,
         recurrence_day_of_month, recurrence_day_of_week, due_date,
         days_before_alert, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, '00000000-0000-0000-0000-000000000001',
        name, description ?? null, amount, recurrence_type,
        recurrence_day_of_month ?? null, recurrence_day_of_week ?? null,
        due_date ?? null, days_before_alert, is_active ? 1 : 0, now, now,
      ]
    )

    const [rows]: any = await pool.query('SELECT * FROM bills WHERE id = ?', [id])
    res.status(201).json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/bills/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const allowed = [
      'name', 'description', 'amount', 'recurrence_type',
      'recurrence_day_of_month', 'recurrence_day_of_week',
      'due_date', 'days_before_alert', 'is_active',
    ]
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

    await pool.query(`UPDATE bills SET ${fields.join(', ')} WHERE id = ?`, values)

    const [rows]: any = await pool.query('SELECT * FROM bills WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/bills/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM bills WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Payment Methods ───────────────────────────────────────────

// GET /api/bills/:billId/payment-methods
router.get('/:billId/payment-methods', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM payment_methods WHERE bill_id = ?',
      [req.params.billId]
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/bills/:billId/payment-methods
router.post('/:billId/payment-methods', async (req: Request, res: Response) => {
  try {
    const {
      type, pix_key_type, pix_key, pix_beneficiary, boleto_code, is_primary = false,
    } = req.body
    const id = uuidv4()

    await pool.query(
      `INSERT INTO payment_methods
        (id, bill_id, type, pix_key_type, pix_key, pix_beneficiary, boleto_code, is_primary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.params.billId, type,
        pix_key_type ?? null, pix_key ?? null, pix_beneficiary ?? null,
        boleto_code ?? null, is_primary ? 1 : 0, new Date(),
      ]
    )

    const [rows]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE id = ?', [id]
    )
    res.status(201).json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/bills/:billId/payment-methods/:methodId
router.patch('/:billId/payment-methods/:methodId', async (req: Request, res: Response) => {
  try {
    const allowed = ['type', 'pix_key_type', 'pix_key', 'pix_beneficiary', 'boleto_code', 'is_primary']
    const fields: string[] = []
    const values: any[] = []

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`)
        values.push(req.body[key])
      }
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' })

    values.push(req.params.methodId)
    await pool.query(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id = ?`, values)

    const [rows]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE id = ?', [req.params.methodId]
    )
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/bills/:billId/payment-methods/:methodId
router.delete('/:billId/payment-methods/:methodId', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM payment_methods WHERE id = ?', [req.params.methodId])
    res.status(204).send()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
