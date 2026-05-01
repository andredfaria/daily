import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { occurrencesApi } from '../api/occurrences'
import type { BillOccurrence, DashboardStats } from '../types'
import { formatBRL, formatDate, formatRelativeDate, getBillIcon } from '../utils/format'
import StatusBadge from '../components/ui/StatusBadge'
import { SkeletonRow, SkeletonStatCard } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import { parseISO, isThisWeek } from 'date-fns'

// --- Donut Chart ---
interface DonutChartProps {
  paid: number
  pending: number
  overdue: number
}

const DonutChart: React.FC<DonutChartProps> = ({ paid, pending, overdue }) => {
  const total = paid + pending + overdue || 1
  const size = 160
  const radius = 60
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = 18
  const circumference = 2 * Math.PI * radius

  const paidPct = paid / total
  const pendingPct = pending / total
  const overduePct = overdue / total

  const buildArc = (startPct: number, endPct: number) => {
    const start = startPct * circumference
    const length = endPct * circumference
    return {
      strokeDasharray: `${length} ${circumference - length}`,
      strokeDashoffset: -start,
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Paid */}
          {paid > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#4ae176"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              {...buildArc(0, paidPct)}
              className="transition-all duration-700"
            />
          )}
          {/* Pending */}
          {pending > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#eab308"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              {...buildArc(paidPct, pendingPct)}
              className="transition-all duration-700"
            />
          )}
          {/* Overdue */}
          {overdue > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#ffb4ab"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              {...buildArc(paidPct + pendingPct, overduePct)}
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-on-surface">{total}</span>
          <span className="text-xs text-on-surface-variant">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary flex-shrink-0" />
            <span className="text-xs text-on-surface-variant">Pagas</span>
          </div>
          <span className="text-xs font-semibold text-on-surface">{paid}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
            <span className="text-xs text-on-surface-variant">Pendentes</span>
          </div>
          <span className="text-xs font-semibold text-on-surface">{pending}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error flex-shrink-0" />
            <span className="text-xs text-on-surface-variant">Atrasadas</span>
          </div>
          <span className="text-xs font-semibold text-on-surface">{overdue}</span>
        </div>
      </div>
    </div>
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
  onMarkPaid: (id: string) => void
  paying: string | null
  justPaid: string | null
}

const OccurrenceRow: React.FC<OccurrenceRowProps> = ({ occurrence, onMarkPaid, paying, justPaid }) => {
  const { label, color } = formatRelativeDate(occurrence.due_date)
  const isPaid = occurrence.status === 'paid'
  const isOverdue = occurrence.status === 'overdue'
  const icon = getBillIcon(occurrence.bill_name ?? occurrence.bill?.name ?? '')
  const billName = occurrence.bill_name ?? occurrence.bill?.name ?? 'Sem nome'
  const isJustPaid = justPaid === occurrence.id
  const isPaying = paying === occurrence.id

  const borderColor = isPaid ? 'border-tertiary/50' : isOverdue ? 'border-error/50' : 'border-yellow-400/50'
  const leftBar = isPaid ? 'bg-tertiary' : isOverdue ? 'bg-error' : 'bg-yellow-400'

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-xl border bg-surface-container/50
        hover:bg-surface-container transition-all duration-200 group
        ${borderColor}
      `}
    >
      {/* Left bar */}
      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${leftBar}`} />

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{billName}</p>
        <p className={`text-xs ${color} font-medium`}>
          {formatDate(occurrence.due_date)} · {label}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-on-surface">{formatBRL(occurrence.amount)}</p>
      </div>

      {/* Status Badge */}
      <StatusBadge status={isJustPaid ? 'paid' : occurrence.status} animate={isJustPaid} />

      {/* Action */}
      {!isPaid && (
        <button
          onClick={() => onMarkPaid(occurrence.id)}
          disabled={isPaying}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-tertiary/10 text-tertiary border border-tertiary/30
            hover:bg-tertiary/20 transition-all duration-200
            disabled:opacity-60 disabled:cursor-not-allowed
            flex-shrink-0
          "
        >
          {isPaying ? (
            <span className="w-3.5 h-3.5 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-sm">check_circle</span>
          )}
          Pagar
        </button>
      )}
    </div>
  )
}

