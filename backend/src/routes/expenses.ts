import { Router, Request, Response } from 'express'
import pool from '../db'
import { formatDateSaoPaulo } from '../services/assetMath'
import { parseValor } from '../services/whatsappCommands'

const router = Router()

const ultimoDiaDoMes = (mes: string): string => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

// GET /api/expenses?month=YYYY-MM — gastos avulsos do mês (padrão: mês atual em São Paulo)
router.get('/', async (req: Request, res: Response) => {
  try {
    const mes = typeof req.query.month === 'string' ? req.query.month : formatDateSaoPaulo(new Date()).slice(0, 7)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return res.status(400).json({ error: 'month deve estar no formato YYYY-MM' })
    }

    const [rows]: any = await pool.query(
      `SELECT id, amount, description, DATE_FORMAT(spent_on, '%Y-%m-%d') AS spent_on, source, created_at
         FROM expenses
        WHERE user_id = ? AND spent_on BETWEEN ? AND ?
        ORDER BY spent_on DESC, created_at DESC`,
      [req.userId, `${mes}-01`, ultimoDiaDoMes(mes)],
    )
    const gastos = rows.map((r: any) => ({ ...r, amount: Number(r.amount) }))
    const total = Math.round(gastos.reduce((s: number, g: any) => s + g.amount, 0) * 100) / 100
    res.json({ month: mes, total, gastos })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/expenses — { amount, description, spent_on? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const amount = typeof req.body.amount === 'number' ? req.body.amount : parseValor(String(req.body.amount ?? ''))
    if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
      return res.status(400).json({ error: 'Valor inválido' })
    }
    const description = String(req.body.description ?? '').trim().slice(0, 120)
    if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' })

    const spentOn = req.body.spent_on ?? formatDateSaoPaulo(new Date())
    if (typeof spentOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || isNaN(Date.parse(spentOn))) {
      return res.status(400).json({ error: 'spent_on deve estar no formato YYYY-MM-DD' })
    }

    const valor = Math.round(amount * 100) / 100
    await pool.query(
      `INSERT INTO expenses (user_id, amount, description, spent_on, source) VALUES (?, ?, ?, ?, 'app')`,
      [req.userId, valor, description, spentOn],
    )
    res.status(201).json({ ok: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/expenses/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Gasto não encontrado' })
    res.status(204).end()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
