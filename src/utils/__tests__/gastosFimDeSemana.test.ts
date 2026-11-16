import { describe, expect, it } from 'vitest'
import { duracaoBloco, finsDeSemanaDoMes } from '../gastosFimDeSemana'

const g = (spent_on: string, amount: number) => ({ spent_on, amount })

// Novembro de 2026: dia 1 é domingo, então o primeiro bloco começa em 29/10.
describe('finsDeSemanaDoMes', () => {
  it('inclui o bloco que começa no mês anterior e para nos que já começaram', () => {
    const r = finsDeSemanaDoMes([], '2026-11', '2026-11-16', null)
    expect(r.fins.map((f) => [f.inicio, f.fim])).toEqual([
      ['2026-11-12', '2026-11-15'],
      ['2026-11-05', '2026-11-08'],
      ['2026-10-29', '2026-11-01'],
    ])
  })

  it('soma só de quinta a domingo, inclusive dias de fora do mês', () => {
    const r = finsDeSemanaDoMes(
      [g('2026-10-29', 50), g('2026-11-01', 25.5), g('2026-11-02', 999), g('2026-11-04', 999), g('2026-11-07', 40), g('2026-11-07', 10)],
      '2026-11',
      '2026-11-16',
      null,
    )
    const [, segundo, primeiro] = r.fins
    expect(primeiro.total).toBe(75.5)
    expect(segundo.total).toBe(50)
    expect(segundo.dias.map((d) => d.total)).toEqual([0, 0, 50, 0])
  })

  it('termina no mês seguinte quando a quinta é do mês', () => {
    // Outubro de 2026: dia 29 é quinta, domingo é 01/11.
    const r = finsDeSemanaDoMes([g('2026-11-01', 30)], '2026-10', '2026-11-16', null)
    expect(r.fins[0]).toMatchObject({ inicio: '2026-10-29', fim: '2026-11-01', total: 30, emAndamento: false })
    expect(r.fins[r.fins.length - 1].inicio).toBe('2026-10-01')
  })

  it('marca o fim de semana em andamento e não conta na média', () => {
    const r = finsDeSemanaDoMes([g('2026-11-13', 100), g('2026-11-19', 80)], '2026-11', '2026-11-20', 90)
    const atual = r.fins[0]
    expect(atual).toMatchObject({ inicio: '2026-11-19', emAndamento: true, total: 80, dentroDaMeta: true })
    expect(atual.dias.map((d) => d.futuro)).toEqual([false, false, true, true])
    expect(r.fechados).toBe(3)
    expect(r.media).toBe(33.33)
    expect(r.dentro).toBe(2)
    expect(r.fins[1].dentroDaMeta).toBe(false)
  })

  it('sem meta não julga e média é null sem fim de semana fechado', () => {
    const r = finsDeSemanaDoMes([g('2026-10-01', 10)], '2026-10', '2026-10-02', null)
    expect(r.fins).toHaveLength(1)
    expect(r.fins[0].dentroDaMeta).toBeNull()
    expect(r.media).toBeNull()
    expect(r.dentro).toBe(0)
  })

  it('usa os dias escolhidos, inclusive virando a semana', () => {
    // Sexta a segunda: 30/10 a 02/11 encosta em novembro.
    const r = finsDeSemanaDoMes([g('2026-11-02', 20), g('2026-11-03', 999)], '2026-11', '2026-11-16', null, 5, 1)
    expect(r.fins.map((f) => [f.inicio, f.fim])).toEqual([
      ['2026-11-13', '2026-11-16'],
      ['2026-11-06', '2026-11-09'],
      ['2026-10-30', '2026-11-02'],
    ])
    expect(r.fins[2].total).toBe(20)
    expect(r.fins[0].emAndamento).toBe(true) // hoje é a segunda que fecha o bloco
  })

  it('pula o dia 1 que cai fora do bloco', () => {
    // Só sábado e domingo; 01/11 é domingo, então 31/10 a 01/11 entra.
    const r = finsDeSemanaDoMes([], '2026-11', '2026-11-03', null, 6, 0)
    expect(r.fins.map((f) => f.inicio)).toEqual(['2026-10-31'])
    // Dezembro: dia 1 é terça, primeiro bloco é 05/12.
    const d = finsDeSemanaDoMes([], '2026-12', '2026-12-06', null, 6, 0)
    expect(d.fins.map((f) => f.inicio)).toEqual(['2026-12-05'])
  })

  it('conta a duração do bloco', () => {
    expect(duracaoBloco(4, 0)).toBe(4)
    expect(duracaoBloco(5, 1)).toBe(4)
    expect(duracaoBloco(6, 6)).toBe(1)
    expect(duracaoBloco(1, 0)).toBe(7)
  })
})
