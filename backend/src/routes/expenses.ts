import { Router, Request, Response } from 'express'
import pool from '../db'
import { formatDateSaoPaulo } from '../services/assetMath'
import { parseValor } from '../services/whatsappCommands'
import {
  CATEGORIA_RESERVA,
  CategoriaDoUsuario,
  ICONES_CATEGORIA,
  ehPadrao,
  inferirCategoria,
  validarNomeCategoria,
} from '../services/expenseCategories'
import { carregarCategorias, chavesOcultas } from '../services/expenseCategoryStore'

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
      `SELECT id, amount, description, category, DATE_FORMAT(spent_on, '%Y-%m-%d') AS spent_on, source, created_at
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

// --- Categorias (antes das rotas /:id, que casariam com "categories") ---

// GET /api/expenses/categories — padrão e criadas, inclusive ocultas (a tela de gerenciar mostra todas)
router.get('/categories', async (req: Request, res: Response) => {
  try {
    res.json(await carregarCategorias(req.userId!))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

const iconeValido = (icone: unknown): icone is string =>
  typeof icone === 'string' && (ICONES_CATEGORIA as readonly string[]).includes(icone)

// POST /api/expenses/categories — { name, icon }
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const categorias = await carregarCategorias(req.userId!)
    const v = validarNomeCategoria(req.body.name, categorias)
    if ('erro' in v) return res.status(400).json({ error: v.erro })
    const icon = req.body.icon ?? 'more_horiz'
    if (!iconeValido(icon)) return res.status(400).json({ error: 'Ícone inválido' })

    await pool.query('INSERT INTO expense_categories (user_id, name, icon) VALUES (?, ?, ?)', [req.userId, v.nome, icon])
    res.status(201).json(await carregarCategorias(req.userId!))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/expenses/categories/:key — { name?, icon?, hidden? }. Na padrão, grava o ajuste.
router.patch('/categories/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key
    const categorias = await carregarCategorias(req.userId!)
    const atual = categorias.find((c) => c.key === key)
    if (!atual) return res.status(404).json({ error: 'Categoria não encontrada' })

    let nome = atual.nome
    if (req.body.name !== undefined) {
      const v = validarNomeCategoria(req.body.name, categorias, key)
      if ('erro' in v) return res.status(400).json({ error: v.erro })
      nome = v.nome
    }
    let icone = atual.icone
    if (req.body.icon !== undefined) {
      if (!iconeValido(req.body.icon)) return res.status(400).json({ error: 'Ícone inválido' })
      icone = req.body.icon
    }
    let oculta = atual.oculta
    if (req.body.hidden !== undefined) {
      if (key === CATEGORIA_RESERVA && req.body.hidden) {
        return res.status(400).json({ error: `"${atual.nome}" recebe os gastos sem categoria e não pode ser ocultada` })
      }
      oculta = !!req.body.hidden
    }

    if (atual.padrao) {
      await pool.query(
        `INSERT INTO expense_categories (user_id, base_key, name, icon, hidden) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), hidden = VALUES(hidden)`,
        [req.userId, key, nome, icone, oculta],
      )
    } else {
      await pool.query(
        'UPDATE expense_categories SET name = ?, icon = ?, hidden = ? WHERE id = ? AND user_id = ?',
        [nome, icone, oculta, key, req.userId],
      )
    }
    res.json(await carregarCategorias(req.userId!))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/expenses/categories/:key — só as criadas; gastos e contas dela vão para "outro"
router.delete('/categories/:key', async (req: Request, res: Response) => {
  const key = req.params.key
  if (ehPadrao(key)) return res.status(400).json({ error: 'Categoria padrão não pode ser apagada, só ocultada' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result]: any = await conn.query('DELETE FROM expense_categories WHERE id = ? AND user_id = ? AND base_key IS NULL', [key, req.userId])
    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Categoria não encontrada' })
    }
    const [movidos]: any = await conn.query(
      'UPDATE expenses SET category = ? WHERE user_id = ? AND category = ?',
      [CATEGORIA_RESERVA, req.userId, key],
    )
    // A lista é a mesma das contas desde a 026: conta da categoria apagada também vai para a reserva.
    const [contas]: any = await conn.query(
      'UPDATE bills SET category = ? WHERE user_id = ? AND category = ?',
      [CATEGORIA_RESERVA, req.userId, key],
    )
    await conn.commit()
    res.json({
      gastosMovidos: movidos.affectedRows,
      contasMovidas: contas.affectedRows,
      categorias: await carregarCategorias(req.userId!),
    })
  } catch (err: any) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  } finally {
    conn.release()
  }
})

type CamposGasto = { amount?: number; description?: string; category?: string; spent_on?: string }

/**
 * Valida os campos enviados. Na criação valor e descrição são exigidos,
 * spent_on cai em hoje e categoria vazia é deduzida da descrição; na edição só
 * os presentes no corpo são validados e alterados.
 */
function validarGasto(
  body: any,
  parcial: boolean,
  categorias: CategoriaDoUsuario[],
): { campos: CamposGasto } | { erro: string } {
  const campos: CamposGasto = {}

  if (body.amount !== undefined || !parcial) {
    const amount = typeof body.amount === 'number' ? body.amount : parseValor(String(body.amount ?? ''))
    if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
      return { erro: 'Valor inválido' }
    }
    campos.amount = Math.round(amount * 100) / 100
  }

  if (body.description !== undefined || !parcial) {
    const description = String(body.description ?? '').trim().slice(0, 120)
    if (!description) return { erro: 'Descrição é obrigatória' }
    campos.description = description
  }

  if (body.category !== undefined && body.category !== null && body.category !== '') {
    // Qualquer categoria do usuário vale, inclusive oculta: editar um gasto
    // antigo reenvia a categoria que ele já tinha.
    if (!categorias.some((c) => c.key === body.category)) return { erro: 'Categoria inválida' }
    campos.category = body.category
  } else if (!parcial) {
    campos.category = inferirCategoria(campos.description!, chavesOcultas(categorias))
  }

  if (body.spent_on !== undefined || !parcial) {
    const spentOn = body.spent_on ?? formatDateSaoPaulo(new Date())
    if (typeof spentOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || isNaN(Date.parse(spentOn))) {
      return { erro: 'spent_on deve estar no formato YYYY-MM-DD' }
    }
    campos.spent_on = spentOn
  }

  return { campos }
}

// POST /api/expenses — { amount, description, category?, spent_on? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const v = validarGasto(req.body, false, await carregarCategorias(req.userId!))
    if ('erro' in v) return res.status(400).json({ error: v.erro })
    const { amount, description, category, spent_on } = v.campos

    await pool.query(
      `INSERT INTO expenses (user_id, amount, description, category, spent_on, source) VALUES (?, ?, ?, ?, ?, 'app')`,
      [req.userId, amount, description, category, spent_on],
    )
    res.status(201).json({ ok: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/expenses/:id — qualquer subconjunto de { amount, description, category, spent_on }
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const v = validarGasto(req.body, true, await carregarCategorias(req.userId!))
    if ('erro' in v) return res.status(400).json({ error: v.erro })
    const entradas = Object.entries(v.campos)
    if (entradas.length === 0) return res.status(400).json({ error: 'Nada para alterar' })

    const [result]: any = await pool.query(
      `UPDATE expenses SET ${entradas.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ? AND user_id = ?`,
      [...entradas.map(([, val]) => val), req.params.id, req.userId],
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Gasto não encontrado' })
    res.json({ ok: true })
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
