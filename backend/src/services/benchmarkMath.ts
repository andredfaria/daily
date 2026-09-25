/**
 * Contas puras do comparativo da carteira com CDI e IBOV. Tudo aqui trabalha
 * com datas 'YYYY-MM-DD' e devolve rentabilidade acumulada em %, a partir do
 * primeiro dia da janela — é o que deixa as três linhas começarem juntas no zero.
 */

export interface SnapshotDoDia {
  assetId: string
  date: string
  price: number
  quantity: number
}

export interface TaxaDiaria {
  date: string
  /** Taxa do dia em %, como o Banco Central publica (0.050788 = 0,050788% a.d.). */
  pct: number
}

export interface Fechamento {
  date: string
  close: number
}

export interface PontoComparativo {
  date: string
  carteira: number
  cdi: number | null
  ibov: number | null
}

const paraPct = (fator: number): number => (fator - 1) * 100

interface PassoDiario {
  date: string
  /** Valor da carteira de ontem com os preços de ontem. */
  valorOntem: number
  /** Valor da carteira de ontem — mesmas quantidades — com os preços de hoje. */
  valorOntemAPrecoDeHoje: number
  /** Valor da carteira de hoje, já com aportes e retiradas. */
  valorHoje: number
}

const valorDoDia = (dia: Map<string, SnapshotDoDia>): number => {
  let total = 0
  for (const s of dia.values()) total += s.quantity * s.price
  return total
}

/**
 * Anda pelos snapshots dia a dia, separando o que foi mercado do que foi
 * aporte: comprar mais de um ativo muda a quantidade de hoje, não a de ontem,
 * então o aporte nunca aparece como ganho. Ativo que sumiu de um dia para o
 * outro (vendido, desativado) entra com o preço de ontem: retorno zero, em vez
 * de uma queda falsa do tamanho da posição.
 */
function passosDiarios(snapshots: SnapshotDoDia[]): { primeiro: string | null; valorInicial: number; passos: PassoDiario[] } {
  const porData = new Map<string, Map<string, SnapshotDoDia>>()
  for (const s of snapshots) {
    if (!porData.has(s.date)) porData.set(s.date, new Map())
    porData.get(s.date)!.set(s.assetId, s)
  }

  const datas = [...porData.keys()].sort()
  if (datas.length === 0) return { primeiro: null, valorInicial: 0, passos: [] }

  const passos: PassoDiario[] = []
  for (let i = 1; i < datas.length; i++) {
    const ontem = porData.get(datas[i - 1])!
    const hoje = porData.get(datas[i])!

    let valorOntemAPrecoDeHoje = 0
    for (const s of ontem.values()) {
      const precoHoje = hoje.get(s.assetId)?.price ?? s.price
      valorOntemAPrecoDeHoje += s.quantity * precoHoje
    }

    passos.push({
      date: datas[i],
      valorOntem: valorDoDia(ontem),
      valorOntemAPrecoDeHoje,
      valorHoje: valorDoDia(hoje),
    })
  }

  return { primeiro: datas[0], valorInicial: valorDoDia(porData.get(datas[0])!), passos }
}

/** Rentabilidade acumulada da carteira em %, descontando aportes e retiradas. */
export function rentabilidadeCarteira(snapshots: SnapshotDoDia[]): { date: string; pct: number }[] {
  const { primeiro, passos } = passosDiarios(snapshots)
  if (primeiro === null) return []

  const serie = [{ date: primeiro, pct: 0 }]
  let fator = 1
  for (const p of passos) {
    // Carteira vazia ontem (só watchlist, ou primeira compra hoje): não há
    // base para medir retorno, o dia passa sem mexer no acumulado.
    if (p.valorOntem > 0) fator *= p.valorOntemAPrecoDeHoje / p.valorOntem
    serie.push({ date: p.date, pct: paraPct(fator) })
  }
  return serie
}

export interface VariacaoPeriodo {
  inicio: string
  fim: string
  patrimonio: number
  /** Quanto o mercado mexeu no patrimônio, em R$, sem contar aportes. */
  ganho: number
  /** O mesmo em %, encadeado dia a dia. */
  pct: number
}

/**
 * Resumo de um período: patrimônio no fim e quanto o mercado rendeu nele.
 * Precisa de pelo menos dois dias — com um só não há variação a contar.
 */
export function variacaoPeriodo(snapshots: SnapshotDoDia[]): VariacaoPeriodo | null {
  const { primeiro, passos } = passosDiarios(snapshots)
  if (primeiro === null || passos.length === 0) return null

  let fator = 1
  let ganho = 0
  for (const p of passos) {
    if (p.valorOntem > 0) fator *= p.valorOntemAPrecoDeHoje / p.valorOntem
    ganho += p.valorOntemAPrecoDeHoje - p.valorOntem
  }

  const ultimo = passos[passos.length - 1]
  return { inicio: primeiro, fim: ultimo.date, patrimonio: ultimo.valorHoje, ganho, pct: paraPct(fator) }
}

/**
 * CDI acumulado de `datas[0]` até cada data. A taxa publicada para o dia d rende
 * de d para o dia útil seguinte, então o acumulado em D usa os dias d < D.
 * Fim de semana e feriado não têm taxa e simplesmente não rendem.
 */
export function acumularCdi(taxas: TaxaDiaria[], datas: string[]): number[] {
  if (datas.length === 0) return []
  const inicio = datas[0]
  const ordenadas = [...taxas].sort((a, b) => a.date.localeCompare(b.date))

  let fator = 1
  let j = 0
  while (j < ordenadas.length && ordenadas[j].date < inicio) j++

  return datas.map((data) => {
    while (j < ordenadas.length && ordenadas[j].date < data) {
      fator *= 1 + ordenadas[j].pct / 100
      j++
    }
    return paraPct(fator)
  })
}

/** Último fechamento em ou antes da data — sábado herda o pregão de sexta. */
function fechamentoAte(fechamentos: Fechamento[], data: string): number | null {
  let achado: number | null = null
  for (const f of fechamentos) {
    if (f.date > data) break
    achado = f.close
  }
  return achado
}

/**
 * Variação do índice de `datas[0]` até cada data. Sem fechamento na base (o
 * histórico da brapi não chega tão longe), a série inteira é null: comparar
 * contra uma base deslocada seria pior que não mostrar.
 */
export function acumularIndice(fechamentos: Fechamento[], datas: string[]): (number | null)[] {
  if (datas.length === 0) return []
  const ordenados = [...fechamentos]
    .filter((f) => Number.isFinite(f.close) && f.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const base = fechamentoAte(ordenados, datas[0])
  if (base === null) return datas.map(() => null)

  return datas.map((data) => {
    const close = fechamentoAte(ordenados, data)
    return close === null ? null : (close / base - 1) * 100
  })
}

export function montarComparativo(
  snapshots: SnapshotDoDia[],
  taxasCdi: TaxaDiaria[] | null,
  fechamentosIbov: Fechamento[] | null,
): PontoComparativo[] {
  const carteira = rentabilidadeCarteira(snapshots)
  const datas = carteira.map((p) => p.date)
  const cdi = taxasCdi ? acumularCdi(taxasCdi, datas) : null
  const ibov = fechamentosIbov ? acumularIndice(fechamentosIbov, datas) : null

  return carteira.map((p, i) => ({
    date: p.date,
    carteira: p.pct,
    cdi: cdi ? cdi[i] : null,
    ibov: ibov ? ibov[i] : null,
  }))
}
