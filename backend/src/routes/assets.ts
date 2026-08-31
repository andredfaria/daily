import { Router, Request, Response } from 'express'
import pool from '../db'
import { fetchQuote, validateTicker } from '../services/brapi'
import {
  AssetKind,
  investedValue,
  currentValue,
  profitLoss,
  profitLossPct,
} from '../services/assetMath'

const router = Router()

const KINDS: AssetKind[] = ['stock', 'fii', 'crypto']

// Valida e normaliza os campos numéricos vindos do corpo da requisição.
// Devolve a mensagem de erro quando algo é inválido, ou null quando está tudo certo.
function validarCampos(body: any): string | null {
  if (body.quantity !== undefined && (isNaN(Number(body.quantity)) || Number(body.quantity) < 0)) {
    return 'quantidade deve ser um número maior ou igual a zero'
  }
  if (body.avg_price !== undefined && (isNaN(Number(body.avg_price)) || Number(body.avg_price) < 0)) {
    return 'preço médio deve ser um número maior ou igual a zero'
  }
  for (const campo of ['target_price', 'stop_price'] as const) {
    const valor = body[campo]
    if (valor !== undefined && valor !== null && (isNaN(Number(valor)) || Number(valor) <= 0)) {
      return `${campo === 'target_price' ? 'preço-alvo' : 'stop'} deve ser um número maior que zero`
    }
  }
  return null
}

// Converte os campos DECIMAL vindos do mysql2 (string) para number,
// preservando null em target_price/stop_price. Usado nas rotas de escrita
// para devolver a linha no mesmo formato numérico que o GET já entrega.
function numerarAtivo(a: any): any {
  return {
    ...a,
    quantity: Number(a.quantity),
    avg_price: Number(a.avg_price),
    target_price: a.target_price === null ? null : Number(a.target_price),
    stop_price: a.stop_price === null ? null : Number(a.stop_price),
  }
}

// GET /api/assets — lista com cotação e resultado calculado
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE user_id = ? ORDER BY ticker ASC',
      [req.userId]
    )

    const comCotacao = await Promise.all(
      rows.map(async (a: any) => {
        const quote = await fetchQuote(a.ticker, a.kind)
        const quantity = Number(a.quantity)
        const avgPrice = Number(a.avg_price)
        const price = quote ? quote.price : (a.last_price === null ? null : Number(a.last_price))

        return {
          ...a,
          quantity,
          avg_price: avgPrice,
          target_price: a.target_price === null ? null : Number(a.target_price),
          stop_price: a.stop_price === null ? null : Number(a.stop_price),
          short_name: quote?.shortName ?? a.ticker,
          current_price: price,
          quote_stale: !quote,
          invested_value: investedValue(quantity, avgPrice),
          current_value: price === null ? null : currentValue(quantity, price),
          profit_loss: price === null ? null : profitLoss(quantity, avgPrice, price),
          profit_loss_pct: price === null ? null : profitLossPct(avgPrice, price),
        }
      })
    )

    res.json(comCotacao)
  } catch (err: any) {
    console.error('[assets] erro no GET /:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/assets
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      ticker, kind = 'stock', quantity = 0, avg_price = 0,
      target_price = null, stop_price = null,
    } = req.body

    if (!ticker || typeof ticker !== 'string' || !ticker.trim()) {
      return res.status(400).json({ error: 'ticker é obrigatório' })
    }
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: `tipo inválido — use um de: ${KINDS.join(', ')}` })
    }
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ error: erro })

    const symbol = ticker.trim().toUpperCase()

    const [existente]: any = await pool.query(
      'SELECT id FROM assets WHERE user_id = ? AND ticker = ?',
      [req.userId, symbol]
    )
    if (existente.length) {
      return res.status(409).json({ error: `${symbol} já está na sua carteira` })
    }

    if (!(await validateTicker(symbol, kind))) {
      return res.status(422).json({ error: `não encontrei cotação para ${symbol}` })
    }

    await pool.query(
      `INSERT INTO assets (user_id, ticker, kind, quantity, avg_price, target_price, stop_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, symbol, kind, Number(quantity), Number(avg_price),
       target_price === null ? null : Number(target_price),
       stop_price === null ? null : Number(stop_price)]
    )

    const [criado]: any = await pool.query(
      'SELECT * FROM assets WHERE user_id = ? AND ticker = ?',
      [req.userId, symbol]
    )
    res.status(201).json(numerarAtivo(criado[0]))
  } catch (err: any) {
    console.error('[assets] erro no POST /:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/assets/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ error: erro })

    const campos: string[] = []
    const valores: any[] = []

    for (const campo of ['quantity', 'avg_price', 'target_price', 'stop_price'] as const) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`)
        valores.push(req.body[campo] === null ? null : Number(req.body[campo]))
      }
    }
    if (req.body.is_active !== undefined) {
      campos.push('is_active = ?')
      valores.push(req.body.is_active ? 1 : 0)
    }

    if (!campos.length) return res.status(400).json({ error: 'nenhum campo para atualizar' })

    valores.push(req.params.id, req.userId)
    const [result]: any = await pool.query(
      `UPDATE assets SET ${campos.join(', ')} WHERE id = ? AND user_id = ?`,
      valores
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })

    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    res.json(numerarAtivo(rows[0]))
  } catch (err: any) {
    console.error('[assets] erro no PATCH /:id:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/assets/:id/rearm — reativa os alertas pausados
router.post('/:id/rearm', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      `UPDATE assets SET target_triggered_at = NULL, stop_triggered_at = NULL
        WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })

    const [rows]: any = await pool.query(
      'SELECT * FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    res.json(numerarAtivo(rows[0]))
  } catch (err: any) {
    console.error('[assets] erro no POST /:id/rearm:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// DELETE /api/assets/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      'DELETE FROM assets WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'ativo não encontrado' })
    res.status(204).send()
  } catch (err: any) {
    console.error('[assets] erro no DELETE /:id:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
