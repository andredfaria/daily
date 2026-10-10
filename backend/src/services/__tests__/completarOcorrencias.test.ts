import { continuarDatas } from '../occurrenceGenerator'

describe('continuarDatas', () => {
  it('quinzenal: segue de 14 em 14 dias a partir da última, até o limite', () => {
    expect(continuarDatas('biweekly', '2026-10-02', null, '2026-11-01'))
      .toEqual(['2026-10-16', '2026-10-30'])
  })

  it('trimestral: mantém o ciclo da última ocorrência, não o mês de hoje', () => {
    expect(continuarDatas('quarterly', '2026-10-10', 10, '2027-07-31'))
      .toEqual(['2027-01-10', '2027-04-10', '2027-07-10'])
  })

  it('semestral e anual usam o passo do tipo', () => {
    expect(continuarDatas('semiannual', '2026-03-05', 5, '2027-03-05')).toEqual(['2026-09-05', '2027-03-05'])
    expect(continuarDatas('annual', '2026-02-20', 20, '2028-12-31')).toEqual(['2027-02-20', '2028-02-20'])
  })

  it('dia 31 cai no último dia do mês curto e volta ao 31 depois', () => {
    expect(continuarDatas('quarterly', '2026-11-30', 31, '2027-08-31'))
      .toEqual(['2027-02-28', '2027-05-31', '2027-08-31'])
  })

  it('nada a acrescentar quando a última já passa do limite', () => {
    expect(continuarDatas('quarterly', '2027-10-10', 10, '2027-07-31')).toEqual([])
  })
})
