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

// Ticker normalizado (maiúsculo, sem espaços): letras, números, ponto ou hífen,
// no máximo 20 caracteres. Barra o INSERT estourando por tamanho, string numérica
// tipo "1e400" (vira Infinity, ver validarCampos) e interpolação na URL da brapi
// (ex.: "../QUOTE/X" vazando o Bearer token para um caminho arbitrário).
const TICKER_REGEX = /^[A-Z0-9.\-]{1,20}$/

// Valida e normaliza os campos numéricos vindos do corpo da requisição.
// Devolve a mensagem de erro quando algo é inválido, ou null quando está tudo certo.
// Number.isFinite (em vez de isNaN) rejeita também Infinity/-Infinity — "1e400" é um
// número válido para isNaN, mas estoura a coluna DECIMAL no INSERT.
function validarCampos(body: any): string | null {
  if (body.quantity !== undefined && (!Number.isFinite(Number(body.quantity)) || Number(body.quantity) < 0)) {
    return 'quantidade deve ser um número maior ou igual a zero'
  }
  if (body.avg_price !== undefined && (!Number.isFinite(Number(body.avg_price)) || Number(body.avg_price) < 0)) {
    return 'preço médio deve ser um número maior ou igual a zero'
  }
  for (const campo of ['target_price', 'stop_price'] as const) {
    const valor = body[campo]
    if (valor !== undefined && valor !== null && (!Number.isFinite(Number(valor)) || Number(valor) <= 0)) {
      return `${campo === 'target_price' ? 'preço-alvo' : 'stop'} deve ser um número maior que zero`
    }
  }
  return null
}

// Converte os campos DECIMAL vindos do mysql2 (string) para number,
// preservando null em target_price/stop_price. Normaliza is_active (1/0 do MySQL)
// para booleano. Usado nas rotas de escrita para devolver a linha no mesmo formato
// que o GET já entrega.
function numerarAtivo(a: any): any {
  return {
    ...a,
    quantity: Number(a.quantity),
    avg_price: Number(a.avg_price),
    target_price: a.target_price === null ? null : Number(a.target_price),
    stop_price: a.stop_price === null ? null : Number(a.stop_price),
    is_active: !!a.is_active,
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
          is_active: !!a.is_active,
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

// GET /api/assets/history — evolução diária do patrimônio a partir dos snapshots.
// Precisa vir antes de qualquer rota /:id, senão "history" é lido como id.
router.get('/history', async (req: Request, res: Response) => {
  try {
    const bruto = Number(req.query.days)
    const days = Number.isFinite(bruto) ? Math.min(Math.max(Math.trunc(bruto), 1), 365) : 90

    const desde = new Date()
    desde.setDate(desde.getDate() - days)

    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date,
              SUM(price * quantity)     AS current_value,
              SUM(avg_price * quantity) AS invested_value
         FROM asset_snapshots
        WHERE user_id = ? AND snapshot_date >= ?
        GROUP BY snapshot_date
        ORDER BY snapshot_date`,
      [req.userId, desde]
    )

    res.json({
      pontos: rows.map((r: any) => ({
        date: r.date,
        current_value: Number(r.current_value),
        invested_value: Number(r.invested_value),
      })),
    })
  } catch (err: any) {
    console.error('[assets] erro ao buscar histórico:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/assets
router.post('/', async (req: Request, res: Response) => {
  // Declarado fora do try para ficar acessível no catch (ER_DUP_ENTRY da corrida
  // SELECT→INSERT precisa da mesma mensagem 409 do caminho já detectado acima).
  let symbol: string | undefined
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

    symbol = ticker.trim().toUpperCase()
    if (!TICKER_REGEX.test(symbol)) {
      return res.status(400).json({ error: 'ticker inválido — use letras, números, ponto ou hífen, até 20 caracteres' })
    }

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
    // Duas requisições simultâneas do mesmo ticker passam pelo SELECT e uma bate
    // na unique key — mesma resposta 409 do caminho já detectado, não 500.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `${symbol} já está na sua carteira` })
    }
    console.error('[assets] erro no POST /:', err.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/assets/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ error: erro })

    if (req.body.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active deve ser booleano' })
    }

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

    // Mudar o preço-alvo ou o stop reabre o alerta correspondente: sem isso, quem
    // sobe o alvo depois de um disparo fica com o alerta pausado para sempre, sem
    // entender por quê. Só zera quando o valor de fato muda.
    if (req.body.target_price !== undefined || req.body.stop_price !== undefined) {
      const [[atual]]: any = await pool.query(
        'SELECT target_price, stop_price FROM assets WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId]
      )
      if (!atual) return res.status(404).json({ error: 'ativo não encontrado' })

      if (req.body.target_price !== undefined) {
        const novoAlvo = req.body.target_price === null ? null : Number(req.body.target_price)
        const alvoAtual = atual.target_price === null ? null : Number(atual.target_price)
        if (novoAlvo !== alvoAtual) {
          campos.push('target_triggered_at = NULL')
        }
      }
      if (req.body.stop_price !== undefined) {
        const novoStop = req.body.stop_price === null ? null : Number(req.body.stop_price)
        const stopAtual = atual.stop_price === null ? null : Number(atual.stop_price)
        if (novoStop !== stopAtual) {
          campos.push('stop_triggered_at = NULL')
        }
      }
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
