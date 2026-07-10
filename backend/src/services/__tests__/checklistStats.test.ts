import { computeItemStats } from '../checklistStats'

describe('computeItemStats', () => {
  it('calcula marked_count, total_polls e pct de cada item', () => {
    const items = ['Tomar remédio', 'Beber água']
    const polls = [
      ['Tomar remédio', 'Beber água'],
      ['Tomar remédio'],
      ['Beber água'],
      ['Tomar remédio'],
    ]
    const result = computeItemStats(items, polls)
    expect(result).toEqual([
      { text: 'Tomar remédio', marked_count: 3, total_polls: 4, pct: 75 },
      { text: 'Beber água', marked_count: 2, total_polls: 4, pct: 50 },
    ])
  })

  it('ordena por pct decrescente', () => {
    const items = ['A', 'B', 'C']
    const polls = [['B'], ['B'], ['C']]
    const result = computeItemStats(items, polls)
    expect(result.map((r) => r.text)).toEqual(['B', 'C', 'A'])
  })

  it('retorna pct 0 e marked_count 0 quando não há polls no período', () => {
    const result = computeItemStats(['Item único'], [])
    expect(result).toEqual([{ text: 'Item único', marked_count: 0, total_polls: 0, pct: 0 }])
  })

  it('arredonda pct para o inteiro mais próximo', () => {
    const result = computeItemStats(['X'], [['X'], [], []])
    expect(result[0].pct).toBe(33) // 1/3 = 33.33... -> 33
  })
})
