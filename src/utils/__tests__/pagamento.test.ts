import { describe, it, expect } from 'vitest'
import { diaDoPagamento, rotuloPaga, valorSugeridoDoPagamento } from '../pagamento'

describe('diaDoPagamento', () => {
  it('converte ISO em UTC para o dia de São Paulo', () => {
    expect(diaDoPagamento('2026-10-05T13:00:00.000Z')).toBe('05/10')
  })

  it('pagamento às 22h BRT (01h UTC do dia seguinte) fica no dia de São Paulo', () => {
    expect(diaDoPagamento('2026-10-06T01:00:00.000Z')).toBe('05/10')
  })

  it('texto sem fuso é usado como veio', () => {
    expect(diaDoPagamento('2026-10-05 23:30:00')).toBe('05/10')
    expect(diaDoPagamento('2026-10-05')).toBe('05/10')
  })

  it('data ilegível vira texto vazio', () => {
    expect(diaDoPagamento('ontem')).toBe('')
  })
})

describe('rotuloPaga', () => {
  it('monta o texto do selo', () => {
    expect(rotuloPaga('2026-10-05T13:00:00.000Z')).toBe('Paga em 05/10')
  })

  it('sem data legível mostra só "Paga"', () => {
    expect(rotuloPaga('???')).toBe('Paga')
  })
})

describe('valorSugeridoDoPagamento', () => {
  it('usa o valor real quando já foi informado', () => {
    expect(valorSugeridoDoPagamento({ amount: '187.40', amount_is_actual: 1 }, '150.00')).toBe(187.4)
  })

  it('usa a estimativa quando o valor do mês ainda é estimado', () => {
    expect(valorSugeridoDoPagamento({ amount: 150, amount_is_actual: 0 }, '160.00')).toBe(160)
  })
})
