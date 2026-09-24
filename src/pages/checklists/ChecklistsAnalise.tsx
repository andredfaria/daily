import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checklistsApi } from '../../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistHistoryDay } from '../../types'
import { StatCard } from '../../components/ui/StatCard'
import { ChecklistHeatmap, HeatmapLegend, resumirHistorico, resumirItem } from '../../components/checklist/analise/ChecklistHeatmap'
import { ChecklistItemRanking } from '../../components/checklist/analise/ChecklistItemRanking'
import { WeeklyTrendSparkline } from '../../components/checklist/analise/WeeklyTrendSparkline'
import { ConstanciaCard } from '../../components/checklist/analise/ConstanciaCard'

const ChecklistsAnalise: React.FC = () => {
  const navigate = useNavigate()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)
  const [historicos, setHistoricos] = useState<Record<string, ChecklistHistoryDay[]>>({})
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    try {
      const [lista, dash, hist] = await Promise.all([
        checklistsApi.get(),
        checklistsApi.dashboard(),
        checklistsApi.history(),
      ])
      setChecklists(lista)
      setDashboard(dash)
      setHistoricos(hist)
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
  // O backend sempre preenche `constancia` (zerada quando não há dado ainda) —
  // o `?? 0` aqui é cinto de segurança, não fluxo esperado.
  const sequenciaAtual = dashboard?.constancia?.sequencia.atual ?? 0

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
            label="Sequência Atual"
            value={`${sequenciaAtual} ${sequenciaAtual === 1 ? 'dia' : 'dias'}`}
            iconColor="text-orange-400"
            iconBg="bg-orange-400/15"
          />
          <StatCard icon="bar_chart" label="Dias Registrados" value={historico.length} iconColor="text-primary" iconBg="bg-primary/15" />
        </div>
      )}

      {dashboard?.constancia && <ConstanciaCard constancia={dashboard.constancia} />}

      <WeeklyTrendSparkline history={historico} />

      <section className="space-y-3">
        <div className="space-y-3">
          {checklists.map((c) => {
            const hist = historicos[c.id] ?? []
            const { completos, enviados } = resumirHistorico(hist)
            return (
              <div
                key={c.id}
                className={`glass-card rounded-2xl border p-4 sm:p-5 ${
                  selecionado === c.id ? 'border-primary/40' : 'border-outline-variant/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${c.is_active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      {c.name}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {enviados === 0
                        ? 'Nenhum envio nas últimas 12 semanas'
                        : `${enviados} ${enviados === 1 ? 'dia' : 'dias'} com envio`}
                      {!c.is_active && ' · inativo'}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-tertiary/15 text-tertiary text-xs font-semibold tabular-nums flex-shrink-0">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {completos} {completos === 1 ? 'completo' : 'completos'}
                  </span>
                </div>
                {c.items.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Checklist sem itens.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Colunas automáticas: cabem quantas grades de 12 semanas a largura permitir */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(272px,100%),1fr))] gap-3">
                      {c.items.map((item) => {
                        const { marcados } = resumirItem(hist, item.text)
                        return (
                          <div key={item.id} className="rounded-xl border border-outline-variant/40 bg-surface-container/40 p-3">
                            <div className="flex items-baseline justify-between gap-3 mb-2">
                              <p className="text-sm text-on-surface truncate">{item.text}</p>
                              <span className="text-xs text-on-surface-variant tabular-nums flex-shrink-0">
                                {marcados} de {enviados} {enviados === 1 ? 'dia' : 'dias'}
                              </span>
                            </div>
                            <ChecklistHeatmap history={hist} itemText={item.text} showLegend={false} />
                          </div>
                        )
                      })}
                    </div>
                    <HeatmapLegend />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <ChecklistItemRanking itemStats={itemStats} />
    </div>
  )
}

export default ChecklistsAnalise
