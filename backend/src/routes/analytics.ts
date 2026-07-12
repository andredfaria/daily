import { Router, Request, Response } from 'express'
import { gastosPorCategoria, projecaoMensal, historicoMensal, fechamentoMensal, topOcorrencias } from '../services/financialAnalytics'

const router = Router()

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

// GET /api/analytics/by-category?from=&to=
router.get('/by-category', async (req: Request, res: Response) => {
  try {
    const def = mesAtualRange()
    const from = (req.query.from as string) || def.from
    const to = (req.query.to as string) || def.to

    const categorias = await gastosPorCategoria(req.userId!, from, to)
    const total = categorias.reduce((acc, c) => acc + c.total, 0)
    const comPct = categorias.map((c) => ({
      ...c,
      pct: total > 0 ? Math.round((c.total / total) * 1000) / 10 : 0,
    }))

    res.json({ from, to, total, categorias: comPct })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/analytics/projection?months=6
router.get('/projection', async (req: Request, res: Response) => {
  try {
    const months = Number(req.query.months) || 6
    const dados = await projecaoMensal(req.userId!, months)
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const meses = dados.map((d) => ({
      ano: d.ano,
      mes: d.mes,
      label: `${nomes[d.mes - 1]}/${d.ano}`,
      total: d.total,
    }))
    res.json({ meses })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/analytics/history?months=6
router.get('/history', async (req: Request, res: Response) => {
  try {
    const months = Number(req.query.months) || 6
    const dados = await historicoMensal(req.userId!, months)
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const meses = dados.map((d) => ({
      ano: d.ano,
      mes: d.mes,
      label: `${nomes[d.mes - 1]}/${d.ano}`,
      total: d.total,
    }))
    res.json({ meses })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/analytics/top-occurrences?from=&to=&limit=5
router.get('/top-occurrences', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string }
    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' })
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)
    const ocorrencias = await topOcorrencias(req.userId!, from, to, limit)
    res.json({ ocorrencias })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/analytics/budget — orçamento vs. gasto do mês corrente
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const dados = await fechamentoMensal(req.userId!, now.getFullYear(), now.getMonth() + 1)
    res.json(dados)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
