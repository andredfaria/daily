import React from 'react'
import type { Checklist, ChecklistStatsEntry } from '../../types'
import { RECURRENCE_LABELS, DAYS_LABELS } from './constants'

interface ChecklistCardProps {
  checklist: Checklist
  stats?: ChecklistStatsEntry
  onEdit: (c: Checklist) => void
  onDelete: (c: Checklist) => void
  onClearHistory: (c: Checklist) => void
  onSendNow: (c: Checklist) => void
  sending: boolean
}

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <div className="text-sm font-bold text-on-surface">{value}</div>
    <div className="text-[10px] text-on-surface-variant">{label}</div>
  </div>
)

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, stats, onEdit, onDelete, onClearHistory, onSendNow, sending }) => {
  const recLabel = RECURRENCE_LABELS[checklist.recurrence_type] ?? 'Todos os dias'
  const customDays = checklist.recurrence_type === 'custom' && checklist.recurrence_days
    ? checklist.recurrence_days.map((d) => DAYS_LABELS[d]).join(', ')
    : null

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-on-surface truncate">{checklist.name}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {checklist.items.length} itens · às <strong>{String(checklist.send_time).padStart(2, '0')}h</strong>
          </p>
          <p className="text-xs text-on-surface-variant">
            {customDays ?? recLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onSendNow(checklist)}
            disabled={sending}
            title="Enviar agora"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {sending ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base">send</span>
            )}
          </button>
          <button
            onClick={() => onEdit(checklist)}
            title="Editar"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={() => onClearHistory(checklist)}
            title="Limpar histórico"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
          </button>
          <button
            onClick={() => onDelete(checklist)}
            title="Excluir"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-around py-3 mb-3 rounded-xl bg-surface-container/60 border border-outline-variant/30">
        <MiniStat label="Semana" value={stats ? `${stats.week_count}/7` : '–/7'} />
        <MiniStat label="Mês" value={stats ? `${stats.month_count}/30` : '–/30'} />
        <MiniStat label="Total" value={stats ? `${stats.total_count}` : '0'} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {checklist.items.slice(0, 4).map((item) => (
          <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            {item.text}
          </span>
        ))}
        {checklist.items.length > 4 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            +{checklist.items.length - 4} mais
          </span>
        )}
      </div>
    </div>
  )
}
