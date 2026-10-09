import { describe, it, expect } from 'vitest'
import { digitosTelefoneBR, formatarTelefoneBR, whatsappParaGravar } from '../telefone'

describe('digitosTelefoneBR', () => {
  it('tira o código do país de número colado', () => {
    expect(digitosTelefoneBR('+55 11 99999-8888')).toBe('11999998888')
    expect(digitosTelefoneBR('5511999998888')).toBe('11999998888')
  })

  it('tira o zero de discagem interurbana', () => {
    expect(digitosTelefoneBR('(011) 99999-8888')).toBe('11999998888')
  })

  it('não mexe em quem está digitando o DDD 55', () => {
    // DDD 55 existe (RS): só é país quando sobra dígito demais.
    expect(digitosTelefoneBR('55')).toBe('55')
    expect(digitosTelefoneBR('55999998888')).toBe('55999998888')
  })
})

describe('formatarTelefoneBR', () => {
  it('aplica a máscara de forma progressiva', () => {
    expect(formatarTelefoneBR('11')).toBe('11')
    expect(formatarTelefoneBR('11999')).toBe('(11) 999')
    expect(formatarTelefoneBR('+55 (11) 99999-8888')).toBe('(11) 99999-8888')
  })
})

describe('whatsappParaGravar', () => {
  it('grava só dígitos com o 55, como o login', () => {
    expect(whatsappParaGravar('+55 (11) 99999-8888')).toBe('5511999998888')
    expect(whatsappParaGravar('(11) 99999-8888')).toBe('5511999998888')
    expect(whatsappParaGravar(' 5511999998888 ')).toBe('5511999998888')
  })

  it('preserva o LID', () => {
    expect(whatsappParaGravar('51810291171433@lid')).toBe('51810291171433@lid')
  })
})
