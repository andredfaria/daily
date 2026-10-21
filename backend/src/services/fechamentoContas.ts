import pool from '../db'
import { getTodaySaoPaulo } from './notificationMaterializer'

// Fechamento das contas de um mês: o que foi pago (bill_payments, o registro
// gravado no pagamento) e o que ficou em aberto (ocorrências sem paid_at),
// agrupado por categoria. O mês é o do vencimento, como no resto da análise.

export interface PagamentoRegistrado {
  id: string
  bill_name: string
  category: string
  due_date: string // YYYY-MM-DD
  amount: number
  paid_at: string // ISO 8601 (UTC)
}

export interface VencimentoAberto {
  id: string
  bill_name: string
  category: string
  due_date: string // YYYY-MM-DD
  amount: number
  /** Conta variável sem valor real informado: o valor é a estimativa. */
  estimado: boolean
}

export type SituacaoItem = 'paga' | 'atrasada' | 'a_vencer'

export interface ItemFechamento {
  id: string
  bill_name: string
  due_date: string
  amount: number
  situacao: SituacaoItem
  paid_at: string | null
  estimado: boolean
}

export interface CategoriaFechamento {
  category: string
  pago: number
  aberto: number
  total: number
  itens: ItemFechamento[]
}

export interface FechamentoContas {
  mes: string // YYYY-MM
  pago: number
  aberto: number
  /** Parte do aberto com vencimento antes de hoje. */
  atrasado: number
  qtdPagas: number
  qtdAbertas: number
  qtdAtrasadas: number
  categorias: CategoriaFechamento[]
}

const centavos = (v: number) => Math.round(v * 100) / 100

// Mês YYYY-MM válido (ano de 4 dígitos, mês 01–12) ou null.
export function validarMes(mes: unknown): string | null {
  if (typeof mes !== 'string') return null
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes)
  return m ? mes : null
}

// Primeiro e último dia (YYYY-MM-DD) de um mês YYYY-MM.
export function intervaloDoMes(mes: string): { from: string; to: string } {
  const [ano, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return { from: `${mes}-01`, to: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

// Parte pura: junta pagos e abertos por categoria. Categoria com mais dinheiro
// no mês vem primeiro; dentro dela, por vencimento.
export function montarFechamento(
  mes: string, pagamentos: PagamentoRegistrado[], abertos: VencimentoAberto[], hoje: string,
): FechamentoContas {
  const porCategoria = new Map<string, CategoriaFechamento>()
  const grupo = (category: string) => {
    let g = porCategoria.get(category)
    if (!g) {
      g = { category, pago: 0, aberto: 0, total: 0, itens: [] }
      porCategoria.set(category, g)
    }
    return g
  }

  let pago = 0
  let aberto = 0
  let atrasado = 0
  let qtdAtrasadas = 0

  for (const p of pagamentos) {
    const g = grupo(p.category)
    g.pago += p.amount
    pago += p.amount
    g.itens.push({
      id: p.id, bill_name: p.bill_name, due_date: p.due_date, amount: p.amount,
      situacao: 'paga', paid_at: p.paid_at, estimado: false,
    })
  }

  for (const a of abertos) {
    const g = grupo(a.category)
    const situacao: SituacaoItem = a.due_date < hoje ? 'atrasada' : 'a_vencer'
    g.aberto += a.amount
    aberto += a.amount
    if (situacao === 'atrasada') {
      atrasado += a.amount
      qtdAtrasadas++
    }
    g.itens.push({
      id: a.id, bill_name: a.bill_name, due_date: a.due_date, amount: a.amount,
      situacao, paid_at: null, estimado: a.estimado,
    })
  }

  const categorias = [...porCategoria.values()].map((g) => ({
    ...g,
    pago: centavos(g.pago),
    aberto: centavos(g.aberto),
    total: centavos(g.pago + g.aberto),
    itens: g.itens.sort((x, y) => x.due_date.localeCompare(y.due_date) || x.bill_name.localeCompare(y.bill_name, 'pt-BR')),
  }))
  categorias.sort((x, y) => y.total - x.total || x.category.localeCompare(y.category))

  return {
    mes,
    pago: centavos(pago),
    aberto: centavos(aberto),
    atrasado: centavos(atrasado),
    qtdPagas: pagamentos.length,
    qtdAbertas: abertos.length,
    qtdAtrasadas,
    categorias,
  }
}

const data = (v: any): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

export async function fechamentoContas(userId: string, mes: string): Promise<FechamentoContas> {
  const { from, to } = intervaloDoMes(mes)

  const [pagos]: any = await pool.query(
    `SELECT id, bill_name, category, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, amount, paid_at
       FROM bill_payments
      WHERE user_id = ? AND due_date BETWEEN ? AND ?`,
    [userId, from, to]
  )
  // Em aberto só de conta ativa: a desativada não vai mais ser paga. O que ela
  // já pagou continua, porque vem de bill_payments.
  const [abertos]: any = await pool.query(
    `SELECT o.id, b.name AS bill_name, COALESCE(b.category, 'outro') AS category,
            DATE_FORMAT(o.due_date, '%Y-%m-%d') AS due_date, o.amount,
            (b.is_fixed = 0 AND o.amount_is_actual = 0) AS estimado
       FROM bill_occurrences o
       JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.paid_at IS NULL
        AND o.due_date BETWEEN ? AND ?`,
    [userId, from, to]
  )

  return montarFechamento(
    mes,
    pagos.map((r: any) => ({
      id: r.id,
      bill_name: r.bill_name,
      category: r.category,
      due_date: data(r.due_date),
      amount: Number(r.amount) || 0,
      paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : String(r.paid_at),
    })),
    abertos.map((r: any) => ({
      id: r.id,
      bill_name: r.bill_name,
      category: r.category,
      due_date: data(r.due_date),
      amount: Number(r.amount) || 0,
      estimado: !!Number(r.estimado),
    })),
    getTodaySaoPaulo(),
  )
}
