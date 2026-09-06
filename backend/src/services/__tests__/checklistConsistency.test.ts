import { computeConsistency, constanciaZerada, PollResumo } from '../checklistConsistency'

// hoje fixo num domingo, para as janelas de 7 dias caírem em semanas cheias
// (seg a dom) e facilitar contar dias úteis vs fim de semana.
const HOJE = '2026-09-06' // domingo

function poll(poll_date: string, completed_count: number, completion_pct = completed_count > 0 ? 100 : 0): PollResumo {
  return { poll_date, completed_count, completion_pct }
}

describe('computeConsistency', () => {
  it('janela ignora dia sem poll: seg-sex com poll, sáb e dom sem linha', () => {
    // hoje-6..hoje = 2026-08-31 (seg) .. 2026-09-06 (dom)
    const polls = [
      poll('2026-08-31', 1),
      poll('2026-09-01', 1),
      poll('2026-09-02', 1),
      poll('2026-09-03', 1),
      poll('2026-09-04', 1),
      // 05 (sáb) e 06 (dom) sem checklist enviado
    ]
    const result = computeConsistency(polls, HOJE)
    expect(result.semana.atual.dias_com_poll).toBe(5)
  })

  it('comparativo: hoje-7 cai em anterior, hoje-6 cai em atual', () => {
    const hojeMenos7 = '2026-08-30'
    const hojeMenos6 = '2026-08-31'
    const polls = [poll(hojeMenos7, 1), poll(hojeMenos6, 1)]
    const result = computeConsistency(polls, HOJE)
    expect(result.semana.anterior.dias_com_poll).toBe(1)
    expect(result.semana.atual.dias_com_poll).toBe(1)
  })

  it('sequência atravessa fim de semana sem poll sem quebrar', () => {
    const polls = [
      poll('2026-08-31', 1), // seg
      poll('2026-09-01', 1), // ter
      poll('2026-09-02', 1), // qua
      poll('2026-09-03', 1), // qui
      poll('2026-09-04', 1), // sex
      // sáb e dom sem linha nenhuma — não são "dia sem resposta", são ausentes
    ]
    const result = computeConsistency(polls, HOJE)
    expect(result.sequencia.atual).toBe(5)
    expect(result.sequencia.melhor).toBe(5)
  })

  it('poll de hoje com completed_count 0 não zera a sequência', () => {
    const polls = [
      poll('2026-09-04', 1),
      poll('2026-09-05', 1),
      poll(HOJE, 0), // hoje ainda não respondido
    ]
    const result = computeConsistency(polls, HOJE)
    expect(result.sequencia.atual).toBe(2)
  })

  it('o mesmo poll com data de ontem zera a sequência', () => {
    const ontem = '2026-09-05'
    const polls = [
      poll('2026-09-03', 1),
      poll('2026-09-04', 1),
      poll(ontem, 0), // ontem não respondido — isso já é uma quebra de verdade
    ]
    const result = computeConsistency(polls, HOJE)
    expect(result.sequencia.atual).toBe(0)
  })

  it('dias_completos usa completion_pct >= 100; 99.99 não conta', () => {
    const polls = [
      poll('2026-09-01', 3, 100),
      poll('2026-09-02', 2, 99.99),
    ]
    const result = computeConsistency(polls, HOJE)
    expect(result.semana.atual.dias_completos).toBe(1)
  })

  it('completed_count e completion_pct como string do MySQL dão o mesmo resultado que como número', () => {
    const comoString = [
      { poll_date: '2026-09-01', completed_count: '3' as any, completion_pct: '100' as any },
      { poll_date: '2026-09-02', completed_count: '0' as any, completion_pct: '0' as any },
    ]
    const comoNumero: PollResumo[] = [
      { poll_date: '2026-09-01', completed_count: 3, completion_pct: 100 },
      { poll_date: '2026-09-02', completed_count: 0, completion_pct: 0 },
    ]
    expect(computeConsistency(comoString, HOJE)).toEqual(computeConsistency(comoNumero, HOJE))
  })

  it('série vazia devolve tudo zerado, sem lançar', () => {
    expect(() => computeConsistency([], HOJE)).not.toThrow()
    expect(computeConsistency([], HOJE)).toEqual(constanciaZerada())
  })
})

describe('constanciaZerada', () => {
  it('devolve todos os números zerados', () => {
    expect(constanciaZerada()).toEqual({
      semana: {
        atual: { dias_com_poll: 0, dias_respondidos: 0, dias_completos: 0 },
        anterior: { dias_com_poll: 0, dias_respondidos: 0, dias_completos: 0 },
      },
      mes: {
        atual: { dias_com_poll: 0, dias_respondidos: 0, dias_completos: 0 },
        anterior: { dias_com_poll: 0, dias_respondidos: 0, dias_completos: 0 },
      },
      sequencia: { atual: 0, melhor: 0 },
    })
  })
})
