import { generatePhoneVariant, buildPhoneCandidates, parseContactPayload } from '../waha'

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

describe('parseContactPayload', () => {
  it('lê pushname minúsculo, que é o que o engine GOWS devolve', () => {
    expect(parseContactPayload({ name: 'André Eu', pushname: 'André de Faria' }))
      .toEqual({ savedName: 'André Eu', pushName: 'André de Faria' })
  })

  it('aceita também pushName camelCase, caso o engine mude', () => {
    expect(parseContactPayload({ pushName: 'André de Faria' }))
      .toEqual({ savedName: null, pushName: 'André de Faria' })
  })

  it('desembrulha resposta em array', () => {
    expect(parseContactPayload([{ name: 'X', pushname: 'Y' }]))
      .toEqual({ savedName: 'X', pushName: 'Y' })
  })

  it('devolve nulos para payload vazio, nulo ou de tipo errado', () => {
    const vazio = { savedName: null, pushName: null }
    expect(parseContactPayload(null)).toEqual(vazio)
    expect(parseContactPayload([])).toEqual(vazio)
    expect(parseContactPayload({ name: 123, pushname: {} })).toEqual(vazio)
  })

  it('trata string vazia como ausente', () => {
    expect(parseContactPayload({ name: '', pushname: '   ' }))
      .toEqual({ savedName: null, pushName: null })
  })
})
