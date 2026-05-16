import { generatePhoneVariant, buildPhoneCandidates } from '../waha'

describe('generatePhoneVariant', () => {
  it('adiciona 9 a numero de 12 digitos', () => {
    expect(generatePhoneVariant('551187654321')).toBe('5511987654321')
  })

  it('remove 9 de numero de 13 digitos', () => {
    expect(generatePhoneVariant('5511987654321')).toBe('551187654321')
  })

  it('retorna null para numero com menos de 12 digitos', () => {
    expect(generatePhoneVariant('12345678901')).toBeNull()
  })

  it('retorna null para numero com mais de 13 digitos', () => {
    expect(generatePhoneVariant('55119876543210')).toBeNull()
  })
})

describe('buildPhoneCandidates', () => {
  it('inclui digits, resolvedNumber e variante quando WAHA resolve diferente', () => {
    const result = buildPhoneCandidates('551187654321', '5511987654321')
    expect(result).toContain('551187654321')
    expect(result).toContain('5511987654321')
    expect(result.length).toBe(2) // resolvedNumber e variant são o mesmo, sem duplicata
  })

  it('deduplica e inclui variante quando WAHA falha (resolvedNumber == digits)', () => {
    const result = buildPhoneCandidates('5511987654321', '5511987654321')
    expect(result).toContain('5511987654321')
    expect(result).toContain('551187654321') // variante gerada por string
    expect(result.filter((n: string) => n === '5511987654321').length).toBe(1) // sem duplicata
  })

  it('nao duplica quando digits e resolved e variant sao todos iguais (numero nao-BR)', () => {
    // 11 digitos — generatePhoneVariant retorna null
    expect(buildPhoneCandidates('12345678901', '12345678901')).toEqual(['12345678901'])
  })
})
