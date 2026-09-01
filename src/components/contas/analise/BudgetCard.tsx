import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { BudgetResponse } from '../../../types'
import { formatBRL } from '../../../utils/format'
import { RadialGauge } from './RadialGauge'

interface BudgetCardProps {
  data: BudgetResponse | null
  loading: boolean
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ data, loading }) => {
  const navigate = useNavigate()

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <h2 className="text-base font-semibold text-on-surface mb-4">Orçamento do mês</h2>
      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : !data ? (
        <p className="text-sm text-on-surface-variant">Erro ao carregar orçamento.</p>
      ) : data.orcamento === null ? (
        <div>
          <p className="text-2xl font-bold text-on-surface mb-1">{formatBRL(data.total)}</p>
          <p className="text-sm text-on-surface-variant mb-4">gastos neste mês</p>
          <button
            onClick={() => navigate('/configuracoes')}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Definir limite mensal →
          </button>
        </div>
      ) : (
        (() => {
          const overBudget = data.total > data.orcamento
          const pct = data.orcamento > 0
            ? Math.round((data.total / data.orcamento) * 100)
            : (data.total > 0 ? 100 : 0)
          return (
            <div className="flex items-center gap-5">
              <RadialGauge pct={pct} color={overBudget ? '#ffb4ab' : '#c0c1ff'}>
                <span className={`text-lg font-bold ${overBudget ? 'text-error' : 'text-on-surface'}`}>{pct}%</span>
                <span className="text-[10px] text-on-surface-variant">gasto</span>
              </RadialGauge>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-xl font-bold text-on-surface">{formatBRL(data.total)}</span>
                  <span className="text-xs text-on-surface-variant">de {formatBRL(data.orcamento)}</span>
                </div>
                <p className={`text-xs mt-1.5 ${overBudget ? 'text-error' : 'text-on-surface-variant'}`}>
                  {overBudget
                    ? `${formatBRL(data.total - data.orcamento)} acima do limite`
                    : `${formatBRL(data.orcamento - data.total)} restantes`}
                </p>
              </div>
            </div>
          )
        })()
      )}
    </div>
  )
}
