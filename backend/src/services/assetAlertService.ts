import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fetchQuote } from './brapi'
import {
  AlertHit,
  isTargetHit,
  isStopHit,
  buildAlertMessage,
  formatDateSaoPaulo,
} from './assetMath'

export async function checkAssetAlerts(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    `SELECT whatsapp_number FROM users
      WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1 AND asset_alerts_enabled = 1`,
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const [assets]: any = await pool.query(
    `SELECT id, ticker, kind, quantity, avg_price, target_price, stop_price,
            target_triggered_at, stop_triggered_at
       FROM assets WHERE user_id = ? AND is_active = 1`,
    [userId]
  )
  if (!assets.length) return

  const hoje = formatDateSaoPaulo(new Date())
  const hits: AlertHit[] = []
  const marcarAlvo: string[] = []
  const marcarStop: string[] = []

  for (const asset of assets) {
    // Um ticker quebrado (cotação inválida, UPDATE falho, data impossível) não
    // pode abortar o laço — os hits já acumulados nos outros ativos não podem se perder.
    try {
      const quote = await fetchQuote(asset.ticker, asset.kind)
      if (!quote) continue

      await pool.query(
        'UPDATE assets SET last_price = ?, last_quote_at = ? WHERE id = ?',
        [quote.price, quote.quotedAt, asset.id]
      )

      // Em fim de semana e feriado a brapi devolve o fechamento anterior.
      // Disparar com preço velho seria alerta falso — cripto não tem pregão.
      if (asset.kind !== 'crypto' && formatDateSaoPaulo(quote.quotedAt) !== hoje) {
        console.log(`[assetAlert] ${asset.ticker} com cotação de ${formatDateSaoPaulo(quote.quotedAt)} — mercado fechado, pulando`)
        continue
      }

      const quantity = Number(asset.quantity)
      const avgPrice = Number(asset.avg_price)
      const target = asset.target_price === null ? null : Number(asset.target_price)
      const stop = asset.stop_price === null ? null : Number(asset.stop_price)

      if (isTargetHit(quote.price, target, asset.target_triggered_at)) {
        hits.push({ ticker: asset.ticker, reason: 'target', price: quote.price, threshold: target!, quantity, avgPrice })
        marcarAlvo.push(asset.id)
      }

      if (isStopHit(quote.price, stop, asset.stop_triggered_at)) {
        hits.push({ ticker: asset.ticker, reason: 'stop', price: quote.price, threshold: stop!, quantity, avgPrice })
        marcarStop.push(asset.id)
      }
    } catch (e: any) {
      console.error(`[assetAlert] erro no ativo ${asset.ticker}:`, e.message)
      continue
    }
  }

  if (!hits.length) return

  await sendWhatsAppText(userRows[0].whatsapp_number, buildAlertMessage(hits))

  if (marcarAlvo.length) {
    await pool.query('UPDATE assets SET target_triggered_at = NOW() WHERE id IN (?)', [marcarAlvo])
  }
  if (marcarStop.length) {
    await pool.query('UPDATE assets SET stop_triggered_at = NOW() WHERE id IN (?)', [marcarStop])
  }

  console.log(`[assetAlert] ${hits.length} alerta(s) enviado(s) para ${userId}`)
}
