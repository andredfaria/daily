import { escolherOcorrenciaAtual, primeiroDiaDoMes } from '../billPayment'

describe('primeiroDiaDoMes', () => {
  it('devolve o dia 1º do mês da data informada', () => {
    expect(primeiroDiaDoMes('2026-10-09')).toBe('2026-10-01')
    expect(primeiroDiaDoMes('2026-12-31')).toBe('2026-12-01')
    expect(primeiroDiaDoMes('2027-01-01')).toBe('2027-01-01')
  })
})

describe('escolherOcorrenciaAtual', () => {
  const oc = (due_date: string, paga = false) => ({ due_date, paid_at: paga ? '2026-10-02T12:00:00.000Z' : null })

  it('mensal em aberto: o vencimento do mês', () => {
    expect(escolherOcorrenciaAtual([oc('2026-10-10'), oc('2026-11-10')], '2026-10-09')?.due_date).toBe('2026-10-10')
  })

  it('mensal já paga: continua no vencimento do mês, não pula para o próximo', () => {
    expect(escolherOcorrenciaAtual([oc('2026-10-05', true), oc('2026-11-05')], '2026-10-09')?.due_date).toBe('2026-10-05')
  })

  it('semanal: a primeira do mês ainda em aberto, mesmo atrasada', () => {
    const lista = [oc('2026-10-02', true), oc('2026-10-09'), oc('2026-10-16'), oc('2026-10-23')]
    expect(escolherOcorrenciaAtual(lista, '2026-10-12')?.due_date).toBe('2026-10-09')
  })

  it('semanal com o mês todo pago: a última do mês', () => {
    const lista = [oc('2026-10-02', true), oc('2026-10-09', true), oc('2026-11-06')]
    expect(escolherOcorrenciaAtual(lista, '2026-10-12')?.due_date).toBe('2026-10-09')
  })

  it('sem vencimento no mês: o próximo', () => {
    expect(escolherOcorrenciaAtual([oc('2027-03-01')], '2026-10-09')?.due_date).toBe('2027-03-01')
  })

  it('sem ocorrência: null', () => {
    expect(escolherOcorrenciaAtual([], '2026-10-09')).toBeNull()
  })
})
