import pool from '../db'
import { fetchQuote, Quote } from './brapi'
import { buildSnapshotRow } from './assetSnapshotMath'
import { formatDateSaoPaulo } from './assetMath'

export interface SyncedAsset {
  asset: any
  quote: Quote | null
}

// Busca a cotação de cada ativo ativo do usuário, atualiza o último preço e
// grava o snapshot do dia. Devolve as cotações para quem precisar decidir
// alerta em cima delas — assim a brapi é consultada uma vez só por ativo.
export async function syncUserAssets(userId: string): Promise<SyncedAsset[]> {
  const [assets]: any = await pool.query(
    `SELECT id, user_id, ticker, kind, quantity, avg_price, target_price, stop_price,
            target_triggered_at, stop_triggered_at, last_price
       FROM assets WHERE user_id = ? AND is_active = 1`,
    [userId]
  )
  if (!assets.length) return []

  const hoje = formatDateSaoPaulo(new Date())
  const synced: SyncedAsset[] = []

  for (const asset of assets) {
    let quote: Quote | null = null

    // Um ticker quebrado não pode abortar o laço nem impedir o snapshot dos outros.
    try {
      quote = await fetchQuote(asset.ticker, asset.kind)

      if (quote) {
        await pool.query(
          'UPDATE assets SET last_price = ?, last_quote_at = ? WHERE id = ?',
          [quote.price, quote.quotedAt, asset.id]
        )
      }

      // A trava de cotação velha (fim de semana, feriado) vale só para o alerta.
      // Aqui não: num sábado, cripto teria preço e ação não, e o total do dia
      // despencaria sem nada ter acontecido. O fechamento de sexta é o valor da
      // carteira no sábado.
      const row = buildSnapshotRow(asset, quote ? quote.price : null, hoje)
      if (row) {
        await pool.query(
          `INSERT INTO asset_snapshots (user_id, asset_id, snapshot_date, price, quantity, avg_price)
                VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE price = VALUES(price),
                                   quantity = VALUES(quantity),
                                   avg_price = VALUES(avg_price)`,
          [row.userId, row.assetId, row.snapshotDate, row.price, row.quantity, row.avgPrice]
        )
      }
    } catch (e: any) {
      console.error(`[assetSync] erro no ativo ${asset.ticker}:`, e.message)
    }

    synced.push({ asset, quote })
  }

  console.log(`[assetSync] ${synced.length} ativo(s) sincronizado(s) para ${userId}`)
  return synced
}
