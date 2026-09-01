import { claimKeyDia, claimKeyMes, claimKeyMesAnterior } from '../messageClaim'

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
