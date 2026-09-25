import {
  rentabilidadeCarteira,
  acumularCdi,
  acumularIndice,
  montarComparativo,
  variacaoPeriodo,
  SnapshotDoDia,
} from '../benchmarkMath'

const snap = (assetId: string, date: string, price: number, quantity: number): SnapshotDoDia => ({
  assetId, date, price, quantity,
})

describe('rentabilidadeCarteira', () => {
  it('começa em zero e acompanha a variação de preço', () => {
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 10),
      snap('a', '2026-09-02', 11, 10),
      snap('a', '2026-09-03', 12.1, 10),
    ])
    expect(serie.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(serie[0].pct).toBe(0)
    expect(serie[1].pct).toBeCloseTo(10)
    expect(serie[2].pct).toBeCloseTo(21)
  })

  it('não conta aporte como ganho', () => {
    // Dobrou a quantidade com o preço parado: patrimônio dobra, retorno zero.
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 10),
      snap('a', '2026-09-02', 10, 20),
    ])
    expect(serie[1].pct).toBeCloseTo(0)
  })

  it('ativo novo não entra no retorno do dia em que aparece', () => {
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 10),
      snap('a', '2026-09-02', 10, 10),
      snap('b', '2026-09-02', 500, 1),
      snap('a', '2026-09-03', 10, 10),
      snap('b', '2026-09-03', 550, 1),
    ])
    expect(serie[1].pct).toBeCloseTo(0)
    // Dia 3: carteira de 600 com b subindo 50 → +8,33%.
    expect(serie[2].pct).toBeCloseTo((650 / 600 - 1) * 100)
  })

  it('ativo que some não vira queda', () => {
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 10),
      snap('b', '2026-09-01', 100, 1),
      snap('a', '2026-09-02', 10, 10),
    ])
    expect(serie[1].pct).toBeCloseTo(0)
  })

  it('pondera o retorno pelo tamanho de cada posição', () => {
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 90),
      snap('b', '2026-09-01', 10, 10),
      snap('a', '2026-09-02', 10, 90),
      snap('b', '2026-09-02', 20, 10),
    ])
    expect(serie[1].pct).toBeCloseTo(10)
  })

  it('carteira sem posição (só watchlist) não gera retorno', () => {
    const serie = rentabilidadeCarteira([
      snap('a', '2026-09-01', 10, 0),
      snap('a', '2026-09-02', 15, 0),
    ])
    expect(serie[1].pct).toBe(0)
  })

  it('devolve vazio sem snapshots', () => {
    expect(rentabilidadeCarteira([])).toEqual([])
  })
})

describe('acumularCdi', () => {
  const taxas = [
    { date: '2026-09-04', pct: 1 }, // antes da janela, ignorada
    { date: '2026-09-07', pct: 1 },
    { date: '2026-09-08', pct: 1 },
    { date: '2026-09-09', pct: 1 },
  ]

  it('rende da data da taxa para a seguinte e compõe os dias', () => {
    const r = acumularCdi(taxas, ['2026-09-07', '2026-09-08', '2026-09-10'])
    expect(r[0]).toBe(0)
    expect(r[1]).toBeCloseTo(1)
    expect(r[2]).toBeCloseTo((1.01 ** 3 - 1) * 100)
  })

  it('fim de semana não rende', () => {
    const r = acumularCdi(taxas, ['2026-09-05', '2026-09-06', '2026-09-07'])
    expect(r).toEqual([0, 0, 0])
  })
})

describe('acumularIndice', () => {
  const fech = [
    { date: '2026-09-04', close: 100 },
    { date: '2026-09-08', close: 110 },
  ]

  it('usa o último pregão em ou antes da data', () => {
    const r = acumularIndice(fech, ['2026-09-05', '2026-09-07', '2026-09-08'])
    expect(r[0]).toBe(0)
    expect(r[1]).toBe(0)
    expect(r[2]).toBeCloseTo(10)
  })

  it('sem fechamento na base, a série inteira é null', () => {
    expect(acumularIndice(fech, ['2026-09-01', '2026-09-08'])).toEqual([null, null])
  })

  it('ignora fechamento inválido', () => {
    const r = acumularIndice([{ date: '2026-09-01', close: 0 }, ...fech], ['2026-09-01'])
    expect(r).toEqual([null])
  })
})

describe('montarComparativo', () => {
  it('alinha as três séries nas datas da carteira', () => {
    const pontos = montarComparativo(
      [snap('a', '2026-09-07', 10, 1), snap('a', '2026-09-08', 11, 1)],
      [{ date: '2026-09-07', pct: 0.05 }],
      [{ date: '2026-09-07', close: 100 }, { date: '2026-09-08', close: 102 }],
    )
    expect(pontos).toHaveLength(2)
    expect(pontos[1].carteira).toBeCloseTo(10)
    expect(pontos[1].cdi).toBeCloseTo(0.05)
    expect(pontos[1].ibov).toBeCloseTo(2)
  })

  it('índice indisponível vira null sem derrubar a carteira', () => {
    const pontos = montarComparativo([snap('a', '2026-09-07', 10, 1)], null, null)
    expect(pontos).toEqual([{ date: '2026-09-07', carteira: 0, cdi: null, ibov: null }])
  })
})

describe('variacaoPeriodo', () => {
  it('separa o ganho de mercado do aporte', () => {
    const v = variacaoPeriodo([
      snap('a', '2026-09-14', 10, 10),
      snap('a', '2026-09-15', 11, 10),
      snap('a', '2026-09-16', 11, 20), // aporte de 10 cotas
      snap('a', '2026-09-17', 12, 20),
    ])!
    expect(v.inicio).toBe('2026-09-14')
    expect(v.fim).toBe('2026-09-17')
    expect(v.patrimonio).toBe(240)
    expect(v.ganho).toBeCloseTo(10 + 20) // +1 em 10 cotas, depois +1 em 20
    expect(v.pct).toBeCloseTo((1.1 * (12 / 11) - 1) * 100)
  })

  it('com um dia só não há variação', () => {
    expect(variacaoPeriodo([snap('a', '2026-09-14', 10, 10)])).toBeNull()
    expect(variacaoPeriodo([])).toBeNull()
  })
})
