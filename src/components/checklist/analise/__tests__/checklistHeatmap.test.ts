import { describe, it, expect } from 'vitest'
import { estadoDoItem, resumirHistorico, resumirItem } from '../ChecklistHeatmap'

describe('estadoDoItem', () => {
  it('sem poll no dia é sem envio', () => {
    expect(estadoDoItem(undefined, 'Beber água')).toBe('empty')
  })

  it('poll enviado sem o item marcado é não marcado', () => {
    expect(estadoDoItem({ poll_date: '2026-09-01', completion_pct: 50, selected_options: ['Ler'] }, 'Beber água'))
      .toBe('unchecked')
  })

  it('item presente nas opções marcadas é marcado', () => {
    expect(estadoDoItem({ poll_date: '2026-09-01', completion_pct: 50, selected_options: ['Beber água'] }, 'Beber água'))
      .toBe('checked')
  })

  it('selected_options nulo conta como nada marcado', () => {
    const dia = { poll_date: '2026-09-01', completion_pct: 0, selected_options: null as unknown as string[] }
    expect(estadoDoItem(dia, 'Beber água')).toBe('unchecked')
  })
})

describe('resumirItem', () => {
  it('conta dias marcados e dias com envio', () => {
    const r = resumirItem([
      { poll_date: '2026-09-01', completion_pct: 100, selected_options: ['A', 'B'] },
      { poll_date: '2026-09-02', completion_pct: 50, selected_options: ['B'] },
      { poll_date: '2026-09-03', completion_pct: 0, selected_options: [] },
    ], 'A')
    expect(r).toEqual({ marcados: 1, enviados: 3 })
  })
})

describe('resumirHistorico', () => {
  it('conta dias completos e dias com envio', () => {
    const r = resumirHistorico([
      { poll_date: '2026-09-01', completion_pct: 100, selected_options: [] },
      { poll_date: '2026-09-02', completion_pct: 50, selected_options: [] },
      { poll_date: '2026-09-03T00:00:00.000Z', completion_pct: 100, selected_options: [] },
    ])
    expect(r).toEqual({ completos: 2, enviados: 3 })
  })

  it('aceita porcentagem vinda como string do MySQL', () => {
    const r = resumirHistorico([{ poll_date: '2026-09-01', completion_pct: '100.00' as unknown as number, selected_options: [] }])
    expect(r.completos).toBe(1)
  })

  it('histórico vazio zera tudo', () => {
    expect(resumirHistorico([])).toEqual({ completos: 0, enviados: 0 })
  })
})
