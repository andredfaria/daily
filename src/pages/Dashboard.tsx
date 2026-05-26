import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { occurrencesApi } from '../api/occurrences'
import { checklistsApi } from '../api/checklists'
import type { BillOccurrence, DashboardStats, ChecklistDashboardData } from '../types'
import { formatBRL, formatDate, formatRelativeDate, getBillIcon } from '../utils/format'
import { SkeletonRow, SkeletonStatCard } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import { parseISO, isThisWeek } from 'date-fns'

// --- WAHA Status Badge ---
interface WahaStatusBadgeProps {
  connected: boolean | null
}

const WahaStatusBadge: React.FC<WahaStatusBadgeProps> = ({ connected }) => {
  if (connected === null) return (
    <span className="flex items-center gap-1 text-xs text-on-surface-variant">
      <span className="w-2 h-2 rounded-full bg-outline animate-pulse" />
      Verificando WhatsApp...
    </span>
  )
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${connected ? 'text-tertiary' : 'text-error'}`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-tertiary' : 'bg-error'}`} />
      WhatsApp {connected ? 'conectado' : 'desconectado'}
    </span>
  )
}

// --- Stat Card ---
interface StatCardProps {
  icon: string
  label: string
  value: string | number
  iconColor: string
  iconBg: string
  sub?: string
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg, sub }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-on-surface mb-0.5">{value}</div>
    <div className="text-xs text-on-surface-variant font-medium">{label}</div>
    {sub && <div className="text-xs text-on-surface-variant/70 mt-0.5">{sub}</div>}
  </div>
)

// --- Occurrence Row ---
interface OccurrenceRowProps {
  occurrence: BillOccurrence
}

const OccurrenceRow: React.FC<OccurrenceRowProps> = ({ occurrence }) => {
  const { label, color } = formatRelativeDate(occurrence.due_date)
  const icon = getBillIcon(occurrence.bill_name ?? occurrence.bill?.name ?? '')
  const billName = occurrence.bill_name ?? occurrence.bill?.name ?? 'Sem nome'

  return (
    <div className="p-3 sm:p-4 rounded-xl border bg-surface-container/50 hover:bg-surface-container transition-all duration-200 border-outline-variant/40">
      <div className="flex items-center gap-3">
        <div className="w-1 h-10 rounded-full flex-shrink-0 bg-primary/40" />
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{billName}</p>
          <p className={`text-xs ${color} font-medium`}>
            {formatDate(occurrence.due_date)} · {label}
          </p>
        </div>
        <p className="text-sm font-bold text-on-surface flex-shrink-0">{formatBRL(occurrence.amount)}</p>
      </div>
    </div>
  )
}

// --- Dashboard Page ---
const Dashboard: React.FC = () => {
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [checklistData, setChecklistData] = useState<ChecklistDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [upcomingData, statsData, checklistResult] = await Promise.allSettled([
        occurrencesApi.upcoming(30),
        occurrencesApi.getDashboardStats(),
        checklistsApi.dashboard(),
      ])

      if (checklistResult.status === 'fulfilled') {
        setChecklistData(checklistResult.value)
      }

      if (upcomingData.status === 'fulfilled') {
        setOccurrences(upcomingData.value)
      }

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value)
      } else {
        if (upcomingData.status === 'fulfilled') {
          const occ = upcomingData.value
          const dueThisWeek = occ.filter(
            (o) => isThisWeek(parseISO(o.due_date), { weekStartsOn: 1 }),
          ).length
          setStats({
            active_bills: occ.length,
            due_this_week: dueThisWeek,
            waha_connected: false,
          })
        }
      }
    } catch (err) {
      showError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Checklist metrics
  const checklistItems = checklistData?.checklist?.items.length ?? 0
  const todayPct = checklistData?.today?.completion_pct ?? null
  const historyAvg = checklistData?.history?.length
    ? Math.round(
        checklistData.history.reduce((s, d) => s + Number(d.completion_pct), 0) /
          checklistData.history.length,
      )
    : null
  const sendTime = checklistData?.checklist
    ? `${String(checklistData.checklist.send_time).padStart(2, '0')}h`
    : null

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Row 1 — Contas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary">receipt_long</span>
            Contas a Pagar
          </p>
          <WahaStatusBadge connected={loading ? null : (stats?.waha_connected ?? null)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard
                icon="receipt_long"
                label="Contas Ativas"
                value={stats?.active_bills ?? 0}
                iconColor="text-primary"
                iconBg="bg-primary/15"
              />
              <StatCard
                icon="event_upcoming"
                label="Vencem Esta Semana"
                value={stats?.due_this_week ?? 0}
                iconColor="text-yellow-400"
                iconBg="bg-yellow-400/15"
              />
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Checklists */}
      <div>
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary">checklist</span>
          Checklist Diário
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          ) : checklistData?.checklist ? (
            <>
              <StatCard
                icon="format_list_bulleted"
                label="Itens no Checklist"
                value={checklistItems}
                iconColor="text-primary"
                iconBg="bg-primary/15"
              />
              <StatCard
                icon="today"
                label="Conclusão Hoje"
                value={todayPct !== null ? `${todayPct}%` : '—'}
                iconColor={todayPct !== null && todayPct >= 100 ? 'text-tertiary' : 'text-yellow-400'}
                iconBg={todayPct !== null && todayPct >= 100 ? 'bg-tertiary/15' : 'bg-yellow-400/15'}
              />
              <StatCard
                icon="bar_chart"
                label="Média (14 dias)"
                value={historyAvg !== null ? `${historyAvg}%` : '—'}
                iconColor="text-primary"
                iconBg="bg-primary/15"
              />
              <StatCard
                icon="schedule"
                label="Próximo Envio"
                value={sendTime ?? '—'}
                iconColor="text-on-surface-variant"
                iconBg="bg-surface-container-high"
              />
            </>
          ) : (
            <div className="col-span-2 lg:col-span-4 glass-card rounded-2xl border border-outline-variant/50 p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">checklist</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Nenhum checklist cadastrado</p>
                <p className="text-xs text-on-surface-variant">Configure um checklist diário na aba Checklists.</p>
              </div>
              <button onClick={() => navigate('/checklists')} className="ml-auto btn-ghost text-xs py-1.5 px-3">
                Configurar →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Occurrences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-on-surface">Próximos Vencimentos</h3>
          <button
            onClick={() => navigate('/notificacoes')}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Ver notificações →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : occurrences.length === 0 ? (
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">
              celebration
            </span>
            <p className="text-on-surface font-semibold mb-1">Tudo em dia!</p>
            <p className="text-sm text-on-surface-variant">Nenhum vencimento próximo.</p>
            <button
              onClick={() => navigate('/contas/nova')}
              className="btn-primary mx-auto mt-4"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar Conta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {occurrences.map((occ) => (
              <OccurrenceRow
                key={occ.id}
                occurrence={occ}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
