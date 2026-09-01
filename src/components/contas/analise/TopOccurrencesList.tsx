import React from 'react'
import type { OcorrenciaTop } from '../../../types'
import { formatBRL, formatDate, getBillIcon } from '../../../utils/format'

interface TopOccurrencesListProps {
  occurrences: OcorrenciaTop[]
  loading: boolean
}

export const TopOccurrencesList: React.FC<TopOccurrencesListProps> = ({ occurrences, loading }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
    <h2 className="text-base font-semibold text-on-surface mb-4">Maiores contas do mês</h2>
    {loading ? (
      <p className="text-sm text-on-surface-variant">Carregando…</p>
    ) : occurrences.length === 0 ? (
      <p className="text-sm text-on-surface-variant">Nenhuma conta neste período.</p>
    ) : (
      <ul className="space-y-3">
        {occurrences.map((o) => (
          <li key={o.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">{getBillIcon(o.bill_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">{o.bill_name}</p>
              <p className="text-xs text-on-surface-variant">{formatDate(o.due_date)}</p>
            </div>
            <span className="text-sm font-bold text-on-surface flex-shrink-0">{formatBRL(o.amount)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
