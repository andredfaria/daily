import React from 'react'
import type { ResultadoAtivo } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

// Barra divergente: a maior variação absoluta da lista define a escala, para
// que a menor não vire um traço invisível quando há um destaque muito grande.
export const ResultadoPorAtivo: React.FC<{ resultados: ResultadoAtivo[] }> = ({ resultados }) => {
  if (resultados.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Resultado por ativo</h3>
        <p className="text-sm text-on-surface-variant">Nenhuma posição com cotação para comparar.</p>
      </div>
    )
  }

  const escala = Math.max(...resultados.map((r) => Math.abs(r.resultadoPct)), 1)

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Resultado por ativo</h3>
      <ul className="space-y-3">
        {resultados.map((r) => {
          const positivo = r.resultado >= 0
          const largura = (Math.abs(r.resultadoPct) / escala) * 50
          return (
            <li key={r.ticker} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">{r.ticker}</span>
                <span className={positivo ? 'text-tertiary' : 'text-error'}>
                  {positivo ? '+' : '−'}R$ {formatBRL(Math.abs(r.resultado))} ({positivo ? '+' : '−'}{Math.abs(r.resultadoPct).toFixed(1)}%)
                </span>
              </div>
              <div className="relative h-2 bg-surface-container rounded-full">
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant" />
                <span
                  className={`absolute top-0 bottom-0 rounded-full ${positivo ? 'bg-tertiary' : 'bg-error'}`}
                  style={positivo
                    ? { left: '50%', width: `${largura}%` }
                    : { right: '50%', width: `${largura}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
