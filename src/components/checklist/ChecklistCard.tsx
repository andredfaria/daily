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
  onReactivate: (c: Checklist) => void
  sending: boolean
}

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <div className="text-sm font-bold text-on-surface tabular-nums">{value}</div>
    <div className="text-[11px] text-on-surface-variant">{label}</div>
  </div>
)

// Mesmo desenho dos botões de ação do card de Contas: 44px de área de toque.
const ACAO = 'w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant cursor-pointer disabled:opacity-40'

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, stats, onEdit, onDelete, onClearHistory, onSendNow, onReactivate, sending }) => {
  const recLabel = RECURRENCE_LABELS[checklist.recurrence_type] ?? 'Todos os dias'
  const customDays = checklist.recurrence_type === 'custom' && checklist.recurrence_days
    ? checklist.recurrence_days.map((d) => DAYS_LABELS[d]).join(', ')
    : null
  const ativo = checklist.is_active

  return (
    <div
      className={`glass-card rounded-2xl border p-5 transition-all duration-200 ${
        ativo ? 'border-outline-variant/50 hover:border-primary/30' : 'border-outline-variant/20'
      }`}
    >
      {/* Identidade + ações */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-primary/15' : 'bg-outline/15'}`}>
          <span className={`material-symbols-outlined text-lg ${ativo ? 'text-primary' : 'text-outline'}`}>checklist</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-on-surface leading-tight truncate pt-2" title={checklist.name}>
              {checklist.name}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 -mt-1 -mr-1.5">
              <button onClick={() => onEdit(checklist)} className={`${ACAO} hover:text-primary`} title="Editar" aria-label="Editar checklist">
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button onClick={() => onClearHistory(checklist)} className={`${ACAO} hover:text-error`} title="Limpar histórico" aria-label="Limpar histórico do checklist">
                <span className="material-symbols-outlined text-base">restart_alt</span>
              </button>
              <button onClick={() => onDelete(checklist)} className={`${ACAO} hover:text-error`} title="Excluir" aria-label="Excluir checklist">
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {checklist.items.length} {checklist.items.length === 1 ? 'item' : 'itens'} · às{' '}
            {String(checklist.send_time).padStart(2, '0')}h
          </p>
        </div>
      </div>

      {/* Selos */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {customDays ?? recLabel}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
          ativo ? 'bg-tertiary/15 text-tertiary' : 'bg-outline/15 text-outline'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ativo ? 'bg-tertiary' : 'bg-outline'}`} />
          {ativo ? 'Ativo' : 'Pausado'}
        </span>
      </div>

      {/* Frequência de resposta */}
      <div className={`flex items-center justify-around py-3 mt-4 rounded-xl bg-surface-container/60 border border-outline-variant/30 ${ativo ? '' : 'opacity-60'}`}>
        <MiniStat label="Semana" value={stats ? `${stats.week_count}/7` : '–/7'} />
        <MiniStat label="Mês" value={stats ? `${stats.month_count}/30` : '–/30'} />
        <MiniStat label="Total" value={stats ? `${stats.total_count}` : '0'} />
      </div>

      {/* Itens */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {checklist.items.slice(0, 4).map((item) => (
          <span key={item.id} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant max-w-full truncate">
            {item.text}
          </span>
        ))}
        {checklist.items.length > 4 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant">
            +{checklist.items.length - 4} mais
          </span>
        )}
      </div>

      {/* Ação principal: pausado reativa, ativo envia agora */}
      <div className="mt-4 pt-3 border-t border-outline-variant/30">
        {ativo ? (
          <button onClick={() => onSendNow(checklist)} disabled={sending} className="btn-ghost text-sm w-full justify-center min-h-[44px]">
            {sending ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">send</span>
            )}
            Enviar agora
          </button>
        ) : (
          <button onClick={() => onReactivate(checklist)} className="btn-ghost text-sm w-full justify-center min-h-[44px] text-tertiary">
            <span className="material-symbols-outlined text-lg">play_circle</span>
            Reativar
          </button>
        )}
      </div>
    </div>
  )
}
