import { Router, Request, Response } from 'express'
import pool from '../db'
import { validarMeta } from '../services/expenseGoals'

const router = Router()

// O gasto é somado na leitura: gasto anotado, editado ou apagado já reflete na meta.
const SELECT_METAS = `
  SELECT g.id, g.name, DATE_FORMAT(g.start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(g.end_date, '%Y-%m-%d') AS end_date, g.amount,
         COALESCE((SELECT SUM(e.amount) FROM expenses e
                    WHERE e.user_id = g.user_id AND e.spent_on BETWEEN g.start_date AND g.end_date), 0) AS spent
    FROM expense_goals g
   WHERE g.user_id = ?`

const normalizar = (r: any) => ({ ...r, amount: Number(r.amount), spent: Math.round(Number(r.spent) * 100) / 100 })

// GET /api/expense-goals — todas as metas do usuário, mais recente primeiro
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`${SELECT_METAS} ORDER BY g.start_date DESC, g.created_at DESC`, [req.userId])
    res.json(rows.map(normalizar))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/expense-goals — { name, start_date, end_date, amount }
router.post('/', async (req: Request, res: Response) => {
  try {
    const v = validarMeta(req.body)
    if ('erro' in v) return res.status(400).json({ error: v.erro })
    await pool.query(
      'INSERT INTO expense_goals (user_id, name, start_date, end_date, amount) VALUES (?, ?, ?, ?, ?)',
      [req.userId, v.name, v.start_date, v.end_date, v.amount],
    )
    res.status(201).json({ ok: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/expense-goals/:id — mesmos campos do POST, todos obrigatórios
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const v = validarMeta(req.body)
    if ('erro' in v) return res.status(400).json({ error: v.erro })
    const [r]: any = await pool.query(
      'UPDATE expense_goals SET name = ?, start_date = ?, end_date = ?, amount = ? WHERE id = ? AND user_id = ?',
      [v.name, v.start_date, v.end_date, v.amount, req.params.id, req.userId],
    )
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Meta não encontrada' })
    res.json({ ok: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/expense-goals/:id — os gastos continuam, só a meta some
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.query('DELETE FROM expense_goals WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Meta não encontrada' })
    res.status(204).end()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
