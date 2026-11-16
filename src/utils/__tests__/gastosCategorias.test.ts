import { describe, expect, it } from 'vitest'
import { resumoPorCategoria } from '../gastosCategorias'

const g = (spent_on: string, amount: number, category: string) => ({ spent_on, amount, category })
const mesma = (c: string) => c

describe('resumoPorCategoria', () => {
  it('ordena do maior para o menor com percentual e quantidade', () => {
    const r = resumoPorCategoria(
      [g('2026-09-01', 30, 'lazer'), g('2026-09-02', 60, 'casa'), g('2026-09-03', 10, 'lazer')],
      [],
      mesma,
      '2026-09',
      '2026-10-31',
    )
    expect(r.total).toBe(100)
    expect(r.categorias.map((c) => [c.key, c.total, c.percentual, c.quantidade])).toEqual([
      ['casa', 60, 60, 1],
      ['lazer', 40, 40, 2],
    ])
  })

  it('compara com o mês anterior inteiro quando o mês já fechou', () => {
    const r = resumoPorCategoria(
      [g('2026-09-05', 150, 'casa')],
      [g('2026-08-02', 50, 'casa'), g('2026-08-30', 50, 'casa')],
      mesma,
      '2026-09',
      '2026-10-31',
    )
    expect(r.ateHoje).toBe(false)
    expect(r.categorias[0]).toMatchObject({ anterior: 100, variacao: 50 })
  })

  it('no mês corrente corta o anterior no mesmo dia', () => {
    const r = resumoPorCategoria(
      [g('2026-10-05', 80, 'casa')],
      [g('2026-09-03', 100, 'casa'), g('2026-09-20', 500, 'casa')],
      mesma,
      '2026-10',
      '2026-10-10',
    )
    expect(r.ateHoje).toBe(true)
    expect(r.totalAnterior).toBe(100)
    expect(r.categorias[0]).toMatchObject({ anterior: 100, variacao: -20 })
  })

  it('categoria nova no mês não tem variação', () => {
    const r = resumoPorCategoria([g('2026-09-01', 10, 'lazer')], [g('2026-08-01', 10, 'casa')], mesma, '2026-09', '2026-10-31')
    expect(r.categorias[0].variacao).toBeNull()
  })

  it('usa a chave normalizada para juntar categoria apagada em outro', () => {
    const chave = (c: string) => (c === 'casa' ? c : 'outro')
    const r = resumoPorCategoria(
      [g('2026-09-01', 0.1, 'uuid-apagada'), g('2026-09-01', 0.2, 'outro')],
      [],
      chave,
      '2026-09',
      '2026-10-31',
    )
    expect(r.categorias).toHaveLength(1)
    expect(r.categorias[0]).toMatchObject({ key: 'outro', total: 0.3, quantidade: 2 })
  })
})
