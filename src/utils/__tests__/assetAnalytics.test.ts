import { describe, it, expect } from 'vitest'
import type { AssetWithQuote } from '../../types'
import {
  agregarPosicao,
  alocacaoPorTipo,
  resultadoPorAtivo,
  progressoAlvoStop,
  rotuloTipo,
} from '../assetAnalytics'

// Base mínima: os testes sobrescrevem só o que cada caso exercita.
function ativo(over: Partial<AssetWithQuote> = {}): AssetWithQuote {
  return {
    id: 'a1',
    user_id: 'u1',
    ticker: 'PETR4',
    kind: 'stock',
    quantity: 10,
    avg_price: 30,
    target_price: null,
    stop_price: null,
    target_triggered_at: null,
    stop_triggered_at: null,
    last_price: 33,
    last_quote_at: '2026-09-01T14:00:00Z',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    short_name: 'Petrobras PN',
    current_price: 33,
    quote_stale: false,
    invested_value: 300,
    current_value: 330,
    profit_loss: 30,
    profit_loss_pct: 10,
    ...over,
  }
}

describe('agregarPosicao', () => {
  it('soma patrimônio, investido e resultado dos ativos com posição', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'VALE3', invested_value: 700, current_value: 770, profit_loss: 70 }),
    ])
    expect(r.patrimonio).toBe(1100)
    expect(r.investido).toBe(1000)
    expect(r.resultado).toBe(100)
    expect(r.resultadoPct).toBeCloseTo(10)
    expect(r.comPosicao).toBe(2)
  })

  it('exclui watchlist dos agregados e a conta à parte', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'ITUB4', quantity: 0, invested_value: 0, current_value: 0, profit_loss: 0 }),
    ])
    expect(r.patrimonio).toBe(330)
    expect(r.comPosicao).toBe(1)
    expect(r.watchlist).toBe(1)
  })

  it('exclui ativo sem cotação e o conta à parte', () => {
    const r = agregarPosicao([
      ativo(),
      ativo({ id: 'a2', ticker: 'XPTO3', current_price: null, current_value: null, profit_loss: null }),
    ])
    expect(r.patrimonio).toBe(330)
    expect(r.investido).toBe(300)
    expect(r.semCotacao).toBe(1)
  })

  it('devolve zeros sem estourar quando não há ativo algum', () => {
    const r = agregarPosicao([])
    expect(r).toEqual({
      patrimonio: 0, investido: 0, resultado: 0, resultadoPct: 0,
      comPosicao: 0, watchlist: 0, semCotacao: 0,
    })
  })

  it('não divide por zero quando o investido é zero', () => {
    const r = agregarPosicao([ativo({ avg_price: 0, invested_value: 0, current_value: 330, profit_loss: 330 })])
    expect(r.resultadoPct).toBe(0)
  })
})

describe('alocacaoPorTipo', () => {
  it('agrupa por tipo e calcula o percentual sobre o patrimônio', () => {
    const fatias = alocacaoPorTipo([
      ativo({ kind: 'stock', current_value: 600 }),
      ativo({ id: 'a2', ticker: 'HGLG11', kind: 'fii', current_value: 300 }),
      ativo({ id: 'a3', ticker: 'BTC', kind: 'crypto', current_value: 100 }),
    ])
    expect(fatias).toEqual([
      { kind: 'stock', valor: 600, pct: 60 },
      { kind: 'fii', valor: 300, pct: 30 },
      { kind: 'crypto', valor: 100, pct: 10 },
    ])
  })

  it('omite tipo sem nenhum ativo', () => {
    const fatias = alocacaoPorTipo([ativo({ kind: 'stock', current_value: 500 })])
    expect(fatias.map((f) => f.kind)).toEqual(['stock'])
  })

  it('devolve lista vazia quando só há watchlist', () => {
    expect(alocacaoPorTipo([ativo({ quantity: 0, current_value: 0 })])).toEqual([])
  })
})

describe('resultadoPorAtivo', () => {
  it('ordena do maior para o menor percentual', () => {
    const r = resultadoPorAtivo([
      ativo({ ticker: 'A', profit_loss: 10, profit_loss_pct: 2 }),
      ativo({ id: 'a2', ticker: 'B', profit_loss: 50, profit_loss_pct: 12 }),
      ativo({ id: 'a3', ticker: 'C', profit_loss: -20, profit_loss_pct: -5 }),
    ])
    expect(r.map((x) => x.ticker)).toEqual(['B', 'A', 'C'])
  })

  it('ignora watchlist e ativo sem cotação', () => {
    const r = resultadoPorAtivo([
      ativo({ ticker: 'A' }),
      ativo({ id: 'a2', ticker: 'W', quantity: 0 }),
      ativo({ id: 'a3', ticker: 'S', current_price: null, current_value: null, profit_loss: null, profit_loss_pct: null }),
    ])
    expect(r.map((x) => x.ticker)).toEqual(['A'])
  })
})

describe('progressoAlvoStop', () => {
  it('mede a posição do preço entre stop e alvo', () => {
    const p = progressoAlvoStop(ativo({ current_price: 35, stop_price: 30, target_price: 40 }))
    expect(p).toBe(50)
  })

  it('limita em 0 e 100 quando o preço passou dos extremos', () => {
    expect(progressoAlvoStop(ativo({ current_price: 45, stop_price: 30, target_price: 40 }))).toBe(100)
    expect(progressoAlvoStop(ativo({ current_price: 25, stop_price: 30, target_price: 40 }))).toBe(0)
  })

  it('devolve null sem alvo, sem stop ou sem cotação', () => {
    expect(progressoAlvoStop(ativo({ stop_price: 30, target_price: null }))).toBeNull()
    expect(progressoAlvoStop(ativo({ stop_price: null, target_price: 40 }))).toBeNull()
    expect(progressoAlvoStop(ativo({ current_price: null, stop_price: 30, target_price: 40 }))).toBeNull()
  })

  it('devolve null quando o alvo não é maior que o stop', () => {
    expect(progressoAlvoStop(ativo({ current_price: 35, stop_price: 40, target_price: 40 }))).toBeNull()
  })
})

describe('rotuloTipo', () => {
  it('traduz o tipo para o rótulo em português', () => {
    expect(rotuloTipo('stock')).toBe('Ação')
    expect(rotuloTipo('fii')).toBe('FII')
    expect(rotuloTipo('crypto')).toBe('Cripto')
  })
})
