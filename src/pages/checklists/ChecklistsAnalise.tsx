import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checklistsApi } from '../../api/checklists'
import type { Checklist, ChecklistDashboardData } from '../../types'
import { StatCard } from '../../components/ui/StatCard'
import { ChecklistHeatmap } from '../../components/checklist/analise/ChecklistHeatmap'
import { ChecklistItemRanking } from '../../components/checklist/analise/ChecklistItemRanking'
import { WeeklyTrendSparkline } from '../../components/checklist/analise/WeeklyTrendSparkline'

const ChecklistsAnalise: React.FC = () => {
  const navigate = useNavigate()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    try {
      const [lista, dash] = await Promise.all([checklistsApi.get(), checklistsApi.dashboard()])
      setChecklists(lista)
      setDashboard(dash)
      if (dash.checklist) setSelecionado(dash.checklist.id)
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const trocarChecklist = async (id: string) => {
    if (id === selecionado) return
    setSelecionado(id)
    try {
      setDashboard(await checklistsApi.dashboard(id))
    } catch {
      setErro(true)
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>
  }

  if (erro) {
    return (
      <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-error">error</span>
        <p className="text-sm text-on-surface flex-1">Erro ao carregar dados do checklist.</p>
        <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
      </div>
    )
  }

  if (checklists.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">checklist</span>
        <p className="text-on-surface font-semibold mb-1">Nenhum checklist cadastrado</p>
        <p className="text-sm text-on-surface-variant mb-4">Crie um checklist para ver as estatísticas aqui.</p>
        <button onClick={() => navigate('/checklists/lista')} className="btn-primary mx-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Criar Checklist
        </button>
      </div>
    )
  }

  const checklist = dashboard?.checklist
  const hoje = dashboard?.today
  const historico = dashboard?.history ?? []
  const itemStats = dashboard?.itemStats ?? []
  const melhorSequencia = itemStats.reduce((max, s) => Math.max(max, s.streak_current), 0)

  return (
    <div className="space-y-6">
      {checklists.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {checklists.map((c) => (
            <button
              key={c.id}
              onClick={() => trocarChecklist(c.id)}
              className={`px-3 min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                selecionado === c.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {checklist && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon="checklist" label="Itens" value={checklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
          <StatCard
            icon="schedule"
            label="Horário de Envio"
            value={`${String(checklist.send_time).padStart(2, '0')}h`}
            iconColor="text-yellow-400"
            iconBg="bg-yellow-400/15"
          />
          <StatCard
            icon="today"
            label="Conclusão Hoje"
            value={hoje ? `${hoje.completion_pct}%` : '—'}
            iconColor={hoje && hoje.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
            iconBg={hoje && hoje.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
          />
          <StatCard
            icon="local_fire_department"
            label="Melhor Sequência"
            value={melhorSequencia > 0 ? `${melhorSequencia} ${melhorSequencia === 1 ? 'dia' : 'dias'}` : '—'}
            iconColor="text-orange-400"
            iconBg="bg-orange-400/15"
          />
          <StatCard icon="bar_chart" label="Dias Registrados" value={historico.length} iconColor="text-primary" iconBg="bg-primary/15" />
        </div>
      )}

      <WeeklyTrendSparkline history={historico} />

      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Histórico (12 semanas)</h3>
        <ChecklistHeatmap history={historico} />
      </div>

      <ChecklistItemRanking itemStats={itemStats} />
    </div>
  )
}

export default ChecklistsAnalise
