import { describe, it, expect } from 'vitest'
import { classificarItem, STREAK_MINIMO_EXIBIDO } from '../checklistItem'

describe('classificarItem', () => {
  it('devolve sem_dados quando o item nunca entrou num poll', () => {
    expect(classificarItem(0, 0)).toBe('sem_dados')
  })

  it('sem_dados vence a faixa de porcentagem — 0% sem poll não é fraco', () => {
    expect(classificarItem(100, 0)).toBe('sem_dados')
  })

  it('classifica como fraco abaixo de 50%', () => {
    expect(classificarItem(0, 30)).toBe('fraco')
    expect(classificarItem(38, 30)).toBe('fraco')
    expect(classificarItem(49, 30)).toBe('fraco')
  })

  it('50% já é oscilando, não fraco — a borda é inclusiva', () => {
    expect(classificarItem(50, 30)).toBe('oscilando')
    expect(classificarItem(79, 30)).toBe('oscilando')
  })

  it('classifica como firme de 80% para cima', () => {
    expect(classificarItem(80, 30)).toBe('firme')
    expect(classificarItem(100, 30)).toBe('firme')
  })

  it('um único poll já é dado suficiente para classificar', () => {
    expect(classificarItem(100, 1)).toBe('firme')
    expect(classificarItem(0, 1)).toBe('fraco')
  })
})

// A chama só aparece quando a sequência significa alguma coisa. Dois dias
// seguidos é acaso; virar selo em toda linha tira a atenção de quem está
// realmente embalado.
describe('STREAK_MINIMO_EXIBIDO', () => {
  it('é 3', () => {
    expect(STREAK_MINIMO_EXIBIDO).toBe(3)
  })
})
