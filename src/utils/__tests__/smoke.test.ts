import { describe, it, expect } from 'vitest'
import { formatBRL } from '../format'

describe('runner de testes do frontend', () => {
  it('carrega um módulo de src e roda a asserção', () => {
    expect(formatBRL(1234.5)).toContain('1.234,50')
  })
})
