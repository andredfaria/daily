import pool from '../../db'
import { WhatsAppNumberNotFoundError } from '../waha'
import {
  cortarTexto,
  mascararOtp,
  descreverErroEnvio,
  nomeDoComando,
  normalizarUserId,
  registrarAtividade,
} from '../activityLog'

jest.mock('../../db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}))

describe('cortarTexto', () => {
  it('corta em 2000 caracteres', () => {
    expect(cortarTexto('a'.repeat(2500))).toHaveLength(2000)
  })
  it('devolve null para vazio', () => {
    expect(cortarTexto(null)).toBeNull()
  })
})

describe('mascararOtp', () => {
  it('troca o código por asteriscos', () => {
    expect(mascararOtp('Seu código: 123456')).toBe('Seu código: ******')
  })
})

describe('descreverErroEnvio', () => {
  it('descreve erro HTTP', () => {
    const r = descreverErroEnvio({ response: { status: 404, data: { message: 'not found' } } })
    expect(r).toContain('HTTP 404')
    expect(r).toContain('not found')
  })
  it('descreve erro de rede', () => {
    expect(descreverErroEnvio({ code: 'ECONNRESET', message: 'socket hang up' })).toContain('ECONNRESET')
  })
  it('descreve número não encontrado', () => {
    expect(descreverErroEnvio(new WhatsAppNumberNotFoundError('5535999999999'))).toBe(
      'número não encontrado no WhatsApp'
    )
  })
})

describe('nomeDoComando', () => {
  it('pega a primeira palavra em minúscula', () => {
    expect(nomeDoComando('/Gasto 45 mercado')).toBe('/gasto')
  })
  it('devolve null sem barra', () => {
    expect(nomeDoComando('oi')).toBeNull()
  })
})

describe('normalizarUserId', () => {
  it('converte o usuário de serviço em null', () => {
    expect(normalizarUserId('__service__')).toBeNull()
    expect(normalizarUserId('')).toBeNull()
  })
  it('mantém id real', () => {
    expect(normalizarUserId('abc')).toBe('abc')
  })
})

describe('registrarAtividade', () => {
  it('não rejeita quando o banco falha', async () => {
    ;(pool.query as jest.Mock).mockRejectedValue(new Error('banco fora'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(registrarAtividade({ kind: 'login' })).resolves.toBeUndefined()
  })
})
