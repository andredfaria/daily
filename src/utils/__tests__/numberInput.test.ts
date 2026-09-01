import { describe, it, expect } from 'vitest'
import {
  clampNumber,
  formatNumericInput,
  normalizeNumericInput,
  parseNumericInput,
  sanitizeNumericInput,
  stepNumericInput,
  stripGrouping,
} from '../numberInput'

describe('sanitizeNumericInput', () => {
  it('mantém o campo vazio quando o usuário apaga tudo', () => {
    expect(sanitizeNumericInput('')).toBe('')
  })

  it('não gruda zero na frente do que foi digitado', () => {
    // O bug original: estado numérico virava 0 e o próximo dígito colava nele.
    expect(sanitizeNumericInput('05')).toBe('5')
    expect(sanitizeNumericInput('007')).toBe('7')
    expect(sanitizeNumericInput('0100')).toBe('100')
  })

  it('preserva o zero sozinho e o zero antes da vírgula', () => {
    expect(sanitizeNumericInput('0')).toBe('0')
    expect(sanitizeNumericInput('0,')).toBe('0,')
    expect(sanitizeNumericInput('00,5')).toBe('0,5')
    expect(sanitizeNumericInput(',5')).toBe('0,5')
  })

  it('descarta letras e símbolos', () => {
    expect(sanitizeNumericInput('12ab3')).toBe('123')
    expect(sanitizeNumericInput('1e5')).toBe('15')
    expect(sanitizeNumericInput('R$ 42,90')).toBe('42,90')
    expect(sanitizeNumericInput('--12')).toBe('12')
  })

  it('aceita ponto como separador decimal e normaliza para vírgula', () => {
    expect(sanitizeNumericInput('12.5')).toBe('12,5')
  })

  it('ignora separadores extras em vez de aceitar dois decimais', () => {
    expect(sanitizeNumericInput('1,2,3')).toBe('1,23')
  })

  it('corta casas decimais acima do limite do campo', () => {
    expect(sanitizeNumericInput('12,3456', { decimals: 2 })).toBe('12,34')
    expect(sanitizeNumericInput('0,00000001234', { decimals: 8 })).toBe('0,00000001')
  })

  it('encerra o número na vírgula quando o campo é inteiro', () => {
    expect(sanitizeNumericInput('12,5', { decimals: 0 })).toBe('12')
    expect(sanitizeNumericInput('31', { decimals: 0 })).toBe('31')
  })

  it('só aceita sinal negativo quando o campo permite', () => {
    expect(sanitizeNumericInput('-12')).toBe('12')
    expect(sanitizeNumericInput('-12', { allowNegative: true })).toBe('-12')
    expect(sanitizeNumericInput('-', { allowNegative: true })).toBe('')
  })

  it('limita o tamanho da parte inteira', () => {
    expect(sanitizeNumericInput('123456789012345', { maxIntegerDigits: 4 })).toBe('1234')
  })

  it('entende valor colado com separador de milhar', () => {
    expect(sanitizeNumericInput('1.234.567,89')).toBe('1234567,89')
  })
})

describe('stripGrouping', () => {
  it('remove o ponto de milhar apenas no formato agrupado', () => {
    expect(stripGrouping('1.234,56')).toBe('1234,56')
    expect(stripGrouping('1.5')).toBe('1.5')
  })
})

describe('parseNumericInput', () => {
  it('devolve null enquanto não há número', () => {
    expect(parseNumericInput('')).toBeNull()
    expect(parseNumericInput(',')).toBeNull()
    expect(parseNumericInput('-')).toBeNull()
  })

  it('lê vírgula, ponto e milhar', () => {
    expect(parseNumericInput('12,5')).toBe(12.5)
    expect(parseNumericInput('12.5')).toBe(12.5)
    expect(parseNumericInput('1.234,56')).toBe(1234.56)
    expect(parseNumericInput('12,')).toBe(12)
  })
})

describe('clampNumber', () => {
  it('prende o valor na faixa', () => {
    expect(clampNumber(45, 1, 31)).toBe(31)
    expect(clampNumber(0, 1, 31)).toBe(1)
    expect(clampNumber(10, 1, 31)).toBe(10)
  })
})

describe('formatNumericInput', () => {
  it('usa vírgula e não agrupa milhar', () => {
    expect(formatNumericInput(1234.5, 2)).toBe('1234,5')
    expect(formatNumericInput(1234.5, 2, { padDecimals: true })).toBe('1234,50')
    expect(formatNumericInput(0.005, 8)).toBe('0,005')
  })
})

describe('normalizeNumericInput', () => {
  it('mantém vazio o campo que o usuário limpou', () => {
    expect(normalizeNumericInput('')).toBe('')
    expect(normalizeNumericInput(',')).toBe('')
  })

  it('fecha a vírgula solta e completa centavos em dinheiro', () => {
    expect(normalizeNumericInput('12,', { decimals: 2, padDecimals: true })).toBe('12,00')
    expect(normalizeNumericInput('1234,5', { decimals: 2, padDecimals: true })).toBe('1234,50')
  })

  it('aplica min e max ao sair do campo', () => {
    expect(normalizeNumericInput('45', { decimals: 0, min: 1, max: 31 })).toBe('31')
    expect(normalizeNumericInput('0', { decimals: 0, min: 1, max: 31 })).toBe('1')
  })

  it('não infla quantidade fracionária com zeros', () => {
    expect(normalizeNumericInput('0,005', { decimals: 8 })).toBe('0,005')
  })
})

describe('stepNumericInput', () => {
  it('incrementa a partir do valor atual', () => {
    expect(stepNumericInput('10', 1, { decimals: 0, min: 1, max: 31 })).toBe('11')
    expect(stepNumericInput('31', 1, { decimals: 0, min: 1, max: 31 })).toBe('31')
  })

  it('parte do mínimo quando o campo está vazio', () => {
    expect(stepNumericInput('', 1, { decimals: 0, min: 1, max: 31 })).toBe('2')
    expect(stepNumericInput('', 1, { decimals: 2 })).toBe('1')
  })

  it('não acumula erro de ponto flutuante', () => {
    expect(stepNumericInput('0,1', 0.2, { decimals: 2 })).toBe('0,3')
  })
})
