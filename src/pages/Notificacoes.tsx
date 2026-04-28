import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { notificationsApi } from '../api/notifications'
import type { NotificationEnriched, NotificationStatus } from '../types'
import { formatBRL, formatDate, getBillIcon } from '../utils/format'
import { useToast } from '../context/ToastContext'
import { SkeletonRow } from '../components/ui/Skeleton'

type Tab = 'upcoming' | 'history'
type HistoryFilter = 'all' | 'sent' | 'failed' | 'skipped'

const historyFilters: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sent', label: 'Enviados' },
  { value: 'failed', label: 'Falhas' },
  { value: 'skipped', label: 'Ignorados' },
]

// --- Status config ---
const statusConfig: Record<NotificationStatus, { icon: string; label: string; color: string; bg: string }> = {
  scheduled: { icon: 'schedule', label: 'Agendado', color: 'text-on-surface-variant', bg: 'bg-outline/10' },
  sent: { icon: 'check_circle', label: 'Enviado', color: 'text-tertiary', bg: 'bg-tertiary/10' },
  failed: { icon: 'cancel', label: 'Falha', color: 'text-error', bg: 'bg-error/10' },
  skipped: { icon: 'skip_next', label: 'Ignorado', color: 'text-on-surface-variant', bg: 'bg-outline/10' },
}

// --- Upcoming row ---
interface UpcomingRowProps {
  notif: NotificationEnriched
  isResending: boolean
  onResend: (id: string) => void
}

const UpcomingRow: React.FC<UpcomingRowProps> = ({ notif, isResending, onResend }) => {
  const icon = getBillIcon(notif.bill_name)
  const sendDate = parseISO(notif.scheduled_for)
  const sendToday = isToday(sendDate)
  const sendLabel = sendToday ? 'Hoje' : formatDate(notif.scheduled_for)

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/20 bg-surface-container/40 hover:bg-surface-container transition-all duration-200">
      {/* Left bar */}
      <div className={`w-1 h-12 rounded-full flex-shrink-0 ${sendToday ? 'bg-primary' : 'bg-outline/40'}`} />

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{notif.bill_name}</p>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5">
          <span>Vence: {formatDate(notif.due_date)}</span>
          <span className="text-outline">·</span>
          <span className={sendToday ? 'text-primary font-semibold' : ''}>
            Envio: {sendLabel}
          </span>
        </div>
      </div>

      {/* Amount */}
      <p className="text-sm font-bold text-on-surface flex-shrink-0 hidden sm:block">
        {formatBRL(notif.amount)}
      </p>

      {/* Action */}
      <button
        onClick={() => onResend(notif.id)}
        disabled={isResending}
        className="btn-ghost text-xs flex-shrink-0 py-1.5 px-3"
      >
        {isResending ? (
          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">send</span>
            Enviar Agora
          </>
        )}
      </button>
    </div>
  )
}

// --- History row ---
interface HistoryRowProps {
  notif: NotificationEnriched
  isResending: boolean
  onResend: (id: string) => void
}

