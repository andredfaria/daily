import pool from '../../db'
import { buildPaymentSection } from '../lembreteConta'
import { WhatsAppNumberNotFoundError } from '../waha'
import {
  cortarTexto,
  mascararOtp,
  mascararDadosPagamento,
  descreverErroEnvio,
  nomeDoComando,
  normalizarUserId,
  registrarAtividade,
  eventoDeEnvio,
  eventoDeComando,
  rotaNormalizada,
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

describe('eventoDeEnvio', () => {
  it('sem ctx, o ref é desconhecido', () => {
    const ev = eventoDeEnvio(undefined, 'oi', { id: 'x' })
    expect(ev.kind).toBe('msg_enviada')
    expect(ev.ref).toBe('desconhecido')
    expect(ev.status).toBe('ok')
  })

  it('otp não grava o código no detail', () => {
    const ev = eventoDeEnvio({ tipo: 'otp' }, 'código 123456', { id: 'x' })
    expect(ev.detail).not.toContain('123456')
    expect(ev.ref).toBe('otp')
  })

  it('erro gera falha com HTTP 500', () => {
    const ev = eventoDeEnvio({ tipo: 'enquete', userId: 'u1' }, 'oi', { erro: { response: { status: 500 } } })
    expect(ev.status).toBe('falha')
    expect(ev.error).toContain('HTTP 500')
    expect(ev.userId).toBe('u1')
  })

  it('sucesso guarda o id da mensagem no meta', () => {
    const ev = eventoDeEnvio({ tipo: 'x' }, 'oi', { id: 'abc' })
    expect(ev.meta?.waha_message_id).toBe('abc')
  })

  it('extra entra no meta', () => {
    const ev = eventoDeEnvio({ tipo: 'x' }, 'oi', { id: null }, { chatId: 'c' })
    expect(ev.meta?.chatId).toBe('c')
  })
})

describe('eventoDeComando', () => {
  it('sucesso gera um evento ok só com o nome', () => {
    expect(eventoDeComando('u1', '/gasto')).toEqual({ userId: 'u1', kind: 'comando', status: 'ok', ref: '/gasto' })
  })
  it('falha gera um único evento falha com o erro', () => {
    const ev = eventoDeComando('u1', '/gasto', { erro: { response: { status: 500 } } })
    expect(ev.status).toBe('falha')
    expect(ev.error).toContain('HTTP 500')
  })
})

describe('rotaNormalizada', () => {
  it('usa baseUrl + rota quando o express casou', () => {
    expect(rotaNormalizada('/api/bills', '/:id', '/api/bills/abc')).toBe('/api/bills/:id')
  })
  it('troca uuid e número por :id quando não casou rota', () => {
    expect(
      rotaNormalizada('', undefined, '/api/bills/0b7c1f2e-3a4b-4c5d-8e9f-1234567890ab/x')
    ).toBe('/api/bills/:id/x')
    expect(rotaNormalizada('', undefined, '/api/assets/42')).toBe('/api/assets/:id')
  })
})

describe('mascararDadosPagamento', () => {
  it('esconde a chave PIX e mantém o resto', () => {
    const t = `Conta *Luz*\n${buildPaymentSection({ type: 'pix', pix_key_type: 'cpf', pix_key: '12345678900', pix_beneficiary: 'Enel' })}`
    const m = mascararDadosPagamento(t)
    expect(m).not.toContain('12345678900')
    expect(m).toContain('PIX — CPF: ******')
    expect(m).toContain('Favorecido: Enel')
  })
  it('esconde o código do boleto', () => {
    const t = `Conta\n${buildPaymentSection({ type: 'boleto', boleto_code: '23793.38128 60000.000003 00000.000400' })}\nrodapé`
    const m = mascararDadosPagamento(t)
    expect(m).not.toContain('23793')
    expect(m).toContain('Boleto:\n******\nrodapé')
  })
  it('eventoDeEnvio mascara lembrete e reenvio, não outros tipos', () => {
    const t = 'PIX — E-mail: a@b.com'
    expect(eventoDeEnvio({ tipo: 'lembrete_conta' }, t, { id: null }).detail).toBe('PIX — E-mail: ******')
    expect(eventoDeEnvio({ tipo: 'reenvio' }, t, { id: null }).detail).toBe('PIX — E-mail: ******')
    expect(eventoDeEnvio({ tipo: 'outro' }, t, { id: null }).detail).toBe(t)
  })
})
