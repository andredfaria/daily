import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { generateOccurrencesForBill, regenerateOccurrencesForBill } from '../services/occurrenceGenerator'

const router = Router()

// GET /api/bills
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    )
    if (!rows.length) return res.json([])

    const billIds = rows.map((b: any) => b.id)
    const [methods]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE bill_id IN (?)',
      [billIds]
    )

    const byBill: Record<string, any[]> = {}
    for (const m of methods) {
      if (!byBill[m.bill_id]) byBill[m.bill_id] = []
      byBill[m.bill_id].push(m)
    }

    res.json(rows.map((b: any) => ({ ...b, payment_methods: byBill[b.id] ?? [] })))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/bills/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    const bill = rows[0]
    const [methods]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE bill_id = ?',
      [bill.id]
    )
    bill.payment_methods = methods
    res.json(bill)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
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
        id, req.userId,
        name, description ?? null, amount, recurrence_type,
        recurrence_day_of_month ?? null, recurrence_day_of_week ?? null,
        due_date ?? null, days_before_alert, is_active ? 1 : 0, now, now,
      ]
    )

    const [rows]: any = await pool.query('SELECT * FROM bills WHERE id = ?', [id])
    const bill = rows[0]

    generateOccurrencesForBill(id, {
      recurrence_type: bill.recurrence_type,
      recurrence_day_of_month: bill.recurrence_day_of_month,
      recurrence_day_of_week: bill.recurrence_day_of_week,
      due_date: bill.due_date,
      amount: bill.amount,
    }).catch((err: any) => console.error('[bills] erro ao gerar ocorrências:', err.message))

    res.status(201).json(bill)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
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
    values.push(req.userId)

    const [result] = await pool.query(`UPDATE bills SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values)
    if ((result as any).affectedRows === 0) return res.status(404).json({ error: 'Not found' })

    const [rows]: any = await pool.query('SELECT * FROM bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    const updatedBill = rows[0]

    const recurrenceChanged = ['recurrence_type', 'recurrence_day_of_month', 'recurrence_day_of_week', 'due_date', 'amount']
      .some(k => req.body[k] !== undefined)
    if (recurrenceChanged) {
      regenerateOccurrencesForBill(req.params.id, {
        recurrence_type: updatedBill.recurrence_type,
        recurrence_day_of_month: updatedBill.recurrence_day_of_month,
        recurrence_day_of_week: updatedBill.recurrence_day_of_week,
        due_date: updatedBill.due_date,
        amount: updatedBill.amount,
      }).catch((err: any) => console.error('[bills] erro ao regenerar ocorrências:', err.message))
    }

    res.json(updatedBill)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/bills/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query('DELETE FROM bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// ─── Payment Methods ───────────────────────────────────────────

// GET /api/bills/:billId/payment-methods
router.get('/:billId/payment-methods', async (req: Request, res: Response) => {
  try {
    const [billRows]: any = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [req.params.billId, req.userId])
    if (!billRows.length) return res.status(404).json({ error: 'Conta não encontrada' })

    const [rows] = await pool.query(
      'SELECT * FROM payment_methods WHERE bill_id = ?',
      [req.params.billId]
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/bills/:billId/payment-methods
router.post('/:billId/payment-methods', async (req: Request, res: Response) => {
  try {
    const [billRows]: any = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [req.params.billId, req.userId])
    if (!billRows.length) return res.status(404).json({ error: 'Conta não encontrada' })

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
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/bills/:billId/payment-methods/:methodId
router.patch('/:billId/payment-methods/:methodId', async (req: Request, res: Response) => {
  try {
    const [billRows]: any = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [req.params.billId, req.userId])
    if (!billRows.length) return res.status(404).json({ error: 'Conta não encontrada' })

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
    values.push(req.params.billId)
    await pool.query(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id = ? AND bill_id = ?`, values)

    const [rows]: any = await pool.query(
      'SELECT * FROM payment_methods WHERE id = ?', [req.params.methodId]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/bills/:billId/payment-methods/:methodId
router.delete('/:billId/payment-methods/:methodId', async (req: Request, res: Response) => {
  try {
    const [billRows]: any = await pool.query('SELECT id FROM bills WHERE id = ? AND user_id = ?', [req.params.billId, req.userId])
    if (!billRows.length) return res.status(404).json({ error: 'Conta não encontrada' })

    await pool.query('DELETE FROM payment_methods WHERE id = ? AND bill_id = ?', [req.params.methodId, req.params.billId])
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
