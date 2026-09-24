import { describe, it, expect } from 'vitest'
import { pctToBucket, resumirHistorico } from '../ChecklistHeatmap'

describe('pctToBucket', () => {
  it('separa dia sem envio de dia enviado e não respondido', () => {
    expect(pctToBucket(undefined)).toBe('empty')
    expect(pctToBucket(0)).toBe('zero')
  })

  it('escala o verde pela conclusão', () => {
    expect(pctToBucket(1)).toBe('low')
    expect(pctToBucket(49)).toBe('low')
    expect(pctToBucket(50)).toBe('mid')
    expect(pctToBucket(75)).toBe('high')
    expect(pctToBucket(99)).toBe('high')
    expect(pctToBucket(100)).toBe('full')
  })
})

describe('resumirHistorico', () => {
  it('conta dias completos e dias com envio', () => {
    const r = resumirHistorico([
      { poll_date: '2026-09-01', completion_pct: 100 },
      { poll_date: '2026-09-02', completion_pct: 50 },
      { poll_date: '2026-09-03T00:00:00.000Z', completion_pct: 100 },
    ])
    expect(r).toEqual({ completos: 2, enviados: 3 })
  })

  it('aceita porcentagem vinda como string do MySQL', () => {
    const r = resumirHistorico([{ poll_date: '2026-09-01', completion_pct: '100.00' as unknown as number }])
    expect(r.completos).toBe(1)
  })

  it('histórico vazio zera tudo', () => {
    expect(resumirHistorico([])).toEqual({ completos: 0, enviados: 0 })
  })
})
