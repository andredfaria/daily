import React from 'react'
import type { ByCategoryResponse, ProjectionResponse } from '../../types'
import { categoryLabel } from '../../utils/categoryColors'
import { formatBRL } from '../../utils/format'
import { StatCard } from '../ui/StatCard'
import { SkeletonStatCard } from '../ui/Skeleton'

interface SummaryStatsProps {
  byCat: ByCategoryResponse | null
  history: ProjectionResponse | null
  projection: ProjectionResponse | null
  loading: boolean
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ byCat, history, projection, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
    )
  }

  const meses = history?.meses ?? []
  const current = meses[meses.length - 1]?.total ?? byCat?.total ?? 0
  const previous = meses.length > 1 ? meses[meses.length - 2]?.total : undefined

  let deltaIcon = 'trending_flat'
  let deltaColor = 'text-on-surface-variant'
  let deltaValue = '—'
  if (previous !== undefined && previous > 0) {
    const deltaPct = Math.round(((current - previous) / previous) * 100)
    deltaIcon = deltaPct > 0 ? 'trending_up' : deltaPct < 0 ? 'trending_down' : 'trending_flat'
    deltaColor = deltaPct > 0 ? 'text-error' : deltaPct < 0 ? 'text-tertiary' : 'text-on-surface-variant'
    deltaValue = `${deltaPct > 0 ? '+' : ''}${deltaPct}%`
  }

  const topCategory = byCat?.categorias?.[0]
  const nextMonth = projection?.meses?.[1]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard icon="payments" label="Total do mês" value={formatBRL(current)} iconColor="text-primary" iconBg="bg-primary/15" />
      <StatCard icon={deltaIcon} label="Vs. mês passado" value={deltaValue} iconColor={deltaColor} iconBg="bg-surface-container-high" />
      <StatCard
        icon="donut_large"
        label={topCategory ? `Maior categoria · ${topCategory.pct}%` : 'Maior categoria'}
        value={topCategory ? categoryLabel(topCategory.category) : '—'}
        iconColor="text-primary"
        iconBg="bg-primary/15"
      />
      <StatCard
        icon="insights"
        label="Projeção próx. mês"
        value={nextMonth ? formatBRL(nextMonth.total) : '—'}
        iconColor="text-tertiary"
        iconBg="bg-tertiary/15"
      />
    </div>
  )
}
