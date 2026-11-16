// Resumo dos gastos avulsos do mês por categoria, com o mês anterior ao lado.

export interface CategoriaResumo {
  key: string
  total: number
  quantidade: number
  /** Fatia do total do mês, 0–100. */
  percentual: number
  /** Mesmo recorte do mês anterior (no mês corrente, só até o mesmo dia). */
  anterior: number
  /** Variação contra `anterior`, em %; null quando o mês anterior não teve gasto nela. */
  variacao: number | null
}

export interface ResumoCategorias {
  categorias: CategoriaResumo[]
  total: number
  /** Total do mês anterior no mesmo recorte usado na comparação. */
  totalAnterior: number
  /** true quando a comparação é parcial (mês corrente, até o dia de hoje). */
  ateHoje: boolean
}

/** Paleta para tema escuro; a cor vem da posição da categoria no mês. */
export const CORES_CATEGORIA = ['#c0c1ff', '#ffb4ab', '#a8dab5', '#f2c078', '#80d5df', '#e8b7d4', '#d0bcff', '#f5a97f']

type Gasto = { spent_on: string; amount: number; category: string }

const centavos = (v: number) => Math.round(v * 100) / 100

/**
 * `chave` normaliza a categoria do gasto (chave apagada vira "outro").
 * No mês corrente o anterior é cortado no mesmo dia: comparar 10 dias contra
 * o mês inteiro faria toda categoria parecer em queda.
 */
export function resumoPorCategoria(
  gastos: Gasto[],
  anteriores: Gasto[],
  chave: (category: string) => string,
  mes: string,
  hoje: string,
): ResumoCategorias {
  const ateHoje = hoje.slice(0, 7) === mes
  const diaLimite = ateHoje ? Number(hoje.slice(8, 10)) : 31

  const atual = new Map<string, { total: number; quantidade: number }>()
  for (const g of gastos) {
    const k = chave(g.category)
    const item = atual.get(k) ?? { total: 0, quantidade: 0 }
    item.total += g.amount
    item.quantidade += 1
    atual.set(k, item)
  }

  const antes = new Map<string, number>()
  let totalAnterior = 0
  for (const g of anteriores) {
    if (Number(g.spent_on.slice(8, 10)) > diaLimite) continue
    const k = chave(g.category)
    antes.set(k, (antes.get(k) ?? 0) + g.amount)
    totalAnterior += g.amount
  }

  const total = [...atual.values()].reduce((s, i) => s + i.total, 0)
  const categorias = [...atual.entries()]
    .map(([key, { total: t, quantidade }]) => {
      const anterior = centavos(antes.get(key) ?? 0)
      return {
        key,
        total: centavos(t),
        quantidade,
        percentual: total > 0 ? Math.round((t / total) * 1000) / 10 : 0,
        anterior,
        variacao: anterior > 0 ? Math.round(((t - anterior) / anterior) * 100) : null,
      }
    })
    .sort((a, b) => b.total - a.total)

  return { categorias, total: centavos(total), totalAnterior: centavos(totalAnterior), ateHoje }
}
