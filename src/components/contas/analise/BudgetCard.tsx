import React from 'react'
import type { BudgetResponse } from '../../../types'
import { formatBRL } from '../../../utils/format'

interface BudgetCardProps {
  data: BudgetResponse | null
  loading: boolean
}

// Contas não têm limite (só gastos avulsos têm, na página de Gastos): o card
// mostra apenas o total do mês.
export const BudgetCard: React.FC<BudgetCardProps> = ({ data, loading }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5">
    <h2 className="text-base font-semibold text-on-surface mb-4">Contas do mês</h2>
    {loading ? (
      <p className="text-sm text-on-surface-variant">Carregando…</p>
    ) : !data ? (
      <p className="text-sm text-on-surface-variant">Erro ao carregar contas do mês.</p>
    ) : (
      <div>
        <p className="text-2xl font-bold text-on-surface mb-1">{formatBRL(data.total)}</p>
        <p className="text-sm text-on-surface-variant">
          em {data.qtdContas} {data.qtdContas === 1 ? 'vencimento' : 'vencimentos'} neste mês
        </p>
      </div>
    )}
  </div>
)