// --- Dashboard Page ---
const Dashboard: React.FC = () => {
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [justPaid, setJustPaid] = useState<string | null>(null)
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [upcomingData, statsData] = await Promise.allSettled([
        occurrencesApi.upcoming(30),
        occurrencesApi.getDashboardStats(),
      ])

      if (upcomingData.status === 'fulfilled') {
        setOccurrences(upcomingData.value)
      }
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value)
      } else {
        // Compute stats from occurrences if endpoint not available
        if (upcomingData.status === 'fulfilled') {
          const occ = upcomingData.value
          const paid = occ.filter((o) => o.status === 'paid').length
          const pending = occ.filter((o) => o.status === 'pending').length
          const overdue = occ.filter((o) => o.status === 'overdue').length
          const dueThisWeek = occ.filter(
            (o) =>
              (o.status === 'pending' || o.status === 'overdue') &&
              isThisWeek(parseISO(o.due_date), { weekStartsOn: 1 }),
          ).length

          setStats({
            active_bills: occ.length,
            due_this_week: dueThisWeek,
            paid_this_month: paid,
            waha_connected: false,
            monthly_paid_amount: occ
              .filter((o) => o.status === 'paid')
              .reduce((s, o) => s + o.amount, 0),
            monthly_pending_amount: occ
              .filter((o) => o.status === 'pending')
              .reduce((s, o) => s + o.amount, 0),
            monthly_overdue_amount: occ
              .filter((o) => o.status === 'overdue')
              .reduce((s, o) => s + o.amount, 0),
            paid_count: paid,
            pending_count: pending,
            overdue_count: overdue,
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

  const handleMarkPaid = async (id: string) => {
    setPaying(id)
    try {
      await occurrencesApi.markAsPaid(id, { confirmation_source: 'web' })
      setJustPaid(id)
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: 'paid', paid_at: new Date().toISOString() } : o,
        ),
      )
      success('Pagamento registrado!')
      setTimeout(() => setJustPaid(null), 1500)

      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              paid_count: prev.paid_count + 1,
              pending_count: Math.max(0, prev.pending_count - 1),
            }
          : prev,
      )
    } catch {
      showError('Erro ao registrar pagamento.')
    } finally {
      setPaying(null)
    }
  }

  const pendingFirst = [...occurrences].sort((a, b) => {
    const order = { overdue: 0, pending: 1, paid: 2, cancelled: 3 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
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
            <StatCard
              icon="check_circle"
              label="Pagas Este Mês"
              value={stats?.paid_this_month ?? 0}
              iconColor="text-tertiary"
              iconBg="bg-tertiary/15"
              sub={formatBRL(stats?.monthly_paid_amount ?? 0)}
            />
            <StatCard
              icon="chat"
              label="WAHA Status"
              value={stats?.waha_connected ? 'Online' : 'Offline'}
              iconColor={stats?.waha_connected ? 'text-tertiary' : 'text-error'}
              iconBg={stats?.waha_connected ? 'bg-tertiary/15' : 'bg-error/15'}
            />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upcoming Occurrences */}
        <div className="xl:col-span-2 space-y-4">
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
          ) : pendingFirst.length === 0 ? (
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
              {pendingFirst.map((occ) => (
                <OccurrenceRow
                  key={occ.id}
                  occurrence={occ}
                  onMarkPaid={handleMarkPaid}
                  paying={paying}
                  justPaid={justPaid}
                />
              ))}
            </div>
          )}
        </div>

        {/* Donut Chart Panel */}
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
          <h3 className="text-base font-semibold text-on-surface mb-1">Visão Geral</h3>
          <p className="text-xs text-on-surface-variant mb-5">Distribuição por status</p>

          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-full shimmer-bg" />
              <div className="space-y-2 w-full">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 shimmer-bg rounded" />
                ))}
              </div>
            </div>
          ) : (
            <DonutChart
              paid={stats?.paid_count ?? 0}
              pending={stats?.pending_count ?? 0}
              overdue={stats?.overdue_count ?? 0}
            />
          )}

          {!loading && stats && (
            <div className="mt-5 pt-4 border-t border-outline-variant/30 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Total pendente</span>
                <span className="font-semibold text-yellow-400">
                  {formatBRL(stats.monthly_pending_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Total atrasado</span>
                <span className="font-semibold text-error">
                  {formatBRL(stats.monthly_overdue_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Total pago</span>
                <span className="font-semibold text-tertiary">
                  {formatBRL(stats.monthly_paid_amount)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
