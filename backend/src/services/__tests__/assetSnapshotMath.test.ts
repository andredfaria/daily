import {
  resolveSnapshotPrice,
  buildSnapshotRow,
  SnapshotInput,
} from '../assetSnapshotMath'

const ativo: SnapshotInput = {
  id: 'a1',
  user_id: 'u1',
  quantity: '10.00000000',
  avg_price: '30.50000000',
  last_price: '28.00000000',
}

describe('resolveSnapshotPrice', () => {
  it('prefere a cotação do dia quando ela existe', () => {
    expect(resolveSnapshotPrice(32.4, 28)).toBe(32.4)
  })

  it('cai para o último preço conhecido quando a cotação falha', () => {
    expect(resolveSnapshotPrice(null, 28)).toBe(28)
  })

  it('devolve null quando não há cotação nem último preço', () => {
    expect(resolveSnapshotPrice(null, null)).toBeNull()
  })

  it('trata preço zero ou negativo como ausente', () => {
    expect(resolveSnapshotPrice(0, 28)).toBe(28)
    expect(resolveSnapshotPrice(-5, 28)).toBe(28)
    expect(resolveSnapshotPrice(0, 0)).toBeNull()
  })

  it('trata Infinity como ausente', () => {
    expect(resolveSnapshotPrice(Infinity, 28)).toBe(28)
  })
})

describe('buildSnapshotRow', () => {
  it('monta a linha convertendo os DECIMAL string do mysql2 para number', () => {
    const row = buildSnapshotRow(ativo, 32.4, '2026-09-01')
    expect(row).toEqual({
      assetId: 'a1',
      userId: 'u1',
      snapshotDate: '2026-09-01',
      price: 32.4,
      quantity: 10,
      avgPrice: 30.5,
    })
  })

  it('congela quantidade e preço médio do momento, não os lê depois', () => {
    const row = buildSnapshotRow({ ...ativo, quantity: '3', avg_price: '99' }, 10, '2026-09-01')
    expect(row?.quantity).toBe(3)
    expect(row?.avgPrice).toBe(99)
  })

  it('usa o último preço quando a cotação do dia falhou', () => {
    const row = buildSnapshotRow(ativo, null, '2026-09-01')
    expect(row?.price).toBe(28)
  })

  it('devolve null quando o ativo não tem preço algum', () => {
    const row = buildSnapshotRow({ ...ativo, last_price: null }, null, '2026-09-01')
    expect(row).toBeNull()
  })

  it('registra watchlist normalmente — quantidade zero soma zero no total', () => {
    const row = buildSnapshotRow({ ...ativo, quantity: '0' }, 32.4, '2026-09-01')
    expect(row?.quantity).toBe(0)
    expect(row?.price).toBe(32.4)
  })
})
