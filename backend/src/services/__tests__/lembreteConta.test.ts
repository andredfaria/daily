import { buildMessage, buildRelativeDate, lembreteDevePular } from '../lembreteConta'

describe('buildRelativeDate', () => {
  it('descreve hoje, amanhã e dias à frente', () => {
    expect(buildRelativeDate('2026-10-09', '2026-10-09')).toBe('hoje')
    expect(buildRelativeDate('2026-10-10', '2026-10-09')).toBe('amanhã')
    expect(buildRelativeDate('2026-10-12', '2026-10-09')).toBe('em 3 dias')
  })

  it('descreve vencimento passado', () => {
    expect(buildRelativeDate('2026-10-08', '2026-10-09')).toBe('venceu ontem')
    expect(buildRelativeDate('2026-10-05', '2026-10-09')).toBe('venceu há 4 dias')
  })
})

describe('buildMessage', () => {
  it('termina com o convite para responder /paguei com o nome da conta', () => {
    const msg = buildMessage('Luz', 187.4, '2026-10-10', null, false, '2026-10-09')
    expect(msg.endsWith('\n\nJá pagou? Responda /paguei Luz')).toBe(true)
  })

  it('põe o /paguei depois da seção de pagamento', () => {
    const pm = { type: 'boleto', boleto_code: '123' }
    const msg = buildMessage('Internet', 99.9, '2026-10-10', pm, false, '2026-10-09')
    expect(msg.indexOf('Boleto')).toBeLessThan(msg.indexOf('/paguei Internet'))
  })

  it('mantém valor, vencimento e o rótulo de estimado', () => {
    const msg = buildMessage('Água', 80, '2026-10-10', null, true, '2026-10-09')
    expect(msg).toContain('Conta: *Água*')
    expect(msg).toContain('Valor estimado: R$ 80,00')
    expect(msg).toContain('Vencimento: *amanhã (10/10/2026)*')
  })
})

describe('lembreteDevePular', () => {
  it('pula ocorrência paga', () => {
    expect(lembreteDevePular({ bill_is_active: 1, paid_at: new Date() })).toBe(true)
    expect(lembreteDevePular({ bill_is_active: 1, paid_at: '2026-10-05 10:00:00' })).toBe(true)
  })

  it('pula conta inativa', () => {
    expect(lembreteDevePular({ bill_is_active: 0, paid_at: null })).toBe(true)
  })

  it('envia conta ativa em aberto', () => {
    expect(lembreteDevePular({ bill_is_active: 1, paid_at: null })).toBe(false)
    expect(lembreteDevePular({ bill_is_active: true, paid_at: undefined })).toBe(false)
  })
})
