import React from 'react'
import type { ChecklistItemStat } from '../../types'

interface ChecklistItemRankingProps {
  itemStats: ChecklistItemStat[]
}

export const ChecklistItemRanking: React.FC<ChecklistItemRankingProps> = ({ itemStats }) => {
  if (!itemStats.length) return null

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-1">Ranking de Itens</h3>
      <p className="text-xs text-on-surface-variant mb-4">Taxa de conclusão de cada item nos últimos 30 dias</p>
      <div className="space-y-3">
        {itemStats.map((stat) => (
          <div key={stat.text} className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface w-32 flex-shrink-0 truncate" title={stat.text}>{stat.text}</span>
              {stat.total_polls === 0 ? (
                <span className="text-xs text-on-surface-variant italic">sem dados ainda</span>
              ) : (
                <>
                  <div className="flex-1 h-2.5 rounded-full bg-outline-variant/30 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ${stat.pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
                      style={{ width: `${Math.min(stat.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant w-10 text-right">{stat.pct}%</span>
                </>
              )}
            </div>
            {(stat.streak_current > 0 || stat.streak_best > 0) && (
              <p className="text-[11px] text-on-surface-variant pl-[8.75rem]">
                🔥 {stat.streak_current} {stat.streak_current === 1 ? 'dia' : 'dias'}
                {stat.streak_current !== stat.streak_best && ` · recorde ${stat.streak_best}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
