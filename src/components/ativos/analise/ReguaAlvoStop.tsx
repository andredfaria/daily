import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssetWithQuote } from '../../../types'
import { progressoAlvoStop } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

export const ReguaAlvoStop: React.FC<{ ativos: AssetWithQuote[] }> = ({ ativos }) => {
  const navigate = useNavigate()
  const comLimite = ativos.filter((a) => a.target_price !== null || a.stop_price !== null)
  const semLimite = ativos.length - comLimite.length

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Alvo e stop</h3>

      {comLimite.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum ativo com alvo ou stop definido.</p>
      ) : (
        <ul className="space-y-4">
          {comLimite.map((a) => {
            const progresso = progressoAlvoStop(a)
            const disparado = a.target_triggered_at !== null || a.stop_triggered_at !== null
            return (
              <li key={a.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">{a.ticker}</span>
                  <span className="text-on-surface-variant">
                    {a.current_price !== null ? `R$ ${formatBRL(a.current_price)}` : 'sem cotação'}
                    {disparado && <span className="ml-2 text-yellow-400">· alerta pausado</span>}
                  </span>
                </div>

                {progresso !== null ? (
                  <>
                    <div className="relative h-2 bg-surface-container rounded-full">
                      <span
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background"
                        style={{ left: `${progresso}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-on-surface-variant">
                      <span>stop R$ {formatBRL(a.stop_price!)}</span>
                      <span>alvo R$ {formatBRL(a.target_price!)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-on-surface-variant">
                    {a.target_price !== null ? `alvo R$ ${formatBRL(a.target_price)}` : `stop R$ ${formatBRL(a.stop_price!)}`}
                    {' · '}defina os dois limites para ver a régua
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {semLimite > 0 && (
        <button
          onClick={() => navigate('/ativos/carteira')}
          className="mt-4 text-xs text-primary hover:text-primary/80 font-medium min-h-[44px]"
        >
          {semLimite} {semLimite === 1 ? 'ativo sem alvo definido' : 'ativos sem alvo definido'} → definir
        </button>
      )}
    </div>
  )
}
