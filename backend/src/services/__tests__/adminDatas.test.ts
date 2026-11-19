import { dataSP, inicioDoDiaSP, inicioDoMesSP, inicioDoProximoMesSP } from '../adminDatas'

describe('datas de São Paulo', () => {
  it('00h30 UTC ainda é o dia anterior em SP', () => {
    expect(dataSP(new Date('2026-11-19T00:30:00Z'))).toBe('2026-11-18')
  })
  it('início do dia SP é 03:00 UTC', () => {
    expect(inicioDoDiaSP(new Date('2026-11-19T15:00:00Z')).toISOString()).toBe('2026-11-19T03:00:00.000Z')
    expect(inicioDoDiaSP(new Date('2026-11-19T02:00:00Z')).toISOString()).toBe('2026-11-18T03:00:00.000Z')
  })
  it('mês corrente em SP vira só às 03h UTC do dia 1', () => {
    expect(inicioDoMesSP(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11-01')
    expect(inicioDoMesSP(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01')
  })
  it('próximo mês, inclusive virada de ano', () => {
    expect(inicioDoProximoMesSP(new Date('2026-11-19T12:00:00Z'))).toBe('2026-12-01')
    expect(inicioDoProximoMesSP(new Date('2026-12-19T12:00:00Z'))).toBe('2027-01-01')
  })
})
