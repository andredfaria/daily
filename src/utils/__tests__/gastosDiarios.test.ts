import { describe, expect, it } from 'vitest'
import { resumoDiario } from '../gastosDiarios'

const g = (spent_on: string, amount: number) => ({ spent_on, amount })

describe('resumoDiario', () => {
  it('mês fechado tem todos os dias, inclusive os sem gasto', () => {
    const r = resumoDiario([g('2026-09-03', 10)], '2026-09', '2026-10-02')
    expect(r.serie).toHaveLength(30)
    expect(r.serie[0]).toEqual({ dia: '2026-09-01', numero: 1, total: 0, acumulado: 0, quantidade: 0 })
    expect(r.serie[2].total).toBe(10)
  })

  it('mês corrente para em hoje', () => {
    const r = resumoDiario([g('2026-10-01', 30)], '2026-10', '2026-10-02')
    expect(r.serie.map((p) => p.numero)).toEqual([1, 2])
    expect(r.mediaPorDia).toBe(15)
  })

  it('soma vários gastos do mesmo dia e acumula sem erro de ponto flutuante', () => {
    const r = resumoDiario(
      [g('2026-09-01', 0.1), g('2026-09-01', 0.2), g('2026-09-02', 45.9)],
      '2026-09',
      '2026-10-02',
    )
    expect(r.serie[0]).toMatchObject({ total: 0.3, quantidade: 2 })
    expect(r.serie[1].acumulado).toBe(46.2)
    expect(r.serie[29].acumulado).toBe(46.2)
  })

  it('maior dia e dias com gasto', () => {
    const r = resumoDiario([g('2026-09-05', 80), g('2026-09-10', 120), g('2026-09-10', 5)], '2026-09', '2026-10-02')
    expect(r.maiorDia?.dia).toBe('2026-09-10')
    expect(r.maiorDia?.total).toBe(125)
    expect(r.diasComGasto).toBe(2)
  })

  it('sem gasto não tem maior dia', () => {
    const r = resumoDiario([], '2026-09', '2026-10-02')
    expect(r.maiorDia).toBeNull()
    expect(r.mediaPorDia).toBe(0)
  })

  it('fevereiro e ano bissexto', () => {
    expect(resumoDiario([], '2027-02', '2027-03-01').serie).toHaveLength(28)
    expect(resumoDiario([], '2028-02', '2028-03-01').serie).toHaveLength(29)
  })

  it('ignora gasto de outro mês', () => {
    const r = resumoDiario([g('2026-08-31', 50)], '2026-09', '2026-10-02')
    expect(r.serie[29].acumulado).toBe(0)
  })
})
