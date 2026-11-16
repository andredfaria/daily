// Gastos de fim de semana: cada bloco vai do dia de início ao de fim escolhidos
// (padrão quinta a domingo; pode virar a semana, ex.: sexta a segunda).

export interface DiaFimDeSemana {
  dia: string
  total: number
  /** Dia ainda não chegou (fim de semana em andamento). */
  futuro: boolean
}

export interface FimDeSemana {
  /** Primeiro dia do bloco, YYYY-MM-DD. */
  inicio: string
  /** Último dia do bloco, YYYY-MM-DD. */
  fim: string
  dias: DiaFimDeSemana[]
  total: number
  emAndamento: boolean
  /** null sem meta; no fim de semana em andamento, false só se já estourou. */
  dentroDaMeta: boolean | null
}

export interface ResumoFinsDeSemana {
  /** Mais recente primeiro. */
  fins: FimDeSemana[]
  /** Média dos fins de semana fechados; null se nenhum fechou. */
  media: number | null
  fechados: number
  /** Fechados dentro da meta. */
  dentro: number
}

type Gasto = { spent_on: string; amount: number }

const centavos = (v: number) => Math.round(v * 100) / 100

const somarDias = (dia: string, n: number): string => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

const diaDaSemana = (dia: string): number => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Quantos dias tem o bloco; início igual ao fim é um dia só. */
export const duracaoBloco = (inicioDow: number, fimDow: number) => ((fimDow - inicioDow + 7) % 7) + 1

/**
 * Fins de semana que encostam no mês (inclusive o que começa no mês anterior
 * ou termina no seguinte) e já começaram até `hoje`. `gastos` precisa cobrir
 * os dias de fora do mês para o total desses blocos sair inteiro.
 */
export function finsDeSemanaDoMes(
  gastos: Gasto[],
  mes: string,
  hoje: string,
  meta: number | null,
  inicioDow = 4,
  fimDow = 0,
): ResumoFinsDeSemana {
  const duracao = duracaoBloco(inicioDow, fimDow)
  const porDia = new Map<string, number>()
  for (const g of gastos) porDia.set(g.spent_on, (porDia.get(g.spent_on) ?? 0) + g.amount)

  const primeiro = `${mes}-01`
  // Início do bloco que contém o dia 1; se o dia 1 cai fora de bloco, o próximo início.
  const recuo = (diaDaSemana(primeiro) - inicioDow + 7) % 7
  let inicio = recuo < duracao ? somarDias(primeiro, -recuo) : somarDias(primeiro, 7 - recuo)

  const fins: FimDeSemana[] = []
  while (inicio.slice(0, 7) <= mes && inicio <= hoje) {
    const dias = Array.from({ length: duracao }, (_, i) => {
      const dia = somarDias(inicio, i)
      return { dia, total: centavos(porDia.get(dia) ?? 0), futuro: dia > hoje }
    })
    const total = centavos(dias.reduce((s, d) => s + d.total, 0))
    const fim = dias[duracao - 1].dia
    // O último dia ainda conta como em andamento: o domingo não acabou.
    const emAndamento = fim >= hoje
    fins.push({ inicio, fim, dias, total, emAndamento, dentroDaMeta: meta === null ? null : total <= meta })
    inicio = somarDias(inicio, 7)
  }

  const fechadosLista = fins.filter((f) => !f.emAndamento)
  const media = fechadosLista.length > 0
    ? centavos(fechadosLista.reduce((s, f) => s + f.total, 0) / fechadosLista.length)
    : null
  return {
    fins: fins.reverse(),
    media,
    fechados: fechadosLista.length,
    dentro: meta === null ? 0 : fechadosLista.filter((f) => f.total <= meta).length,
  }
}
