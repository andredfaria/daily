// Série dia a dia dos gastos avulsos de um mês, para o gráfico da página de Gastos.

export interface DiaGasto {
  /** YYYY-MM-DD */
  dia: string
  /** Dia do mês, 1-31 */
  numero: number
  total: number
  acumulado: number
  quantidade: number
}

export interface ResumoDiario {
  serie: DiaGasto[]
  /** Total do mês dividido pelos dias já decorridos (o mês atual não conta os dias que faltam). */
  mediaPorDia: number
  maiorDia: DiaGasto | null
  diasComGasto: number
}

const centavos = (v: number) => Math.round(v * 100) / 100

/**
 * Um ponto por dia, inclusive os sem gasto — barra que falta esconderia o dia
 * parado. No mês corrente a série para em `hoje`: dia futuro com zero puxaria a
 * média para baixo e faria o acumulado parecer estável.
 */
export function resumoDiario(
  gastos: Array<{ spent_on: string; amount: number }>,
  mes: string,
  hoje: string,
): ResumoDiario {
  const [ano, m] = mes.split('-').map(Number)
  const diasNoMes = new Date(ano, m, 0).getDate()
  const ultimoDia = hoje.slice(0, 7) === mes ? Number(hoje.slice(8, 10)) : diasNoMes

  const porDia = new Map<string, { total: number; quantidade: number }>()
  for (const g of gastos) {
    if (g.spent_on.slice(0, 7) !== mes) continue
    const atual = porDia.get(g.spent_on) ?? { total: 0, quantidade: 0 }
    atual.total += g.amount
    atual.quantidade += 1
    porDia.set(g.spent_on, atual)
  }

  const serie: DiaGasto[] = []
  let acumulado = 0
  for (let d = 1; d <= ultimoDia; d++) {
    const dia = `${mes}-${String(d).padStart(2, '0')}`
    const { total, quantidade } = porDia.get(dia) ?? { total: 0, quantidade: 0 }
    acumulado += total
    serie.push({ dia, numero: d, total: centavos(total), acumulado: centavos(acumulado), quantidade })
  }

  const maiorDia = serie.reduce<DiaGasto | null>(
    (maior, p) => (p.total > 0 && (!maior || p.total > maior.total) ? p : maior),
    null,
  )

  return {
    serie,
    mediaPorDia: serie.length ? centavos(acumulado / serie.length) : 0,
    maiorDia,
    diasComGasto: serie.filter((p) => p.quantidade > 0).length,
  }
}
