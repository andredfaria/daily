// Linha de um ativo vinda do banco, com os DECIMAL ainda como string (mysql2).
export interface SnapshotInput {
  id: string
  user_id: string
  quantity: number | string
  avg_price: number | string
  last_price: number | string | null
}

export interface SnapshotRow {
  assetId: string
  userId: string
  snapshotDate: string
  price: number
  quantity: number
  avgPrice: number
}

function precoValido(valor: number | null): boolean {
  return valor !== null && Number.isFinite(valor) && valor > 0
}

// A cotação do dia é a preferida. Quando a brapi falha, o último preço conhecido
// evita um degrau falso no gráfico — um ticker fora do ar por um dia não pode
// parecer uma queda de patrimônio. Sem nenhum dos dois, não há o que registrar.
export function resolveSnapshotPrice(
  quotePrice: number | null,
  lastPrice: number | null,
): number | null {
  if (precoValido(quotePrice)) return quotePrice
  if (precoValido(lastPrice)) return lastPrice
  return null
}

// Quantidade e preço médio são copiados para dentro do snapshot, não lidos de
// assets na hora da consulta: comprar mais de um ativo amanhã não pode alterar
// o patrimônio de ontem.
export function buildSnapshotRow(
  asset: SnapshotInput,
  quotePrice: number | null,
  snapshotDate: string,
): SnapshotRow | null {
  const lastPrice = asset.last_price === null ? null : Number(asset.last_price)
  const price = resolveSnapshotPrice(quotePrice, lastPrice)
  if (price === null) return null

  return {
    assetId: asset.id,
    userId: asset.user_id,
    snapshotDate,
    price,
    quantity: Number(asset.quantity),
    avgPrice: Number(asset.avg_price),
  }
}
