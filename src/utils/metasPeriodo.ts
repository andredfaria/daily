// Metas de gasto por período (viagem, feriado): situação e ordem de exibição.

export interface MetaPeriodo {
  id: string
  name: string
  start_date: string
  end_date: string
  amount: number
  /** Soma dos gastos avulsos dentro do período, calculada pelo backend. */
  spent: number
}

export type EstadoMeta = 'futura' | 'andamento' | 'encerrada'

export interface SituacaoMeta {
  estado: EstadoMeta
  /** Dias do período contando início e fim. */
  dias: number
  /** Dias que faltam contando hoje; 0 fora do andamento. */
  diasRestantes: number
  /** meta - gasto; negativo quando estourou. */
  disponivel: number
  estourou: boolean
  /** Quanto dá por dia no resto do período; null fora do andamento ou estourada. */
  porDia: number | null
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

const centavos = (v: number) => Math.round(v * 100) / 100

export function situacaoMeta(meta: MetaPeriodo, hoje: string): SituacaoMeta {
  const estado: EstadoMeta = hoje < meta.start_date ? 'futura' : hoje > meta.end_date ? 'encerrada' : 'andamento'
  const dias = diasEntre(meta.start_date, meta.end_date) + 1
  const diasRestantes = estado === 'andamento' ? diasEntre(hoje, meta.end_date) + 1 : 0
  const disponivel = centavos(meta.amount - meta.spent)
  const estourou = disponivel < 0
  return {
    estado,
    dias,
    diasRestantes,
    disponivel,
    estourou,
    porDia: estado === 'andamento' && !estourou ? centavos(disponivel / diasRestantes) : null,
  }
}

const ORDEM: Record<EstadoMeta, number> = { andamento: 0, futura: 1, encerrada: 2 }

/** Em andamento primeiro (a que acaba antes no topo), depois as próximas, depois as encerradas da mais recente. */
export function ordenarMetas(metas: MetaPeriodo[], hoje: string): MetaPeriodo[] {
  return [...metas].sort((a, b) => {
    const ea = situacaoMeta(a, hoje).estado
    const eb = situacaoMeta(b, hoje).estado
    if (ea !== eb) return ORDEM[ea] - ORDEM[eb]
    if (ea === 'andamento') return a.end_date.localeCompare(b.end_date)
    if (ea === 'futura') return a.start_date.localeCompare(b.start_date)
    return b.end_date.localeCompare(a.end_date)
  })
}
