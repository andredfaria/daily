import React, { useCallback, useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analytics'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, OcorrenciaTop } from '../../types'
import { BudgetCard } from '../../components/contas/analise/BudgetCard'
import { TopOccurrencesList } from '../../components/contas/analise/TopOccurrencesList'
import { SpendingTrendChart } from '../../components/contas/analise/SpendingTrendChart'
import { CategoryBreakdown } from '../../components/contas/analise/CategoryBreakdown'
import { SummaryStats } from '../../components/contas/analise/SummaryStats'

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const ContasAnalise: React.FC = () => {
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [topOcc, setTopOcc] = useState<OcorrenciaTop[]>([])
  const [history, setHistory] = useState<ProjectionResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    const { from, to } = mesAtualRange()
    const [catR, budR, topR, histR, projR] = await Promise.allSettled([
      analyticsApi.byCategory(from, to),
      analyticsApi.budget(),
      analyticsApi.topOccurrences(from, to, 5),
      analyticsApi.history(6),
      analyticsApi.projection(6),
    ])
    if (catR.status === 'fulfilled') setByCat(catR.value)
    if (budR.status === 'fulfilled') setBudget(budR.value)
    if (topR.status === 'fulfilled') setTopOcc(topR.value.ocorrencias)
    if (histR.status === 'fulfilled') setHistory(histR.value)
    if (projR.status === 'fulfilled') setProjection(projR.value)
    setErro([catR, budR, topR, histR, projR].some((r) => r.status === 'rejected'))
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="space-y-6">
      {erro && (
        <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-error">error</span>
          <p className="text-sm text-on-surface flex-1">Alguns dados não puderam ser carregados.</p>
          <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
        </div>
      )}

      <SummaryStats byCat={byCat} history={history} projection={projection} loading={loading} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BudgetCard data={budget} loading={loading} />
        <TopOccurrencesList occurrences={topOcc} loading={loading} />
      </div>

      <SpendingTrendChart history={history} projection={projection} loading={loading} />

      <CategoryBreakdown data={byCat} loading={loading} />
    </div>
  )
}

export default ContasAnalise
