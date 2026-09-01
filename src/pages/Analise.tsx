import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { checklistsApi } from '../api/checklists'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, OcorrenciaTop } from '../types'
import type { Checklist, ChecklistDashboardData, ChecklistStatsEntry } from '../types'
import { useToast } from '../context/ToastContext'
import { BudgetCard } from '../components/contas/analise/BudgetCard'
import { TopOccurrencesList } from '../components/contas/analise/TopOccurrencesList'
import { SpendingTrendChart } from '../components/contas/analise/SpendingTrendChart'
import { CategoryBreakdown } from '../components/contas/analise/CategoryBreakdown'
import { SummaryStats } from '../components/contas/analise/SummaryStats'
import { StatCard } from '../components/ui/StatCard'
import { ChecklistHeatmap } from '../components/checklist/ChecklistHeatmap'
import { ChecklistItemRanking } from '../components/checklist/ChecklistItemRanking'
import { WeeklyTrendSparkline } from '../components/checklist/WeeklyTrendSparkline'

type AnaliseTab = 'financeiro' | 'checklist'

function mesAtualRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const Analise: React.FC = () => {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<AnaliseTab>('financeiro')

  // --- Aba Financeiro ---
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [topOcc, setTopOcc] = useState<OcorrenciaTop[]>([])
  const [history, setHistory] = useState<ProjectionResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true)
  const [financeiroLoaded, setFinanceiroLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'financeiro' || financeiroLoaded) return
    let active = true
    setLoadingFinanceiro(true)
    const { from, to } = mesAtualRange()
    Promise.allSettled([
      analyticsApi.byCategory(from, to),
      analyticsApi.budget(),
      analyticsApi.topOccurrences(from, to, 5),
      analyticsApi.history(6),
      analyticsApi.projection(6),
    ]).then(([catR, budR, topR, histR, projR]) => {
      if (!active) return
      if (catR.status === 'fulfilled') setByCat(catR.value)
      if (budR.status === 'fulfilled') setBudget(budR.value)
      if (topR.status === 'fulfilled') setTopOcc(topR.value.ocorrencias)
      if (histR.status === 'fulfilled') setHistory(histR.value)
      if (projR.status === 'fulfilled') setProjection(projR.value)
      const anyFailed = [catR, budR, topR, histR, projR].some((r) => r.status === 'rejected')
      if (anyFailed) showToast('Alguns dados financeiros não puderam ser carregados', 'error')
      setLoadingFinanceiro(false)
      setFinanceiroLoaded(true)
    })
    return () => { active = false }
  }, [activeTab, financeiroLoaded, showToast])

  const navigate = useNavigate()

  // --- Aba Checklist ---
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [checklistDashboard, setChecklistDashboard] = useState<ChecklistDashboardData | null>(null)
  const [, setChecklistStats] = useState<ChecklistStatsEntry[]>([])
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
  const [loadingChecklist, setLoadingChecklist] = useState(true)
  const [checklistLoaded, setChecklistLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'checklist' || checklistLoaded) return
    let active = true
    setLoadingChecklist(true)
    Promise.all([checklistsApi.get(), checklistsApi.dashboard(), checklistsApi.stats()])
      .then(([list, dash, stats]) => {
        if (!active) return
        setChecklists(list)
        setChecklistDashboard(dash)
        setChecklistStats(stats)
        if (dash.checklist) setSelectedChecklistId(dash.checklist.id)
      })
      .catch(() => { if (active) showToast('Erro ao carregar dados do checklist', 'error') })
      .finally(() => { if (active) { setLoadingChecklist(false); setChecklistLoaded(true) } })
    return () => { active = false }
  }, [activeTab, checklistLoaded, showToast])

  const handleSelectChecklist = async (id: string) => {
    if (id === selectedChecklistId) return
    setSelectedChecklistId(id)
    try {
      const dash = await checklistsApi.dashboard(id)
      setChecklistDashboard(dash)
    } catch {
      showToast('Erro ao carregar dados do checklist', 'error')
    }
  }

  const renderFinanceiroTab = () => (
    <div className="space-y-6">
      <SummaryStats byCat={byCat} history={history} projection={projection} loading={loadingFinanceiro} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BudgetCard data={budget} loading={loadingFinanceiro} />
        <TopOccurrencesList occurrences={topOcc} loading={loadingFinanceiro} />
      </div>

      <SpendingTrendChart history={history} projection={projection} loading={loadingFinanceiro} />

      <CategoryBreakdown data={byCat} loading={loadingFinanceiro} />
    </div>
  )

  const renderChecklistTab = () => {
    if (loadingChecklist) {
      return <p className="text-sm text-on-surface-variant">Carregando…</p>
    }
    if (checklists.length === 0) {
      return (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">checklist</span>
          <p className="text-on-surface font-semibold mb-1">Nenhum checklist cadastrado</p>
          <p className="text-sm text-on-surface-variant mb-4">Crie um checklist para ver as estatísticas aqui.</p>
          <button onClick={() => navigate('/checklists')} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            Criar Checklist
          </button>
        </div>
      )
    }

    const dashChecklist = checklistDashboard?.checklist
    const today = checklistDashboard?.today
    const history = checklistDashboard?.history ?? []

    return (
      <div className="space-y-6">
        {checklists.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {checklists.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectChecklist(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  selectedChecklistId === c.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {dashChecklist && (() => {
          const itemStats = checklistDashboard?.itemStats ?? []
          const bestStreak = itemStats.reduce((max, s) => Math.max(max, s.streak_current), 0)
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon="checklist" label="Itens" value={dashChecklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
              <StatCard
                icon="schedule"
                label="Horário de Envio"
                value={`${String(dashChecklist.send_time).padStart(2, '0')}h`}
                iconColor="text-yellow-400"
                iconBg="bg-yellow-400/15"
              />
              <StatCard
                icon="today"
                label="Conclusão Hoje"
                value={today ? `${today.completion_pct}%` : '—'}
                iconColor={today && today.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
                iconBg={today && today.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
              />
              <StatCard
                icon="local_fire_department"
                label="Melhor Sequência"
                value={bestStreak > 0 ? `${bestStreak} ${bestStreak === 1 ? 'dia' : 'dias'}` : '—'}
                iconColor="text-orange-400"
                iconBg="bg-orange-400/15"
              />
              <StatCard icon="bar_chart" label="Dias Registrados" value={history.length} iconColor="text-primary" iconBg="bg-primary/15" />
            </div>
          )
        })()}

        <WeeklyTrendSparkline history={history} />

        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
          <h3 className="text-base font-semibold text-on-surface mb-4">Histórico (12 semanas)</h3>
          <ChecklistHeatmap history={history} />
        </div>

        <ChecklistItemRanking itemStats={checklistDashboard?.itemStats ?? []} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">Análise</h1>
        <p className="text-sm text-on-surface-variant">Métricas aprofundadas de contas e checklist.</p>
      </header>

      <div className="flex gap-2">
        {(['financeiro', 'checklist'] as AnaliseTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {t === 'financeiro' ? 'Financeiro' : 'Checklist'}
          </button>
        ))}
      </div>

      {activeTab === 'financeiro' ? renderFinanceiroTab() : renderChecklistTab()}
    </div>
  )
}

export default Analise
