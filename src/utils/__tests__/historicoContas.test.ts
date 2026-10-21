import { describe, it, expect } from 'vitest'
import { separarContasDoMes, somarMeses } from '../historicoContas'
import type { FechamentoContasResponse, ItemFechamentoContas } from '../../types'

const item = (bill_name: string, situacao: ItemFechamentoContas['situacao'], due_date: string, paid_at: string | null = null): ItemFechamentoContas => ({
  id: bill_name, bill_name, due_date, amount: 10, situacao, paid_at, source: paid_at ? 'app' : null, estimado: false,
})

describe('somarMeses', () => {
  it('vira o ano para frente e para trás', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(somarMeses('2026-10', 0)).toBe('2026-10')
  })
})

describe('separarContasDoMes', () => {
  const fechamento: FechamentoContasResponse = {
    mes: '2026-10', pago: 20, aberto: 30, atrasado: 10, qtdPagas: 2, qtdAbertas: 3, qtdAtrasadas: 1,
    categorias: [
      { category: 'casa', pago: 10, aberto: 20, total: 30, itens: [
        item('Aluguel', 'paga', '2026-10-05', '2026-10-04T15:00:00.000Z'),
        item('Luz', 'a_vencer', '2026-10-25'),
        item('Gás', 'a_vencer', '2026-10-22'),
      ] },
      { category: 'assinaturas', pago: 10, aberto: 10, total: 20, itens: [
        item('Spotify', 'atrasada', '2026-10-10'),
        item('Netflix', 'paga', '2026-10-15', '2026-10-15T12:00:00.000Z'),
      ] },
    ],
  }

  it('falta pagar: atrasadas primeiro, depois por vencimento, com a categoria', () => {
    const { faltaPagar } = separarContasDoMes(fechamento)
    expect(faltaPagar.map((i) => [i.bill_name, i.category])).toEqual([
      ['Spotify', 'assinaturas'], ['Gás', 'casa'], ['Luz', 'casa'],
    ])
  })

  it('pagas: a mais recente primeiro', () => {
    expect(separarContasDoMes(fechamento).pagas.map((i) => i.bill_name)).toEqual(['Netflix', 'Aluguel'])
  })
})
