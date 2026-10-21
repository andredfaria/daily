import { intervaloDoMes, mesesAte, montarFechamento, montarHistorico, validarMes } from '../fechamentoContas'

describe('validarMes', () => {
  it('aceita AAAA-MM com mês de 01 a 12', () => {
    expect(validarMes('2026-10')).toBe('2026-10')
    expect(validarMes('2026-01')).toBe('2026-01')
  })

  it('recusa o resto', () => {
    expect(validarMes('2026-13')).toBeNull()
    expect(validarMes('2026-1')).toBeNull()
    expect(validarMes('2026-10-01')).toBeNull()
    expect(validarMes(undefined)).toBeNull()
    expect(validarMes(['2026-10'])).toBeNull()
  })
})

describe('intervaloDoMes', () => {
  it('vai do dia 1º ao último dia do mês', () => {
    expect(intervaloDoMes('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(intervaloDoMes('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(intervaloDoMes('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('montarFechamento', () => {
  const pago = (id: string, category: string, amount: number, due_date = '2026-10-05') =>
    ({ id, bill_name: id, category, due_date, amount, paid_at: '2026-10-04T15:00:00.000Z', source: 'app' as const })
  const aberto = (id: string, category: string, amount: number, due_date: string, estimado = false) =>
    ({ id, bill_name: id, category, due_date, amount, estimado })

  it('soma pago e em aberto por categoria, maior total primeiro', () => {
    const f = montarFechamento('2026-10', [
      pago('Aluguel', 'casa', 1500),
      pago('Netflix', 'assinaturas', 55.9),
    ], [
      aberto('Luz', 'casa', 180.35, '2026-10-25', true),
      aberto('Spotify', 'assinaturas', 21.9, '2026-10-10'),
    ], '2026-10-21')

    expect(f).toMatchObject({ mes: '2026-10', pago: 1555.9, aberto: 202.25, atrasado: 21.9, qtdPagas: 2, qtdAbertas: 2, qtdAtrasadas: 1 })
    expect(f.categorias.map((c) => [c.category, c.pago, c.aberto, c.total])).toEqual([
      ['casa', 1500, 180.35, 1680.35],
      ['assinaturas', 55.9, 21.9, 77.8],
    ])
  })

  it('marca a situação de cada item e ordena por vencimento', () => {
    const f = montarFechamento('2026-10', [pago('Internet', 'serviços', 100, '2026-10-15')], [
      aberto('Água', 'serviços', 80, '2026-10-21'),
      aberto('Gás', 'serviços', 60, '2026-10-02', true),
    ], '2026-10-21')

    expect(f.categorias[0].itens.map((i) => [i.bill_name, i.situacao, i.estimado])).toEqual([
      ['Gás', 'atrasada', true],
      ['Internet', 'paga', false],
      ['Água', 'a_vencer', false], // vence hoje: ainda não está atrasada
    ])
  })

  it('mês sem conta: tudo zerado', () => {
    expect(montarFechamento('2026-10', [], [], '2026-10-21')).toEqual({
      mes: '2026-10', pago: 0, aberto: 0, atrasado: 0, qtdPagas: 0, qtdAbertas: 0, qtdAtrasadas: 0, categorias: [],
    })
  })
})

describe('mesesAte', () => {
  it('lista os N meses até o informado, virando o ano', () => {
    expect(mesesAte('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesAte('2026-10', 1)).toEqual(['2026-10'])
  })
})

describe('montarHistorico', () => {
  it('um item por mês, zerado quando não há conta', () => {
    expect(montarHistorico(
      ['2026-08', '2026-09', '2026-10'],
      [{ mes: '2026-08', total: 100.005, qtd: 2 }, { mes: '2026-10', total: 50, qtd: 1 }],
      [{ mes: '2026-10', total: 30, qtd: 1 }],
    )).toEqual([
      { mes: '2026-08', pago: 100.01, aberto: 0, qtdPagas: 2, qtdAbertas: 0 },
      { mes: '2026-09', pago: 0, aberto: 0, qtdPagas: 0, qtdAbertas: 0 },
      { mes: '2026-10', pago: 50, aberto: 30, qtdPagas: 1, qtdAbertas: 1 },
    ])
  })
})
