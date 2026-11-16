import { describe, expect, it } from 'vitest'
import { ordenarMetas, situacaoMeta, type MetaPeriodo } from '../metasPeriodo'

const meta = (id: string, start_date: string, end_date: string, amount = 100, spent = 0): MetaPeriodo =>
  ({ id, name: id, start_date, end_date, amount, spent })

describe('situacaoMeta', () => {
  it('em andamento: conta hoje nos dias restantes e divide o que sobra', () => {
    const s = situacaoMeta(meta('v', '2026-11-14', '2026-11-20', 800, 200), '2026-11-16')
    expect(s).toEqual({ estado: 'andamento', dias: 7, diasRestantes: 5, disponivel: 600, estourou: false, porDia: 120 })
  })

  it('último dia ainda está em andamento', () => {
    const s = situacaoMeta(meta('v', '2026-11-14', '2026-11-16'), '2026-11-16')
    expect(s.estado).toBe('andamento')
    expect(s.diasRestantes).toBe(1)
  })

  it('estourada não sugere valor por dia', () => {
    const s = situacaoMeta(meta('v', '2026-11-14', '2026-11-20', 100, 150.5), '2026-11-16')
    expect(s.estourou).toBe(true)
    expect(s.disponivel).toBe(-50.5)
    expect(s.porDia).toBeNull()
  })

  it('futura e encerrada', () => {
    expect(situacaoMeta(meta('f', '2026-12-01', '2026-12-03'), '2026-11-16')).toMatchObject({ estado: 'futura', dias: 3, diasRestantes: 0, porDia: null })
    expect(situacaoMeta(meta('e', '2026-11-01', '2026-11-03'), '2026-11-16').estado).toBe('encerrada')
  })
})

describe('ordenarMetas', () => {
  it('andamento, depois futuras, depois encerradas da mais recente', () => {
    const r = ordenarMetas([
      meta('enc-velha', '2026-09-01', '2026-09-03'),
      meta('fut-longe', '2027-01-01', '2027-01-05'),
      meta('and-longa', '2026-11-01', '2026-11-30'),
      meta('enc-nova', '2026-11-01', '2026-11-10'),
      meta('fut-perto', '2026-12-01', '2026-12-02'),
      meta('and-curta', '2026-11-15', '2026-11-17'),
    ], '2026-11-16')
    expect(r.map((m) => m.id)).toEqual(['and-curta', 'and-longa', 'fut-perto', 'fut-longe', 'enc-nova', 'enc-velha'])
  })
})
