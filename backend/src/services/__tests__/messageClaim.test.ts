import { claimKeyDia, claimKeyMes, claimKeyMesAnterior, isDeliveryRuledOut } from '../messageClaim'

// Datas construídas em UTC para o teste não depender do fuso da máquina;
// as funções normalizam para America/Sao_Paulo internamente.
const emUtc = (iso: string) => new Date(iso)

describe('claimKeyDia', () => {
  it('usa a data de São Paulo, não a do relógio da máquina', () => {
    // 01/09 02:00 UTC ainda é 31/08 no horário de Brasília.
    expect(claimKeyDia(emUtc('2026-09-01T02:00:00Z'))).toBe('2026-08-31')
    expect(claimKeyDia(emUtc('2026-09-01T12:00:00Z'))).toBe('2026-09-01')
  })
})

describe('claimKeyMes', () => {
  it('devolve o mês corrente em São Paulo', () => {
    expect(claimKeyMes(emUtc('2026-09-01T12:00:00Z'))).toBe('2026-09')
  })

  it('não vira o mês antes da virada em Brasília', () => {
    expect(claimKeyMes(emUtc('2026-09-01T02:00:00Z'))).toBe('2026-08')
  })
})

describe('claimKeyMesAnterior', () => {
  it('devolve o mês fechado, que é o do relatório mensal', () => {
    expect(claimKeyMesAnterior(emUtc('2026-09-01T12:00:00Z'))).toBe('2026-08')
  })

  it('atravessa a virada de ano', () => {
    expect(claimKeyMesAnterior(emUtc('2026-01-01T12:00:00Z'))).toBe('2025-12')
  })
})

// --- Política de liberação da trava ---
//
// Liberar depois de um erro ambíguo é o que duplica a mensagem: o timeout do
// axios não cancela o envio do lado do WhatsApp.

const erroHttp = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  })

const erroRede = (code: string) => Object.assign(new Error(code), { code })

describe('isDeliveryRuledOut', () => {
  it('libera quando o WAHA recusou com 4xx — a mensagem não saiu', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isDeliveryRuledOut(erroHttp(status))).toBe(true)
    }
  })

  it('NÃO libera em 408 e 429: pode ter processado antes de barrar', () => {
    expect(isDeliveryRuledOut(erroHttp(408))).toBe(false)
    expect(isDeliveryRuledOut(erroHttp(429))).toBe(false)
  })

  it('NÃO libera em 5xx: proxy costuma responder com a requisição já entregue', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isDeliveryRuledOut(erroHttp(status))).toBe(false)
    }
  })

  it('NÃO libera em timeout — o caso que duplicava o checklist', () => {
    expect(isDeliveryRuledOut(erroRede('ECONNABORTED'))).toBe(false)
    expect(isDeliveryRuledOut(erroRede('ETIMEDOUT'))).toBe(false)
  })

  it('NÃO libera quando a conexão caiu no meio', () => {
    expect(isDeliveryRuledOut(erroRede('ECONNRESET'))).toBe(false)
    expect(isDeliveryRuledOut(erroRede('EPIPE'))).toBe(false)
  })

  it('libera quando a requisição nem saiu da máquina', () => {
    expect(isDeliveryRuledOut(erroRede('ECONNREFUSED'))).toBe(true)
    expect(isDeliveryRuledOut(erroRede('ENOTFOUND'))).toBe(true)
    expect(isDeliveryRuledOut(erroRede('EAI_AGAIN'))).toBe(true)
  })

  it('libera quando o número não existe no WhatsApp', () => {
    const err = new Error('Número não encontrado no WhatsApp: +55...')
    err.name = 'WhatsAppNumberNotFoundError'
    expect(isDeliveryRuledOut(err)).toBe(true)
  })

  it('na dúvida, mantém a trava', () => {
    expect(isDeliveryRuledOut(new Error('deu ruim'))).toBe(false)
    expect(isDeliveryRuledOut(undefined)).toBe(false)
    expect(isDeliveryRuledOut(null)).toBe(false)
  })
})
