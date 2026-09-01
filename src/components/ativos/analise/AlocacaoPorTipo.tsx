import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { FatiaAlocacao } from '../../../utils/assetAnalytics'
import { rotuloTipo } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

// Cores dos tokens do design system: primary, tertiary e o amarelo de destaque
// já usado nos StatCards de vencimento.
const CORES: Record<string, string> = {
  stock: '#c0c1ff',
  fii: '#7fd8a0',
  crypto: '#facc15',
}

export const AlocacaoPorTipo: React.FC<{ fatias: FatiaAlocacao[] }> = ({ fatias }) => {
  if (fatias.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Alocação</h3>
        <p className="text-sm text-on-surface-variant">Nenhuma posição com cotação para alocar.</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Alocação por tipo</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={fatias} dataKey="valor" nameKey="kind" innerRadius={38} outerRadius={62} stroke="none">
                {fatias.map((f) => (
                  <Cell key={f.kind} fill={CORES[f.kind]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(valor: any) => `R$ ${formatBRL(Number(valor))}`}
                contentStyle={{ background: '#1f1f25', border: 'none', borderRadius: 12, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 min-w-0">
          {fatias.map((f) => (
            <li key={f.kind} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CORES[f.kind] }} />
              <span className="text-on-surface flex-1 truncate">{rotuloTipo(f.kind)}</span>
              <span className="text-on-surface-variant text-xs">{f.pct.toFixed(0)}%</span>
              <span className="text-on-surface font-semibold text-xs">R$ {formatBRL(f.valor)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