const HistoryNotifRow: React.FC<HistoryRowProps> = ({ notif, isResending, onResend }) => {
  const icon = getBillIcon(notif.bill_name)
  const cfg = statusConfig[notif.status]

  const leftBarColor =
    notif.status === 'sent'
      ? 'bg-tertiary'
      : notif.status === 'failed'
      ? 'bg-error'
      : 'bg-outline/30'

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/20 bg-surface-container/40 hover:bg-surface-container transition-all duration-200">
      {/* Left bar */}
      <div className={`w-1 h-12 rounded-full flex-shrink-0 ${leftBarColor}`} />

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-on-surface truncate">{notif.bill_name}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span>Vence: {formatDate(notif.due_date)}</span>
          {notif.sent_at && (
            <>
              <span className="text-outline">·</span>
              <span>Enviado: {format(parseISO(notif.sent_at), "dd/MM HH:mm")}</span>
            </>
          )}
          {notif.status === 'failed' && notif.error_detail && (
            <>
              <span className="text-outline">·</span>
              <span className="text-error truncate max-w-[200px]" title={notif.error_detail}>
                {notif.error_detail}
              </span>
            </>
          )}
          {notif.status === 'skipped' && (
            <>
              <span className="text-outline">·</span>
              <span>Conta já paga/cancelada</span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <p className="text-sm font-bold text-on-surface flex-shrink-0 hidden sm:block">
        {formatBRL(notif.amount)}
      </p>

      {/* Status badge */}
      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
          {cfg.icon}
        </span>
        {cfg.label}
      </span>

      {/* Reenviar (only for failed) */}
      {notif.status === 'failed' && (
        <button
          onClick={() => onResend(notif.id)}
          disabled={isResending}
          className="btn-ghost text-xs flex-shrink-0 py-1.5 px-3"
        >
          {isResending ? (
            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">refresh</span>
              Reenviar
            </>
          )}
        </button>
      )}
    </div>
  )
}

// --- Month group for history ---
interface MonthGroup {
  key: string
  label: string
  date: Date
  items: NotificationEnriched[]
}

// --- Main page ---
const Notificacoes: React.FC = () => {
  const [tab, setTab] = useState<Tab>('upcoming')

  const [upcoming, setUpcoming] = useState<NotificationEnriched[]>([])
  const [history, setHistory] = useState<NotificationEnriched[]>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [resendingId, setResendingId] = useState<string | null>(null)

  const { success, error: showError } = useToast()

  const fetchUpcoming = useCallback(async () => {
    try {
      setLoadingUpcoming(true)
      const data = await notificationsApi.listEnriched({ upcoming: true })
      setUpcoming(data)
    } catch {
      showError('Erro ao carregar próximos envios.')
    } finally {
      setLoadingUpcoming(false)
    }
  }, [showError])

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true)
      const data = await notificationsApi.listEnriched({ history: true })
      setHistory(data)
    } catch {
      showError('Erro ao carregar histórico de envios.')
    } finally {
      setLoadingHistory(false)
    }
  }, [showError])

  useEffect(() => {
    fetchUpcoming()
    fetchHistory()
  }, [fetchUpcoming, fetchHistory])

  const handleResend = useCallback(async (id: string) => {
    setResendingId(id)
    try {
      const { result } = await notificationsApi.resend(id)
      if (result === 'sent') {
        success('Notificação enviada com sucesso!')
      } else if (result === 'skipped') {
        success('Notificação ignorada — conta já paga ou cancelada.')
      } else {
        showError('Falha ao enviar notificação. Verifique a conexão WAHA.')
      }
      // Refresh ambas as listas para refletir o novo estado
      await Promise.all([fetchUpcoming(), fetchHistory()])
    } catch (err: any) {
      const detail = err.response?.data?.error ?? err.message ?? 'Erro desconhecido.'
      showError(`Erro: ${detail}`)
    } finally {
      setResendingId(null)
    }
  }, [fetchUpcoming, fetchHistory, success, showError])

  // Filtrar histórico client-side
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history
    return history.filter((n) => n.status === historyFilter)
  }, [history, historyFilter])

  // Agrupar histórico por mês de scheduled_for
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const sorted = [...filteredHistory].sort(
      (a, b) => parseISO(b.scheduled_for).getTime() - parseISO(a.scheduled_for).getTime()
    )

    const groups: Record<string, MonthGroup> = {}
    sorted.forEach((n) => {
      const d = parseISO(n.scheduled_for)
      const key = format(d, 'yyyy-MM')
      if (!groups[key]) {
        groups[key] = {
          key,
          label: format(startOfMonth(d), "MMMM yyyy", { locale: ptBR }),
          date: startOfMonth(d),
          items: [],
        }
      }
      groups[key].items.push(n)
    })

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [filteredHistory])

  // Counts para badges nas tabs
  const upcomingCount = upcoming.length
  const failedCount = history.filter((n) => n.status === 'failed').length

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Notificações WhatsApp</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Acompanhe e gerencie os envios de lembretes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container rounded-xl w-fit">
        <TabButton
          active={tab === 'upcoming'}
          onClick={() => setTab('upcoming')}
          icon="schedule_send"
          label="Próximos Envios"
          count={upcomingCount > 0 ? upcomingCount : undefined}
          countColor="bg-primary text-on-primary-fixed"
        />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          icon="history"
          label="Histórico"
          count={failedCount > 0 ? failedCount : undefined}
          countColor="bg-error text-white"
        />
      </div>

      {/* Tab: Próximos Envios */}
      {tab === 'upcoming' && (
        <div className="space-y-3">
          {loadingUpcoming ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="notifications_off"
              title="Nenhum envio agendado"
              description="Não há notificações pendentes. Novas são geradas automaticamente quando contas se aproximam do vencimento."
            />
          ) : (
            <>
              <p className="text-xs text-on-surface-variant">
                {upcomingCount} notificaç{upcomingCount === 1 ? 'ão agendada' : 'ões agendadas'} para envio automático
              </p>
              <div className="space-y-2">
                {upcoming.map((notif) => (
                  <UpcomingRow
                    key={notif.id}
                    notif={notif}
                    isResending={resendingId === notif.id}
                    onResend={handleResend}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Histórico */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {historyFilters.map((f) => {
              const count = f.value === 'all' ? history.length : history.filter((n) => n.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setHistoryFilter(f.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                    ${historyFilter === f.value
                      ? 'bg-primary text-on-primary-fixed shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }
                  `}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      historyFilter === f.value ? 'bg-white/20 text-white' : 'bg-outline/15 text-on-surface-variant'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {loadingHistory ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-5 shimmer-bg rounded w-28 mb-3" />
                  {Array.from({ length: 3 }).map((_, j) => <SkeletonRow key={j} />)}
                </div>
              ))}
            </div>
          ) : monthGroups.length === 0 ? (
            <EmptyState
              icon="mark_email_unread"
              title="Nenhum envio encontrado"
              description={historyFilter === 'all' ? 'Ainda não há histórico de envios.' : `Nenhum envio com status "${historyFilters.find(f => f.value === historyFilter)?.label}".`}
            />
          ) : (
            <div className="space-y-8">
              {monthGroups.map((group) => {
                const sentCount = group.items.filter((n) => n.status === 'sent').length
                const failedCount = group.items.filter((n) => n.status === 'failed').length
                return (
                  <div key={group.key}>
                    {/* Month header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-on-surface capitalize">{group.label}</h3>
                      <div className="flex items-center gap-3 text-xs">
                        {sentCount > 0 && (
                          <span className="text-tertiary font-semibold">{sentCount} enviado{sentCount > 1 ? 's' : ''}</span>
                        )}
                        {failedCount > 0 && (
                          <span className="text-error font-semibold">{failedCount} falha{failedCount > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2">
                      {group.items.map((notif) => (
                        <HistoryNotifRow
                          key={notif.id}
                          notif={notif}
                          isResending={resendingId === notif.id}
                          onResend={handleResend}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Helper components ---

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  count?: number
  countColor?: string
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, count, countColor }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
      ${active
        ? 'bg-surface-container-high text-on-surface shadow-sm'
        : 'text-on-surface-variant hover:text-on-surface'
      }
    `}
  >
    <span className="material-symbols-outlined text-base">{icon}</span>
    {label}
    {count !== undefined && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countColor}`}>
        {count}
      </span>
    )}
  </button>
)

interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-16 text-center">
    <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
      {icon}
    </span>
    <h3 className="text-base font-semibold text-on-surface mb-2">{title}</h3>
    <p className="text-sm text-on-surface-variant">{description}</p>
  </div>
)

export default Notificacoes
