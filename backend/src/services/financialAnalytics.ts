import pool from '../db'

export interface CategoriaTotal {
  category: string
  total: number
  count: number
}

export interface MesProjecao {
  ano: number
  mes: number
  total: number
}

export interface FechamentoMensal {
  total: number
  porCategoria: Array<{ category: string; total: number }>
  orcamento: number | null
  qtdContas: number
}

// Gastos por categoria num intervalo [from, to] (datas YYYY-MM-DD, inclusivas)
export async function gastosPorCategoria(
  userId: string,
  from: string,
  to: string
): Promise<CategoriaTotal[]> {
  const [rows]: any = await pool.query(
    `SELECT COALESCE(b.category, 'outro') AS category,
            SUM(o.amount) AS total,
            COUNT(*) AS count
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      GROUP BY COALESCE(b.category, 'outro')
      ORDER BY total DESC`,
    [userId, from, to]
  )
  return rows.map((r: any) => ({
    category: r.category,
    total: Number(r.total) || 0,
    count: Number(r.count) || 0,
  }))
}

// Soma das ocorrências por mês para os próximos N meses (inclui mês corrente)
export async function projecaoMensal(
  userId: string,
  meses: number
): Promise<MesProjecao[]> {
  const n = Math.min(Math.max(meses, 1), 12)
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + n, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [rows]: any = await pool.query(
    `SELECT YEAR(o.due_date) AS ano, MONTH(o.due_date) AS mes, SUM(o.amount) AS total
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      GROUP BY YEAR(o.due_date), MONTH(o.due_date)
      ORDER BY ano, mes`,
    [userId, toStr(first), toStr(last)]
  )

  const mapa = new Map<string, number>()
  for (const r of rows) mapa.set(`${r.ano}-${r.mes}`, Number(r.total) || 0)

  const resultado: MesProjecao[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    resultado.push({ ano, mes, total: mapa.get(`${ano}-${mes}`) ?? 0 })
  }
  return resultado
}

// Soma das ocorrências por mês para os últimos N meses, incluindo o mês corrente (parcial)
export async function historicoMensal(
  userId: string,
  meses: number
): Promise<MesProjecao[]> {
  const n = Math.min(Math.max(meses, 1), 12)
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [rows]: any = await pool.query(
    `SELECT YEAR(o.due_date) AS ano, MONTH(o.due_date) AS mes, SUM(o.amount) AS total
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      GROUP BY YEAR(o.due_date), MONTH(o.due_date)
      ORDER BY ano, mes`,
    [userId, toStr(first), toStr(last)]
  )

  const mapa = new Map<string, number>()
  for (const r of rows) mapa.set(`${r.ano}-${r.mes}`, Number(r.total) || 0)

  const resultado: MesProjecao[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    resultado.push({ ano, mes, total: mapa.get(`${ano}-${mes}`) ?? 0 })
  }
  return resultado
}

// Fechamento de um mês específico (1-based)
export async function fechamentoMensal(
  userId: string,
  ano: number,
  mes: number
): Promise<FechamentoMensal> {
  const first = new Date(ano, mes - 1, 1)
  const last = new Date(ano, mes, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const porCategoria = await gastosPorCategoria(userId, toStr(first), toStr(last))
  const total = porCategoria.reduce((acc, c) => acc + c.total, 0)
  const qtdContas = porCategoria.reduce((acc, c) => acc + c.count, 0)

  const [[user]]: any = await pool.query(
    'SELECT monthly_budget_limit FROM users WHERE id = ?',
    [userId]
  )
  const orcamento = user?.monthly_budget_limit != null ? Number(user.monthly_budget_limit) : null

  return {
    total,
    porCategoria: porCategoria.map((c) => ({ category: c.category, total: c.total })),
    orcamento,
    qtdContas,
  }
}

export interface OcorrenciaTop {
  id: string
  bill_id: string
  bill_name: string
  category: string
  amount: number
  due_date: string
}

// Maiores ocorrências (contas) por valor num intervalo [from, to]
export async function topOcorrencias(
  userId: string,
  from: string,
  to: string,
  limit: number
): Promise<OcorrenciaTop[]> {
  const lim = Math.min(Math.max(limit, 1), 20)
  const [rows]: any = await pool.query(
    `SELECT o.id, o.bill_id, b.name AS bill_name, COALESCE(b.category, 'outro') AS category,
            o.amount, o.due_date
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1
        AND o.due_date BETWEEN ? AND ?
      ORDER BY o.amount DESC
      LIMIT ?`,
    [userId, from, to, lim]
  )
  return rows.map((r: any) => ({
    id: r.id,
    bill_id: r.bill_id,
    bill_name: r.bill_name,
    category: r.category,
    amount: Number(r.amount) || 0,
    due_date: r.due_date instanceof Date
      ? r.due_date.toISOString().slice(0, 10)
      : String(r.due_date).slice(0, 10),
  }))
}
