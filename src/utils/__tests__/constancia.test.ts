import { describe, it, expect } from 'vitest'
import { formatarDelta } from '../constancia'

describe('formatarDelta', () => {
  it('marca alta com sinal de mais e direção subiu', () => {
    expect(formatarDelta(5, 3)).toEqual({ texto: '+2', direcao: 'subiu' })
  })

  it('marca queda com o menos tipográfico U+2212, não o hífen ASCII', () => {
    const resultado = formatarDelta(3, 5)
    expect(resultado.direcao).toBe('desceu')
    expect(resultado.texto).toBe('−2')
    expect(resultado.texto).not.toContain('-')
  })

  it('marca empate como 0 e direção igual', () => {
    expect(formatarDelta(4, 4)).toEqual({ texto: '0', direcao: 'igual' })
  })
})
