import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { occurrencesApi } from '../api/occurrences'
import type { BillOccurrence } from '../types'
import {
  formatBRL,
  formatDate,
  getBillIcon,
  getRecurrenceShortLabel,
} from '../utils/format'
import { SkeletonRow } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'

interface OccurrenceRowProps {
  occurrence: BillOccurrence
  animateRow: boolean
}

const HistoryRow: React.FC<OccurrenceRowProps> = ({ occurrence, animateRow }) => {
  const icon = getBillIcon(occurrence.bill?.name ?? '')
  const recurrenceLabel = occurrence.bill
    ? getRecurrenceShortLabel(occurrence.bill.recurrence_type)
    : null

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-xl border border-outline-variant/20
        bg-surface-container/40 hover:bg-surface-container
        transition-all duration-200 hover:translate-x-0.5 group
        ${animateRow ? 'animate-slideIn' : ''}
      `}
    >
      <div className="w-1 h-12 rounded-full flex-shrink-0 bg-primary/40" />
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-on-surface truncate">
            {occurrence.bill?.name ?? 'Conta removida'}
          </p>
          {recurrenceLabel && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0">
              {recurrenceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span>Vence: {formatDate(occurrence.due_date)}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-on-surface">{formatBRL(occurrence.amount)}</p>
      </div>
    </div>
  )
}

interface MonthGroup {
  key: string
  label: string
  date: Date
  occurrences: BillOccurrence[]
  totalAmount: number
}

const Historico: React.FC = () => {
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [animatedRows, _setAnimatedRows] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const { error: showError, success: showSuccess } = useToast()
  const navigate = useNavigate()

  const fetchOccurrences = useCallback(async () => {
    try {
      setLoading(true)
      const data = await occurrencesApi.list({ limit: 200 })
      setOccurrences(data)
    } catch {
      showError('Erro ao carregar histórico. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  const handleExport = async () => {
    setExporting(true)
    try {
      await occurrencesApi.exportCsv({
        from: selectedMonth ? `${selectedMonth}-01` : undefined,
        to: selectedMonth
          ? format(endOfMonth(parseISO(`${selectedMonth}-01`)), 'yyyy-MM-dd')
          : undefined,
      })
      showSuccess('CSV exportado com sucesso')
    } catch {
      showError('Erro ao exportar CSV')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    fetchOccurrences()
  }, [fetchOccurrences])

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const filtered = occurrences.filter((o) => {
      const searchMatch =
        !search ||
        o.bill?.name?.toLowerCase().includes(search.toLowerCase())

      const monthMatch = !selectedMonth || (() => {
        const d = parseISO(o.due_date)
        return format(d, 'yyyy-MM') === selectedMonth
      })()

      return searchMatch && monthMatch
    })

    const sorted = [...filtered].sort(
      (a, b) => parseISO(b.due_date).getTime() - parseISO(a.due_date).getTime(),
    )

    const groups: Record<string, MonthGroup> = {}

    sorted.forEach((o) => {
      const d = parseISO(o.due_date)
      const key = format(d, 'yyyy-MM')
      if (!groups[key]) {
        groups[key] = {
          key,
          label: format(startOfMonth(d), "MMMM yyyy", { locale: ptBR }),
          date: startOfMonth(d),
          occurrences: [],
          totalAmount: 0,
        }
      }
      groups[key].occurrences.push(o)
      groups[key].totalAmount += o.amount
    })

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [occurrences, search, selectedMonth])

  const availableMonths = useMemo(() => {
    const months = new Set(
      occurrences.map((o) => format(parseISO(o.due_date), 'yyyy-MM')),
    )
    return Array.from(months)
      .sort()
      .reverse()
      .map((m) => ({
        value: m,
        label: format(
          new Date(m + '-01'),
          "MMM yyyy",
          { locale: ptBR },
        ),
      }))
  }, [occurrences])

  const totalFiltered = monthGroups.reduce((s, g) => s + g.occurrences.length, 0)

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Histórico de Vencimentos</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">{totalFiltered} registros encontrados</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-surface-container border border-outline-variant/50 text-on-surface-variant
            hover:text-on-surface hover:bg-surface-container-high
            active:scale-95 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {exporting ? (
            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-base">download</span>
          )}
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-base">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome da conta..."
              className="input-field pl-10"
            />
          </div>

          {/* Month picker */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">Todos os meses</option>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-6 shimmer-bg rounded w-32 mb-3" />
              {Array.from({ length: 3 }).map((_, j) => (
                <SkeletonRow key={j} />
              ))}
            </div>
          ))}
        </div>
      ) : monthGroups.length === 0 ? (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            history
          </span>
          <h3 className="text-base font-semibold text-on-surface mb-2">Nenhum registro encontrado</h3>
          <p className="text-sm text-on-surface-variant">
            Tente ajustar os filtros ou adicione novas contas.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthGroups.map((group) => (
            <div key={group.key}>
              {/* Month Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-on-surface capitalize">
                  {group.label}
                </h3>
                <span className="text-xs text-on-surface-variant font-semibold">
                  {formatBRL(group.totalAmount)}
                </span>
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {group.occurrences.map((occ) => (
                  <HistoryRow
                    key={occ.id}
                    occurrence={occ}
                    animateRow={animatedRows.has(occ.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/contas/nova')}
        className="
          fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary shadow-xl
          flex items-center justify-center text-on-primary-fixed
          hover:brightness-110 active:scale-95 transition-all duration-200
          shadow-[0_0_20px_rgba(192,193,255,0.3)]
        "
      >
        <span className="material-symbols-outlined text-xl">add</span>
      </button>
    </div>
  )
}

export default Historico
