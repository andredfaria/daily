import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { BudgetResponse } from '../../types'
import { formatBRL } from '../../utils/format'

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
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold text-on-surface">{formatBRL(data.total)}</span>
            <span className="text-sm text-on-surface-variant">de {formatBRL(data.orcamento)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-outline-variant/30 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                data.total > data.orcamento ? 'bg-error' : 'bg-primary'
              }`}
              style={{
                width: `${
                  data.orcamento > 0
                    ? Math.min((data.total / data.orcamento) * 100, 100)
                    : (data.total > 0 ? 100 : 0)
                }%`,
              }}
            />
          </div>
          <p className={`text-xs mt-2 ${data.total > data.orcamento ? 'text-error' : 'text-on-surface-variant'}`}>
            {data.total > data.orcamento
              ? `${formatBRL(data.total - data.orcamento)} acima do limite`
              : `${formatBRL(data.orcamento - data.total)} restantes`}
          </p>
        </div>
      )}
    </div>
  )
}
