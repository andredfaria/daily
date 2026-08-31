export type AssetKind = 'stock' | 'fii' | 'crypto'

export interface AlertHit {
  ticker: string
  reason: 'target' | 'stop'
  price: number
  threshold: number
  quantity: number
  avgPrice: number
}

export function investedValue(quantity: number, avgPrice: number): number {
  return quantity * avgPrice
}

export function currentValue(quantity: number, price: number): number {
  return quantity * price
}

export function profitLoss(quantity: number, avgPrice: number, price: number): number {
  return currentValue(quantity, price) - investedValue(quantity, avgPrice)
}

// Preço médio zero significa posição sem custo registrado — não há percentual a calcular.
export function profitLossPct(avgPrice: number, price: number): number {
  if (!avgPrice) return 0
  return ((price - avgPrice) / avgPrice) * 100
}

export function isTargetHit(
  price: number,
  target: number | null,
  triggeredAt: Date | string | null,
): boolean {
  if (target === null || target === undefined) return false
  if (triggeredAt) return false
  return price >= target
}

export function isStopHit(
  price: number,
  stop: number | null,
  triggeredAt: Date | string | null,
): boolean {
  if (stop === null || stop === undefined) return false
  if (triggeredAt) return false
  return price <= stop
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Percentual sempre com uma casa decimal: 20.857 -> "20,9", -9 -> "9,0".
function formatPct(value: number): string {
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
}

function buildHitBlock(hit: AlertHit): string {
  const isTarget = hit.reason === 'target'
  const lines = [
    `${isTarget ? '🎯' : '🛑'} *${hit.ticker}* atingiu o ${isTarget ? 'alvo' : 'stop'}`,
    `Cotação: R$ ${formatBRL(hit.price)} (${isTarget ? 'alvo' : 'stop'} R$ ${formatBRL(hit.threshold)})`,
  ]

  // Quantidade zero é watchlist — não há posição nem resultado a mostrar.
  if (hit.quantity > 0) {
    lines.push(`Posição: ${formatQuantity(hit.quantity)} un. · pago R$ ${formatBRL(hit.avgPrice)}`)
    const pl = profitLoss(hit.quantity, hit.avgPrice, hit.price)
    const pct = profitLossPct(hit.avgPrice, hit.price)
    const label = pl >= 0 ? 'Lucro' : 'Prejuízo'
    const sign = pl >= 0 ? '+' : '-'
    lines.push(`${label}: ${sign}R$ ${formatBRL(Math.abs(pl))} (${sign}${formatPct(pct)}%)`)
  }

  return lines.join('\n')
}

export function buildAlertMessage(hits: AlertHit[]): string {
  return [
    '📈 *Alerta de Ativos — BillSync*',
    '',
    hits.map(buildHitBlock).join('\n\n'),
    '',
    '_Alertas pausados até você reativar no app._',
  ].join('\n')
}

export function formatDateSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const p: Record<string, string> = {}
  parts.forEach(({ type, value }) => { p[type] = value })
  return `${p.year}-${p.month}-${p.day}`
}
