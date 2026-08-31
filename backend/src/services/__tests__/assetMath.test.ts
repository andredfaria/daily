import {
  investedValue,
  currentValue,
  profitLoss,
  profitLossPct,
  isTargetHit,
  isStopHit,
  formatBRL,
  buildAlertMessage,
  formatDateSaoPaulo,
  AlertHit,
} from '../assetMath'

describe('cálculos de posição', () => {
  it('calcula valor investido como quantidade vezes preço médio', () => {
    expect(investedValue(100, 35)).toBe(3500)
  })

  it('calcula valor atual como quantidade vezes cotação', () => {
    expect(currentValue(100, 42.3)).toBe(4230)
  })

  it('calcula lucro em reais', () => {
    expect(profitLoss(100, 35, 42.3)).toBeCloseTo(730, 2)
  })

  it('calcula prejuízo em reais como valor negativo', () => {
    expect(profitLoss(100, 35, 30)).toBeCloseTo(-500, 2)
  })

  it('calcula variação percentual sobre o preço médio', () => {
    expect(profitLossPct(35, 42.3)).toBeCloseTo(20.857, 2)
  })

  it('retorna 0% quando o preço médio é zero, sem dividir por zero', () => {
    expect(profitLossPct(0, 42.3)).toBe(0)
  })

  it('lida com quantidade fracionária de cripto', () => {
    expect(investedValue(0.005, 350000)).toBeCloseTo(1750, 6)
  })
})

describe('isTargetHit', () => {
  it('dispara quando o preço ultrapassa o alvo', () => {
    expect(isTargetHit(42.3, 42, null)).toBe(true)
  })

  it('dispara quando o preço é exatamente igual ao alvo', () => {
    expect(isTargetHit(42, 42, null)).toBe(true)
  })

  it('não dispara quando o preço está abaixo do alvo', () => {
    expect(isTargetHit(41.99, 42, null)).toBe(false)
  })

  it('não dispara quando não há alvo definido', () => {
    expect(isTargetHit(42.3, null, null)).toBe(false)
  })

  it('não redispara quando o alerta já foi disparado', () => {
    expect(isTargetHit(42.3, 42, new Date('2026-08-30T14:00:00Z'))).toBe(false)
  })

  it('aceita triggered_at vindo do banco como string', () => {
    expect(isTargetHit(42.3, 42, '2026-08-30 14:00:00')).toBe(false)
  })
})

describe('isStopHit', () => {
  it('dispara quando o preço cai abaixo do stop', () => {
    expect(isStopHit(9.1, 9.2, null)).toBe(true)
  })

  it('dispara quando o preço é exatamente igual ao stop', () => {
    expect(isStopHit(9.2, 9.2, null)).toBe(true)
  })

  it('não dispara quando o preço está acima do stop', () => {
    expect(isStopHit(9.21, 9.2, null)).toBe(false)
  })

  it('não dispara quando não há stop definido', () => {
    expect(isStopHit(9.1, null, null)).toBe(false)
  })

  it('não redispara quando o stop já foi disparado', () => {
    expect(isStopHit(9.1, 9.2, new Date('2026-08-30T14:00:00Z'))).toBe(false)
  })
})

describe('formatBRL', () => {
  it('formata com duas casas e separador de milhar brasileiro', () => {
    expect(formatBRL(4230.5)).toBe('4.230,50')
  })

  it('formata valor negativo preservando o sinal', () => {
    expect(formatBRL(-45)).toBe('-45,00')
  })
})

describe('buildAlertMessage', () => {
  const alvo: AlertHit = {
    ticker: 'PETR4', reason: 'target', price: 42.3, threshold: 42, quantity: 100, avgPrice: 35,
  }
  const stop: AlertHit = {
    ticker: 'MXRF11', reason: 'stop', price: 9.1, threshold: 9.2, quantity: 50, avgPrice: 10,
  }

  it('inclui o cabeçalho do alerta', () => {
    expect(buildAlertMessage([alvo])).toContain('📈 *Alerta de Ativos — BillSync*')
  })

  it('descreve o ticker e a cotação que atingiu o alvo', () => {
    const msg = buildAlertMessage([alvo])
    expect(msg).toContain('🎯 *PETR4* atingiu o alvo')
    expect(msg).toContain('Cotação: R$ 42,30 (alvo R$ 42,00)')
  })

  it('mostra a posição e o lucro quando há quantidade', () => {
    const msg = buildAlertMessage([alvo])
    expect(msg).toContain('Posição: 100 un. · pago R$ 35,00')
    expect(msg).toContain('Lucro: +R$ 730,00 (+20,9%)')
  })

  it('formata quantidade fracionária de cripto no padrão pt-BR, sem casas fixas erradas', () => {
    const cripto: AlertHit = {
      ticker: 'BTC', reason: 'target', price: 350000, threshold: 340000, quantity: 0.005, avgPrice: 300000,
    }
    const msg = buildAlertMessage([cripto])
    expect(msg).toContain('Posição: 0,005 un. · pago R$ 300.000,00')
  })

  it('usa a palavra prejuízo e sinal negativo quando o resultado é negativo', () => {
    const msg = buildAlertMessage([stop])
    expect(msg).toContain('🛑 *MXRF11* atingiu o stop')
    expect(msg).toContain('Prejuízo: -R$ 45,00 (-9,0%)')
  })

  it('omite posição e resultado quando a quantidade é zero', () => {
    const msg = buildAlertMessage([{ ...alvo, quantity: 0 }])
    expect(msg).not.toContain('Posição:')
    expect(msg).not.toContain('Lucro:')
    expect(msg).toContain('Cotação: R$ 42,30')
  })

  it('consolida vários ativos em uma única mensagem', () => {
    const msg = buildAlertMessage([alvo, stop])
    expect(msg).toContain('PETR4')
    expect(msg).toContain('MXRF11')
    expect((msg.match(/Alerta de Ativos/g) || []).length).toBe(1)
  })

  it('encerra com o aviso de que os alertas ficam pausados', () => {
    expect(buildAlertMessage([alvo])).toContain('_Alertas pausados até você reativar no app._')
  })
})

describe('formatDateSaoPaulo', () => {
  it('formata em YYYY-MM-DD no fuso de São Paulo', () => {
    expect(formatDateSaoPaulo(new Date('2026-08-31T12:00:00Z'))).toBe('2026-08-31')
  })

  it('usa o dia anterior quando o UTC já virou mas São Paulo não', () => {
    expect(formatDateSaoPaulo(new Date('2026-09-01T02:00:00Z'))).toBe('2026-08-31')
  })
})
